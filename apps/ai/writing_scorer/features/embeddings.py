"""
Embedding-based feature extraction utilities for IELTS scoring.

- full essay embeddings using MiniLM
- optional disk caching keyed by essay hash
"""

from __future__ import annotations

import hashlib

import numpy as np
import pandas as pd

from .utils import get_cache_dir, get_sbert_model

EMBEDDING_DIM = 384
EMBEDDING_FEATURE_NAMES = [
    f"essay_embedding_{index:03d}" for index in range(EMBEDDING_DIM)
]
ESSAY_EMBEDDING_CACHE_PATH = get_cache_dir() / "essay_embeddings.parquet"


def _essay_hash(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def _load_embedding_cache() -> pd.DataFrame | None:
    if not ESSAY_EMBEDDING_CACHE_PATH.exists():
        return None
    cached = pd.read_parquet(ESSAY_EMBEDDING_CACHE_PATH)
    expected = {"essay_hash", *EMBEDDING_FEATURE_NAMES}
    if not expected.issubset(cached.columns):
        return None
    return cached.drop_duplicates("essay_hash", keep="last")


def _append_embedding_cache(new_rows: list[dict[str, float | str]]) -> None:
    new_df = pd.DataFrame(new_rows)
    cached = _load_embedding_cache()
    if cached is None:
        combined = new_df
    else:
        combined = pd.concat([cached, new_df], ignore_index=True)
        combined = combined.drop_duplicates("essay_hash", keep="last")
    combined.to_parquet(ESSAY_EMBEDDING_CACHE_PATH, index=False)


def extract_essay_embedding_features(
    essays: list[str],
    model=None,
    batch_size: int = 32,
    use_cache: bool = True,
) -> np.ndarray:
    """Return one cached MiniLM embedding per essay in a stable column order."""
    if not essays:
        return np.empty((0, EMBEDDING_DIM), dtype=np.float64)

    if model is None:
        model = get_sbert_model()

    essay_hashes = [_essay_hash(essay) for essay in essays]
    rows: list[np.ndarray | None] = [None] * len(essays)

    cached_map: dict[str, np.ndarray] = {}
    if use_cache:
        cached = _load_embedding_cache()
        if cached is not None:
            for row in cached.itertuples(index=False):
                cached_map[row.essay_hash] = np.asarray(
                    [getattr(row, name) for name in EMBEDDING_FEATURE_NAMES],
                    dtype=np.float64,
                )

    missing_indices: list[int] = []
    for i, essay_hash in enumerate(essay_hashes):
        cached_row = cached_map.get(essay_hash)
        if cached_row is None:
            missing_indices.append(i)
        else:
            rows[i] = cached_row

    if missing_indices:
        missing_essays = [essays[i] for i in missing_indices]
        encoded = np.asarray(
            model.encode(
                missing_essays,
                batch_size=batch_size,
                show_progress_bar=True,
                convert_to_numpy=True,
            ),
            dtype=np.float64,
        )
        if encoded.ndim != 2 or encoded.shape[1] != EMBEDDING_DIM:
            raise ValueError(
                f"Expected essay embeddings with shape (n, {EMBEDDING_DIM}), "
                f"got {encoded.shape}."
            )

        new_cache_rows: list[dict[str, float | str]] = []
        for row_index, essay_index in enumerate(missing_indices):
            embedding = encoded[row_index]
            rows[essay_index] = embedding
            new_cache_rows.append({
                "essay_hash": essay_hashes[essay_index],
                **{
                    feature_name: float(value)
                    for feature_name, value in zip(
                        EMBEDDING_FEATURE_NAMES, embedding, strict=False
                    )
                },
            })

        if use_cache and new_cache_rows:
            _append_embedding_cache(new_cache_rows)

    return np.vstack(rows).astype(np.float64, copy=False)
