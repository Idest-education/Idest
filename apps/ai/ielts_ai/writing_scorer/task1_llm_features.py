"""
LLM-based Task 1 judgment features (1–5 ordinal scales).

Scores are model judgments on anchored rubrics, not official IELTS band scores.
Downstream models should treat them as numeric features only.

Environment (optional overrides; defaults in CLI):
  OLLAMA_HOST — Ollama API base URL (e.g. http://127.0.0.1:11434)
  TASK1_LLM_OLLAMA_MODEL — text model for structured JSON judgment (must exist locally: ollama pull <name>)

Stronger models (after pull) often judge more reliably than the default small model, e.g. llama3.1:8b, mistral, qwen2.5:7b.
"""

from __future__ import annotations

import hashlib
import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import pandas as pd
from ollama import Client
from pydantic import BaseModel, Field, ValidationError

from ielts_ai.paths import APPS_AI_DIR

from .llm_features import truncate_essay
from .text_utils import segment_essay, split_paragraphs

logger = logging.getLogger(__name__)

CACHE_PATH = APPS_AI_DIR / "cache" / "task1_llm_features.parquet"
CACHE_VERSION = "task1_judgment_v2"

# Default text model for judgments (VLM is only for image_description upstream).
# Small default so a fresh Ollama install does not 404; override TASK1_LLM_OLLAMA_MODEL after ollama pull <model>.
DEFAULT_OLLAMA_MODEL = "phi3:mini"
DEFAULT_OLLAMA_HOST = "http://127.0.0.1:11434"

SYSTEM_PROMPT = """You are an IELTS Academic Writing Task 1 examiner. You judge ONLY from: (1) the TASK PROMPT, \
(2) the REFERENCE DESCRIPTION (neutral text of what the figure shows—treat as authoritative for facts), \
(3) the CANDIDATE RESPONSE. You do not see the image.

Before assigning scores, mentally: (a) list what the task prompt requires; (b) note key facts/trends named in the reference; \
(c) check whether the candidate's factual statements contradict the reference or invent specifics the reference does not support.

Segmentation note: short Task 1 answers may have one or two paragraphs; labels (INTRODUCTION/BODY/CONCLUSION) reflect that layout. \
Judge overview across the opening and any overview sentence elsewhere; judge detail using all non-overview substantive content.

Scoring rules:
- Use integers 1–5 only. Use the full scale; avoid giving 4–5 by default.
- Assign 4 or 5 only when that criterion is clearly satisfied.
- If uncertain on a dimension, prefer 2 or 3 rather than extremes.
- consistency_with_reference: penalize contradictions and fabricated numbers, categories, dates, or trends not supported by the reference. \
Reasonable paraphrase and omission of minor reference details are not contradictions. Hedging without false claims is acceptable for mid scores.

Return ONLY valid JSON with exactly these integer fields (no decimals, no extra keys, no markdown, no text before or after):

- "overview_strength": Overall summary of the visual(s)—main features/trends/comparison the task implies.
  1 = Missing, misleading, or wrong focus relative to the task/reference.
  2 = Barely adequate; vague; misses obvious main patterns.
  3 = Identifies the main idea with some gaps or imprecision.
  4 = Clear, accurate overview of main patterns; minor gap only.
  5 = Precise, complete overview of the figure as a whole for the task.

- "covers_prompt_parts": Fulfils the task instructions (e.g. select and report, compare periods, summarise stages).
  1 = Misses or misreads major instructions.
  2 = Only partial compliance; important prompt parts missing.
  3 = Most parts addressed; at least one thin or unclear part.
  4 = All parts clearly addressed; tiny omissions.
  5 = Every required part fully and explicitly handled.

- "development_quality": Depth and relevance of substantive description (data use, comparisons, specifics—not memorized phrases).
  1 = Vague, generic, repetitive, or mostly irrelevant to the data.
  2 = Thin; few meaningful specifics; weak link to the figure.
  3 = Uneven; some good detail mixed with generic stretches.
  4 = Generally specific and tied to the data; solid support.
  5 = Consistently detailed, relevant, and well-linked to the information implied by the reference.

- "consistency_with_reference": Factual alignment with the REFERENCE DESCRIPTION (source of truth for what is in the figure).
  1 = Clear false claims vs the reference or obvious invention.
  2 = Multiple likely errors or unsupported specifics.
  3 = Generally aligned; noticeable imprecision or a few shaky claims.
  4 = Well aligned; at most rare minor slips.
  5 = No contradictions; no invented data; strong match to the reference.

Return ONLY the JSON object. No explanation."""

LLM_T1_FEATURE_NAMES = [
    "llm_t1_overview_strength",
    "llm_t1_covers_prompt_parts",
    "llm_t1_development_quality",
    "llm_t1_consistency_with_reference",
]

_CACHE_COLUMNS = [
    "cache_version",
    "cache_key",
    "row_index",
    "status",
    "error_message",
    *LLM_T1_FEATURE_NAMES,
]


class Task1Judgment(BaseModel):
    overview_strength: int = Field(ge=1, le=5)
    covers_prompt_parts: int = Field(ge=1, le=5)
    development_quality: int = Field(ge=1, le=5)
    consistency_with_reference: int = Field(ge=1, le=5)


def _norm(s: str) -> str:
    return " ".join(str(s).strip().lower().split())


def cache_key(subject: str, image_description: str, content: str) -> str:
    a = _norm(subject)
    b = _norm(image_description)
    c = _norm(content)
    return hashlib.sha1(f"{a}||{b}||{c}".encode("utf-8")).hexdigest()


def _segment_for_task1(essay: str) -> tuple[list[str], list[str], list[str]]:
    """Layout labels for Task 1. Avoid empty BODY for 1–2 paragraph answers (common in Task 1)."""
    paras = split_paragraphs(essay)
    if not paras:
        return [], [], []
    if len(paras) == 1:
        return [], paras, []
    if len(paras) == 2:
        return [paras[0]], [paras[1]], []
    return segment_essay(essay)


def _build_user_message(subject: str, content: str, image_description: str) -> str:
    truncated = truncate_essay(content)
    intro, body_paras, conclusion = _segment_for_task1(truncated)
    intro_s = "\n\n".join(intro) if intro else "(none)"
    body_s = (
        "\n\n".join(f"[{j}] {p}" for j, p in enumerate(body_paras, 1))
        if body_paras
        else "(none)"
    )
    concl_s = "\n\n".join(conclusion) if conclusion else "(none)"
    return (
        "TASK PROMPT:\n"
        f"{subject.strip()}\n\n"
        "REFERENCE DESCRIPTION OF THE FIGURE (ground truth text; judge factual alignment against this):\n"
        f"{image_description.strip()}\n\n"
        "CANDIDATE RESPONSE (segmented):\n"
        f"INTRODUCTION:\n{intro_s}\n\n"
        f"BODY PARAGRAPHS:\n{body_s}\n\n"
        f"CONCLUSION:\n{concl_s}"
    )


def judge_task1(
    subject: str,
    content: str,
    image_description: str,
    *,
    client: Client,
    model: str,
    num_predict: int = 512,
    max_attempts: int = 3,
) -> Task1Judgment:
    user_msg = _build_user_message(subject, content, image_description)
    last_error: Exception | None = None
    for attempt in range(max_attempts):
        try:
            response = client.chat(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                format=Task1Judgment.model_json_schema(),
                options={"temperature": 0, "num_predict": num_predict},
            )
            raw = response.message.content
            if not raw or not str(raw).strip():
                raise ValueError("empty model response")
            return Task1Judgment.model_validate_json(raw)
        except (ValidationError, json.JSONDecodeError, ValueError, KeyError, AttributeError) as e:
            last_error = e
            logger.warning("Task1 judgment attempt %d/%d failed: %s", attempt + 1, max_attempts, e)
    assert last_error is not None
    raise last_error


def _append_to_cache(rows: list[dict], cache_path: Path) -> None:
    new_df = pd.DataFrame(rows)
    for c in _CACHE_COLUMNS:
        if c not in new_df.columns:
            new_df[c] = pd.NA
    new_df = new_df.reindex(columns=_CACHE_COLUMNS)
    if cache_path.exists():
        existing = pd.read_parquet(cache_path)
        combined = pd.concat([existing, new_df], ignore_index=True)
        combined = combined.drop_duplicates(["cache_version", "cache_key"], keep="last")
    else:
        combined = new_df
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    combined.to_parquet(cache_path, index=False)


def _load_cache_raw(cache_path: Path) -> pd.DataFrame | None:
    if not cache_path.exists():
        return None
    df = pd.read_parquet(cache_path)
    need = {"cache_version", "cache_key", "status"}
    if not need.issubset(df.columns):
        return None
    return df


def load_cached_task1_llm_features(cache_path: Path | None = None) -> pd.DataFrame | None:
    """Load successful Task 1 LLM feature rows for the current CACHE_VERSION."""
    path = cache_path or CACHE_PATH
    df = _load_cache_raw(path)
    if df is None or df.empty:
        return None
    df = df[df["cache_version"] == CACHE_VERSION]
    if df.empty:
        return None
    df = df[df["status"] == "ok"]
    if df.empty:
        return None
    expected = {"cache_version", "cache_key", *LLM_T1_FEATURE_NAMES}
    if not expected.issubset(df.columns):
        return None
    return df.drop_duplicates("cache_key", keep="last").reset_index(drop=True)


def _cache_key_sets(
    cache_path: Path,
) -> tuple[set[str], set[str]]:
    """Return (ok_keys, error_keys) for CACHE_VERSION."""
    df = _load_cache_raw(cache_path)
    if df is None or df.empty:
        return set(), set()
    df = df[df["cache_version"] == CACHE_VERSION]
    ok = set(df.loc[df["status"] == "ok", "cache_key"].astype(str).tolist())
    err = set(df.loc[df["status"] == "error", "cache_key"].astype(str).tolist())
    return ok, err


def _task1_row_to_cache_row(
    row: pd.Series,
    *,
    client: Client,
    model: str,
) -> dict:
    """Run judgment for one row; return a cache row dict (ok or error)."""
    key = cache_key(str(row["subject"]), str(row["image_description"]), str(row["content"]))
    rid = row["row_index"]
    rid_val = int(rid) if rid is not None and not (isinstance(rid, float) and pd.isna(rid)) else pd.NA
    try:
        result = judge_task1(
            str(row["subject"]),
            str(row["content"]),
            str(row["image_description"]),
            client=client,
            model=model,
        )
        return {
            "cache_version": CACHE_VERSION,
            "cache_key": key,
            "row_index": rid_val,
            "status": "ok",
            "error_message": pd.NA,
            "llm_t1_overview_strength": float(result.overview_strength),
            "llm_t1_covers_prompt_parts": float(result.covers_prompt_parts),
            "llm_t1_development_quality": float(result.development_quality),
            "llm_t1_consistency_with_reference": float(result.consistency_with_reference),
        }
    except Exception as e:
        logger.warning("Task1 LLM extraction failed row_index=%s: %s", rid, e)
        return {
            "cache_version": CACHE_VERSION,
            "cache_key": key,
            "row_index": rid_val,
            "status": "error",
            "error_message": str(e)[:2000],
            "llm_t1_overview_strength": float("nan"),
            "llm_t1_covers_prompt_parts": float("nan"),
            "llm_t1_development_quality": float("nan"),
            "llm_t1_consistency_with_reference": float("nan"),
        }


def run_and_cache(
    df: pd.DataFrame,
    *,
    client: Client,
    model: str,
    cache_path: Path | None = None,
    limit: int | None = None,
    retry_failed: bool = False,
    batch_flush: int = 100,
    parallel_workers: int = 1,
    ollama_host: str | None = None,
    timeout_seconds: float | None = None,
) -> None:
    """
    Run Task 1 judgment for each row. DataFrame must include: row_index, subject, content, image_description.

    Skips rows whose cache_key already has status ok. Rows with status error are skipped unless retry_failed.

    When parallel_workers > 1, each worker uses its own Ollama Client (same host/timeout); cache writes stay on the
    main thread. Set parallel_workers from CPU count sparingly—Ollama throughput depends on VRAM and model size.
    """
    path = cache_path or CACHE_PATH
    path.parent.mkdir(parents=True, exist_ok=True)

    ok_keys, err_keys = _cache_key_sets(path)
    work_df = df.copy()
    if limit is not None:
        work_df = work_df.iloc[: max(0, limit)].copy()

    to_process: list[tuple[int, pd.Series]] = []
    for i, row in work_df.iterrows():
        key = cache_key(str(row["subject"]), str(row["image_description"]), str(row["content"]))
        if key in ok_keys:
            continue
        if key in err_keys and not retry_failed:
            continue
        to_process.append((i, row))

    remaining = len(to_process)
    workers = max(1, int(parallel_workers))
    print(
        f"  Task1 LLM extraction: {remaining} rows to process ({len(ok_keys)} ok cached) | workers={workers}",
        flush=True,
    )

    def flush_if_needed(buf: list[dict]) -> list[dict]:
        if len(buf) >= batch_flush:
            _append_to_cache(buf, path)
            return []
        return buf

    rows: list[dict] = []
    processed = 0

    if workers == 1:
        for _, row in to_process:
            key = cache_key(str(row["subject"]), str(row["image_description"]), str(row["content"]))
            cache_row = _task1_row_to_cache_row(row, client=client, model=model)
            rows.append(cache_row)
            if cache_row["status"] == "ok":
                ok_keys.add(key)
                err_keys.discard(key)
            else:
                err_keys.add(key)
            processed += 1
            if processed % 10 == 0:
                print(f"    Processed {processed}/{remaining}...", flush=True)
            rows = flush_if_needed(rows)
    else:
        host = ollama_host if ollama_host is not None else DEFAULT_OLLAMA_HOST
        timeout = timeout_seconds if timeout_seconds is not None else 120.0

        def _work(item: tuple[int, pd.Series]) -> dict:
            _, row = item
            c = Client(host=host, timeout=timeout)
            return _task1_row_to_cache_row(row, client=c, model=model)

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(_work, item) for item in to_process]
            for fut in as_completed(futures):
                cache_row = fut.result()
                key = str(cache_row["cache_key"])
                rows.append(cache_row)
                if cache_row["status"] == "ok":
                    ok_keys.add(key)
                    err_keys.discard(key)
                else:
                    err_keys.add(key)
                processed += 1
                if processed % 10 == 0:
                    print(f"    Processed {processed}/{remaining}...", flush=True)
                rows = flush_if_needed(rows)

    if rows:
        _append_to_cache(rows, path)
    print(f"  Task1 LLM extraction batch complete ({processed} rows touched).", flush=True)
