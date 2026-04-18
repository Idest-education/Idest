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

from ielts_ai.paths import ARTIFACT_DIR
from ielts_ai.inference.feedback_generator import generate_detailed_feedback
RUBRIC_TARGETS = ("TA", "CC", "LR", "GR")
DIRECT_OVERALL_TARGET = "overall_direct"
DERIVED_OVERALL_TARGET = "overall_from_rubrics"
HYBRID_OVERALL_TARGET = "overall_hybrid_stacked"
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
    from ielts_ai.writing_scorer.features import (
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
    from ielts_ai.writing_scorer.llm_features import LLM_FEATURE_NAMES, judge_essay

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
    scores: dict[str, Any]
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
        self.calibrators = self._load_calibrators()
        self.selected_overall_strategy = self.metadata.get(
            "selected_overall_strategy",
            DIRECT_OVERALL_TARGET,
        )
        self.abstention_policy = dict(self.metadata.get("abstention_policy", {}))
        self.confidence_policy = dict(self.metadata.get("confidence_policy", {}))
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

    def _load_calibrators(self) -> dict[str, dict[str, Any]]:
        calibrator_name = self.metadata.get("calibrator_file", "calibrator.json")
        calibrator_path = self.artifact_dir / calibrator_name
        if not calibrator_path.exists():
            return {}
        with calibrator_path.open(encoding="utf-8") as handle:
            payload = json.load(handle)
        return payload if isinstance(payload, dict) else {}

    def _apply_calibrator(self, key: str, value: float) -> float:
        spec = self.calibrators.get(key)
        raw = float(np.ravel(clip_scores(value))[0])
        if not spec or spec.get("kind") == "identity":
            return raw
        if spec.get("kind") != "isotonic":
            return raw
        x_thresholds = np.asarray(spec.get("x_thresholds", []), dtype=np.float64)
        y_thresholds = np.asarray(spec.get("y_thresholds", []), dtype=np.float64)
        if len(x_thresholds) == 0 or len(y_thresholds) == 0:
            return raw
        return float(np.ravel(clip_scores(np.interp(raw, x_thresholds, y_thresholds)))[0])

    def _agreement_confidence(self, candidates: dict[str, float]) -> float | None:
        """Heuristic 0–1 score from spread of direct / derived / hybrid overall candidates."""
        if not self.confidence_policy.get("enabled"):
            return None
        values = [float(v) for v in candidates.values() if np.isfinite(v)]
        if len(values) < 2:
            return 1.0 if len(values) == 1 else None
        spread = max(values) - min(values)
        return float(max(0.0, min(1.0, 1.0 - spread / 1.5)))

    def _display_band(self, value: float) -> str:
        clipped = float(np.ravel(clip_scores(value))[0])
        if clipped <= 4.0:
            return "<=4"
        if clipped >= 8.5:
            return ">=8.5"
        return f"{round(float(np.ravel(round_to_half_band(clipped))[0]), 1):.1f}"

    def _build_hybrid_meta_features(
        self,
        rubric_scores: dict[str, float],
        direct_overall: float,
    ) -> np.ndarray:
        rubric_values = np.asarray([rubric_scores[target] for target in RUBRIC_TARGETS], dtype=np.float64)
        rubric_mean = float(np.mean(rubric_values))
        rubric_spread = float(np.max(rubric_values) - np.min(rubric_values))
        rubric_std = float(np.std(rubric_values))
        return np.asarray(
            [[
                *rubric_values.tolist(),
                float(direct_overall),
                rubric_mean,
                rubric_spread,
                rubric_std,
            ]],
            dtype=np.float64,
        )

    def _abstain(self, essay: str, degraded_features: list[str]) -> bool:
        if self.abstention_policy.get("abstain_on_degraded_features") and degraded_features:
            return True
        words = len(essay.split())
        min_words = self.abstention_policy.get("min_essay_words")
        max_words = self.abstention_policy.get("max_essay_words")
        if isinstance(min_words, int) and words < min_words:
            return True
        if isinstance(max_words, int) and words > max_words:
            return True
        return False

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

        rubric_raw: dict[str, float] = {}
        for target in RUBRIC_TARGETS:
            model = self.models.get(target)
            if model is None:
                continue
            rubric_raw[target] = float(clip_scores(model.predict(features))[0])

        rubric_scores = {
            target: self._apply_calibrator(target, value)
            for target, value in rubric_raw.items()
        }

        overall_model = self.models.get("band")
        if rubric_raw:
            derived_raw = derive_overall_score(rubric_raw)
        else:
            derived_raw = np.nan
        if overall_model is not None:
            direct_raw = float(clip_scores(overall_model.predict(features))[0])
        else:
            direct_raw = np.nan

        overall_candidates: dict[str, float] = {}
        if not np.isnan(direct_raw):
            overall_candidates[DIRECT_OVERALL_TARGET] = self._apply_calibrator(
                DIRECT_OVERALL_TARGET,
                direct_raw,
            )
        if not np.isnan(derived_raw):
            overall_candidates[DERIVED_OVERALL_TARGET] = self._apply_calibrator(
                DERIVED_OVERALL_TARGET,
                derived_raw,
            )

        hybrid_model = self.models.get(HYBRID_OVERALL_TARGET)
        if hybrid_model is not None and rubric_raw and not np.isnan(direct_raw):
            hybrid_raw = float(
                clip_scores(
                    hybrid_model.predict(
                        self._build_hybrid_meta_features(rubric_raw, direct_raw)
                    )
                )[0]
            )
            overall_candidates[HYBRID_OVERALL_TARGET] = self._apply_calibrator(
                HYBRID_OVERALL_TARGET,
                hybrid_raw,
            )

        if self.selected_overall_strategy in overall_candidates:
            overall = overall_candidates[self.selected_overall_strategy]
        elif DIRECT_OVERALL_TARGET in overall_candidates:
            overall = overall_candidates[DIRECT_OVERALL_TARGET]
        elif DERIVED_OVERALL_TARGET in overall_candidates:
            overall = overall_candidates[DERIVED_OVERALL_TARGET]
        elif overall_model is not None:
            overall = float(clip_scores(overall_model.predict(features))[0])
            rubric_scores = {target: overall for target in RUBRIC_TARGETS}
            degraded.append("rubric_models_missing")
        else:
            raise RuntimeError("No rubric or overall model available for inference.")

        abstained = self._abstain(essay, degraded)
        overall_display = self._display_band(overall)
        conf_value = self._agreement_confidence(overall_candidates)
        response_scores = {
            RUBRIC_RESPONSE_KEYS[target]: round(rubric_scores[target], 1)
            for target in RUBRIC_TARGETS
            if target in rubric_scores
        }
        response_scores["overall"] = round(overall, 1)
        response_scores["overall_display"] = overall_display
        if conf_value is not None:
            response_scores["confidence"] = round(conf_value, 3)
        description = build_score_description(response_scores)
        detailed_feedback, feedback_meta = generate_detailed_feedback(
            task="task2",
            question=prompt,
            essay=essay,
            scores=response_scores,
        )
        metadata = {
            "artifact_dir": str(self.artifact_dir),
            "feature_count": len(self.feature_names),
            "degraded_features": sorted(set(degraded)),
            "loaded_models": sorted(self.models.keys()),
            "selected_overall_strategy": self.selected_overall_strategy,
            "overall_candidates": {key: round(value, 3) for key, value in overall_candidates.items()},
            "overall_display": overall_display,
            "abstained": abstained,
            "confidence": conf_value,
            "confidence_enabled": bool(self.confidence_policy.get("enabled", False)),
            **feedback_meta,
        }
        if detailed_feedback is not None:
            metadata["detailed_feedback"] = detailed_feedback
        return ScoringResult(scores=response_scores, description=description, metadata=metadata)

    def score_overall_direct(self, prompt: str, essay: str) -> ScoringResult:
        """Predict overall band using best available overall strategy for Task 2."""
        features, degraded = self._ordered_feature_row(prompt, essay)

        rubric_raw: dict[str, float] = {}
        for target in RUBRIC_TARGETS:
            model = self.models.get(target)
            if model is None:
                continue
            rubric_raw[target] = float(clip_scores(model.predict(features))[0])

        overall_model = self.models.get("band")
        direct_raw = (
            float(clip_scores(overall_model.predict(features))[0])
            if overall_model is not None
            else np.nan
        )
        derived_raw = derive_overall_score(rubric_raw) if rubric_raw else np.nan

        overall_candidates: dict[str, float] = {}
        overall_candidates_raw: dict[str, float] = {}
        if not np.isnan(direct_raw):
            overall_candidates_raw[DIRECT_OVERALL_TARGET] = direct_raw
            overall_candidates[DIRECT_OVERALL_TARGET] = self._apply_calibrator(
                DIRECT_OVERALL_TARGET,
                direct_raw,
            )
        if not np.isnan(derived_raw):
            overall_candidates_raw[DERIVED_OVERALL_TARGET] = derived_raw
            overall_candidates[DERIVED_OVERALL_TARGET] = self._apply_calibrator(
                DERIVED_OVERALL_TARGET,
                derived_raw,
            )

        hybrid_model = self.models.get(HYBRID_OVERALL_TARGET)
        if hybrid_model is not None and rubric_raw and not np.isnan(direct_raw):
            hybrid_raw = float(
                clip_scores(
                    hybrid_model.predict(
                        self._build_hybrid_meta_features(rubric_raw, direct_raw)
                    )
                )[0]
            )
            overall_candidates_raw[HYBRID_OVERALL_TARGET] = hybrid_raw
            overall_candidates[HYBRID_OVERALL_TARGET] = self._apply_calibrator(
                HYBRID_OVERALL_TARGET,
                hybrid_raw,
            )

        # Keep inference aligned with training-time model selection.
        preferred = [
            self.selected_overall_strategy,
            HYBRID_OVERALL_TARGET,
            DIRECT_OVERALL_TARGET,
            DERIVED_OVERALL_TARGET,
        ]
        selected_source = next((key for key in preferred if key in overall_candidates), None)
        if selected_source is None:
            raise RuntimeError(
                "No suitable overall strategy is available; expected one of "
                f"{preferred}."
            )
        grade = overall_candidates[selected_source]
        rounded = round(grade, 1)
        grade_display = self._display_band(grade)
        description = f"Estimated band ({selected_source}): {grade_display}."
        metadata = {
            "artifact_dir": str(self.artifact_dir),
            "feature_count": len(self.feature_names),
            "degraded_features": sorted(set(degraded)),
            "loaded_models": sorted(self.models.keys()),
            "source": selected_source,
            "overall_candidates": {key: round(value, 3) for key, value in overall_candidates.items()},
            "overall_candidates_raw": {
                key: round(value, 3) for key, value in overall_candidates_raw.items()
            },
            "grade_display": grade_display,
            "abstained": self._abstain(essay, degraded),
            "confidence": self._agreement_confidence(overall_candidates),
            "confidence_enabled": bool(self.confidence_policy.get("enabled", False)),
        }
        return ScoringResult(
            scores={"grade": rounded, "grade_display": grade_display},
            description=description,
            metadata=metadata,
        )


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
    parts = [_criterion_feedback(name, scores[name]) for name in criteria if name in scores]
    display = scores.get("overall_display")
    if display is None:
        display = f"{scores['overall']:.1f}"
    parts.append(f"Overall estimated band: {display}.")
    return " ".join(parts)


@lru_cache(maxsize=1)
def get_scorer() -> ArtifactBackedScorer:
    return ArtifactBackedScorer()


