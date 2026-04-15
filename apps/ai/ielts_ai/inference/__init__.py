"""Artifact-backed CatBoost inference and score formatting."""

from ielts_ai.inference.task1_scorer import (
    Task1ArtifactBackedScorer,
    decode_image_base64,
    get_task1_scorer,
    resolve_task1_figure_description,
)
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
    "Task1ArtifactBackedScorer",
    "decode_image_base64",
    "get_task1_scorer",
    "resolve_task1_figure_description",
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
