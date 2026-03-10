"""
Task Achievement feature extraction for IELTS scoring.

- Discourse marker counts + density score (Group A)
- Semantic development depth: prompt–paragraph similarity, progression, diversity (Group D)
- Surface: word_count
"""

from __future__ import annotations

import math
import re

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from .utils import MARKER_GROUPS, OPTIMAL_DENSITY, SIGMA, split_paragraphs, split_sentences

TASK_ACHIEVEMENT_FEATURE_NAMES = [
    "word_count",
    "n_example_markers",
    "n_reason_markers",
    "n_contrast_markers",
    "n_addition_markers",
    "discourse_marker_density_score",
    "mean_prompt_paragraph_sim",
    "prompt_sim_progression",
    "inter_paragraph_diversity",
]


def _count_markers(text_lower: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for group, patterns in MARKER_GROUPS.items():
        counts[group] = sum(len(re.findall(p, text_lower)) for p in patterns)
    return counts


def discourse_marker_features(essay: str) -> dict[str, float]:
    """Extract discourse marker counts and density score."""
    lower = essay.lower()
    counts = _count_markers(lower)
    total = sum(counts.values())
    sent_count = max(len(split_sentences(essay)), 1)

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
