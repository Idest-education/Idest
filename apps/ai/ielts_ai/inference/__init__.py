"""Artifact-backed CatBoost inference and score formatting."""

from ielts_ai.inference.scorer import (
    ArtifactBackedScorer,
    DEFAULT_MODEL_FILES,
    DERIVED_OVERALL_TARGET,
    DIRECT_OVERALL_TARGET,
    HYBRID_OVERALL_TARGET,
    RUBRIC_RESPONSE_KEYS,
    RUBRIC_TARGETS,
    ScoringResult,
    build_score_description,
    clip_scores,
    derive_overall_score,
    get_scorer,
    round_to_half_band,
)

__all__ = [
    "ArtifactBackedScorer",
    "DEFAULT_MODEL_FILES",
    "DERIVED_OVERALL_TARGET",
    "DIRECT_OVERALL_TARGET",
    "HYBRID_OVERALL_TARGET",
    "RUBRIC_RESPONSE_KEYS",
    "RUBRIC_TARGETS",
    "ScoringResult",
    "build_score_description",
    "clip_scores",
    "derive_overall_score",
    "get_scorer",
    "round_to_half_band",
]
