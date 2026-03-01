"""
LLM-based structural judgment features (Group E).

Single-call design: one Ollama/Phi-3 Mini call per essay returns structured JSON
with position clarity, task coverage, and paragraph development ratio.

Results are cached to disk for offline extraction.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

import numpy as np
import pandas as pd
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

CACHE_PATH = Path(__file__).resolve().parent.parent / "cache" / "llm_features.parquet"

SYSTEM_PROMPT = (
    "You are an IELTS writing examiner. You will receive a question and a list of body paragraphs "
    "(middle paragraphs of an essay, excluding intro and conclusion). "
    "Return ONLY valid JSON with exactly these fields:\n"
    '- "has_position": true if the body content shows the writer clearly states their position, false otherwise\n'
    '- "covers_all_parts": true if the body content addresses all parts of the question, false otherwise\n'
    '- "developed": a list of exactly N booleans (one per body paragraph), where true means that paragraph '
    "follows a Claim then Explanation then Example structure or provides supporting evidence\n"
    "Return ONLY valid JSON. No explanation, no markdown, no extra text."
)

MAX_ESSAY_WORDS = 500

LLM_FEATURE_NAMES = [
    "llm_position_clear",
    "llm_full_task_coverage",
    "llm_structured_paragraph_ratio",
]


class EssayJudgment(BaseModel):
    has_position: bool
    covers_all_parts: bool
    developed: list[bool]


class DevelopedLengthMismatchError(ValueError):
    """Raised when len(developed) != body_count after retries."""


_PARA_SPLIT_RE = re.compile(r"(?:\n\s*)+")


def _segment_essay(essay: str) -> tuple[list[str], list[str], list[str]]:
    """Split by blank lines or single newlines. Returns (intro, body, conclusion)."""
    paragraphs = [p.strip() for p in _PARA_SPLIT_RE.split(essay) if p.strip()]
    if len(paragraphs) <= 2:
        intro = paragraphs[:1] if paragraphs else []
        conclusion = paragraphs[1:2] if len(paragraphs) == 2 else []
        return (intro, [], conclusion)
    return (paragraphs[:1], paragraphs[1:-1], paragraphs[-1:])


def truncate_essay(essay: str, max_words: int = MAX_ESSAY_WORDS) -> str:
    words = essay.split()
    if len(words) <= max_words:
        return essay
    truncated = " ".join(words[:max_words])
    last_period = truncated.rfind(".")
    if last_period > len(truncated) // 2:
        truncated = truncated[: last_period + 1]
    return truncated


def judge_essay(prompt: str, essay: str) -> EssayJudgment:
    from ollama import chat

    truncated = truncate_essay(essay)
    _, body_paragraphs, _ = _segment_essay(truncated)
    body_count = len(body_paragraphs)

    body_section = (
        "\n\n".join(f"[{j}] {p}" for j, p in enumerate(body_paragraphs, 1))
        if body_paragraphs
        else "(none)"
    )
    user_msg = f"QUESTION: {prompt}\n\nBODY PARAGRAPHS:\n{body_section}"

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            response = chat(
                model="phi3:mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                format=EssayJudgment.model_json_schema(),
                options={"temperature": 0, "num_predict": 128},
            )
            result = EssayJudgment.model_validate_json(response.message.content)
            if len(result.developed) != body_count:
                last_error = ValueError(
                    f"len(developed)={len(result.developed)} != body_count={body_count}"
                )
                if attempt < 2:
                    logger.warning(
                        "Retry %d: developed length mismatch: %s",
                        attempt + 1,
                        last_error,
                    )
                    continue
                raise DevelopedLengthMismatchError(
                    f"len(developed) != body_count after 3 attempts: {last_error}"
                )
            return result
        except (ValidationError, json.JSONDecodeError, KeyError):
            raise
        except DevelopedLengthMismatchError:
            raise


def _append_to_cache(new_rows: list[dict]) -> None:
    new_df = pd.DataFrame(new_rows)
    if CACHE_PATH.exists():
        existing = pd.read_parquet(CACHE_PATH)
        combined = pd.concat([existing, new_df], ignore_index=True)
    else:
        combined = new_df
    combined.to_parquet(CACHE_PATH, index=False)


def run_and_cache(df: pd.DataFrame) -> None:
    """Run LLM extraction for all essays, saving incrementally to parquet."""
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)

    done: set[int] = set()
    if CACHE_PATH.exists():
        cached = pd.read_parquet(CACHE_PATH)
        done = set(cached["idx"].tolist())

    total = len(df)
    remaining = total - len(done)
    print(f"  LLM extraction: {remaining} essays remaining ({len(done)} cached)")

    rows: list[dict] = []
    processed = 0

    for i, row in df.iterrows():
        if i in done:
            continue
        try:
            result = judge_essay(row["prompt"], row["essay"])
        except (DevelopedLengthMismatchError, ValidationError, json.JSONDecodeError, KeyError, Exception) as e:
            logger.warning("LLM extraction failed for essay %s, skipping: %s", i, e)
            continue
        body_count = len(result.developed)
        ratio = sum(result.developed) / max(body_count, 1)
        rows.append({
            "idx": i,
            "llm_position_clear": float(result.has_position),
            "llm_full_task_coverage": float(result.covers_all_parts),
            "llm_structured_paragraph_ratio": ratio,
        })
        processed += 1
        if processed % 10 == 0:
            print(f"    Processed {processed}/{remaining}...", flush=True)
        if len(rows) % 100 == 0:
            _append_to_cache(rows)
            rows = []

    if rows:
        _append_to_cache(rows)
    print(f"  LLM extraction complete. Total cached: {total}")


def load_cached_llm_features() -> pd.DataFrame | None:
    """Load cached LLM features. Returns None if cache doesn't exist."""
    if not CACHE_PATH.exists():
        return None
    df = pd.read_parquet(CACHE_PATH)
    return df.sort_values("idx").reset_index(drop=True)


def get_llm_feature_array(n_essays: int) -> np.ndarray | None:
    """Load cached LLM features as a numpy array aligned by index.
    Returns None if cache is missing or incomplete."""
    cached = load_cached_llm_features()
    if cached is None or len(cached) < n_essays:
        return None
    cached = cached.head(n_essays)
    return cached[LLM_FEATURE_NAMES].values


def get_partial_llm_cache() -> tuple[np.ndarray, np.ndarray] | None:
    """Load cached LLM features for essays that have been processed.
    Returns (indices, values) or None if cache is empty.
    indices: 1d array of dataframe row indices with cached features
    values: (len(indices), 3) array of LLM features"""
    cached = load_cached_llm_features()
    if cached is None or len(cached) == 0:
        return None
    indices = cached["idx"].values
    values = cached[LLM_FEATURE_NAMES].values
    return indices, values
