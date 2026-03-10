"""
Coherence and Cohesion feature extraction for IELTS scoring.

- discourse-aware coherence from body-paragraph sentence transitions
- structural depth via paragraph and sentence balance
- readability features via textstat
- sentence-to-sentence coherence flow from MiniLM embeddings
"""

from __future__ import annotations

import hashlib
import re
from functools import lru_cache

import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

from .utils import (
    MARKER_GROUPS,
    body_paragraphs,
    get_cache_dir,
    split_paragraphs,
    split_sentences,
)

BASE_COHERENCE_FEATURE_NAMES = [
    "mean_discourse_coherence",
]
STRUCTURAL_FEATURE_NAMES = [
    "avg_sentences_per_paragraph",
    "body_paragraph_count",
]
READABILITY_FEATURE_NAMES = [
    "flesch_reading_ease",
    "flesch_kincaid_grade",
    "gunning_fog",
    "smog_index",
]
SENTENCE_COHERENCE_FEATURE_NAMES = [
    "sentence_coherence_mean",
    "sentence_coherence_std",
    "sentence_coherence_min",
    "sentence_coherence_max",
]
COHERENCE_FEATURE_NAMES = [
    *BASE_COHERENCE_FEATURE_NAMES,
    *STRUCTURAL_FEATURE_NAMES,
    *READABILITY_FEATURE_NAMES,
    *SENTENCE_COHERENCE_FEATURE_NAMES,
]

_SENTENCE_COHERENCE_CACHE_PATH = get_cache_dir() / "sentence_coherence_features.parquet"


def _essay_hash(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def _to_finite_float(value: float | int | None) -> float:
    if value is None:
        return 0.0
    try:
        value = float(value)
    except (TypeError, ValueError):
        return 0.0
    if not np.isfinite(value):
        return 0.0
    return float(value)


@lru_cache(maxsize=1)
def _get_textstat():
    import textstat

    return textstat


def _load_sentence_coherence_cache() -> pd.DataFrame | None:
    if not _SENTENCE_COHERENCE_CACHE_PATH.exists():
        return None
    cached = pd.read_parquet(_SENTENCE_COHERENCE_CACHE_PATH)
    expected = {"essay_hash", *SENTENCE_COHERENCE_FEATURE_NAMES}
    if not expected.issubset(cached.columns):
        return None
    return cached.drop_duplicates("essay_hash", keep="last")


def _append_sentence_coherence_cache(new_rows: list[dict[str, float | str]]) -> None:
    new_df = pd.DataFrame(new_rows)
    cached = _load_sentence_coherence_cache()
    if cached is None:
        combined = new_df
    else:
        combined = pd.concat([cached, new_df], ignore_index=True)
        combined = combined.drop_duplicates("essay_hash", keep="last")
    combined.to_parquet(_SENTENCE_COHERENCE_CACHE_PATH, index=False)


def _label_sentence(sent: str) -> str:
    lower = sent.lower()
    for label in ("contrast", "reason", "example"):
        if any(re.search(p, lower) for p in MARKER_GROUPS[label]):
            return label
    return "neutral"


def _discourse_aware_score(sim: float, label: str) -> float:
    if label == "contrast":
        return 1.0 - sim
    return sim


def _sentence_similarity_stats(sent_embeddings: np.ndarray) -> dict[str, float]:
    if len(sent_embeddings) < 2:
        return {
            "sentence_coherence_mean": 0.0,
            "sentence_coherence_std": 0.0,
            "sentence_coherence_min": 0.0,
            "sentence_coherence_max": 0.0,
        }

    norms = np.linalg.norm(sent_embeddings, axis=1, keepdims=True)
    safe_norms = np.clip(norms, 1e-12, None)
    normalized = sent_embeddings / safe_norms
    sims = np.sum(normalized[:-1] * normalized[1:], axis=1)

    return {
        "sentence_coherence_mean": _to_finite_float(np.mean(sims)),
        "sentence_coherence_std": _to_finite_float(np.std(sims)),
        "sentence_coherence_min": _to_finite_float(np.min(sims)),
        "sentence_coherence_max": _to_finite_float(np.max(sims)),
    }


def coherence_features(
    body_paragraphs_list: list[str],
    sent_embeddings: np.ndarray,
    sent_offsets: list[tuple[int, int]],
) -> dict[str, float]:
    """Compute discourse-aware coherence from pre-computed body sentence embeddings."""
    if not body_paragraphs_list:
        return {"mean_discourse_coherence": 0.0}

    all_body_sents: list[str] = []
    for para in body_paragraphs_list:
        all_body_sents.extend(split_sentences(para))
    labels = [_label_sentence(s) for s in all_body_sents]

    para_scores: list[float] = []
    for start, end in sent_offsets:
        if end - start < 2:
            continue
        pair_scores: list[float] = []
        for i in range(start, end - 1):
            sim = cosine_similarity(
                sent_embeddings[i : i + 1], sent_embeddings[i + 1 : i + 2]
            )[0, 0]
            score = _discourse_aware_score(float(sim), labels[i + 1])
            pair_scores.append(score)
        if pair_scores:
            para_scores.append(float(np.mean(pair_scores)))

    if not para_scores:
        return {"mean_discourse_coherence": 0.0}

    return {
        "mean_discourse_coherence": float(np.mean(para_scores)),
    }


def structural_features(essay: str) -> dict[str, float]:
    """Extract retained structural depth signals for coherence scoring."""
    paragraphs = split_paragraphs(essay)
    body = body_paragraphs(paragraphs)
    sents = split_sentences(essay)
    para_count = max(len(paragraphs), 1)

    return {
        "avg_sentences_per_paragraph": _to_finite_float(len(sents) / para_count),
        "body_paragraph_count": float(len(body)),
    }


def extract_readability_features(essay: str) -> dict[str, float]:
    """Return stable readability metrics for one essay."""
    textstat = _get_textstat()

    metrics = {
        "flesch_reading_ease": textstat.flesch_reading_ease,
        "flesch_kincaid_grade": textstat.flesch_kincaid_grade,
        "gunning_fog": textstat.gunning_fog,
        "smog_index": textstat.smog_index,
    }
    features: dict[str, float] = {}
    for name, func in metrics.items():
        try:
            features[name] = _to_finite_float(func(essay))
        except Exception:
            features[name] = 0.0
    return features


def extract_sentence_coherence_features_batch(
    essays: list[str],
    model,
    batch_size: int = 64,
    use_cache: bool = True,
) -> np.ndarray:
    """Return consecutive-sentence coherence stats for each essay.

    Features are cached by essay hash so repeat training runs do not need to
    recompute the embedding-based sentence flow statistics.
    """
    if not essays:
        return np.empty((0, len(SENTENCE_COHERENCE_FEATURE_NAMES)), dtype=np.float64)

    rows: list[list[float] | None] = [None] * len(essays)
    essay_hashes = [_essay_hash(essay) for essay in essays]

    cached_map: dict[str, np.ndarray] = {}
    if use_cache:
        cached = _load_sentence_coherence_cache()
        if cached is not None:
            for row in cached.itertuples(index=False):
                cached_map[row.essay_hash] = np.asarray(
                    [getattr(row, name) for name in SENTENCE_COHERENCE_FEATURE_NAMES],
                    dtype=np.float64,
                )

    missing_indices: list[int] = []
    for i, essay_hash in enumerate(essay_hashes):
        cached_row = cached_map.get(essay_hash)
        if cached_row is None:
            missing_indices.append(i)
        else:
            rows[i] = cached_row.tolist()

    if missing_indices:
        all_sentences: list[str] = []
        sent_offsets: dict[int, tuple[int, int]] = {}
        for idx in missing_indices:
            sentences = split_sentences(essays[idx])
            start = len(all_sentences)
            all_sentences.extend(sentences)
            sent_offsets[idx] = (start, len(all_sentences))

        if all_sentences:
            sent_embeddings = model.encode(
                all_sentences,
                batch_size=batch_size,
                show_progress_bar=True,
                convert_to_numpy=True,
            )
        else:
            sent_embeddings = np.empty((0, 0), dtype=np.float64)

        new_cache_rows: list[dict[str, float | str]] = []
        for idx in missing_indices:
            start, end = sent_offsets[idx]
            stats = _sentence_similarity_stats(sent_embeddings[start:end])
            rows[idx] = [stats[name] for name in SENTENCE_COHERENCE_FEATURE_NAMES]
            new_cache_rows.append({
                "essay_hash": essay_hashes[idx],
                **stats,
            })

        if use_cache and new_cache_rows:
            _append_sentence_coherence_cache(new_cache_rows)

    return np.asarray(rows, dtype=np.float64)
