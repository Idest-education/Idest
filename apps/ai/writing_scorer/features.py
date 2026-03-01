"""
Feature extraction for IELTS Task Achievement scoring (Groups A-D).

Group A: Discourse marker counts + overuse penalty
Group B: Discourse-aware coherence (sentence embeddings + marker labels)
Group C: Structural depth (sentence/paragraph counts)
Group D: Semantic development depth (paragraph embeddings vs prompt)
"""

from __future__ import annotations

import math
import re

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# ── Shared Constants ─────────────────────────────────────────────────────────

MARKER_GROUPS: dict[str, list[str]] = {
    "example": [
        r"\bfor example\b",
        r"\bfor instance\b",
        r"\bsuch as\b",
        r"\be\.g\.\b",
        r"\bto illustrate\b",
        r"\ba case in point\b",
    ],
    "reason": [
        r"\bbecause\b",
        r"\bsince\b",
        r"\btherefore\b",
        r"\bthus\b",
        r"\bas a result\b",
        r"\bconsequently\b",
        r"\bthis is because\b",
    ],
    "contrast": [
        r"\bhowever\b",
        r"\bon the other hand\b",
        r"\balthough\b",
        r"\bnevertheless\b",
        r"\bdespite\b",
        r"\bwhereas\b",
    ],
    "addition": [
        r"\bfurthermore\b",
        r"\bmoreover\b",
        r"\bin addition\b",
        r"\badditionally\b",
    ],
}

OPTIMAL_DENSITY = 0.15
SIGMA = 0.08

_SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
_PARA_SPLIT_RE = re.compile(r"\n\s*\n")


def _split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENT_SPLIT_RE.split(text) if s.strip()]


def _split_paragraphs(text: str) -> list[str]:
    return [p.strip() for p in _PARA_SPLIT_RE.split(text) if p.strip()]


def _body_paragraphs(paragraphs: list[str]) -> list[str]:
    if len(paragraphs) >= 3:
        return paragraphs[1:-1]
    return paragraphs


# ── Group A: Discourse Marker Features ───────────────────────────────────────

def _count_markers(text_lower: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for group, patterns in MARKER_GROUPS.items():
        counts[group] = sum(len(re.findall(p, text_lower)) for p in patterns)
    return counts


def discourse_marker_features(essay: str) -> dict[str, float]:
    lower = essay.lower()
    counts = _count_markers(lower)
    total = sum(counts.values())
    sent_count = max(len(_split_sentences(essay)), 1)

    raw_density = total / sent_count
    density_score = math.exp(
        -((raw_density - OPTIMAL_DENSITY) ** 2) / (2 * SIGMA**2)
    )

    return {
        "n_example_markers": float(counts["example"]),
        "n_reason_markers": float(counts["reason"]),
        "n_contrast_markers": float(counts["contrast"]),
        "n_addition_markers": float(counts["addition"]),
        "discourse_marker_density_score": density_score,
    }


# ── Group B: Discourse-Aware Coherence ───────────────────────────────────────

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


def coherence_features(
    body_paragraphs: list[str],
    sent_embeddings: np.ndarray,
    sent_offsets: list[tuple[int, int]],
) -> dict[str, float]:
    """Compute discourse-aware coherence from pre-computed sentence embeddings.

    body_paragraphs: the body paragraphs (excluding intro/conclusion)
    sent_embeddings: sentence embeddings for body paragraph sentences only (N x D)
    sent_offsets: list of (start_idx, end_idx) per body paragraph into sent_embeddings
    """
    if not body_paragraphs:
        return {"mean_discourse_coherence": 0.0, "min_paragraph_discourse_coherence": 0.0}

    # Build labels aligned to sent_embeddings indices
    all_body_sents: list[str] = []
    for para in body_paragraphs:
        all_body_sents.extend(_split_sentences(para))
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
        return {"mean_discourse_coherence": 0.0, "min_paragraph_discourse_coherence": 0.0}

    return {
        "mean_discourse_coherence": float(np.mean(para_scores)),
        "min_paragraph_discourse_coherence": float(np.min(para_scores)),
    }


# ── Group C: Structural Depth Features ───────────────────────────────────────

def structural_features(essay: str) -> dict[str, float]:
    paragraphs = _split_paragraphs(essay)
    body = _body_paragraphs(paragraphs)
    sents = _split_sentences(essay)
    para_word_counts = [len(p.split()) for p in paragraphs]

    sent_count = max(len(sents), 1)
    para_count = max(len(paragraphs), 1)

    return {
        "sentence_count": float(sent_count),
        "avg_sentences_per_paragraph": len(sents) / para_count,
        "avg_paragraph_length": float(np.mean(para_word_counts)) if para_word_counts else 0.0,
        "body_paragraph_count": float(len(body)),
        "longest_paragraph_words": float(max(para_word_counts)) if para_word_counts else 0.0,
    }


# ── Group D: Semantic Development Depth ──────────────────────────────────────

def semantic_depth_features(
    prompt_emb: np.ndarray,
    para_embs: np.ndarray,
) -> dict[str, float]:
    """Compute semantic depth from pre-computed prompt and paragraph embeddings."""
    if len(para_embs) == 0:
        return {
            "mean_prompt_paragraph_sim": 0.0,
            "prompt_sim_progression": 0.0,
            "inter_paragraph_diversity": 0.0,
        }

    sims = cosine_similarity(prompt_emb.reshape(1, -1), para_embs)[0]
    mean_sim = float(np.mean(sims))

    if len(sims) > 1:
        progression = float(np.polyfit(range(len(sims)), sims, 1)[0])
    else:
        progression = 0.0

    if len(para_embs) > 1:
        inter = cosine_similarity(para_embs)
        mask = np.triu_indices_from(inter, k=1)
        diversity = 1.0 - float(np.mean(inter[mask]))
    else:
        diversity = 0.0

    return {
        "mean_prompt_paragraph_sim": mean_sim,
        "prompt_sim_progression": progression,
        "inter_paragraph_diversity": diversity,
    }


# ── Orchestrator ─────────────────────────────────────────────────────────────

FEATURE_NAMES = [
    # Surface (existing)
    "cosine_sim",
    "word_count",
    "paragraph_count",
    # Group A
    "n_example_markers",
    "n_reason_markers",
    "n_contrast_markers",
    "n_addition_markers",
    "discourse_marker_density_score",
    # Group B
    "mean_discourse_coherence",
    "min_paragraph_discourse_coherence",
    # Group C
    "sentence_count",
    "avg_sentences_per_paragraph",
    "avg_paragraph_length",
    "body_paragraph_count",
    "longest_paragraph_words",
    # Group D
    "mean_prompt_paragraph_sim",
    "prompt_sim_progression",
    "inter_paragraph_diversity",
]


def extract_classical_features(
    prompts: list[str],
    essays: list[str],
    model: SentenceTransformer,
) -> np.ndarray:
    """Extract Groups A-D features for all essays. Returns (N, 18) array."""
    n = len(essays)
    print(f"  Extracting classical features for {n} essays...")

    # ── Batch encode prompts & essays (surface similarity) ───────────────
    print("    Encoding prompts...")
    prompt_embs = model.encode(prompts, show_progress_bar=True, convert_to_numpy=True)
    print("    Encoding essays...")
    essay_embs = model.encode(essays, show_progress_bar=True, convert_to_numpy=True)

    cosine_sims = np.array([
        cosine_similarity(prompt_embs[i : i + 1], essay_embs[i : i + 1])[0, 0]
        for i in range(n)
    ])

    # ── Batch encode all sentences (for Group B coherence) ───────────────
    print("    Splitting and encoding sentences...")
    all_sents: list[str] = []
    essay_sent_offsets: list[list[tuple[int, int]]] = []

    for essay in essays:
        paragraphs = _split_paragraphs(essay)
        body = _body_paragraphs(paragraphs)
        para_offsets: list[tuple[int, int]] = []
        for para in body:
            sents = _split_sentences(para)
            start = len(all_sents)
            all_sents.extend(sents)
            para_offsets.append((start, len(all_sents)))
        essay_sent_offsets.append(para_offsets)

    if all_sents:
        all_sent_embs = model.encode(all_sents, show_progress_bar=True, convert_to_numpy=True)
    else:
        all_sent_embs = np.empty((0, prompt_embs.shape[1]))

    # ── Batch encode all paragraphs (for Group D depth) ──────────────────
    print("    Encoding paragraphs...")
    all_paras: list[str] = []
    essay_para_offsets: list[tuple[int, int]] = []

    for essay in essays:
        paragraphs = _split_paragraphs(essay)
        start = len(all_paras)
        all_paras.extend(paragraphs)
        essay_para_offsets.append((start, len(all_paras)))

    if all_paras:
        all_para_embs = model.encode(all_paras, show_progress_bar=True, convert_to_numpy=True)
    else:
        all_para_embs = np.empty((0, prompt_embs.shape[1]))

    # ── Build feature matrix row by row ──────────────────────────────────
    print("    Computing per-essay features...")
    rows: list[np.ndarray] = []

    for i in range(n):
        essay = essays[i]
        word_count = len(essay.split())
        paragraph_count = len(_split_paragraphs(essay))

        # Group A
        dm = discourse_marker_features(essay)

        # Group B
        sent_offsets = essay_sent_offsets[i]
        sent_start = sent_offsets[0][0] if sent_offsets else 0
        sent_end = sent_offsets[-1][1] if sent_offsets else 0
        essay_sent_embs = all_sent_embs[sent_start:sent_end]

        local_offsets = [
            (s - sent_start, e - sent_start) for s, e in sent_offsets
        ]
        body = _body_paragraphs(_split_paragraphs(essay))
        coh = coherence_features(body, essay_sent_embs, local_offsets)

        # Group C
        struct = structural_features(essay)

        # Group D
        p_start, p_end = essay_para_offsets[i]
        para_embs = all_para_embs[p_start:p_end]
        depth = semantic_depth_features(prompt_embs[i], para_embs)

        row = np.array([
            cosine_sims[i],
            word_count,
            paragraph_count,
            dm["n_example_markers"],
            dm["n_reason_markers"],
            dm["n_contrast_markers"],
            dm["n_addition_markers"],
            dm["discourse_marker_density_score"],
            coh["mean_discourse_coherence"],
            coh["min_paragraph_discourse_coherence"],
            struct["sentence_count"],
            struct["avg_sentences_per_paragraph"],
            struct["avg_paragraph_length"],
            struct["body_paragraph_count"],
            struct["longest_paragraph_words"],
            depth["mean_prompt_paragraph_sim"],
            depth["prompt_sim_progression"],
            depth["inter_paragraph_diversity"],
        ])
        rows.append(row)

    result = np.vstack(rows)
    print(f"    Feature matrix shape: {result.shape}")
    return result
