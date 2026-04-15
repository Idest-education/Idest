"""
IELTS Academic Writing Task 1 labeled benchmark frame for CatBoost training.

Schema (HF default: TraTacXiMuoi/Ielts_writing_task1_academic)
  - topic, subject, content, image (optional), evaluation, overall_band_score
  - Labels: evaluation text → TA, CC, LR, GR via extract_rubric_scores_from_evaluation;
    overall_band_score (string) → band (float).

Join keys for caches
  - task1_image_descriptions.parquet (default script): keyed by (hf_split=train, row_index) where
    row_index is the row position in the HF *train* split only. Val/test rows have no VLM row
    unless you extend the image script with --split and rebuild parquet with hf_split.
  - task1_llm_features.parquet: cache_key = sha1(norm(subject)||norm(image_description)||norm(content)).
    Prefer merging on cache_key after image_description is available; stable across splits.

Split strategies
  - hf_native: HF train→train, validation→dev, test→real_test (no prompt leakage across splits
    if the dataset authors split that way).
  - locked_prompt: pool rows (HF and/or Parquet), group by prompt_family = normalize(subject),
    assign train/dev/real_test like Task 2 locked splits (BENCHMARK_CONFIG proportions).

Training note: ``train_task1_model`` calls ``ensure_task1_eval_splits`` when dev or real_test is
empty (e.g. ``--hf-splits train`` only), so CatBoost evaluation always has non-empty holdout rows.

Environment (optional; CLI in train_task1_model may mirror):
  TASK1_TRAIN_DATASET — HF dataset id
  TASK1_IMAGE_DESC_PARQUET — path to task1_image_descriptions.parquet
  TASK1_LLM_FEATURES_CACHE — path to task1_llm_features.parquet
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Literal

import numpy as np
import pandas as pd
from datasets import load_dataset

from ielts_ai.data.benchmark import (
    BENCHMARK_CONFIG,
    RUBRIC_COLUMNS,
    _assign_locked_splits,
    _canonicalize_text,
    _overall_band_bucket,
    _stable_hash,
    extract_rubric_scores_from_evaluation,
    normalize_prompt_group,
    summarize_benchmark_frame,
)
from ielts_ai.writing_scorer.task1_llm_features import cache_key as task1_cache_key

logger = logging.getLogger(__name__)

DEFAULT_TASK1_DATASET = "TraTacXiMuoi/Ielts_writing_task1_academic"

_SPLIT_HF_TO_INTERNAL = {
    "train": "train",
    "validation": "dev",
    "test": "real_test",
}


def _parse_overall_band_str(raw: object) -> float | None:
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return None
    s = str(raw).strip().replace("\u00a0", " ")
    s = re.sub(r"\s+", "", s)
    if s.lower() in ("<4",):
        return 3.5
    try:
        return float(s)
    except ValueError:
        return None


def _parse_overall_from_evaluation(text: str) -> float | None:
    m = re.search(r"Overall\s+Band\s+Score[^0-9]*\[?(\d+\.?\d*)\]?", text, re.IGNORECASE)
    return float(m.group(1)) if m else None


def _rows_from_hf_split(dataset_id: str, hf_split: str, columns: list[str]) -> list[dict]:
    ds = load_dataset(dataset_id, split=hf_split, columns=columns)
    n = len(ds)
    out: list[dict] = []
    for i in range(n):
        row = ds[i]
        out.append({**{c: row.get(c) for c in columns}, "row_index": i, "hf_split": hf_split})
    return out


def _build_raw_frame_from_hf(
    dataset_id: str,
    hf_splits: tuple[str, ...] = ("train", "validation", "test"),
) -> pd.DataFrame:
    cols = ["topic", "subject", "content", "evaluation", "overall_band_score"]
    rows: list[dict] = []
    for sp in hf_splits:
        if sp not in _SPLIT_HF_TO_INTERNAL:
            raise ValueError(f"Unknown HF split {sp!r}; expected one of {list(_SPLIT_HF_TO_INTERNAL)}")
        rows.extend(_rows_from_hf_split(dataset_id, sp, cols))
    return pd.DataFrame(rows)


def _parse_and_validate_labels(df: pd.DataFrame) -> pd.DataFrame:
    frame = df.copy()
    scores_series = frame["evaluation"].astype(str).map(extract_rubric_scores_from_evaluation)
    scores_df = pd.DataFrame(scores_series.tolist())
    for col in RUBRIC_COLUMNS:
        frame[col] = scores_df[col]

    frame["band"] = frame["overall_band_score"].map(_parse_overall_band_str)
    miss_band = frame["band"].isna()
    if miss_band.any():
        n = int(miss_band.sum())
        logger.warning("Dropped %d rows with unparseable overall_band_score", n)
        frame = frame.loc[~miss_band].copy()

    for col in RUBRIC_COLUMNS:
        if col not in frame.columns:
            raise ValueError(
                f"Missing rubric column {col} after parsing evaluation. "
                "Check that evaluation strings contain Task 2–style rubric headers "
                "(Task Achievement, Coherence and Cohesion, Lexical Resource, "
                "Grammatical Range and Accuracy)."
            )

    rubric_na = frame[RUBRIC_COLUMNS].isna().any(axis=1)
    if rubric_na.any():
        n = int(rubric_na.sum())
        logger.warning("Dropped %d rows with missing rubric score(s) in evaluation", n)
        frame = frame.loc[~rubric_na].copy()

    valid_rubrics = frame[RUBRIC_COLUMNS].apply(lambda col: col.astype(float).between(0.0, 9.0))
    frame = frame[valid_rubrics.all(axis=1)]
    frame = frame[frame["band"].astype(float).between(0.0, 9.0)].copy()

    mismatch = 0
    for _, row in frame.iterrows():
        ev = str(row.get("evaluation", "") or "")
        if not ev:
            continue
        from_ev = _parse_overall_from_evaluation(ev)
        if from_ev is None:
            continue
        b = float(row["band"])
        if abs(from_ev - b) > 0.51:
            mismatch += 1
            logger.debug(
                "overall_band_score %.2f vs evaluation Overall %.2f (row_index=%s hf_split=%s)",
                b,
                from_ev,
                row.get("row_index"),
                row.get("hf_split"),
            )
    if mismatch:
        logger.warning(
            "Band mismatch (|delta|>0.5) between overall_band_score and evaluation text in %d rows",
            mismatch,
        )

    return frame.drop(columns=["evaluation"], errors="ignore").reset_index(drop=True)


def _prepare_task1_benchmark_columns(df: pd.DataFrame) -> pd.DataFrame:
    frame = df.copy()
    frame["essay"] = frame["content"].astype(str).str.strip()
    frame["essay_word_count"] = frame["essay"].str.split().str.len().astype(int)
    frame["essay_char_count"] = frame["essay"].str.len().astype(int)
    frame["prompt_family"] = frame["subject"].astype(str).map(normalize_prompt_group)
    frame["essay_id"] = frame["essay"].map(_canonicalize_text).map(lambda t: _stable_hash(t))
    frame["duplicate_cluster"] = frame["essay_id"]
    frame["near_duplicate_cluster"] = (
        frame["essay"].map(_canonicalize_text).map(lambda t: _stable_hash(t[:500]))
    )
    frame["overall_band_bucket"] = frame["band"].astype(float).map(_overall_band_bucket)
    frame["is_multi_rated"] = frame["human_rating_count"].fillna(1).astype(float) >= 2
    frame["meets_rating_bar"] = True
    return frame


def _set_encoder_prompt_column(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    subj = out["subject"].astype(str).str.strip()
    desc = out["image_description"]
    desc_str = desc.where(desc.notna(), "").astype(str).str.strip()
    has_desc = desc_str != ""
    out["prompt"] = subj
    out.loc[has_desc, "prompt"] = (
        subj[has_desc]
        + "\n\n[Figure reference — neutral description of the visual]\n"
        + desc_str[has_desc]
    )
    return out


def _prompt_sha256(subject: str) -> str:
    import hashlib

    norm = " ".join(str(subject).strip().split())
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()


def _merge_image_descriptions(
    frame: pd.DataFrame,
    image_desc_path: Path,
    *,
    validate_prompt_sha256: bool = True,
) -> pd.DataFrame:
    if not image_desc_path.exists():
        logger.warning("Image descriptions parquet missing: %s", image_desc_path)
        out = frame.copy()
        out["image_description"] = np.nan
        return out

    desc = pd.read_parquet(image_desc_path)
    need = {"row_index", "status", "image_description"}
    if not need.issubset(desc.columns):
        raise ValueError(f"Image desc parquet missing columns {need}: {image_desc_path}")

    take = ["row_index", "status", "image_description"]
    if "prompt_sha256" in desc.columns:
        take.append("prompt_sha256")
    desc_sub = desc[take].copy()
    desc_sub["_join_split"] = "train"
    merged = frame.merge(
        desc_sub,
        left_on=["hf_split", "row_index"],
        right_on=["_join_split", "row_index"],
        how="left",
    )
    merged = merged.drop(columns=["_join_split"], errors="ignore")

    if validate_prompt_sha256 and "prompt_sha256" in merged.columns:
        ok_mask = merged["hf_split"].astype(str) == "train"
        for idx in merged.index[ok_mask]:
            sub = str(merged.at[idx, "subject"] or "")
            ph = merged.at[idx, "prompt_sha256"]
            if pd.isna(ph) or str(ph).strip() == "":
                continue
            if str(ph) != _prompt_sha256(sub):
                logger.warning(
                    "prompt_sha256 mismatch at row_index=%s (subject changed vs VLM cache?)",
                    merged.at[idx, "row_index"],
                )

    return merged


def _merge_task1_llm_cache(frame: pd.DataFrame, llm_path: Path | None) -> pd.DataFrame:
    if llm_path is None or not llm_path.exists():
        return frame
    from ielts_ai.writing_scorer.task1_llm_features import (
        LLM_T1_FEATURE_NAMES,
        load_cached_task1_llm_features,
    )

    cached = load_cached_task1_llm_features(llm_path)
    if cached is None or cached.empty:
        logger.warning("No usable Task 1 LLM rows in %s", llm_path)
        return frame

    keys = frame.apply(
        lambda r: task1_cache_key(
            str(r["subject"] or ""),
            str(r.get("image_description") or ""),
            str(r["content"] or ""),
        ),
        axis=1,
    )
    out = frame.copy()
    out["cache_key"] = keys
    feat_cols = [c for c in LLM_T1_FEATURE_NAMES if c in cached.columns]
    right = cached[["cache_key", *feat_cols]].drop_duplicates("cache_key", keep="last")
    merged = out.merge(right, on="cache_key", how="left", suffixes=("", "_llm_dup"))
    return merged.drop(columns=["cache_key"], errors="ignore")


def summarize_task1_frame(df: pd.DataFrame, *, dataset_id: str | None = None) -> dict[str, object]:
    base = summarize_benchmark_frame(df)
    base["task"] = "writing_task1"
    if dataset_id:
        base["dataset_id"] = dataset_id
    return base


def build_task1_inference_row(
    subject: str,
    content: str,
    image_description: str,
) -> pd.DataFrame:
    """Single-row frame with ``prompt``/``essay`` for Task 1 feature extraction (matches training)."""
    df = pd.DataFrame(
        [
            {
                "subject": str(subject).strip(),
                "content": str(content).strip(),
                "image_description": str(image_description).strip(),
            }
        ]
    )
    df["essay"] = df["content"].astype(str).str.strip()
    return _set_encoder_prompt_column(df)


def ensure_task1_eval_splits(df: pd.DataFrame) -> tuple[pd.DataFrame, bool]:
    """
    ``evaluate_pipeline`` expects non-empty ``dev`` and ``real_test`` for metrics. If the loader
    left all rows in ``train`` (typical with ``--hf-splits train`` + caches), re-assign splits
    with ``_assign_locked_splits`` on ``prompt_family`` (requires columns from
    ``_prepare_task1_benchmark_columns``).
    """
    if df.empty:
        return df, False
    dev_n = int((df["split"] == "dev").sum())
    rt_n = int((df["split"] == "real_test").sum())
    if dev_n >= 1 and rt_n >= 1:
        return df, False
    logger.warning(
        "Task 1 frame has dev=%d, real_test=%d rows; applying locked prompt_family splits so "
        "training can evaluate on holdout buckets. Use HF validation+test splits if you want the "
        "publisher's dev/test partition instead.",
        dev_n,
        rt_n,
    )
    out = _assign_locked_splits(df.copy().reset_index(drop=True))
    return out, True


SplitStrategy = Literal["hf_native", "locked_prompt"]


def load_task1_frame(
    *,
    dataset_id: str = DEFAULT_TASK1_DATASET,
    parquet_path: Path | None = None,
    split_strategy: SplitStrategy = "hf_native",
    hf_splits: tuple[str, ...] = ("train", "validation", "test"),
    image_desc_parquet: Path | None = None,
    task1_llm_parquet: Path | None = None,
    require_image_desc: bool = False,
    require_task1_llm: bool = False,
    merge_task1_llm_parquet: bool = True,
) -> pd.DataFrame:
    """
    Load Task 1 labeled data, optional image/LLM caches, and produce a frame compatible
    with train_model.evaluate_pipeline (split, TA..GR, band, essay_word_count, source, ...).
    """
    from ielts_ai.paths import APPS_AI_DIR

    img_path = image_desc_parquet or (APPS_AI_DIR / "cache" / "task1_image_descriptions.parquet")

    if parquet_path is not None:
        raw = pd.read_parquet(parquet_path)
        need = {"subject", "content", "evaluation", "overall_band_score"}
        if not need.issubset(raw.columns):
            raise ValueError(f"Parquet missing columns {need}; got {list(raw.columns)}")
        if "hf_split" not in raw.columns:
            raw["hf_split"] = "train"
        if "row_index" not in raw.columns:
            raw = raw.reset_index(drop=True)
            raw["row_index"] = np.arange(len(raw), dtype=np.int64)
    else:
        raw = _build_raw_frame_from_hf(dataset_id, hf_splits=hf_splits)

    if split_strategy == "hf_native":
        raw["split"] = raw["hf_split"].map(_SPLIT_HF_TO_INTERNAL)
        if raw["split"].isna().any():
            bad = raw.loc[raw["split"].isna(), "hf_split"].unique().tolist()
            raise ValueError(f"Unknown hf_split values for hf_native: {bad}")
        raw["is_locked_real_test"] = raw["split"] == "real_test"
    elif split_strategy == "locked_prompt":
        raw["split"] = "train"
        raw["is_locked_real_test"] = False
    else:
        raise ValueError(f"Unknown split_strategy: {split_strategy}")

    labeled = _parse_and_validate_labels(raw)

    labeled["source"] = "hf_task1"
    if "human_rating_count" not in labeled.columns:
        labeled["human_rating_count"] = 1
    else:
        labeled["human_rating_count"] = labeled["human_rating_count"].fillna(1)
    if "rater_disagreement" not in labeled.columns:
        labeled["rater_disagreement"] = 0.0
    else:
        labeled["rater_disagreement"] = labeled["rater_disagreement"].fillna(0.0)

    labeled = _merge_image_descriptions(labeled, Path(img_path))
    if "prompt_sha256" in labeled.columns:
        labeled = labeled.drop(columns=["prompt_sha256"])
    if require_image_desc:
        ok = labeled["image_description"].notna() & (
            labeled["image_description"].astype(str).str.strip() != ""
        )
        labeled = labeled.loc[ok].reset_index(drop=True)

    if merge_task1_llm_parquet:
        from ielts_ai.writing_scorer.task1_llm_features import CACHE_PATH as TASK1_LLM_DEFAULT

        llm_path = Path(task1_llm_parquet) if task1_llm_parquet else TASK1_LLM_DEFAULT
        labeled = _merge_task1_llm_cache(labeled, llm_path)
    if require_task1_llm:
        from ielts_ai.writing_scorer.task1_llm_features import LLM_T1_FEATURE_NAMES

        missing_llm = [c for c in LLM_T1_FEATURE_NAMES if c not in labeled.columns]
        if missing_llm:
            raise ValueError(
                f"--require-task1-llm but columns missing {missing_llm}. "
                "Populate task1_llm_features.parquet (see extract_task1_llm_features) or disable the flag."
            )
        ok = labeled[LLM_T1_FEATURE_NAMES].notna().all(axis=1)
        labeled = labeled.loc[ok].reset_index(drop=True)

    labeled = _prepare_task1_benchmark_columns(labeled)
    labeled = _set_encoder_prompt_column(labeled)

    if split_strategy == "locked_prompt":
        labeled = _assign_locked_splits(labeled)

    return labeled.reset_index(drop=True)
