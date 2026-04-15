"""Task 1 feature matrix: classical + optional embeddings, LanguageTool, Task 1 LLM block, reference-aware extras."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

import numpy as np
import pandas as pd

from ielts_ai.training.train_model import DatasetBundle
from ielts_ai.writing_scorer.features import (
    DEFAULT_FEATURE_FLAGS,
    EMBEDDING_FEATURE_NAMES,
    LT_FEATURE_NAMES,
    extract_classical_features,
    extract_essay_embedding_features,
    extract_lt_features_batch,
    get_classical_feature_names,
    get_languagetool,
    get_sbert_model,
    resolve_feature_flags,
)
from ielts_ai.writing_scorer.task1_llm_features import LLM_T1_FEATURE_NAMES

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

TASK1_REFERENCE_FEATURE_NAMES = [
    "t1_cosine_essay_image_desc",
    "t1_cosine_essay_prompt",
    "t1_year_count_essay",
    "t1_year_count_ref",
    "t1_year_overlap_ratio",
]

TASK1_DEFAULT_FEATURE_FLAGS: dict[str, object] = {
    **DEFAULT_FEATURE_FLAGS,
    "llm": False,
    "task1_llm": True,
    "task1_reference_feats": True,
}

_YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\b")


def resolve_task1_feature_flags(overrides: dict[str, object] | None = None) -> dict[str, object]:
    flags = dict(TASK1_DEFAULT_FEATURE_FLAGS)
    if overrides:
        flags.update(overrides)
    flags["llm"] = False
    return flags


def _catboost_feature_flags(flags: dict[str, object]) -> dict[str, object]:
    cat = resolve_feature_flags({k: flags[k] for k in DEFAULT_FEATURE_FLAGS})
    cat["llm"] = False
    return cat


def _cosine_rows(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    denom = np.linalg.norm(a, axis=1) * np.linalg.norm(b, axis=1)
    denom = np.maximum(denom, 1e-12)
    return np.sum(a * b, axis=1) / denom


def _year_stats(essays: list[str], refs: list[str]) -> np.ndarray:
    n = len(essays)
    ce = np.zeros(n, dtype=np.float64)
    cr = np.zeros(n, dtype=np.float64)
    ratio = np.zeros(n, dtype=np.float64)
    for i in range(n):
        ye = set(_YEAR_RE.findall(essays[i]))
        yr = set(_YEAR_RE.findall(refs[i]))
        ce[i] = float(len(ye))
        cr[i] = float(len(yr))
        if not ye:
            ratio[i] = 0.0
        else:
            ratio[i] = float(len(ye & yr)) / float(len(ye))
    return np.column_stack([ce, cr, ratio])


def _reference_feature_block(
    df: pd.DataFrame,
    model: SentenceTransformer,
    *,
    batch_size: int,
) -> tuple[np.ndarray, list[str]]:
    prompts = df["prompt"].astype(str).tolist()
    essays = df["essay"].astype(str).tolist()
    refs = df["image_description"].fillna("").astype(str).tolist()

    log("  Task 1 reference features: encoding essays / prompts / image descriptions...")
    emb_e = model.encode(
        essays,
        batch_size=batch_size,
        show_progress_bar=True,
        convert_to_numpy=True,
    )
    emb_p = model.encode(
        prompts,
        batch_size=batch_size,
        show_progress_bar=True,
        convert_to_numpy=True,
    )
    emb_r = model.encode(
        refs,
        batch_size=batch_size,
        show_progress_bar=True,
        convert_to_numpy=True,
    )

    cos_ed = _cosine_rows(emb_e, emb_r)
    cos_ep = _cosine_rows(emb_e, emb_p)
    for i in range(len(essays)):
        if not str(refs[i]).strip():
            cos_ed[i] = np.nan

    years = _year_stats(essays, refs)
    block = np.column_stack([cos_ed, cos_ep, years]).astype(np.float64, copy=False)
    return block, list(TASK1_REFERENCE_FEATURE_NAMES)


def build_task1_dataset_bundle(
    df: pd.DataFrame,
    feature_flags: dict[str, object] | None = None,
    *,
    verbose: bool = True,
) -> DatasetBundle:
    """Stack classical (+ optional embeddings, LT), Task 1 LLM columns, and reference-aware features."""
    flags = resolve_task1_feature_flags(feature_flags)
    cat_flags = _catboost_feature_flags(flags)
    log = print if verbose else lambda *_a, **_k: None
    log("Extracting Task 1 features...")

    df_working = df.reset_index(drop=True).copy()
    prompts = df_working["prompt"].astype(str).tolist()
    essays = df_working["essay"].astype(str).tolist()
    model = get_sbert_model()
    batch_size = int(cat_flags["embedding_batch_size"])

    classical_names = list(get_classical_feature_names(cat_flags))
    classical_block = extract_classical_features(prompts, essays, model, feature_flags=cat_flags)

    feature_names = list(classical_names)
    blocks: list[np.ndarray] = [classical_block]

    if bool(cat_flags["essay_embeddings"]):
        log("  Extracting full essay embeddings (Task 1)...")
        essay_embeddings = extract_essay_embedding_features(
            essays,
            model=model,
            batch_size=batch_size,
            use_cache=bool(cat_flags["cache_embeddings"]),
        )
        blocks.append(essay_embeddings)
        feature_names.extend(EMBEDDING_FEATURE_NAMES)
        log(f"  Essay embeddings: {essay_embeddings.shape[1]}")

    if bool(flags["task1_reference_feats"]):
        ref_block, ref_names = _reference_feature_block(
            df_working,
            model,
            batch_size=batch_size,
        )
        blocks.append(ref_block)
        feature_names.extend(ref_names)

    if bool(cat_flags["languagetool"]):
        log("  Extracting LanguageTool features (Task 1)...")
        lt_block = extract_lt_features_batch(essays, get_languagetool())
        blocks.append(lt_block)
        feature_names.extend(LT_FEATURE_NAMES)
        log(f"  LanguageTool features: {lt_block.shape[1]}")

    if bool(flags["task1_llm"]):
        missing = [c for c in LLM_T1_FEATURE_NAMES if c not in df_working.columns]
        if missing:
            log(f"  Task 1 LLM columns missing {missing} — disabling task1_llm block.")
            flags = {**flags, "task1_llm": False}
        else:
            llm_block = df_working[LLM_T1_FEATURE_NAMES].astype(np.float64).to_numpy()
            if np.isnan(llm_block).any():
                log("  Task 1 LLM block contains NaNs (CatBoost may still train).")
            blocks.append(llm_block)
            feature_names.extend(LLM_T1_FEATURE_NAMES)
            log(f"  Task 1 LLM features: {llm_block.shape[1]}")

    X = np.hstack(blocks) if len(blocks) > 1 else blocks[0]
    log(f"  Final Task 1 feature matrix: {X.shape} (n_samples={len(df_working)})")
    return DatasetBundle(
        frame=df_working,
        features=X,
        feature_names=feature_names,
        feature_flags=flags,
    )
