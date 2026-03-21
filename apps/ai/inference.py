from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

try:
    from catboost import CatBoostRegressor
except ImportError:
    CatBoostRegressor = None


_path = Path(__file__).resolve()
try:
    PROJECT_ROOT = _path.parents[2]  # Monorepo root when running from apps/ai/
except IndexError:
    PROJECT_ROOT = _path.parent  # Use app dir when shallow (e.g. Docker /app)
ARTIFACT_DIR = PROJECT_ROOT / "models" / "rubric_catboost"
RUBRIC_TARGETS = ("TA", "CC", "LR", "GR")
RUBRIC_RESPONSE_KEYS = {
    "TA": "task_achievement",
    "CC": "coherence",
    "LR": "lexical",
    "GR": "grammar",
}
DEFAULT_MODEL_FILES = {
    "TA": "ta_model.cbm",
    "CC": "cc_model.cbm",
    "LR": "lr_model.cbm",
    "GR": "gr_model.cbm",
    "band": "overall_model.cbm",
}


def _feature_dependencies():
    from writing_scorer.features import (
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

    return {
        "EMBEDDING_FEATURE_NAMES": EMBEDDING_FEATURE_NAMES,
        "LT_FEATURE_NAMES": LT_FEATURE_NAMES,
        "extract_classical_features": extract_classical_features,
        "extract_essay_embedding_features": extract_essay_embedding_features,
        "extract_lt_features_batch": extract_lt_features_batch,
        "get_classical_feature_names": get_classical_feature_names,
        "get_languagetool": get_languagetool,
        "get_sbert_model": get_sbert_model,
        "resolve_feature_flags": resolve_feature_flags,
    }


def _llm_dependencies():
    from writing_scorer.llm_features import LLM_FEATURE_NAMES, judge_essay

    return {
        "LLM_FEATURE_NAMES": LLM_FEATURE_NAMES,
        "judge_essay": judge_essay,
    }


def clip_scores(values: np.ndarray | list[float] | float) -> np.ndarray:
    return np.clip(np.asarray(values, dtype=np.float64), 0.0, 9.0)


def round_to_half_band(values: np.ndarray | list[float] | float) -> np.ndarray:
    return np.round(np.asarray(values, dtype=np.float64) * 2.0) / 2.0


def derive_overall_score(rubric_scores: dict[str, float]) -> float:
    values = np.asarray([rubric_scores[target] for target in RUBRIC_TARGETS], dtype=np.float64)
    return float(np.ravel(clip_scores(round_to_half_band(np.mean(values))))[0])


@dataclass(frozen=True)
class ScoringResult:
    scores: dict[str, float]
    description: str
    metadata: dict[str, Any]


class ArtifactBackedScorer:
    def __init__(self, artifact_dir: Path | None = None):
        if CatBoostRegressor is None:
            raise RuntimeError(
                "CatBoost is required for inference. Install dependencies from apps/ai/requirements.txt."
            )
        self.artifact_dir = artifact_dir or ARTIFACT_DIR
        self.metadata = self._load_metadata()
        self.models = self._load_models()
        self.feature_names = list(self.metadata.get("feature_names", []))
        if not self.feature_names:
            raise RuntimeError("Model metadata is missing feature_names.")
        self._features = _feature_dependencies()
        self._llm = _llm_dependencies()
        self.feature_flags = self._features["resolve_feature_flags"](self.metadata.get("feature_flags"))

    def _load_metadata(self) -> dict[str, Any]:
        metadata_path = self.artifact_dir / "metadata.json"
        if not metadata_path.exists():
            raise RuntimeError(f"Missing metadata file: {metadata_path}")
        with metadata_path.open(encoding="utf-8") as handle:
            return json.load(handle)

    def _load_models(self) -> dict[str, CatBoostRegressor]:
        model_files = dict(DEFAULT_MODEL_FILES)
        model_files.update(self.metadata.get("model_files", {}))
        loaded: dict[str, CatBoostRegressor] = {}
        for target, filename in model_files.items():
            model_path = self.artifact_dir / filename
            if not model_path.exists():
                continue
            model = CatBoostRegressor()
            model.load_model(str(model_path))
            loaded[target] = model
        if not loaded:
            raise RuntimeError(f"No CatBoost model artifacts found in {self.artifact_dir}")
        return loaded

    def _ordered_feature_row(self, prompt: str, essay: str) -> tuple[np.ndarray, list[str]]:
        degraded_features: list[str] = []
        feature_map: dict[str, float] = {}
        model = self._features["get_sbert_model"]()

        classical_values = self._features["extract_classical_features"](
            [prompt],
            [essay],
            model,
            feature_flags=self.feature_flags,
        )[0]
        classical_names = self._features["get_classical_feature_names"](self.feature_flags)
        feature_map.update({
            name: float(value) for name, value in zip(classical_names, classical_values, strict=False)
        })

        embedding_feature_names = self._features["EMBEDDING_FEATURE_NAMES"]
        llm_feature_names = self._llm["LLM_FEATURE_NAMES"]
        lt_feature_names = self._features["LT_FEATURE_NAMES"]

        if any(name in self.feature_names for name in embedding_feature_names):
            embedding_values = self._features["extract_essay_embedding_features"](
                [essay],
                model=model,
                batch_size=int(self.feature_flags["embedding_batch_size"]),
                use_cache=bool(self.feature_flags["cache_embeddings"]),
            )[0]
            feature_map.update({
                name: float(value)
                for name, value in zip(embedding_feature_names, embedding_values, strict=False)
            })

        if any(name in self.feature_names for name in llm_feature_names):
            try:
                judgment = self._llm["judge_essay"](prompt, essay)
                llm_values = [
                    float(judgment.has_position),
                    float(judgment.covers_all_parts),
                    float(sum(judgment.developed) / max(len(judgment.developed), 1)),
                ]
            except Exception:
                llm_values = [0.0, 0.0, 0.0]
                degraded_features.append("llm")
            feature_map.update({
                name: float(value)
                for name, value in zip(llm_feature_names, llm_values, strict=False)
            })

        if any(name in self.feature_names for name in lt_feature_names):
            lt_values = self._features["extract_lt_features_batch"](
                [essay],
                self._features["get_languagetool"](),
            )[0]
            feature_map.update({
                name: float(value) for name, value in zip(lt_feature_names, lt_values, strict=False)
            })

        missing_names = [name for name in self.feature_names if name not in feature_map]
        if missing_names:
            raise RuntimeError(
                "Inference feature mismatch; missing features: "
                + ", ".join(missing_names[:10])
                + ("..." if len(missing_names) > 10 else "")
            )

        ordered = np.asarray([[feature_map[name] for name in self.feature_names]], dtype=np.float64)
        return ordered, degraded_features

    def score(self, prompt: str, essay: str) -> ScoringResult:
        features, degraded = self._ordered_feature_row(prompt, essay)

        rubric_scores: dict[str, float] = {}
        for target in RUBRIC_TARGETS:
            model = self.models.get(target)
            if model is None:
                continue
            rubric_scores[target] = float(clip_scores(model.predict(features))[0])

        overall_model = self.models.get("band")
        if rubric_scores:
            overall = derive_overall_score(rubric_scores)
        elif overall_model is not None:
            overall = float(clip_scores(overall_model.predict(features))[0])
            rubric_scores = {target: overall for target in RUBRIC_TARGETS}
            degraded.append("rubric_models_missing")
        else:
            raise RuntimeError("No rubric or overall model available for inference.")

        response_scores = {
            RUBRIC_RESPONSE_KEYS[target]: round(rubric_scores[target], 1)
            for target in RUBRIC_TARGETS
        }
        response_scores["overall"] = round(overall, 1)
        description = build_score_description(response_scores)
        metadata = {
            "artifact_dir": str(self.artifact_dir),
            "feature_count": len(self.feature_names),
            "degraded_features": sorted(set(degraded)),
            "loaded_models": sorted(self.models.keys()),
        }
        return ScoringResult(scores=response_scores, description=description, metadata=metadata)


def _criterion_feedback(name: str, score: float) -> str:
    if score >= 7.0:
        band = "strong"
    elif score >= 5.5:
        band = "adequate"
    else:
        band = "developing"
    labels = {
        "task_achievement": "task response",
        "coherence": "organization and cohesion",
        "lexical": "lexical control",
        "grammar": "grammatical accuracy",
    }
    return f"{labels[name]} is {band} ({score:.1f})."


def build_score_description(scores: dict[str, float]) -> str:
    criteria = ["task_achievement", "coherence", "lexical", "grammar"]
    parts = [_criterion_feedback(name, scores[name]) for name in criteria]
    parts.append(f"Overall estimated band: {scores['overall']:.1f}.")
    return " ".join(parts)


@lru_cache(maxsize=1)
def get_scorer() -> ArtifactBackedScorer:
    return ArtifactBackedScorer()
