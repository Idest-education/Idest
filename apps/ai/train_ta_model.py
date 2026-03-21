"""
Train rubric-aware CatBoost models for IELTS Writing Task 2 scoring.

Pipeline:
data loading -> feature extraction -> robust evaluation -> ablation study -> export
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import (
    GroupShuffleSplit,
    KFold,
    RepeatedKFold,
    RepeatedStratifiedKFold,
    StratifiedKFold,
)

from data import RUBRIC_COLUMNS, load_clean_data
from writing_scorer.features import (
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
from writing_scorer.llm_features import LLM_FEATURE_NAMES, get_llm_feature_array

try:
    from catboost import CatBoostRegressor
except ImportError:
    CatBoostRegressor = None


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = PROJECT_ROOT / "models" / "rubric_catboost"
OVERALL_TARGET = "band"
DIRECT_OVERALL_TARGET = "overall_direct"
DERIVED_OVERALL_TARGET = "overall_from_rubrics"
ALL_TARGETS = [*RUBRIC_COLUMNS, OVERALL_TARGET]
MODEL_FILENAMES = {
    "TA": "ta_model.cbm",
    "CC": "cc_model.cbm",
    "LR": "lr_model.cbm",
    "GR": "gr_model.cbm",
    OVERALL_TARGET: "overall_model.cbm",
}
CATBOOST_PARAMS = {
    "iterations": 2000,
    "depth": 6,
    "learning_rate": 0.03,
    "loss_function": "MAE",
    "random_seed": 42,
    "verbose": False,
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
    run_repeated_cv: bool
    run_prompt_group_cv: bool
    run_derived_repeated_cv: bool
    cv_splits: int
    cv_repeats: int
    prompt_group_splits: int


def parse_args() -> TrainingConfig:
    parser = argparse.ArgumentParser(description="Train rubric-aware IELTS scoring models.")
    parser.add_argument(
        "--fast",
        action="store_true",
        help="Use a quicker development mode with fewer evaluation passes.",
    )
    parser.add_argument(
        "--skip-ablation",
        action="store_true",
        help="Skip the ablation study and train the full stack only.",
    )
    parser.add_argument(
        "--skip-group-cv",
        action="store_true",
        help="Skip prompt-group evaluation.",
    )
    parser.add_argument(
        "--skip-repeated-cv",
        action="store_true",
        help="Skip repeated cross-validation summaries.",
    )
    parser.add_argument(
        "--full-derived-cv",
        action="store_true",
        help="Enable repeated CV for the rubric-derived overall score.",
    )
    args = parser.parse_args()

    fast_mode = bool(args.fast)
    return TrainingConfig(
        fast_mode=fast_mode,
        run_ablation_study=not args.skip_ablation and not fast_mode,
        run_repeated_cv=not args.skip_repeated_cv and not fast_mode,
        run_prompt_group_cv=not args.skip_group_cv,
        run_derived_repeated_cv=bool(args.full_derived_cv and not fast_mode),
        cv_splits=3 if fast_mode else 5,
        cv_repeats=1 if fast_mode else 2,
        prompt_group_splits=2 if fast_mode else 5,
    )


def load_data() -> pd.DataFrame:
    print("Loading and cleaning dataset...")
    df = load_clean_data()
    print(f"  Loaded {len(df)} rubric-complete samples")
    return df


def normalize_prompt_group(prompt: str) -> str:
    return re.sub(r"\s+", " ", prompt.strip().lower())


def round_to_half_band(values: np.ndarray | list[float] | float) -> np.ndarray:
    arr = np.asarray(values, dtype=np.float64)
    return np.round(arr * 2.0) / 2.0


def clip_scores(values: np.ndarray | list[float] | float) -> np.ndarray:
    return np.clip(np.asarray(values, dtype=np.float64), 0.0, 9.0)


def derive_overall_band(predictions: dict[str, np.ndarray]) -> np.ndarray:
    stacked = np.column_stack([clip_scores(predictions[target]) for target in RUBRIC_COLUMNS])
    return clip_scores(round_to_half_band(np.mean(stacked, axis=1)))


def build_catboost_regressor() -> CatBoostRegressor:
    if CatBoostRegressor is None:
        raise RuntimeError(
            "CatBoost is required for training. Install dependencies from apps/ai/requirements.txt."
        )
    return CatBoostRegressor(**CATBOOST_PARAMS)


def _band_labels(targets: pd.Series) -> np.ndarray:
    return round_to_half_band(targets.to_numpy()).astype(str)


def _class_counts(labels: np.ndarray) -> Counter:
    return Counter(labels)


def _safe_n_splits(labels: np.ndarray, desired: int = 5) -> int:
    counts = _class_counts(labels)
    if not counts:
        raise ValueError("Cannot build splits for an empty dataset.")
    return min(max(2, desired), len(labels))


def _supports_stratification(labels: np.ndarray) -> bool:
    counts = _class_counts(labels)
    return bool(counts) and min(counts.values()) >= 2


def _build_oof_splitter(labels: np.ndarray, cv_splits: int):
    n_splits = min(max(2, cv_splits), len(labels))
    if _supports_stratification(labels):
        return StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    return KFold(n_splits=n_splits, shuffle=True, random_state=42)


def _build_repeated_splitter(labels: np.ndarray, config: TrainingConfig):
    n_splits = min(max(2, config.cv_splits), len(labels))
    if _supports_stratification(labels):
        return "repeated_stratified_cv", RepeatedStratifiedKFold(
            n_splits=n_splits,
            n_repeats=config.cv_repeats,
            random_state=42,
        )
    return "repeated_kfold_cv", RepeatedKFold(
        n_splits=n_splits,
        n_repeats=config.cv_repeats,
        random_state=42,
    )


def accuracy_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    pred = clip_scores(y_pred)
    pred_band = round_to_half_band(pred)
    true_band = round_to_half_band(y_true)
    exact = np.mean(pred_band == true_band)
    within_05 = np.mean(np.abs(pred - y_true) <= 0.5)
    within_1 = np.mean(np.abs(pred - y_true) <= 1.0)
    return {
        "exact": float(exact),
        "within_0.5": float(within_05),
        "within_1.0": float(within_1),
    }


def evaluate_predictions(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, object]:
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
        "per_band_mae": per_band_mae,
    }


def _summarize_split_metrics(rows: list[dict[str, float]]) -> dict[str, object]:
    if not rows:
        return {}
    keys = ["MAE", "ACC_EXACT", "ACC_0.5", "ACC_1.0"]
    summary: dict[str, object] = {}
    for key in keys:
        values = np.asarray([row[key] for row in rows], dtype=np.float64)
        summary[key] = {
            "mean": float(np.mean(values)),
            "std": float(np.std(values)),
            "min": float(np.min(values)),
            "max": float(np.max(values)),
        }
    return summary


def evaluate_target_with_cv(
    X: np.ndarray,
    y: pd.Series,
    groups: np.ndarray,
    config: TrainingConfig,
) -> dict[str, object]:
    labels = _band_labels(y)
    summary: dict[str, object] = {}

    if config.run_repeated_cv:
        repeated_name, repeated_cv = _build_repeated_splitter(labels, config)
        repeated_rows: list[dict[str, float]] = []
        for train_idx, test_idx in repeated_cv.split(X, labels):
            model = build_catboost_regressor()
            model.fit(X[train_idx], y.iloc[train_idx].to_numpy())
            pred = model.predict(X[test_idx])
            repeated_rows.append(evaluate_predictions(y.iloc[test_idx].to_numpy(), pred))
        summary[repeated_name] = _summarize_split_metrics(repeated_rows)

    if config.run_prompt_group_cv and len(np.unique(groups)) >= 2:
        grouped_rows: list[dict[str, float]] = []
        grouped_cv = GroupShuffleSplit(
            n_splits=config.prompt_group_splits,
            test_size=0.2,
            random_state=42,
        )
        for train_idx, test_idx in grouped_cv.split(X, y, groups=groups):
            model = build_catboost_regressor()
            model.fit(X[train_idx], y.iloc[train_idx].to_numpy())
            pred = model.predict(X[test_idx])
            grouped_rows.append(evaluate_predictions(y.iloc[test_idx].to_numpy(), pred))
        summary["prompt_group_cv"] = _summarize_split_metrics(grouped_rows)

    return summary


def evaluate_derived_overall_with_cv(
    X: np.ndarray,
    targets: pd.DataFrame,
    groups: np.ndarray,
    config: TrainingConfig,
) -> dict[str, object]:
    labels = _band_labels(targets[OVERALL_TARGET])
    summary: dict[str, object] = {}

    def _evaluate_split_rows(splitter, use_groups: bool = False) -> list[dict[str, float]]:
        rows: list[dict[str, float]] = []
        if use_groups:
            iterator = splitter.split(X, targets[OVERALL_TARGET], groups=groups)
        else:
            iterator = splitter.split(X, labels)
        for train_idx, test_idx in iterator:
            split_predictions: dict[str, np.ndarray] = {}
            for target in RUBRIC_COLUMNS:
                model = build_catboost_regressor()
                model.fit(X[train_idx], targets[target].iloc[train_idx].to_numpy())
                split_predictions[target] = model.predict(X[test_idx])
            derived = derive_overall_band(split_predictions)
            rows.append(
                evaluate_predictions(
                    targets[OVERALL_TARGET].iloc[test_idx].to_numpy(),
                    derived,
                )
            )
        return rows

    if config.run_derived_repeated_cv:
        repeated_name, repeated_cv = _build_repeated_splitter(labels, config)
        repeated_rows = _evaluate_split_rows(repeated_cv)
        summary[repeated_name] = _summarize_split_metrics(repeated_rows)

    if config.run_prompt_group_cv and len(np.unique(groups)) >= 2:
        grouped_rows = _evaluate_split_rows(
            GroupShuffleSplit(
                n_splits=config.prompt_group_splits,
                test_size=0.2,
                random_state=42,
            ),
            use_groups=True,
        )
        summary["prompt_group_cv"] = _summarize_split_metrics(grouped_rows)
    return summary


def generate_oof_predictions(X: np.ndarray, y: pd.Series, cv_splits: int = 5) -> np.ndarray:
    labels = _band_labels(y)
    splitter = _build_oof_splitter(labels, cv_splits=cv_splits)
    oof = np.zeros(len(y), dtype=np.float64)
    for train_idx, test_idx in splitter.split(X, labels):
        model = build_catboost_regressor()
        model.fit(X[train_idx], y.iloc[train_idx].to_numpy())
        oof[test_idx] = clip_scores(model.predict(X[test_idx]))
    return oof


def _flatten_metric_row(target: str, evaluation: str, metrics: dict[str, object]) -> dict[str, object]:
    return {
        "Target": target,
        "Evaluation": evaluation,
        "MAE": metrics["MAE"],
        "ACC_EXACT": metrics["ACC_EXACT"],
        "ACC_0.5": metrics["ACC_0.5"],
        "ACC_1.0": metrics["ACC_1.0"],
    }


def prepare_shared_feature_blocks(
    df: pd.DataFrame,
    feature_flags: dict[str, object] | None = None,
) -> SharedFeatureBlocks:
    flags = resolve_feature_flags(feature_flags)
    print("Extracting features...")

    df_working = df.loc[:, ["prompt", "essay", *ALL_TARGETS]].reset_index(drop=True)
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
        llm_full = get_llm_feature_array(len(df_working))
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


def evaluate_rubric_bundle(
    bundle: DatasetBundle,
    config: TrainingConfig,
) -> tuple[pd.DataFrame, dict[str, object], dict[str, np.ndarray]]:
    groups = bundle.frame["prompt"].map(normalize_prompt_group).to_numpy()
    targets = bundle.frame[ALL_TARGETS].astype(float)
    rows: list[dict[str, object]] = []
    reports: dict[str, object] = {}
    predictions: dict[str, np.ndarray] = {}

    for target in RUBRIC_COLUMNS:
        y = targets[target]
        pred = generate_oof_predictions(bundle.features, y, cv_splits=config.cv_splits)
        metrics = evaluate_predictions(y.to_numpy(), pred)
        rows.append(_flatten_metric_row(target, "oof", metrics))
        reports[target] = {
            "oof_metrics": metrics,
            "cv_summary": evaluate_target_with_cv(bundle.features, y, groups, config),
        }
        predictions[target] = pred

    derived_overall = derive_overall_band(predictions)
    overall_metrics = evaluate_predictions(targets[OVERALL_TARGET].to_numpy(), derived_overall)
    rows.append(_flatten_metric_row(DERIVED_OVERALL_TARGET, "oof", overall_metrics))
    reports[DERIVED_OVERALL_TARGET] = {
        "oof_metrics": overall_metrics,
        "cv_summary": evaluate_derived_overall_with_cv(bundle.features, targets, groups, config),
    }
    predictions[DERIVED_OVERALL_TARGET] = derived_overall

    direct_overall = generate_oof_predictions(
        bundle.features,
        targets[OVERALL_TARGET],
        cv_splits=config.cv_splits,
    )
    direct_metrics = evaluate_predictions(targets[OVERALL_TARGET].to_numpy(), direct_overall)
    rows.append(_flatten_metric_row(DIRECT_OVERALL_TARGET, "oof", direct_metrics))
    reports[DIRECT_OVERALL_TARGET] = {
        "oof_metrics": direct_metrics,
        "cv_summary": evaluate_target_with_cv(
            bundle.features,
            targets[OVERALL_TARGET],
            groups,
            config,
        ),
    }
    predictions[DIRECT_OVERALL_TARGET] = direct_overall
    return pd.DataFrame(rows), reports, predictions


def fit_final_models(bundle: DatasetBundle) -> dict[str, CatBoostRegressor]:
    trained: dict[str, CatBoostRegressor] = {}
    targets = bundle.frame[ALL_TARGETS].astype(float)
    for target in [*RUBRIC_COLUMNS, OVERALL_TARGET]:
        print(f"Training final CatBoost model for {target}...")
        model = build_catboost_regressor()
        model.fit(bundle.features, targets[target].to_numpy())
        trained[target] = model
    return trained


def run_ablation_study(
    df: pd.DataFrame,
    shared_blocks: SharedFeatureBlocks,
    config: TrainingConfig,
) -> pd.DataFrame:
    print("\nRunning feature ablation study...")
    rows: list[dict[str, object]] = []
    for name, overrides in ABLATION_CONFIGS:
        print(f"\n[Ablation] {name}")
        flags = dict(DEFAULT_FEATURE_FLAGS)
        flags.update(overrides)
        if bool(flags.get("llm")) and shared_blocks.llm_block is None:
            print("  Skipping LLM ablation because the full LLM cache is unavailable.")
            rows.append({
                "Experiment": name,
                "Status": "skipped_missing_llm_cache",
                "MAE": np.nan,
                "ACC_EXACT": np.nan,
                "ACC_0.5": np.nan,
                "ACC_1.0": np.nan,
                "n_features": np.nan,
                "llm_enabled": False,
            })
            continue
        bundle = extract_dataset_bundle(df, feature_flags=flags, shared_blocks=shared_blocks)
        y = bundle.frame[OVERALL_TARGET].astype(float)
        pred = generate_oof_predictions(bundle.features, y, cv_splits=config.cv_splits)
        metrics = evaluate_predictions(y.to_numpy(), pred)
        rows.append({
            "Experiment": name,
            "Status": "completed",
            "MAE": metrics["MAE"],
            "ACC_EXACT": metrics["ACC_EXACT"],
            "ACC_0.5": metrics["ACC_0.5"],
            "ACC_1.0": metrics["ACC_1.0"],
            "n_features": len(bundle.feature_names),
            "llm_enabled": bool(bundle.feature_flags["llm"]),
        })
    return pd.DataFrame(rows).sort_values(["Status", "MAE"], na_position="last").reset_index(drop=True)


def save_training_artifacts(
    bundle: DatasetBundle,
    models: dict[str, CatBoostRegressor],
    metrics_df: pd.DataFrame,
    reports: dict[str, object],
    predictions: dict[str, np.ndarray],
    ablation_df: pd.DataFrame,
) -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    for target, model in models.items():
        model_path = ARTIFACT_DIR / MODEL_FILENAMES[target]
        model.save_model(str(model_path))

    metrics_df.to_csv(ARTIFACT_DIR / "metrics.csv", index=False)
    ablation_df.to_csv(ARTIFACT_DIR / "ablation_metrics.csv", index=False)

    evaluation_payload = {}
    true_overall = bundle.frame[OVERALL_TARGET].astype(float).to_numpy()
    for target in RUBRIC_COLUMNS:
        evaluation_payload[target] = {
            "true": [float(x) for x in bundle.frame[target].astype(float).to_list()],
            "pred": [float(x) for x in predictions[target].tolist()],
        }
    evaluation_payload[DIRECT_OVERALL_TARGET] = {
        "true": [float(x) for x in true_overall.tolist()],
        "pred": [float(x) for x in predictions[DIRECT_OVERALL_TARGET].tolist()],
    }
    evaluation_payload[DERIVED_OVERALL_TARGET] = {
        "true": [float(x) for x in true_overall.tolist()],
        "pred": [float(x) for x in predictions[DERIVED_OVERALL_TARGET].tolist()],
    }

    metadata = {
        "model_family": "CatBoostRegressor",
        "model_params": CATBOOST_PARAMS,
        "feature_flags": bundle.feature_flags,
        "feature_names": bundle.feature_names,
        "targets": [*RUBRIC_COLUMNS, OVERALL_TARGET],
        "derived_prediction_name": DERIVED_OVERALL_TARGET,
        "direct_prediction_name": DIRECT_OVERALL_TARGET,
        "n_features": len(bundle.feature_names),
        "n_samples": int(len(bundle.frame)),
        "artifact_dir": str(ARTIFACT_DIR),
        "model_files": {
            target: filename for target, filename in MODEL_FILENAMES.items()
        },
        "evaluation_reports": reports,
        "ablation_file": "ablation_metrics.csv",
    }

    (ARTIFACT_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    (ARTIFACT_DIR / "evaluation.json").write_text(
        json.dumps(evaluation_payload, indent=2),
        encoding="utf-8",
    )

    print("\nSaved rubric-aware training artifacts to", ARTIFACT_DIR)


def main() -> None:
    config = parse_args()
    df = load_data()
    shared_blocks = prepare_shared_feature_blocks(df, feature_flags=dict(DEFAULT_FEATURE_FLAGS))
    if config.run_ablation_study:
        ablation_df = run_ablation_study(df, shared_blocks, config)
    else:
        print("\nSkipping ablation study.")
        ablation_df = pd.DataFrame()

    print("\nTraining full rubric-aware stack...")
    bundle = extract_dataset_bundle(
        df,
        feature_flags=dict(DEFAULT_FEATURE_FLAGS),
        shared_blocks=shared_blocks,
    )
    metrics_df, reports, predictions = evaluate_rubric_bundle(bundle, config)
    models = fit_final_models(bundle)
    save_training_artifacts(bundle, models, metrics_df, reports, predictions, ablation_df)

    print("\n" + "=" * 84)
    print("  Rubric-aware evaluation summary")
    print("=" * 84)
    print(
        metrics_df.to_string(
            index=False,
            formatters={
                "MAE": "{:.4f}".format,
                "ACC_EXACT": "{:.2%}".format,
                "ACC_0.5": "{:.2%}".format,
                "ACC_1.0": "{:.2%}".format,
            },
        )
    )


if __name__ == "__main__":
    main()
