from __future__ import annotations

import hashlib
import json
import re

import numpy as np
import pandas as pd
from datasets import load_dataset
from sklearn.model_selection import train_test_split

from ielts_ai.paths import CRAWLED_DATA_PATH

RUBRIC_COLUMNS = ["TA", "CC", "LR", "GR"]
OVERALL_BAND_COLUMN = "band"
BAND_COUNT_TARGETS = [*RUBRIC_COLUMNS, OVERALL_BAND_COLUMN]
BENCHMARK_CONFIG = {
    "dev_size": 0.15,
    "real_test_size": 0.15,
    "random_state": 42,
}
LOW_BAND_MAX = 4.0
HIGH_BAND_MIN = 8.5


def round_to_half_band(values: float | np.ndarray | pd.Series) -> np.ndarray:
    """Round scores to 0.5 steps."""
    arr = np.asarray(values, dtype=np.float64)
    return np.round(arr * 2.0) / 2.0


def band_class_counts(series: pd.Series) -> pd.Series:
    """Half-band label -> count, index sorted ascending."""
    bands = round_to_half_band(series.dropna().to_numpy(dtype=np.float64))
    return pd.Series(bands).value_counts().sort_index()


def rubric_band_class_counts(df: pd.DataFrame | None = None) -> dict[str, pd.Series]:
    """Per-target half-band class counts (TA, CC, LR, GR, overall band)."""
    if df is None:
        df = load_clean_data()
    out: dict[str, pd.Series] = {}
    for col in BAND_COUNT_TARGETS:
        if col not in df.columns:
            continue
        out[col] = band_class_counts(df[col])
    return out


def print_rubric_band_class_counts(df: pd.DataFrame | None = None) -> None:
    """Print all half-band classes and counts for each rubric + overall band."""
    if df is None:
        df = load_clean_data()
    for col in BAND_COUNT_TARGETS:
        if col not in df.columns:
            continue
        vc = band_class_counts(df[col])
        n_valid = int(df[col].notna().sum())
        print(f"\n{col} (valid scores: {n_valid})")
        for band, count in vc.items():
            print(f"  {band:g}: {count}")


def normalize_prompt_group(prompt: str) -> str:
    return re.sub(r"\s+", " ", str(prompt).strip().lower())


def _canonicalize_text(text: str) -> str:
    normalized = re.sub(r"\s+", " ", str(text).strip().lower())
    return re.sub(r"[^a-z0-9 ]+", "", normalized)


def _stable_hash(*parts: str) -> str:
    return hashlib.sha1("||".join(parts).encode("utf-8")).hexdigest()


def _overall_band_bucket(value: float) -> str:
    if value <= LOW_BAND_MAX:
        return "<=4"
    if value >= HIGH_BAND_MIN:
        return ">=8.5"
    return "mid"


def _extract_scores(text: str) -> dict[str, float | None]:
    rubrics = [
        ("TA", "Task Achievement"),
        ("CC", "Coherence and Cohesion"),
        ("LR", "Lexical Resource"),
        ("GR", "Grammatical Range and Accuracy"),
    ]
    result: dict[str, float | None] = {}
    for i, (key, name) in enumerate(rubrics):
        start = text.find(name)
        if start == -1:
            result[key] = None
            continue
        search_start = start + len(name)
        end = (
            text.find(rubrics[i + 1][1], search_start)
            if i < len(rubrics) - 1
            else len(text)
        )
        if end == -1:
            end = len(text)
        section = text[search_start:end]
        match = re.search(r"(\d+\.?\d*)", section)
        result[key] = float(match.group(1)) if match else None
    return result


def extract_rubric_scores_from_evaluation(text: str) -> dict[str, float | None]:
    """Parse TA/CC/LR/GR from an IELTS-style evaluation string (Task 1 or Task 2)."""
    return _extract_scores(text)


def _parse_crawled_band(title: str) -> float:
    match = re.search(r"band\s+(\d+(?:\.\d+)?)", title.lower())
    if match:
        return float(match.group(1))
    return 8.5


def _load_hf_public_data() -> pd.DataFrame:
    dataset = load_dataset("chillies/IELTS-writing-task-2-evaluation")
    df = dataset["train"].to_pandas()

    scores = df["evaluation"].apply(_extract_scores)
    scores_df = pd.DataFrame(scores.tolist())
    df = pd.concat([df, scores_df], axis=1)
    df["band"] = (
        df["band"]
        .astype(str)
        .str.strip()
        .str.replace(r"\s+", "", regex=True)
        .replace("<4", "3.5")
        .astype(float)
    )
    valid_rubrics = df[RUBRIC_COLUMNS].apply(lambda col: col.between(0.0, 9.0))
    df = df[valid_rubrics.all(axis=1)]
    df = df[df["band"].between(0.0, 9.0)].reset_index(drop=True)
    df["source"] = "hf_public"
    if "human_rating_count" not in df.columns:
        df["human_rating_count"] = 1
    if "rater_disagreement" not in df.columns:
        df["rater_disagreement"] = 0.0
    return df


def _load_crawled_ielts_data() -> pd.DataFrame:
    if not CRAWLED_DATA_PATH.exists():
        return pd.DataFrame(columns=["prompt", "essay", *RUBRIC_COLUMNS, "band"])

    with CRAWLED_DATA_PATH.open("r", encoding="utf-8") as f:
        crawled_rows = json.load(f)

    rows: list[dict[str, object]] = []
    for item in crawled_rows:
        essay = str(item.get("essay", "")).strip()
        prompt = str(item.get("question", "")).strip()
        title = str(item.get("title", "")).strip()
        if not essay or not prompt:
            continue
        score = _parse_crawled_band(title)
        rows.append({
            "prompt": prompt,
            "essay": essay,
            "TA": score,
            "CC": score,
            "LR": score,
            "GR": score,
            "band": score,
            "title": title,
            "url": str(item.get("url", "")),
            "topic": str(item.get("topic", "")),
            "source_item_id": str(item.get("id", "")),
            "source": "crawled",
            "human_rating_count": 1,
            "rater_disagreement": 0.0,
        })

    if not rows:
        return pd.DataFrame(columns=["prompt", "essay", *RUBRIC_COLUMNS, "band"])
    return pd.DataFrame(rows)


def _prepare_benchmark_columns(df: pd.DataFrame) -> pd.DataFrame:
    frame = df.copy()
    frame["prompt"] = frame["prompt"].astype(str).str.strip()
    frame["essay"] = frame["essay"].astype(str).str.strip()
    frame["essay_word_count"] = frame["essay"].str.split().str.len().astype(int)
    frame["essay_char_count"] = frame["essay"].str.len().astype(int)
    frame["prompt_family"] = frame["prompt"].map(normalize_prompt_group)
    frame["essay_id"] = frame["essay"].map(_canonicalize_text).map(lambda text: _stable_hash(text))
    frame["duplicate_cluster"] = frame["essay_id"]
    frame["near_duplicate_cluster"] = (
        frame["essay"].map(_canonicalize_text).map(lambda text: _stable_hash(text[:500]))
    )
    frame["overall_band_bucket"] = frame["band"].map(_overall_band_bucket)
    frame["is_multi_rated"] = frame["human_rating_count"].fillna(1).astype(float) >= 2
    frame["meets_rating_bar"] = True
    return frame


def _drop_exact_duplicates(df: pd.DataFrame) -> pd.DataFrame:
    ranked = df.assign(
        _source_priority=df["source"].map({"crawled": 0, "hf_public": 1}).fillna(99).astype(int)
    )
    deduped = ranked.sort_values(["duplicate_cluster", "_source_priority"]).drop_duplicates(
        "duplicate_cluster", keep="first"
    )
    return deduped.drop(columns="_source_priority").reset_index(drop=True)


def _bucket_mode(values: pd.Series) -> str:
    mode = values.mode()
    if not mode.empty:
        return str(mode.iloc[0])
    return str(values.iloc[0])


def _assign_locked_splits(frame: pd.DataFrame) -> pd.DataFrame:
    groups = (
        frame.groupby("prompt_family", as_index=False)
        .agg(
            overall_band_bucket=("overall_band_bucket", _bucket_mode),
            source=("source", _bucket_mode),
        )
        .reset_index(drop=True)
    )
    stratify = groups["overall_band_bucket"]
    if stratify.value_counts().min() < 2:
        stratify = None

    real_test_groups, remaining_groups = train_test_split(
        groups["prompt_family"],
        test_size=1.0 - BENCHMARK_CONFIG["real_test_size"],
        random_state=BENCHMARK_CONFIG["random_state"],
        stratify=stratify,
    )
    remaining = groups[groups["prompt_family"].isin(remaining_groups)].reset_index(drop=True)
    remaining_stratify = remaining["overall_band_bucket"]
    if remaining_stratify.value_counts().min() < 2:
        remaining_stratify = None
    dev_share_of_remaining = BENCHMARK_CONFIG["dev_size"] / (
        1.0 - BENCHMARK_CONFIG["real_test_size"]
    )
    train_groups, dev_groups = train_test_split(
        remaining["prompt_family"],
        test_size=dev_share_of_remaining,
        random_state=BENCHMARK_CONFIG["random_state"],
        stratify=remaining_stratify,
    )
    split_map = {group: "train" for group in train_groups}
    split_map.update({group: "dev" for group in dev_groups})
    split_map.update({group: "real_test" for group in real_test_groups})

    out = frame.copy()
    out["split"] = out["prompt_family"].map(split_map).fillna("train")
    out["is_locked_real_test"] = out["split"] == "real_test"
    return out


def summarize_benchmark_frame(df: pd.DataFrame) -> dict[str, object]:
    return {
        "config": BENCHMARK_CONFIG,
        "summary": {
            "n_rows": int(len(df)),
            "split_counts": {
                split: int(count) for split, count in df["split"].value_counts().sort_index().items()
            },
            "source_counts": {
                source: int(count) for source, count in df["source"].value_counts().sort_index().items()
            },
            "prompt_family_count": int(df["prompt_family"].nunique()),
            "duplicate_cluster_count": int(df["duplicate_cluster"].nunique()),
            "near_duplicate_cluster_count": int(df["near_duplicate_cluster"].nunique()),
            "overall_band_counts": {
                str(float(band)): int(count)
                for band, count in band_class_counts(df["band"]).items()
            },
        },
        "columns": list(df.columns),
    }


def load_benchmark_frame() -> pd.DataFrame:
    hf_df = _load_hf_public_data()
    crawled_df = _load_crawled_ielts_data()
    frames = [hf_df]
    if not crawled_df.empty:
        for col in crawled_df.columns:
            if col not in hf_df.columns:
                hf_df[col] = np.nan
        for col in hf_df.columns:
            if col not in crawled_df.columns:
                crawled_df[col] = np.nan
        crawled_df = crawled_df[hf_df.columns]
        frames.append(crawled_df)

    df = pd.concat(frames, ignore_index=True)
    df = _prepare_benchmark_columns(df)
    df = _drop_exact_duplicates(df)
    df = _assign_locked_splits(df)
    return df.reset_index(drop=True)


def load_clean_data() -> pd.DataFrame:
    return load_benchmark_frame()


if __name__ == "__main__":
    benchmark = load_clean_data()
    print(json.dumps(summarize_benchmark_frame(benchmark), indent=2))
    print_rubric_band_class_counts(benchmark)
