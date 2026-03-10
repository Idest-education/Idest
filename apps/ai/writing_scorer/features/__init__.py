"""
IELTS feature extraction organized by rubric criteria.

- task_achievement_features: discourse markers, semantic depth, surface metrics
- coherence_features: discourse-aware coherence, structural depth, readability
- lexical_features: lexical diversity, sophistication, density, repetition, PMI, syntax
- grammar_features: LanguageTool spelling/grammar
- embeddings: full essay embeddings
"""

from __future__ import annotations

import numpy as np
from sentence_transformers import SentenceTransformer

from . import coherence_features as coherence_features_module
from . import embeddings as embeddings_module
from . import grammar_features as grammar_features_module
from . import lexical_features as lexical_features_module
from . import task_achievement_features as task_achievement_features_module
from .coherence_features import (
    READABILITY_FEATURE_NAMES,
    SENTENCE_COHERENCE_FEATURE_NAMES,
    coherence_features,
    extract_readability_features,
    extract_sentence_coherence_features_batch,
    structural_features,
)
from .embeddings import EMBEDDING_FEATURE_NAMES, extract_essay_embedding_features
from .grammar_features import (
    LT_FEATURE_NAMES,
    extract_lt_features,
    extract_lt_features_batch,
    get_languagetool,
)
from .lexical_features import (
    LEXICAL_FEATURE_NAMES,
    SYNTAX_FEATURE_NAMES,
    extract_lexical_features_batch,
    extract_syntax_features_batch,
)
from .task_achievement_features import discourse_marker_features, semantic_depth_features
from .utils import body_paragraphs, get_sbert_model, split_paragraphs, split_sentences

ENABLE_READABILITY = True
ENABLE_SYNTAX = True
ENABLE_COHERENCE = True
ENABLE_EMBEDDINGS = True
ENABLE_LLM = True
ENABLE_LANGUAGE_TOOL = True
ENABLE_EMBEDDING_CACHE = True
EMBEDDING_BATCH_SIZE = 64

DEFAULT_FEATURE_FLAGS = {
    "readability": ENABLE_READABILITY,
    "syntax": ENABLE_SYNTAX,
    "sentence_coherence": ENABLE_COHERENCE,
    "essay_embeddings": ENABLE_EMBEDDINGS,
    "llm": ENABLE_LLM,
    "languagetool": ENABLE_LANGUAGE_TOOL,
    "cache_embeddings": ENABLE_EMBEDDING_CACHE,
    "embedding_batch_size": EMBEDDING_BATCH_SIZE,
}

CORE_FEATURE_NAMES = [
    "word_count",
    "n_example_markers",
    "n_reason_markers",
    "n_contrast_markers",
    "n_addition_markers",
    "discourse_marker_density_score",
    "mean_discourse_coherence",
    "avg_sentences_per_paragraph",
    "body_paragraph_count",
    "mean_prompt_paragraph_sim",
    "prompt_sim_progression",
    "inter_paragraph_diversity",
]

__all__ = [
    "ENABLE_READABILITY",
    "ENABLE_SYNTAX",
    "ENABLE_COHERENCE",
    "ENABLE_EMBEDDINGS",
    "DEFAULT_FEATURE_FLAGS",
    "CORE_FEATURE_NAMES",
    "FEATURE_NAMES",
    "EMBEDDING_FEATURE_NAMES",
    "LT_FEATURE_NAMES",
    "READABILITY_FEATURE_NAMES",
    "SENTENCE_COHERENCE_FEATURE_NAMES",
    "SYNTAX_FEATURE_NAMES",
    "extract_essay_embedding_features",
    "extract_classical_features",
    "extract_lt_features",
    "extract_lt_features_batch",
    "get_classical_feature_names",
    "get_languagetool",
    "resolve_feature_flags",
    "get_sbert_model",
    "task_achievement_features_module",
    "coherence_features_module",
    "lexical_features_module",
    "grammar_features_module",
    "embeddings_module",
]


def resolve_feature_flags(feature_flags: dict[str, object] | None = None) -> dict[str, object]:
    flags = dict(DEFAULT_FEATURE_FLAGS)
    if feature_flags:
        flags.update(feature_flags)
    return flags


def get_classical_feature_names(feature_flags: dict[str, object] | None = None) -> list[str]:
    flags = resolve_feature_flags(feature_flags)
    names = list(CORE_FEATURE_NAMES)
    if flags["readability"]:
        names.extend(READABILITY_FEATURE_NAMES)
    if flags["sentence_coherence"]:
        names.extend(SENTENCE_COHERENCE_FEATURE_NAMES)
    names.extend(LEXICAL_FEATURE_NAMES)
    if flags["syntax"]:
        names.extend(SYNTAX_FEATURE_NAMES)
    return names


FEATURE_NAMES = get_classical_feature_names()


def extract_classical_features(
    prompts: list[str],
    essays: list[str],
    model: SentenceTransformer,
    feature_flags: dict[str, object] | None = None,
) -> np.ndarray:
    """Extract TA, coherence, and lexical features for all essays."""
    if len(prompts) != len(essays):
        raise ValueError("prompts and essays must have the same length")

    flags = resolve_feature_flags(feature_flags)
    feature_names = get_classical_feature_names(flags)
    n = len(essays)
    print(f"  Extracting classical features for {n} essays...")

    print("    Encoding prompts...")
    prompt_embs = model.encode(
        prompts,
        batch_size=int(flags["embedding_batch_size"]),
        show_progress_bar=True,
        convert_to_numpy=True,
    )

    print("    Splitting and encoding sentences...")
    essay_body_paragraphs: list[list[str]] = []
    all_body_sents: list[str] = []
    essay_sent_offsets: list[list[tuple[int, int]]] = []

    for essay in essays:
        paragraphs = split_paragraphs(essay)
        body = body_paragraphs(paragraphs)
        essay_body_paragraphs.append(body)
        para_offsets: list[tuple[int, int]] = []
        for para in body:
            sents = split_sentences(para)
            start = len(all_body_sents)
            all_body_sents.extend(sents)
            para_offsets.append((start, len(all_body_sents)))
        essay_sent_offsets.append(para_offsets)

    if all_body_sents:
        all_sent_embs = model.encode(
            all_body_sents,
            batch_size=int(flags["embedding_batch_size"]),
            show_progress_bar=True,
            convert_to_numpy=True,
        )
    else:
        all_sent_embs = np.empty((0, prompt_embs.shape[1]))

    print("    Encoding paragraphs...")
    all_paras: list[str] = []
    essay_para_offsets: list[tuple[int, int]] = []

    for essay in essays:
        paragraphs = split_paragraphs(essay)
        start = len(all_paras)
        all_paras.extend(paragraphs)
        essay_para_offsets.append((start, len(all_paras)))

    if all_paras:
        all_para_embs = model.encode(
            all_paras,
            batch_size=int(flags["embedding_batch_size"]),
            show_progress_bar=True,
            convert_to_numpy=True,
        )
    else:
        all_para_embs = np.empty((0, prompt_embs.shape[1]))

    print("    Extracting lexical features...")
    lexical_rows = extract_lexical_features_batch(essays)
    syntax_rows = None
    readability_rows = None
    sentence_coherence_rows = None

    if flags["syntax"]:
        print("    Extracting syntax features...")
        syntax_rows = extract_syntax_features_batch(
            essays,
            batch_size=max(8, int(flags["embedding_batch_size"]) // 2),
        )

    if flags["readability"]:
        print("    Extracting readability features...")
        readability_dicts = [extract_readability_features(essay) for essay in essays]
        readability_rows = np.asarray(
            [
                [readability[name] for name in READABILITY_FEATURE_NAMES]
                for readability in readability_dicts
            ],
            dtype=np.float64,
        )

    if flags["sentence_coherence"]:
        print("    Extracting sentence coherence features...")
        sentence_coherence_rows = extract_sentence_coherence_features_batch(
            essays,
            model=model,
            batch_size=int(flags["embedding_batch_size"]),
            use_cache=bool(flags["cache_embeddings"]),
        )

    print("    Computing per-essay features...")
    rows: list[np.ndarray] = []

    for i in range(n):
        essay = essays[i]
        word_count = len(essay.split())

        dm = discourse_marker_features(essay)

        sent_offsets = essay_sent_offsets[i]
        sent_start = sent_offsets[0][0] if sent_offsets else 0
        sent_end = sent_offsets[-1][1] if sent_offsets else 0
        essay_sent_embs = all_sent_embs[sent_start:sent_end]

        local_offsets = [
            (s - sent_start, e - sent_start) for s, e in sent_offsets
        ]
        body = essay_body_paragraphs[i]
        coh = coherence_features(body, essay_sent_embs, local_offsets)

        struct = structural_features(essay)

        p_start, p_end = essay_para_offsets[i]
        para_embs = all_para_embs[p_start:p_end]
        depth = semantic_depth_features(prompt_embs[i], para_embs)
        lexical = lexical_rows[i]

        row_values = [
            word_count,
            dm["n_example_markers"],
            dm["n_reason_markers"],
            dm["n_contrast_markers"],
            dm["n_addition_markers"],
            dm["discourse_marker_density_score"],
            coh["mean_discourse_coherence"],
            struct["avg_sentences_per_paragraph"],
            struct["body_paragraph_count"],
            depth["mean_prompt_paragraph_sim"],
            depth["prompt_sim_progression"],
            depth["inter_paragraph_diversity"],
        ]
        if readability_rows is not None:
            row_values.extend(readability_rows[i].tolist())
        if sentence_coherence_rows is not None:
            row_values.extend(sentence_coherence_rows[i].tolist())
        row_values.extend(lexical.tolist())
        if syntax_rows is not None:
            row_values.extend(syntax_rows[i].tolist())
        row = np.asarray(row_values, dtype=np.float64)
        rows.append(row)

    if not rows:
        return np.empty((0, len(feature_names)), dtype=np.float64)
    result = np.vstack(rows)
    print(f"    Feature matrix shape: {result.shape}")
    return result
