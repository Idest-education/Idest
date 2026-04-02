"""
Build neutral chart descriptions for IELTS Task 1 (academic) using a local VLM via Ollama.

Loads a Hugging Face dataset with image + prompt per row, validates images, calls Ollama,
and writes resume-safe Parquet output keyed by row_index.

Default model is a very small VLM (see DEFAULT_OLLAMA_MODEL). Override with TASK1_VLM_OLLAMA_MODEL or --ollama-model
(e.g. llava-phi3 or llava if charts need more readable small text).
"""

from __future__ import annotations

import argparse
import hashlib
import io
import logging
import os
import signal
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from datasets import load_dataset
from ollama import Client, ResponseError
from PIL import Image

from ielts_ai.paths import APPS_AI_DIR

logger = logging.getLogger(__name__)

DEFAULT_DATASET = "TraTacXiMuoi/Ielts_writing_task1_academic"
DEFAULT_OLLAMA_HOST = "http://127.0.0.1:11434"
# ~1.8B; minimal VRAM/RAM. Weaker on tiny chart labels than llava-phi3/llava—override if quality drops.
DEFAULT_OLLAMA_MODEL = "moondream"
DEFAULT_TIMEOUT = 300.0
DEFAULT_MAX_RETRIES = 3

PARQUET_COLUMNS = [
    "row_index",
    "prompt_sha256",
    "topic",
    "subject",
    "content",
    "image_description",
    "status",
    "error_message",
    "model",
    "updated_at",
]

SYSTEM_PROMPT = (
    "You describe IELTS Academic Task 1 visuals for downstream automated grading. "
    "The image may be a line/bar/pie chart, table, map, process or flow diagram, or several "
    "of these in one figure. Identify what is shown, then describe only what is visible in the image. "
    "Cover: a short overview of the visual type(s); for charts/tables—main trends, comparisons, "
    "or largest/smallest values where clear; for maps—spatial patterns or differences between areas "
    "if legible; for process diagrams—the stages or steps and their order; for multi-panel images—"
    "each part briefly if space allows. Quote key numbers, labels, units, dates, or categories "
    "only when they are clearly readable. If text is too small to read, say so instead of guessing. "
    "Do not evaluate any student writing. Do not give opinions or advice. "
    "Use clear English suitable for rubric-based scoring."
)


def _env_str(key: str, default: str) -> str:
    v = os.environ.get(key)
    return v if v is not None and v != "" else default


def _env_path(key: str, default: Path) -> Path:
    v = os.environ.get(key)
    return Path(v) if v else default


def normalize_subject_for_hash(subject: str) -> str:
    return " ".join(str(subject).strip().split())


def prompt_sha256(subject: str) -> str:
    return hashlib.sha256(normalize_subject_for_hash(subject).encode("utf-8")).hexdigest()


def get_image_bytes(img: Any) -> bytes | None:
    """Extract raw image bytes from a Hugging Face Image feature value."""
    if img is None:
        return None
    if isinstance(img, dict):
        b = img.get("bytes")
        if b:
            return bytes(b)
        p = img.get("path")
        if p:
            with open(p, "rb") as f:
                return f.read()
        return None
    if isinstance(img, Image.Image):
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    return None


def validate_image_bytes(image_bytes: bytes | None) -> tuple[bool, str | None]:
    """Return (ok, error_message)."""
    if not image_bytes:
        return False, "image_missing_or_empty"
    try:
        im = Image.open(io.BytesIO(image_bytes))
        im.load()
    except Exception as e:
        return False, f"image_decode_failed: {e}"
    return True, None


def load_existing_records(path: Path) -> dict[int, dict[str, Any]]:
    if not path.exists():
        return {}
    df = pd.read_parquet(path)
    if df.empty:
        return {}
    if "row_index" not in df.columns:
        return {}
    df = df.sort_values("updated_at").drop_duplicates(subset=["row_index"], keep="last")
    out: dict[int, dict[str, Any]] = {}
    for _, row in df.iterrows():
        rid = int(row["row_index"])
        rec: dict[str, Any] = {}
        for c in PARQUET_COLUMNS:
            if c not in df.columns:
                rec[c] = None
                continue
            val = row[c]
            rec[c] = None if pd.isna(val) else val
        out[rid] = rec
    return out


def records_to_dataframe(records: dict[int, dict[str, Any]]) -> pd.DataFrame:
    if not records:
        return pd.DataFrame(columns=PARQUET_COLUMNS)
    rows = [records[k] for k in sorted(records.keys())]
    return pd.DataFrame(rows).reindex(columns=PARQUET_COLUMNS)


def atomic_write_parquet(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(suffix=".parquet", dir=str(path.parent))
    os.close(fd)
    tmp_path = Path(tmp_name)
    try:
        df.to_parquet(tmp_path, index=False)
        os.replace(tmp_path, path)
    except Exception:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        raise


def should_process_row(
    row_index: int,
    existing: dict[int, dict[str, Any]],
    retry_failed: bool,
) -> bool:
    prev = existing.get(row_index)
    if prev is None:
        return True
    st = prev.get("status")
    if st == "ok":
        return False
    if st == "error":
        return retry_failed
    if st == "pending":
        return True
    return True


def check_prompt_alignment(
    row_index: int,
    subject: str,
    existing: dict[int, dict[str, Any]] | None,
) -> str | None:
    """Return warning string if stored hash disagrees with current HF row."""
    if not existing or row_index not in existing:
        return None
    prev = existing[row_index]
    old_h = prev.get("prompt_sha256")
    new_h = prompt_sha256(subject)
    if old_h and old_h != new_h:
        return (
            f"row_index={row_index}: prompt_sha256 mismatch "
            f"(stored={old_h[:12]}… vs hf={new_h[:12]}…); overwriting with HF row"
        )
    return None


def build_user_message(subject: str) -> str:
    return (
        "Task prompt (IELTS Writing Task 1):\n\n"
        f"{subject.strip()}\n\n"
        "Describe the visual(s) in the image according to the instructions above."
    )


def call_vlm(
    client: Client,
    model: str,
    subject: str,
    image_bytes: bytes,
    *,
    max_retries: int,
    options: dict[str, Any],
) -> tuple[str | None, str | None]:
    """Return (description, error_message)."""
    user_content = build_user_message(subject)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": user_content,
            "images": [image_bytes],
        },
    ]
    last_err: str | None = None
    for attempt in range(max_retries):
        try:
            resp = client.chat(
                model=model,
                messages=messages,
                options=options,
            )
            text = (resp.message.content or "").strip()
            if not text:
                last_err = "empty_model_response"
                continue
            return text, None
        except Exception as e:
            if isinstance(e, (KeyboardInterrupt, SystemExit)):
                raise
            if isinstance(e, ResponseError):
                last_err = f"ResponseError: {e}"
            else:
                last_err = f"{type(e).__name__}: {e}"
            if attempt < max_retries - 1:
                delay = min(60.0, 2.0**attempt)
                time.sleep(delay)
            continue
    return None, last_err or "vlm_failed"


def process_one_row(
    row_index: int,
    topic: str,
    subject: str,
    content: str | None,
    image_bytes: bytes | None,
    *,
    client: Client,
    model: str,
    max_retries: int,
    existing_before: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    now = pd.Timestamp(datetime.now(timezone.utc))
    ph = prompt_sha256(subject)
    base: dict[str, Any] = {
        "row_index": row_index,
        "prompt_sha256": ph,
        "topic": topic if topic is not None else "",
        "subject": subject,
        "content": content if content is not None else "",
        "image_description": "",
        "status": "error",
        "error_message": None,
        "model": model,
        "updated_at": now,
    }

    if not str(subject).strip():
        base["error_message"] = "empty_subject"
        return base

    ok_img, img_err = validate_image_bytes(image_bytes)
    if not ok_img:
        base["error_message"] = img_err
        return base

    warn = check_prompt_alignment(row_index, subject, existing_before)
    if warn:
        logger.warning("%s", warn)

    assert image_bytes is not None
    desc, err = call_vlm(
        client,
        model,
        subject,
        image_bytes,
        max_retries=max_retries,
        options={"temperature": 0, "num_predict": 1024},
    )
    if desc is not None:
        base["image_description"] = desc
        base["status"] = "ok"
        base["error_message"] = None
    else:
        base["error_message"] = err
    return base


def build_work_indices(
    n_rows: int,
    *,
    start_row: int | None,
    end_row: int | None,
    limit: int | None,
) -> list[int]:
    start = start_row if start_row is not None else 0
    end = end_row if end_row is not None else n_rows
    indices = list(range(max(0, start), min(n_rows, end)))
    if limit is not None:
        indices = indices[: max(0, limit)]
    return indices


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    default_out = _env_path("TASK1_VLM_OUTPUT", APPS_AI_DIR / "cache" / "task1_image_descriptions.parquet")
    p = argparse.ArgumentParser(description="Task 1 chart descriptions via Ollama VLM → Parquet")
    p.add_argument(
        "--dataset",
        default=_env_str("TASK1_VLM_DATASET", DEFAULT_DATASET),
        help="Hugging Face dataset id",
    )
    p.add_argument("--output", type=Path, default=default_out, help="Output Parquet path")
    p.add_argument(
        "--ollama-model",
        default=_env_str("TASK1_VLM_OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL),
        help="Ollama vision model name",
    )
    p.add_argument(
        "--ollama-host",
        default=_env_str("OLLAMA_HOST", DEFAULT_OLLAMA_HOST),
        help="Ollama API base URL",
    )
    p.add_argument("--timeout-seconds", type=float, default=DEFAULT_TIMEOUT, help="HTTP timeout per request")
    p.add_argument("--max-retries", type=int, default=DEFAULT_MAX_RETRIES, help="Retries per row for transient errors")
    p.add_argument("--limit", type=int, default=None, help="Max rows to process (after range filter)")
    p.add_argument("--start-row", type=int, default=None, help="First row index (inclusive)")
    p.add_argument("--end-row", type=int, default=None, help="End row index (exclusive)")
    p.add_argument(
        "--retry-failed",
        action="store_true",
        help="Re-run rows that previously ended with status error",
    )
    p.add_argument("-v", "--verbose", action="store_true", help="Debug logging")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(message)s")

    interrupt = False

    def _on_sigint(_signum: int, _frame: Any) -> None:
        nonlocal interrupt
        interrupt = True
        logger.warning("Interrupt received; finishing current row then exiting…")

    signal.signal(signal.SIGINT, _on_sigint)

    output_path: Path = args.output
    ds = load_dataset(
        args.dataset,
        split="train",
        columns=["topic", "subject", "image", "content"],
    )
    n_total = len(ds)
    work = build_work_indices(
        n_total,
        start_row=args.start_row,
        end_row=args.end_row,
        limit=args.limit,
    )
    to_do = []
    existing = load_existing_records(output_path)
    for idx in work:
        if should_process_row(idx, existing, args.retry_failed):
            to_do.append(idx)

    n_work = len(to_do)
    logger.info(
        "Dataset rows=%d | work queue=%d (after skip ok / resume) | output=%s",
        n_total,
        n_work,
        output_path,
    )
    if n_work == 0:
        return 0

    client = Client(host=args.ollama_host, timeout=args.timeout_seconds)
    t0 = time.perf_counter()
    processed = 0

    for row_index in to_do:
        if interrupt:
            logger.warning("Stopped early after interrupt (output already up to date for completed rows).")
            return 130

        row = ds[row_index]
        topic = row.get("topic") or ""
        subject = row.get("subject") or ""
        content = row.get("content")
        img_raw = row.get("image")
        image_bytes = get_image_bytes(img_raw)

        snap = dict(existing)
        rec = process_one_row(
            row_index,
            str(topic),
            str(subject),
            str(content) if content is not None else None,
            image_bytes,
            client=client,
            model=args.ollama_model,
            max_retries=args.max_retries,
            existing_before=snap,
        )
        existing[row_index] = rec
        df_out = records_to_dataframe(existing)
        atomic_write_parquet(df_out, output_path)

        processed += 1
        elapsed = time.perf_counter() - t0
        rate = processed / elapsed if elapsed > 0 else 0.0
        remaining = (n_work - processed) / rate if rate > 0 else float("nan")
        eta_s = f"{remaining:.0f}s" if remaining == remaining else "?"
        logger.info(
            "progress %d/%d | row_index=%d | status=%s | ETA ~%s",
            processed,
            n_work,
            row_index,
            rec["status"],
            eta_s,
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
