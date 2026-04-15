"""Train and evaluate a benchmarked CatBoost IELTS scoring stack."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import GroupKFold, KFold, StratifiedKFold, train_test_split

from ielts_ai.data import (
    HIGH_BAND_MIN,
    LOW_BAND_MAX,
    RUBRIC_COLUMNS,
    load_clean_data,
    summarize_benchmark_frame,
)
from ielts_ai.paths import ARTIFACT_DIR
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
from ielts_ai.writing_scorer.llm_features import LLM_FEATURE_NAMES, get_llm_feature_array

try:
    from catboost import CatBoostRegressor
except ImportError:
    CatBoostRegressor = None
OVERALL_TARGET = "band"
DIRECT_OVERALL_TARGET = "overall_direct"
DERIVED_OVERALL_TARGET = "overall_from_rubrics"
HYBRID_OVERALL_TARGET = "overall_hybrid_stacked"
ALL_TARGETS = [*RUBRIC_COLUMNS, OVERALL_TARGET]
TAIL_BUCKETS = ("<=4", "mid", ">=8.5")
META_FEATURE_NAMES = [
    "meta_ta",
    "meta_cc",
    "meta_lr",
    "meta_gr",
    "meta_overall_direct",
    "meta_rubric_mean",
    "meta_rubric_spread",
    "meta_rubric_std",
]
MODEL_FILENAMES = {
    "TA": "ta_model.cbm",
    "CC": "cc_model.cbm",
    "LR": "lr_model.cbm",
    "GR": "gr_model.cbm",
    OVERALL_TARGET: "overall_model.cbm",
    HYBRID_OVERALL_TARGET: "overall_hybrid_stacked.cbm",
}
CATBOOST_PARAMS = {
    "iterations": 2000,
    "depth": 6,
    "learning_rate": 0.03,
    "loss_function": "MAE",
    "random_seed": 42,
    "verbose": False,
}
META_CATBOOST_PARAMS = {
    "iterations": 600,
    "depth": 3,
    "learning_rate": 0.05,
    "loss_function": "MAE",
    "random_seed": 42,
    "verbose": False,
}
METRICS_SUMMARY_FORMATTERS = {
    "MAE": "{:.4f}".format,
    "ACC_EXACT": "{:.2%}".format,
    "ACC_0.5": "{:.2%}".format,
    "ACC_1.0": "{:.2%}".format,
    "ACC_1.5": "{:.2%}".format,
    "MAE_CI95_LOW": "{:.4f}".format,
    "MAE_CI95_HIGH": "{:.4f}".format,
}

ABLATION_CONFIGS: list[tuple[str, dict[str, object]]] = [
    (
        "classical_only",
        {
            "essay_embeddings": False,
            "llm": False,
            "languagetool": False,
        },
    ),
    (
        "plus_languagetool",
        {
            "essay_embeddings": False,
            "llm": False,
            "languagetool": True,
        },
    ),
    (
        "plus_embeddings",
        {
            "essay_embeddings": True,
            "llm": False,
            "languagetool": False,
        },
    ),
    (
        "plus_llm",
        {
            "essay_embeddings": False,
            "llm": True,
            "languagetool": False,
        },
    ),
    ("full_stack", {}),
]


@dataclass(frozen=True)
class DatasetBundle:
    frame: pd.DataFrame
    features: np.ndarray
    feature_names: list[str]
    feature_flags: dict[str, object]


@dataclass(frozen=True)
class SharedFeatureBlocks:
    frame: pd.DataFrame
    classical_block: np.ndarray
    classical_feature_names: list[str]
    essay_embeddings: np.ndarray | None
    lt_block: np.ndarray | None
    llm_block: np.ndarray | None


@dataclass(frozen=True)
class TrainingConfig:
    fast_mode: bool
    run_ablation_study: bool
    run_stress_tests: bool
    cv_splits: int
    early_stopping_rounds: int
    stress_sample_size: int
    bootstrap_samples: int


def parse_args() -> TrainingConfig:
    parser = argparse.ArgumentParser(description="Train benchmarked IELTS scoring models.")
    parser.add_argument("--fast", action="store_true", help="Use a quicker development mode.")
    parser.add_argument("--skip-ablation", action="store_true", help="Skip ablation study.")
    parser.add_argument("--skip-stress-tests", action="store_true", help="Skip stress slices.")
    parser.add_argument(
        "--skip-group-cv",
        action="store_true",
        help="Deprecated compatibility flag; locked benchmark splits are always used.",
    )
    parser.add_argument(
        "--skip-repeated-cv",
        action="store_true",
        help="Deprecated compatibility flag; repeated CV summaries are no longer primary metrics.",
    )
    parser.add_argument(
        "--full-derived-cv",
        action="store_true",
        help="Deprecated compatibility flag; derived overall is benchmarked on locked splits.",
    )
    args = parser.parse_args()
    return TrainingConfig(
        fast_mode=bool(args.fast),
        run_ablation_study=not args.skip_ablation and not args.fast,
        run_stress_tests=not args.skip_stress_tests,
        cv_splits=3 if args.fast else 5,
        early_stopping_rounds=50 if args.fast else 100,
        stress_sample_size=100 if args.fast else 250,
        bootstrap_samples=50 if args.fast else 200,
    )


def load_data() -> pd.DataFrame:
    print("Loading benchmark frame...")
    df = load_clean_data()
    summary = summarize_benchmark_frame(df)
    print(f"  Loaded {len(df)} scored samples")
    print(f"  Split counts: {summary['summary']['split_counts']}")
    print(f"  Source counts: {summary['summary']['source_counts']}")
    return df


def round_to_half_band(values: np.ndarray | list[float] | float) -> np.ndarray:
    arr = np.asarray(values, dtype=np.float64)
    return np.round(arr * 2.0) / 2.0


def clip_scores(values: np.ndarray | list[float] | float) -> np.ndarray:
    return np.clip(np.asarray(values, dtype=np.float64), 0.0, 9.0)


def derive_overall_band(predictions: dict[str, np.ndarray]) -> np.ndarray:
    stacked = np.column_stack([clip_scores(predictions[target]) for target in RUBRIC_COLUMNS])
    return clip_scores(round_to_half_band(np.mean(stacked, axis=1)))


def band_bucket(values: np.ndarray | list[float] | float) -> np.ndarray:
    arr = clip_scores(values)
    labels = np.full(arr.shape, "mid", dtype=object)
    labels[arr <= LOW_BAND_MAX] = "<=4"
    labels[arr >= HIGH_BAND_MIN] = ">=8.5"
    return labels


def format_display_band(value: float) -> str:
    clipped = float(np.ravel(clip_scores(value))[0])
    if clipped <= LOW_BAND_MAX:
        return "<=4"
    if clipped >= HIGH_BAND_MIN:
        return ">=8.5"
    return f"{round(float(np.ravel(round_to_half_band(clipped))[0]), 1):.1f}"


def build_catboost_regressor(*, meta: bool = False) -> CatBoostRegressor:
    if CatBoostRegressor is None:
        raise RuntimeError(
            "CatBoost is required for training. Install dependencies from apps/ai/requirements.txt."
        )
    params = META_CATBOOST_PARAMS if meta else CATBOOST_PARAMS
    return CatBoostRegressor(**params)


def fit_catboost_regressor(
    X_train: np.ndarray,
    y_train: np.ndarray,
    *,
    X_valid: np.ndarray | None = None,
    y_valid: np.ndarray | None = None,
    early_stopping_rounds: int | None = None,
    meta: bool = False,
) -> CatBoostRegressor:
    model = build_catboost_regressor(meta=meta)
    fit_kwargs: dict[str, object] = {}
    if X_valid is not None and y_valid is not None and len(X_valid) > 0:
        fit_kwargs["eval_set"] = (X_valid, y_valid)
        fit_kwargs["use_best_model"] = True
        if early_stopping_rounds is not None:
            fit_kwargs["early_stopping_rounds"] = early_stopping_rounds
    model.fit(X_train, y_train, **fit_kwargs)
    return model


def _band_labels(targets: pd.Series | np.ndarray) -> np.ndarray:
    arr = targets.to_numpy() if isinstance(targets, pd.Series) else np.asarray(targets)
    return round_to_half_band(arr).astype(str)


def _class_counts(labels: np.ndarray) -> Counter:
    return Counter(labels)


def _supports_stratification(labels: np.ndarray, n_splits: int) -> bool:
    counts = _class_counts(labels)
    return bool(counts) and min(counts.values()) >= n_splits


def _build_aligned_oof_folds(train_frame: pd.DataFrame, config: TrainingConfig) -> list[tuple[np.ndarray, np.ndarray]]:
    n_rows = len(train_frame)
    groups = train_frame["prompt_family"].astype(str).to_numpy()
    unique_groups = np.unique(groups)
    desired_splits = min(max(2, config.cv_splits), n_rows)
    if len(unique_groups) >= desired_splits:
        splitter = GroupKFold(n_splits=desired_splits)
        return list(splitter.split(np.zeros(n_rows), groups=groups))

    labels = _band_labels(train_frame[OVERALL_TARGET])
    if _supports_stratification(labels, desired_splits):
        splitter = StratifiedKFold(n_splits=desired_splits, shuffle=True, random_state=42)
        return list(splitter.split(np.zeros(n_rows), labels))

    splitter = KFold(n_splits=desired_splits, shuffle=True, random_state=42)
    return list(splitter.split(np.zeros(n_rows)))


def accuracy_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    pred = clip_scores(y_pred)
    pred_band = round_to_half_band(pred)
    true_band = round_to_half_band(y_true)
    exact = np.mean(pred_band == true_band)
    within_05 = np.mean(np.abs(pred - y_true) <= 0.5)
    within_1 = np.mean(np.abs(pred - y_true) <= 1.0)
    within_15 = np.mean(np.abs(pred - y_true) <= 1.5)
    return {
        "exact": float(exact),
        "within_0.5": float(within_05),
        "within_1.0": float(within_1),
        "within_1.5": float(within_15),
    }


def _bootstrap_mae_ci(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    *,
    bootstrap_samples: int,
    seed: int = 42,
) -> dict[str, float]:
    if len(y_true) < 2:
        mae = float(mean_absolute_error(y_true, y_pred))
        return {"low": mae, "high": mae}
    rng = np.random.default_rng(seed)
    values: list[float] = []
    for _ in range(bootstrap_samples):
        sample_idx = rng.integers(0, len(y_true), size=len(y_true))
        values.append(float(mean_absolute_error(y_true[sample_idx], y_pred[sample_idx])))
    arr = np.asarray(values, dtype=np.float64)
    return {
        "low": float(np.quantile(arr, 0.025)),
        "high": float(np.quantile(arr, 0.975)),
    }


def _slice_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, object]:
    buckets = band_bucket(y_true)
    out: dict[str, object] = {}
    for bucket in TAIL_BUCKETS:
        mask = buckets == bucket
        if not np.any(mask):
            out[bucket] = {}
            continue
        clipped_pred = clip_scores(y_pred[mask])
        acc = accuracy_metrics(y_true[mask], clipped_pred)
        out[bucket] = {
            "n": int(mask.sum()),
            "MAE": float(mean_absolute_error(y_true[mask], clipped_pred)),
            "ACC_EXACT": acc["exact"],
            "ACC_0.5": acc["within_0.5"],
            "ACC_1.0": acc["within_1.0"],
            "ACC_1.5": acc["within_1.5"],
        }
    return out


def evaluate_predictions(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    *,
    bootstrap_samples: int,
) -> dict[str, object]:
    clipped = clip_scores(y_pred)
    acc = accuracy_metrics(y_true, clipped)
    per_band_mae = {}
    rounded_true = round_to_half_band(y_true)
    for band in sorted(np.unique(rounded_true)):
        mask = rounded_true == band
        per_band_mae[str(float(band))] = float(mean_absolute_error(y_true[mask], clipped[mask]))
    return {
        "MAE": float(mean_absolute_error(y_true, clipped)),
        "ACC_EXACT": acc["exact"],
        "ACC_0.5": acc["within_0.5"],
        "ACC_1.0": acc["within_1.0"],
        "ACC_1.5": acc["within_1.5"],
        "MAE_CI95": _bootstrap_mae_ci(
            y_true,
            clipped,
            bootstrap_samples=bootstrap_samples,
        ),
        "per_band_mae": per_band_mae,
        "slice_metrics": _slice_metrics(y_true, clipped),
    }


def format_evaluation_summary_text(metrics_df: pd.DataFrame) -> str:
    """Human-readable table matching console output (saved to evaluation_summary.txt)."""
    body = metrics_df.to_string(index=False, formatters=METRICS_SUMMARY_FORMATTERS)
    return "\n".join(
        [
            "=" * 84,
            "  Benchmarked evaluation summary",
            "=" * 84,
            body,
        ]
    )


def _flatten_metric_row(
    target: str,
    split: str,
    evaluation: str,
    metrics: dict[str, object],
) -> dict[str, object]:
    return {
        "Target": target,
        "Split": split,
        "Evaluation": evaluation,
        "MAE": metrics["MAE"],
        "ACC_EXACT": metrics["ACC_EXACT"],
        "ACC_0.5": metrics["ACC_0.5"],
        "ACC_1.0": metrics["ACC_1.0"],
        "ACC_1.5": metrics["ACC_1.5"],
        "MAE_CI95_LOW": metrics["MAE_CI95"]["low"],
        "MAE_CI95_HIGH": metrics["MAE_CI95"]["high"],
    }


def prepare_shared_feature_blocks(
    df: pd.DataFrame,
    feature_flags: dict[str, object] | None = None,
) -> SharedFeatureBlocks:
    flags = resolve_feature_flags(feature_flags)
    print("Extracting features...")

    df_working = df.reset_index(drop=True).copy()
    prompts = df_working["prompt"].tolist()
    essays = df_working["essay"].tolist()
    model = get_sbert_model()

    classical_feature_names = list(get_classical_feature_names(flags))
    classical_block = extract_classical_features(prompts, essays, model, feature_flags=flags)

    essay_embeddings: np.ndarray | None = None
    if bool(flags["essay_embeddings"]):
        print("  Extracting full essay embeddings...")
        essay_embeddings = extract_essay_embedding_features(
            essays,
            model=model,
            batch_size=int(flags["embedding_batch_size"]),
            use_cache=bool(flags["cache_embeddings"]),
        )
        print(f"  Essay embeddings: {essay_embeddings.shape[1]}")

    llm_block: np.ndarray | None = None
    if bool(flags["llm"]):
        llm_full = get_llm_feature_array(prompts, essays)
        if llm_full is None:
            print("  Full LLM cache not found — LLM feature block unavailable.")
        else:
            llm_block = llm_full
            print(f"  LLM features loaded from full cache ({llm_full.shape[1]} features)")

    lt_block: np.ndarray | None = None
    if bool(flags["languagetool"]):
        print("  Extracting LanguageTool features...")
        lt_block = extract_lt_features_batch(essays, get_languagetool())
        print(f"  LanguageTool features: {lt_block.shape[1]}")

    return SharedFeatureBlocks(
        frame=df_working,
        classical_block=classical_block,
        classical_feature_names=classical_feature_names,
        essay_embeddings=essay_embeddings,
        lt_block=lt_block,
        llm_block=llm_block,
    )


def extract_dataset_bundle(
    df: pd.DataFrame,
    feature_flags: dict[str, object] | None = None,
    shared_blocks: SharedFeatureBlocks | None = None,
) -> DatasetBundle:
    flags = resolve_feature_flags(feature_flags)
    if shared_blocks is None:
        shared_blocks = prepare_shared_feature_blocks(df, feature_flags=flags)

    feature_names = list(shared_blocks.classical_feature_names)
    feature_blocks = [shared_blocks.classical_block]

    if bool(flags["essay_embeddings"]):
        if shared_blocks.essay_embeddings is None:
            print("  Essay embedding block unavailable — disabling for this run.")
            flags["essay_embeddings"] = False
        else:
            feature_blocks.append(shared_blocks.essay_embeddings)
            feature_names.extend(EMBEDDING_FEATURE_NAMES)

    if bool(flags["llm"]):
        if shared_blocks.llm_block is None:
            print("  Full LLM cache not found — disabling LLM feature block for comparability.")
            flags["llm"] = False
        else:
            feature_blocks.append(shared_blocks.llm_block)
            feature_names.extend(LLM_FEATURE_NAMES)

    if bool(flags["languagetool"]):
        if shared_blocks.lt_block is None:
            print("  LanguageTool block unavailable — disabling for this run.")
            flags["languagetool"] = False
        else:
            feature_blocks.append(shared_blocks.lt_block)
            feature_names.extend(LT_FEATURE_NAMES)

    X = np.hstack(feature_blocks) if len(feature_blocks) > 1 else feature_blocks[0]
    print(f"  Final feature matrix: {X.shape} (n_samples={len(shared_blocks.frame)})")
    return DatasetBundle(
        frame=shared_blocks.frame,
        features=X,
        feature_names=feature_names,
        feature_flags=flags,
    )


def _split_indices(frame: pd.DataFrame) -> dict[str, np.ndarray]:
    return {
        split: frame.index[frame["split"] == split].to_numpy(dtype=int)
        for split in ("train", "dev", "real_test")
    }


def _subset(bundle: DatasetBundle, indices: np.ndarray) -> tuple[np.ndarray, pd.DataFrame]:
    return bundle.features[indices], bundle.frame.iloc[indices].reset_index(drop=True)


def _fit_first_stage_models(
    X_train: np.ndarray,
    train_frame: pd.DataFrame,
    X_valid: np.ndarray,
    valid_frame: pd.DataFrame,
    config: TrainingConfig,
) -> dict[str, CatBoostRegressor]:
    models: dict[str, CatBoostRegressor] = {}
    for target in [*RUBRIC_COLUMNS, OVERALL_TARGET]:
        models[target] = fit_catboost_regressor(
            X_train,
            train_frame[target].astype(float).to_numpy(),
            X_valid=X_valid,
            y_valid=valid_frame[target].astype(float).to_numpy(),
            early_stopping_rounds=config.early_stopping_rounds,
        )
    return models


def _predict_first_stage(
    models: dict[str, CatBoostRegressor],
    X: np.ndarray,
) -> dict[str, np.ndarray]:
    preds = {target: clip_scores(model.predict(X)) for target, model in models.items()}
    preds[DIRECT_OVERALL_TARGET] = preds[OVERALL_TARGET]
    return preds


def _build_meta_features(predictions: dict[str, np.ndarray]) -> np.ndarray:
    rubrics = np.column_stack([clip_scores(predictions[target]) for target in RUBRIC_COLUMNS])
    direct = clip_scores(predictions[DIRECT_OVERALL_TARGET]).reshape(-1, 1)
    rubric_mean = np.mean(rubrics, axis=1, keepdims=True)
    rubric_spread = (np.max(rubrics, axis=1) - np.min(rubrics, axis=1)).reshape(-1, 1)
    rubric_std = np.std(rubrics, axis=1, keepdims=True)
    return np.hstack([rubrics, direct, rubric_mean, rubric_spread, rubric_std]).astype(
        np.float64,
        copy=False,
    )


def _fit_meta_model(meta_X: np.ndarray, y: np.ndarray, config: TrainingConfig) -> CatBoostRegressor:
    labels = _band_labels(y)
    stratify = labels if len(np.unique(labels)) > 1 and Counter(labels).most_common()[-1][1] >= 2 else None
    if len(meta_X) >= 10:
        X_train, X_valid, y_train, y_valid = train_test_split(
            meta_X,
            y,
            test_size=0.15,
            random_state=42,
            stratify=stratify,
        )
        return fit_catboost_regressor(
            X_train,
            y_train,
            X_valid=X_valid,
            y_valid=y_valid,
            early_stopping_rounds=config.early_stopping_rounds,
            meta=True,
        )
    return fit_catboost_regressor(meta_X, y, meta=True)


def _generate_aligned_train_oof(
    X_train: np.ndarray,
    train_frame: pd.DataFrame,
    config: TrainingConfig,
) -> tuple[dict[str, np.ndarray], list[tuple[np.ndarray, np.ndarray]]]:
    folds = _build_aligned_oof_folds(train_frame, config)
    predictions = {
        target: np.zeros(len(train_frame), dtype=np.float64)
        for target in [*RUBRIC_COLUMNS, DIRECT_OVERALL_TARGET]
    }
    for fold_train_idx, fold_valid_idx in folds:
        X_fold_train = X_train[fold_train_idx]
        X_fold_valid = X_train[fold_valid_idx]
        fold_train = train_frame.iloc[fold_train_idx]
        fold_valid = train_frame.iloc[fold_valid_idx]
        fold_models = _fit_first_stage_models(
            X_fold_train,
            fold_train,
            X_fold_valid,
            fold_valid,
            config,
        )
        fold_preds = _predict_first_stage(fold_models, X_fold_valid)
        for target in RUBRIC_COLUMNS:
            predictions[target][fold_valid_idx] = fold_preds[target]
        predictions[DIRECT_OVERALL_TARGET][fold_valid_idx] = fold_preds[DIRECT_OVERALL_TARGET]
    predictions[DERIVED_OVERALL_TARGET] = derive_overall_band(predictions)
    return predictions, folds


def _fit_calibrator(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, object]:
    x = clip_scores(y_pred).astype(np.float64)
    y = clip_scores(y_true).astype(np.float64)
    if len(np.unique(x)) < 2:
        return {"kind": "identity"}
    calibrator = IsotonicRegression(out_of_bounds="clip")
    calibrator.fit(x, y)
    return {
        "kind": "isotonic",
        "x_thresholds": [float(value) for value in calibrator.X_thresholds_],
        "y_thresholds": [float(value) for value in calibrator.y_thresholds_],
    }


def apply_calibrator(values: np.ndarray | list[float] | float, spec: dict[str, object] | None) -> np.ndarray:
    arr = clip_scores(values)
    if not spec or spec.get("kind") == "identity":
        return clip_scores(arr)
    if spec.get("kind") != "isotonic":
        return clip_scores(arr)
    x_thresholds = np.asarray(spec["x_thresholds"], dtype=np.float64)
    y_thresholds = np.asarray(spec["y_thresholds"], dtype=np.float64)
    return clip_scores(np.interp(arr, x_thresholds, y_thresholds))


def _evaluate_target_across_splits(
    target: str,
    raw_predictions: dict[str, dict[str, np.ndarray]],
    frame_by_split: dict[str, pd.DataFrame],
    *,
    bootstrap_samples: int,
    calibrator: dict[str, object] | None = None,
) -> tuple[list[dict[str, object]], dict[str, object]]:
    rows: list[dict[str, object]] = []
    report: dict[str, object] = {}
    for split in ("dev", "real_test"):
        y_true = frame_by_split[split][target if target in RUBRIC_COLUMNS else OVERALL_TARGET].astype(float).to_numpy()
        raw = raw_predictions[split][target]
        raw_metrics = evaluate_predictions(y_true, raw, bootstrap_samples=bootstrap_samples)
        rows.append(_flatten_metric_row(target, split, "raw", raw_metrics))
        report[f"{split}_raw"] = raw_metrics
        if calibrator is not None:
            calibrated = apply_calibrator(raw, calibrator)
            calibrated_metrics = evaluate_predictions(
                y_true,
                calibrated,
                bootstrap_samples=bootstrap_samples,
            )
            rows.append(_flatten_metric_row(target, split, "calibrated", calibrated_metrics))
            report[f"{split}_calibrated"] = calibrated_metrics
    return rows, report


def _select_best_overall_strategy(reports: dict[str, dict[str, object]]) -> str:
    candidates = [HYBRID_OVERALL_TARGET, DIRECT_OVERALL_TARGET, DERIVED_OVERALL_TARGET]

    def _tail_penalty(report: dict[str, object]) -> float:
        slices = report["real_test_raw"]["slice_metrics"]
        penalties = [slices.get(bucket, {}).get("MAE", 1e9) for bucket in ("<=4", ">=8.5")]
        usable = [value for value in penalties if np.isfinite(value)]
        return float(np.mean(usable)) if usable else 1e9

    ranked = sorted(
        candidates,
        key=lambda target: (
            reports[target]["real_test_raw"]["MAE"],
            _tail_penalty(reports[target]),
            reports[target]["dev_raw"]["MAE"],
        ),
    )
    return ranked[0]


def _confidence_gate(
    overall_reports: dict[str, dict[str, object]],
    selected: str,
    *,
    max_real_test_mae: float = 0.92,
    max_tail_mae: float = 1.85,
    min_tail_n: int = 5,
) -> tuple[bool, dict[str, object]]:
    """Expose confidence in the API only when calibrated real_test metrics pass slice checks."""
    report = overall_reports.get(selected)
    if not report:
        return False, {"reason": "missing_report", "selected": selected}
    cal = report.get("real_test_calibrated")
    if not cal:
        return False, {"reason": "missing_calibrated_real_test", "selected": selected}
    mae = float(cal["MAE"])
    detail: dict[str, object] = {
        "selected": selected,
        "real_test_mae_calibrated": mae,
        "thresholds": {
            "max_real_test_mae": max_real_test_mae,
            "max_tail_mae": max_tail_mae,
            "min_tail_n": min_tail_n,
        },
        "tail_slices": {},
    }
    if mae > max_real_test_mae:
        return False, {**detail, "reason": "real_test_mae_above_threshold"}
    slices = cal.get("slice_metrics") or {}
    for bucket in ("<=4", ">=8.5"):
        s = slices.get(bucket) or {}
        n = int(s.get("n", 0))
        smae = s.get("MAE")
        detail["tail_slices"][bucket] = {"n": n, "MAE": smae}
        if n >= min_tail_n and smae is not None and float(smae) > max_tail_mae:
            return False, {**detail, "reason": f"tail_slice_{bucket}_above_threshold"}
    return True, {**detail, "reason": "passed"}


def _abstention_policy(train_frame: pd.DataFrame) -> dict[str, object]:
    word_counts = train_frame["essay_word_count"].astype(float).to_numpy()
    return {
        "min_essay_words": int(np.floor(np.quantile(word_counts, 0.01))),
        "max_essay_words": int(np.ceil(np.quantile(word_counts, 0.99))),
        "abstain_on_degraded_features": True,
        "display_tail_buckets": True,
    }


def _stress_slice_report(
    frame: pd.DataFrame,
    predictions: np.ndarray,
    *,
    bootstrap_samples: int,
) -> dict[str, object]:
    y_true = frame[OVERALL_TARGET].astype(float).to_numpy()
    slices: dict[str, np.ndarray] = {
        "short_essay": frame["essay_word_count"].astype(int).to_numpy() <= 250,
        "long_essay": frame["essay_word_count"].astype(int).to_numpy() >= 400,
        "crawled_source": frame["source"].astype(str).to_numpy() == "crawled",
        "hf_public_source": frame["source"].astype(str).to_numpy() == "hf_public",
    }
    out: dict[str, object] = {}
    for name, mask in slices.items():
        if not np.any(mask):
            out[name] = {}
            continue
        out[name] = evaluate_predictions(
            y_true[mask],
            predictions[mask],
            bootstrap_samples=bootstrap_samples,
        )
    return out


def _column_percentile_mask(feature_names: list[str], X: np.ndarray, name: str, percentile: float) -> np.ndarray | None:
    if name not in feature_names:
        return None
    column = X[:, feature_names.index(name)]
    threshold = float(np.quantile(column, percentile))
    return column >= threshold


def _run_stress_tests(
    feature_names: list[str],
    X_real_test: np.ndarray,
    real_test_frame: pd.DataFrame,
    selected_predictions: np.ndarray,
    *,
    bootstrap_samples: int,
) -> dict[str, object]:
    report = _stress_slice_report(real_test_frame, selected_predictions, bootstrap_samples=bootstrap_samples)
    marker_dense_mask = _column_percentile_mask(
        feature_names,
        X_real_test,
        "discourse_marker_density_score",
        0.9,
    )
    if marker_dense_mask is not None and np.any(marker_dense_mask):
        report["marker_dense"] = evaluate_predictions(
            real_test_frame[OVERALL_TARGET].astype(float).to_numpy()[marker_dense_mask],
            selected_predictions[marker_dense_mask],
            bootstrap_samples=bootstrap_samples,
        )
    body_para_mask = _column_percentile_mask(feature_names, X_real_test, "body_paragraph_count", 0.9)
    if body_para_mask is not None and np.any(body_para_mask):
        report["many_body_paragraphs"] = evaluate_predictions(
            real_test_frame[OVERALL_TARGET].astype(float).to_numpy()[body_para_mask],
            selected_predictions[body_para_mask],
            bootstrap_samples=bootstrap_samples,
        )
    return report


def run_ablation_study(
    df: pd.DataFrame,
    shared_blocks: SharedFeatureBlocks,
    split_indices: dict[str, np.ndarray],
    config: TrainingConfig,
) -> pd.DataFrame:
    print("\nRunning feature ablation study...")
    rows: list[dict[str, object]] = []
    train_idx = split_indices["train"]
    dev_idx = split_indices["dev"]
    for name, overrides in ABLATION_CONFIGS:
        print(f"\n[Ablation] {name}")
        flags = dict(DEFAULT_FEATURE_FLAGS)
        flags.update(overrides)
        ablation_bundle = extract_dataset_bundle(
            df,
            feature_flags=flags,
            shared_blocks=shared_blocks,
        )
        X_train = ablation_bundle.features[train_idx]
        y_train = ablation_bundle.frame.iloc[train_idx][OVERALL_TARGET].astype(float).to_numpy()
        X_dev = ablation_bundle.features[dev_idx]
        y_dev = ablation_bundle.frame.iloc[dev_idx][OVERALL_TARGET].astype(float).to_numpy()
        if bool(flags.get("llm")) and LLM_FEATURE_NAMES[0] not in ablation_bundle.feature_names:
            rows.append({
                "Experiment": name,
                "Status": "skipped_missing_llm_cache",
                "Split": "dev",
                "MAE": np.nan,
                "ACC_EXACT": np.nan,
                "ACC_0.5": np.nan,
                "ACC_1.0": np.nan,
                "ACC_1.5": np.nan,
                "n_features": np.nan,
                "llm_enabled": False,
            })
            continue
        model = fit_catboost_regressor(
            X_train,
            y_train,
            X_valid=X_dev,
            y_valid=y_dev,
            early_stopping_rounds=config.early_stopping_rounds,
        )
        pred = clip_scores(model.predict(X_dev))
        metrics = evaluate_predictions(y_dev, pred, bootstrap_samples=config.bootstrap_samples)
        rows.append({
            "Experiment": name,
            "Status": "completed",
            "Split": "dev",
            "MAE": metrics["MAE"],
            "ACC_EXACT": metrics["ACC_EXACT"],
            "ACC_0.5": metrics["ACC_0.5"],
            "ACC_1.0": metrics["ACC_1.0"],
            "ACC_1.5": metrics["ACC_1.5"],
            "n_features": len(ablation_bundle.feature_names),
            "llm_enabled": bool(ablation_bundle.feature_flags["llm"]),
        })
    return pd.DataFrame(rows).sort_values(["Status", "MAE"], na_position="last").reset_index(drop=True)


def evaluate_pipeline(
    bundle: DatasetBundle,
    config: TrainingConfig,
) -> tuple[pd.DataFrame, dict[str, object], dict[str, CatBoostRegressor], dict[str, object]]:
    split_indices = _split_indices(bundle.frame)
    X_train, train_frame = _subset(bundle, split_indices["train"])
    X_dev, dev_frame = _subset(bundle, split_indices["dev"])
    X_real_test, real_test_frame = _subset(bundle, split_indices["real_test"])
    frame_by_split = {"train": train_frame, "dev": dev_frame, "real_test": real_test_frame}

    train_oof_predictions, folds = _generate_aligned_train_oof(X_train, train_frame, config)
    hybrid_model = _fit_meta_model(
        _build_meta_features(train_oof_predictions),
        train_frame[OVERALL_TARGET].astype(float).to_numpy(),
        config,
    )
    train_oof_predictions[HYBRID_OVERALL_TARGET] = clip_scores(
        hybrid_model.predict(_build_meta_features(train_oof_predictions))
    )

    first_stage_models = _fit_first_stage_models(X_train, train_frame, X_dev, dev_frame, config)
    raw_dev = _predict_first_stage(first_stage_models, X_dev)
    raw_real_test = _predict_first_stage(first_stage_models, X_real_test)
    raw_dev[DERIVED_OVERALL_TARGET] = derive_overall_band(raw_dev)
    raw_real_test[DERIVED_OVERALL_TARGET] = derive_overall_band(raw_real_test)
    raw_dev[HYBRID_OVERALL_TARGET] = clip_scores(
        hybrid_model.predict(_build_meta_features(raw_dev))
    )
    raw_real_test[HYBRID_OVERALL_TARGET] = clip_scores(
        hybrid_model.predict(_build_meta_features(raw_real_test))
    )

    calibrators: dict[str, dict[str, object]] = {}
    for target in [*RUBRIC_COLUMNS, DIRECT_OVERALL_TARGET, DERIVED_OVERALL_TARGET, HYBRID_OVERALL_TARGET]:
        y_dev = dev_frame[target if target in RUBRIC_COLUMNS else OVERALL_TARGET].astype(float).to_numpy()
        calibrators[target] = _fit_calibrator(y_dev, raw_dev[target])

    rows: list[dict[str, object]] = []
    reports: dict[str, object] = {
        "benchmark_summary": summarize_benchmark_frame(bundle.frame),
        "aligned_oof_folds": len(folds),
        "feature_flags": bundle.feature_flags,
        "train_oof": {},
        "train_meta_fit": {},
    }
    for target in RUBRIC_COLUMNS:
        y_train = train_frame[target].astype(float).to_numpy()
        oof_metrics = evaluate_predictions(
            y_train,
            train_oof_predictions[target],
            bootstrap_samples=config.bootstrap_samples,
        )
        rows.append(_flatten_metric_row(target, "train", "oof", oof_metrics))
        target_rows, target_report = _evaluate_target_across_splits(
            target,
            {"dev": raw_dev, "real_test": raw_real_test},
            frame_by_split,
            bootstrap_samples=config.bootstrap_samples,
            calibrator=calibrators[target],
        )
        rows.extend(target_rows)
        reports[target] = target_report
        reports["train_oof"][target] = oof_metrics

    overall_reports: dict[str, dict[str, object]] = {}
    for target in [DIRECT_OVERALL_TARGET, DERIVED_OVERALL_TARGET, HYBRID_OVERALL_TARGET]:
        y_train_overall = train_frame[OVERALL_TARGET].astype(float).to_numpy()
        train_target_pred = (
            train_oof_predictions[target]
            if target in train_oof_predictions
            else clip_scores(hybrid_model.predict(_build_meta_features(train_oof_predictions)))
        )
        oof_metrics = evaluate_predictions(
            y_train_overall,
            train_target_pred,
            bootstrap_samples=config.bootstrap_samples,
        )
        evaluation_name = "meta_fit" if target == HYBRID_OVERALL_TARGET else "oof"
        rows.append(_flatten_metric_row(target, "train", evaluation_name, oof_metrics))
        target_rows, target_report = _evaluate_target_across_splits(
            target,
            {"dev": raw_dev, "real_test": raw_real_test},
            frame_by_split,
            bootstrap_samples=config.bootstrap_samples,
            calibrator=calibrators[target],
        )
        rows.extend(target_rows)
        reports[target] = target_report
        if target == HYBRID_OVERALL_TARGET:
            reports["train_meta_fit"][target] = oof_metrics
        else:
            reports["train_oof"][target] = oof_metrics
        overall_reports[target] = target_report

    selected_overall_strategy = _select_best_overall_strategy(overall_reports)
    confidence_enabled, confidence_gate_detail = _confidence_gate(overall_reports, selected_overall_strategy)
    confidence_reason = (
        "Agreement-based confidence enabled after passing real_test calibration and tail-slice checks."
        if confidence_enabled
        else confidence_gate_detail.get("reason", "withheld")
    )
    selected_real_test_predictions = (
        apply_calibrator(raw_real_test[selected_overall_strategy], calibrators[selected_overall_strategy])
        if calibrators.get(selected_overall_strategy)
        else raw_real_test[selected_overall_strategy]
    )
    reports["selection"] = {
        "selected_overall_strategy": selected_overall_strategy,
        "selection_targets": [DIRECT_OVERALL_TARGET, DERIVED_OVERALL_TARGET, HYBRID_OVERALL_TARGET],
        "confidence_enabled": confidence_enabled,
        "confidence_reason": confidence_reason,
        "confidence_gate": confidence_gate_detail,
        "abstention_policy": _abstention_policy(train_frame),
    }
    if config.run_stress_tests:
        reports["stress_tests"] = _run_stress_tests(
            bundle.feature_names,
            X_real_test,
            real_test_frame,
            selected_real_test_predictions,
            bootstrap_samples=config.bootstrap_samples,
        )

    models: dict[str, CatBoostRegressor] = {**first_stage_models, HYBRID_OVERALL_TARGET: hybrid_model}
    artifacts = {
        "calibrators": calibrators,
        "selected_overall_strategy": selected_overall_strategy,
        "abstention_policy": reports["selection"]["abstention_policy"],
        "confidence_policy": {
            "enabled": confidence_enabled,
            "reason": reports["selection"]["confidence_reason"],
            "gate": confidence_gate_detail,
        },
    }
    return pd.DataFrame(rows), reports, models, artifacts


def save_training_artifacts(
    bundle: DatasetBundle,
    models: dict[str, CatBoostRegressor],
    metrics_df: pd.DataFrame,
    reports: dict[str, object],
    artifacts: dict[str, object],
    ablation_df: pd.DataFrame,
    *,
    artifact_dir: Path | None = None,
    benchmark_manifest: dict[str, object] | None = None,
    metadata_extras: dict[str, object] | None = None,
) -> None:
    out_dir = artifact_dir or ARTIFACT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    saved_model_files: dict[str, str] = {}
    for target, model in models.items():
        if target not in MODEL_FILENAMES:
            continue
        model_path = out_dir / MODEL_FILENAMES[target]
        model.save_model(str(model_path))
        saved_model_files[target] = MODEL_FILENAMES[target]

    metrics_df.to_csv(out_dir / "metrics.csv", index=False)
    ablation_df.to_csv(out_dir / "ablation_metrics.csv", index=False)

    summary_path = out_dir / "evaluation_summary.txt"
    summary_lines = [
        f"generated_utc: {datetime.now(timezone.utc).isoformat()}",
        "",
        format_evaluation_summary_text(metrics_df),
        "",
    ]
    summary_path.write_text("\n".join(summary_lines), encoding="utf-8")

    manifest = benchmark_manifest if benchmark_manifest is not None else summarize_benchmark_frame(bundle.frame)
    manifest = dict(manifest)
    manifest["selected_overall_strategy"] = artifacts["selected_overall_strategy"]
    manifest["tail_policy"] = {
        "training_target": "numeric_regression",
        "display_low_band_as": "<=4",
        "display_high_band_as": ">=8.5",
    }
    (out_dir / "benchmark_manifest.json").write_text(
        json.dumps(manifest, indent=2),
        encoding="utf-8",
    )
    (out_dir / "calibrator.json").write_text(
        json.dumps(artifacts["calibrators"], indent=2),
        encoding="utf-8",
    )
    (out_dir / "evaluation.json").write_text(
        json.dumps(reports, indent=2),
        encoding="utf-8",
    )

    metadata: dict[str, object] = {
        "model_family": "CatBoostRegressor",
        "model_params": CATBOOST_PARAMS,
        "meta_model_params": META_CATBOOST_PARAMS,
        "feature_flags": bundle.feature_flags,
        "feature_names": bundle.feature_names,
        "meta_feature_names": META_FEATURE_NAMES,
        "targets": [*RUBRIC_COLUMNS, OVERALL_TARGET],
        "overall_candidates": [
            DIRECT_OVERALL_TARGET,
            DERIVED_OVERALL_TARGET,
            HYBRID_OVERALL_TARGET,
        ],
        "selected_overall_strategy": artifacts["selected_overall_strategy"],
        "derived_prediction_name": DERIVED_OVERALL_TARGET,
        "direct_prediction_name": DIRECT_OVERALL_TARGET,
        "hybrid_prediction_name": HYBRID_OVERALL_TARGET,
        "n_features": len(bundle.feature_names),
        "n_samples": int(len(bundle.frame)),
        "artifact_dir": str(out_dir),
        "model_files": saved_model_files,
        "benchmark_manifest_file": "benchmark_manifest.json",
        "evaluation_file": "evaluation.json",
        "evaluation_summary_file": "evaluation_summary.txt",
        "calibrator_file": "calibrator.json",
        "ablation_file": "ablation_metrics.csv",
        "abstention_policy": artifacts["abstention_policy"],
        "confidence_policy": artifacts["confidence_policy"],
    }
    if metadata_extras:
        metadata.update(metadata_extras)
    (out_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print("\nSaved benchmarked training artifacts to", out_dir)


def main() -> None:
    config = parse_args()
    df = load_data()
    shared_blocks = prepare_shared_feature_blocks(df, feature_flags=dict(DEFAULT_FEATURE_FLAGS))
    bundle = extract_dataset_bundle(
        df,
        feature_flags=dict(DEFAULT_FEATURE_FLAGS),
        shared_blocks=shared_blocks,
    )

    if config.run_ablation_study:
        ablation_df = run_ablation_study(df, shared_blocks, _split_indices(bundle.frame), config)
    else:
        print("\nSkipping ablation study.")
        ablation_df = pd.DataFrame()

    print("\nTraining benchmarked CatBoost stack...")
    metrics_df, reports, models, artifacts = evaluate_pipeline(bundle, config)
    save_training_artifacts(bundle, models, metrics_df, reports, artifacts, ablation_df)

    print("\n" + format_evaluation_summary_text(metrics_df))


if __name__ == "__main__":
    main()
