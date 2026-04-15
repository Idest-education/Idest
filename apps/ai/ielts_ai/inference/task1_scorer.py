"""Task 1 (Academic Writing) CatBoost inference: question + essay + figure description or image."""

from __future__ import annotations

import base64
import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

try:
    from catboost import CatBoostRegressor
except ImportError:
    CatBoostRegressor = None

from ielts_ai.data.task1_benchmark import build_task1_inference_row
from ielts_ai.inference.scorer import (
    DIRECT_OVERALL_TARGET,
    DERIVED_OVERALL_TARGET,
    HYBRID_OVERALL_TARGET,
    RUBRIC_RESPONSE_KEYS,
    RUBRIC_TARGETS,
    ScoringResult,
    build_score_description,
    clip_scores,
    derive_overall_score,
    round_to_half_band,
)
from ielts_ai.paths import TASK1_ARTIFACT_DIR
from ielts_ai.training.task1_feature_blocks import build_task1_dataset_bundle
from ielts_ai.writing_scorer.task1_llm_features import (
    DEFAULT_OLLAMA_HOST as TASK1_TEXT_DEFAULT_HOST,
    DEFAULT_OLLAMA_MODEL as TASK1_TEXT_DEFAULT_MODEL,
    LLM_T1_FEATURE_NAMES,
    judge_task1,
)
from ollama import Client

DEFAULT_TASK1_MODEL_FILES = {
    "TA": "ta_model.cbm",
    "CC": "cc_model.cbm",
    "LR": "lr_model.cbm",
    "GR": "gr_model.cbm",
    "band": "overall_model.cbm",
    HYBRID_OVERALL_TARGET: "overall_hybrid_stacked.cbm",
}


def _task1_artifact_dir() -> Path:
    for key in ("IELTS_TASK1_ARTIFACT_DIR", "TASK1_ARTIFACT_DIR"):
        v = os.environ.get(key)
        if v is not None and v != "":
            return Path(v)
    return TASK1_ARTIFACT_DIR


def _vlm_settings() -> tuple[str, str]:
    host = os.environ.get("OLLAMA_HOST") or os.environ.get("TASK1_VLM_OLLAMA_HOST") or "http://127.0.0.1:11434"
    model = os.environ.get("TASK1_VLM_OLLAMA_MODEL") or "moondream"
    return host, model


def _text_llm_settings() -> tuple[str, str]:
    host = os.environ.get("OLLAMA_HOST") or TASK1_TEXT_DEFAULT_HOST
    model = os.environ.get("TASK1_LLM_OLLAMA_MODEL") or TASK1_TEXT_DEFAULT_MODEL
    return host, model


def describe_task1_image_bytes(subject: str, image_bytes: bytes, *, max_retries: int = 3) -> tuple[str, dict[str, Any]]:
    """Run local VLM (Ollama) to produce a neutral figure description."""
    from ielts_ai.scripts.task1_image_descriptions import call_vlm

    host, model = _vlm_settings()
    client = Client(host=host)
    text, err = call_vlm(
        client,
        model,
        subject,
        image_bytes,
        max_retries=max_retries,
        options={"temperature": 0},
    )
    meta: dict[str, Any] = {"vlm_model": model, "ollama_host": host}
    if err:
        meta["vlm_error"] = err
    if not text:
        raise RuntimeError(f"VLM did not return a description: {err or 'unknown'}")
    return text.strip(), meta


def resolve_task1_figure_description(
    subject: str,
    *,
    image_description: str | None,
    image_bytes: bytes | None,
) -> tuple[str, dict[str, Any]]:
    """
    Prefer client-provided ``image_description``; otherwise require ``image_bytes`` and run VLM.
    """
    desc = (image_description or "").strip()
    if desc:
        return desc, {"figure_description_source": "provided", "resolved_description": desc}
    if image_bytes is None or len(image_bytes) == 0:
        raise ValueError(
            "Provide either a non-empty image_description or an image file / image_base64 for VLM captioning."
        )
    from ielts_ai.scripts.task1_image_descriptions import validate_image_bytes

    ok, msg = validate_image_bytes(image_bytes)
    if not ok:
        raise ValueError(f"Invalid image: {msg}")
    text, vlm_meta = describe_task1_image_bytes(subject, image_bytes)
    return text, {"figure_description_source": "vlm", "resolved_description": text, **vlm_meta}


def decode_image_base64(data: str) -> bytes:
    raw = data.strip()
    if "," in raw[:80] and raw.lstrip().lower().startswith("data:"):
        raw = raw.split(",", 1)[1]
    return base64.b64decode(raw, validate=True)


class Task1ArtifactBackedScorer:
    """Loads Task 1 ``metadata.json`` + .cbm files and scores one essay at a time."""

    def __init__(self, artifact_dir: Path | None = None):
        if CatBoostRegressor is None:
            raise RuntimeError(
                "CatBoost is required for inference. Install dependencies from apps/ai/requirements.txt."
            )
        self.artifact_dir = artifact_dir or _task1_artifact_dir()
        self.metadata = self._load_metadata()
        self.models = self._load_models()
        self.feature_names = list(self.metadata.get("feature_names", []))
        if not self.feature_names:
            raise RuntimeError("Task 1 metadata is missing feature_names.")
        self.calibrators = self._load_calibrators()
        self.selected_overall_strategy = self.metadata.get(
            "selected_overall_strategy",
            DIRECT_OVERALL_TARGET,
        )
        self.abstention_policy = dict(self.metadata.get("abstention_policy", {}))
        self.confidence_policy = dict(self.metadata.get("confidence_policy", {}))
        self._feature_flags = dict(self.metadata.get("feature_flags", {}))

    def _load_metadata(self) -> dict[str, Any]:
        path = self.artifact_dir / "metadata.json"
        if not path.exists():
            raise RuntimeError(f"Missing Task 1 metadata: {path}")
        with path.open(encoding="utf-8") as f:
            return json.load(f)

    def _load_models(self) -> dict[str, CatBoostRegressor]:
        files = dict(DEFAULT_TASK1_MODEL_FILES)
        files.update(self.metadata.get("model_files", {}))
        loaded: dict[str, CatBoostRegressor] = {}
        for target, filename in files.items():
            p = self.artifact_dir / filename
            if not p.exists():
                continue
            m = CatBoostRegressor()
            m.load_model(str(p))
            loaded[target] = m
        if not loaded:
            raise RuntimeError(f"No Task 1 .cbm models in {self.artifact_dir}")
        return loaded

    def _load_calibrators(self) -> dict[str, dict[str, Any]]:
        name = self.metadata.get("calibrator_file", "calibrator.json")
        p = self.artifact_dir / name
        if not p.exists():
            return {}
        with p.open(encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}

    def _apply_calibrator(self, key: str, value: float) -> float:
        spec = self.calibrators.get(key)
        raw = float(np.ravel(clip_scores(value))[0])
        if not spec or spec.get("kind") == "identity":
            return raw
        if spec.get("kind") != "isotonic":
            return raw
        x_t = np.asarray(spec.get("x_thresholds", []), dtype=np.float64)
        y_t = np.asarray(spec.get("y_thresholds", []), dtype=np.float64)
        if len(x_t) == 0 or len(y_t) == 0:
            return raw
        return float(np.ravel(clip_scores(np.interp(raw, x_t, y_t)))[0])

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
        rubric_values = np.asarray([rubric_scores[t] for t in RUBRIC_TARGETS], dtype=np.float64)
        return np.asarray(
            [[
                *rubric_values.tolist(),
                float(direct_overall),
                float(np.mean(rubric_values)),
                float(np.max(rubric_values) - np.min(rubric_values)),
                float(np.std(rubric_values)),
            ]],
            dtype=np.float64,
        )

    def _agreement_confidence(self, candidates: dict[str, float]) -> float | None:
        if not self.confidence_policy.get("enabled"):
            return None
        values = [float(v) for v in candidates.values() if np.isfinite(v)]
        if len(values) < 2:
            return 1.0 if len(values) == 1 else None
        spread = max(values) - min(values)
        return float(max(0.0, min(1.0, 1.0 - spread / 1.5)))

    def _abstain(self, essay: str, degraded: list[str]) -> bool:
        if self.abstention_policy.get("abstain_on_degraded_features") and degraded:
            return True
        words = len(essay.split())
        min_w = self.abstention_policy.get("min_essay_words")
        max_w = self.abstention_policy.get("max_essay_words")
        if isinstance(min_w, int) and words < min_w:
            return True
        if isinstance(max_w, int) and words > max_w:
            return True
        return False

    def _inject_task1_llm_row(self, df: pd.DataFrame) -> pd.DataFrame:
        out = df.copy()
        for c in LLM_T1_FEATURE_NAMES:
            out[c] = np.nan
        if not bool(self._feature_flags.get("task1_llm", False)):
            return out
        sub = str(out.at[0, "subject"])
        content = str(out.at[0, "content"])
        desc = str(out.at[0, "image_description"])
        host, model = _text_llm_settings()
        try:
            client = Client(host=host)
            j = judge_task1(sub, content, desc, client=client, model=model)
            out.at[0, "llm_t1_overview_strength"] = float(j.overview_strength)
            out.at[0, "llm_t1_covers_prompt_parts"] = float(j.covers_prompt_parts)
            out.at[0, "llm_t1_development_quality"] = float(j.development_quality)
            out.at[0, "llm_t1_consistency_with_reference"] = float(j.consistency_with_reference)
        except Exception:
            pass
        return out

    def _feature_matrix(self, df: pd.DataFrame) -> tuple[np.ndarray, list[str]]:
        bundle = build_task1_dataset_bundle(
            df,
            feature_flags=self._feature_flags,
            verbose=False,
        )
        if bundle.feature_names != self.feature_names:
            idx_map = {n: i for i, n in enumerate(bundle.feature_names)}
            missing = [n for n in self.feature_names if n not in idx_map]
            if missing:
                raise RuntimeError(
                    "Task 1 inference feature mismatch vs metadata.json: missing "
                    + ", ".join(missing[:12])
                    + ("..." if len(missing) > 12 else "")
                )
            X = bundle.features[:, [idx_map[n] for n in self.feature_names]]
        else:
            X = bundle.features
        if X.shape[1] != len(self.feature_names):
            raise RuntimeError(
                f"Feature width mismatch: got {X.shape[1]}, metadata expects {len(self.feature_names)}"
            )
        return X, bundle.feature_flags

    def score(
        self,
        question: str,
        essay: str,
        *,
        image_description: str | None = None,
        image_bytes: bytes | None = None,
    ) -> tuple[ScoringResult, dict[str, Any]]:
        """
        Resolve figure text (provided or VLM), build features, run CatBoost stack.
        Returns ``(ScoringResult, figure_meta)``.
        """
        question = question.strip()
        essay = essay.strip()
        if not question or not essay:
            raise ValueError("question and essay must be non-empty.")

        desc, fig_meta = resolve_task1_figure_description(
            question,
            image_description=image_description,
            image_bytes=image_bytes,
        )

        df = build_task1_inference_row(question, essay, desc)
        df = self._inject_task1_llm_row(df)
        degraded: list[str] = []
        if bool(self._feature_flags.get("task1_llm")) and df[LLM_T1_FEATURE_NAMES].isna().any(axis=None):
            degraded.append("task1_llm")

        X, _ff = self._feature_matrix(df)
        features = X[0:1, :]

        rubric_raw: dict[str, float] = {}
        for target in RUBRIC_TARGETS:
            model = self.models.get(target)
            if model is None:
                continue
            rubric_raw[target] = float(clip_scores(model.predict(features))[0])

        rubric_scores = {t: self._apply_calibrator(t, v) for t, v in rubric_raw.items()}

        overall_model = self.models.get("band")
        derived_raw = derive_overall_score(rubric_raw) if rubric_raw else float("nan")
        direct_raw = (
            float(clip_scores(overall_model.predict(features))[0]) if overall_model is not None else float("nan")
        )

        overall_candidates: dict[str, float] = {}
        if not np.isnan(direct_raw):
            overall_candidates[DIRECT_OVERALL_TARGET] = self._apply_calibrator(DIRECT_OVERALL_TARGET, direct_raw)
        if not np.isnan(derived_raw):
            overall_candidates[DERIVED_OVERALL_TARGET] = self._apply_calibrator(
                DERIVED_OVERALL_TARGET,
                derived_raw,
            )

        hybrid_model = self.models.get(HYBRID_OVERALL_TARGET)
        if hybrid_model is not None and rubric_raw and not np.isnan(direct_raw):
            hybrid_raw = float(
                clip_scores(
                    hybrid_model.predict(self._build_hybrid_meta_features(rubric_raw, direct_raw))
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
            rubric_scores = {t: overall for t in RUBRIC_TARGETS}
            degraded.append("rubric_models_missing")
        else:
            raise RuntimeError("No Task 1 rubric or overall model available.")

        abstained = self._abstain(essay, degraded)
        overall_display = self._display_band(overall)
        conf = self._agreement_confidence(overall_candidates)

        response_scores = {
            RUBRIC_RESPONSE_KEYS[t]: round(rubric_scores[t], 1)
            for t in RUBRIC_TARGETS
            if t in rubric_scores
        }
        response_scores["overall"] = round(overall, 1)
        response_scores["overall_display"] = overall_display
        if conf is not None:
            response_scores["confidence"] = round(conf, 3)

        description = build_score_description(response_scores)
        metadata = {
            "artifact_dir": str(self.artifact_dir),
            "task": "writing_task1",
            "feature_count": len(self.feature_names),
            "degraded_features": sorted(set(degraded)),
            "loaded_models": sorted(self.models.keys()),
            "selected_overall_strategy": self.selected_overall_strategy,
            "overall_candidates": {k: round(v, 3) for k, v in overall_candidates.items()},
            "overall_display": overall_display,
            "abstained": abstained,
            "confidence": conf,
            "confidence_enabled": bool(self.confidence_policy.get("enabled", False)),
            "figure_description_preview": desc[:500] + ("…" if len(desc) > 500 else ""),
        }
        return ScoringResult(scores=response_scores, description=description, metadata=metadata), fig_meta


@lru_cache(maxsize=1)
def get_task1_scorer() -> Task1ArtifactBackedScorer:
    return Task1ArtifactBackedScorer()
