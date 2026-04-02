"""
Extract Task 1 LLM judgment features (1–5) into Parquet.

Joins a Hugging Face Task 1 dataset with task1_image_descriptions.parquet on row_index.
Does not write to llm_features.parquet (Task 2).

Example:
  cd apps/ai && PYTHONPATH=. python -m ielts_ai.scripts.extract_task1_llm_features --limit 5

Environment (optional defaults for CLI flags):
  OLLAMA_HOST — Ollama base URL (same as task1_image_descriptions)
  TASK1_LLM_OLLAMA_MODEL — text model for JSON judgment
  TASK1_LLM_DATASET — Hugging Face dataset id
  TASK1_IMAGE_DESC_PARQUET — path to task1_image_descriptions.parquet
  TASK1_LLM_FEATURES_CACHE — output Parquet path
  TASK1_LLM_WORKERS — concurrent Ollama requests (default 1; try 4–8 if GPU/VRAM allows)
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from pathlib import Path

import pandas as pd
from datasets import load_dataset
from ollama import Client

from ielts_ai.paths import APPS_AI_DIR
from ielts_ai.writing_scorer.task1_llm_features import (
    CACHE_PATH,
    DEFAULT_OLLAMA_HOST,
    DEFAULT_OLLAMA_MODEL,
    run_and_cache,
)

logger = logging.getLogger(__name__)

DEFAULT_DATASET = "TraTacXiMuoi/Ielts_writing_task1_academic"
DEFAULT_IMAGE_DESC_PARQUET = APPS_AI_DIR / "cache" / "task1_image_descriptions.parquet"


def _env_str(key: str, default: str) -> str:
    v = os.environ.get(key)
    return v if v is not None and v != "" else default


def _env_path(key: str, default: Path) -> Path:
    v = os.environ.get(key)
    return Path(v) if v else default


def _env_int(key: str, default: int) -> int:
    v = os.environ.get(key)
    if v is None or v == "":
        return default
    try:
        return int(v)
    except ValueError:
        return default


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    default_out = _env_path("TASK1_LLM_FEATURES_CACHE", CACHE_PATH)
    p = argparse.ArgumentParser(
        description="Task 1 LLM 1–5 judgments via Ollama → Parquet (join HF + image descriptions)",
    )
    p.add_argument(
        "--dataset",
        default=_env_str("TASK1_LLM_DATASET", DEFAULT_DATASET),
        help="Hugging Face dataset id",
    )
    p.add_argument(
        "--image-desc-parquet",
        type=Path,
        default=_env_path("TASK1_IMAGE_DESC_PARQUET", DEFAULT_IMAGE_DESC_PARQUET),
        help="Parquet from task1_image_descriptions (row_index, status, image_description, …)",
    )
    p.add_argument(
        "--output-cache",
        type=Path,
        default=default_out,
        help="Output Parquet path (default: cache/task1_llm_features.parquet)",
    )
    p.add_argument(
        "--ollama-model",
        default=_env_str("TASK1_LLM_OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL),
        help="Ollama text model for JSON judgment",
    )
    p.add_argument(
        "--ollama-host",
        default=_env_str("OLLAMA_HOST", DEFAULT_OLLAMA_HOST),
        help="Ollama API base URL",
    )
    p.add_argument("--limit", type=int, default=None, help="Max rows after filter (head)")
    p.add_argument(
        "--retry-failed",
        action="store_true",
        help="Re-run rows that previously failed (status=error in cache)",
    )
    p.add_argument(
        "--timeout-seconds",
        type=float,
        default=120.0,
        help="HTTP timeout for Ollama client",
    )
    p.add_argument(
        "--workers",
        type=int,
        default=_env_int("TASK1_LLM_WORKERS", 1),
        metavar="N",
        help="Parallel Ollama requests (default: 1 or TASK1_LLM_WORKERS). Each worker uses its own client.",
    )
    p.add_argument("-v", "--verbose", action="store_true", help="Debug logging")
    return p.parse_args(argv)


def build_work_frame(
    dataset_id: str,
    image_desc_path: Path,
    *,
    limit: int | None,
) -> pd.DataFrame:
    ds = load_dataset(
        dataset_id,
        split="train",
        columns=["subject", "content"],
    )
    n = len(ds)
    hf_rows: list[dict] = []
    for i in range(n):
        row = ds[i]
        hf_rows.append({
            "row_index": i,
            "subject": row.get("subject") or "",
            "content": row.get("content") if row.get("content") is not None else "",
        })
    hf = pd.DataFrame(hf_rows)
    if not image_desc_path.exists():
        raise FileNotFoundError(f"Image descriptions parquet not found: {image_desc_path}")
    desc = pd.read_parquet(image_desc_path)
    need = {"row_index", "status", "image_description"}
    if not need.issubset(desc.columns):
        raise ValueError(f"Parquet missing columns {need}: {image_desc_path}")
    merged = hf.merge(desc[["row_index", "status", "image_description"]], on="row_index", how="inner")
    ok = merged["status"].astype(str) == "ok"
    img = merged["image_description"].astype(str).str.strip()
    non_empty = img != ""
    merged = merged.loc[ok & non_empty].copy()
    merged["image_description"] = merged["image_description"].astype(str)
    if limit is not None:
        merged = merged.iloc[: max(0, limit)].reset_index(drop=True)
    return merged


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(message)s")

    t0 = time.perf_counter()
    try:
        df = build_work_frame(
            args.dataset,
            args.image_desc_parquet,
            limit=args.limit,
        )
    except Exception as e:
        logger.error("%s", e)
        return 1

    if df.empty:
        logger.warning("No rows after join/filter (ok status + non-empty image_description).")
        return 0

    n = len(df)
    logger.info(
        "Rows to consider=%d | dataset=%s | image_desc=%s | output=%s | model=%s | workers=%d",
        n,
        args.dataset,
        args.image_desc_parquet,
        args.output_cache,
        args.ollama_model,
        max(1, args.workers),
    )

    client = Client(host=args.ollama_host, timeout=args.timeout_seconds)
    run_and_cache(
        df,
        client=client,
        model=args.ollama_model,
        cache_path=args.output_cache,
        limit=None,
        retry_failed=args.retry_failed,
        parallel_workers=max(1, args.workers),
        ollama_host=args.ollama_host,
        timeout_seconds=args.timeout_seconds,
    )
    elapsed = time.perf_counter() - t0
    logger.info("Done in %.1fs", elapsed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
