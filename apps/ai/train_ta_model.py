"""
Train a single CatBoost regressor for overall IELTS Writing Task 2 band score.

Pipeline:
data loading -> feature extraction -> single-target training -> evaluation -> export
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split

from data import load_clean_data
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
from writing_scorer.llm_features import (
    LLM_FEATURE_NAMES,
    get_llm_feature_array,
    get_partial_llm_cache,
)

try:
    from catboost import CatBoostRegressor
except ImportError:
    CatBoostRegressor = None


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = PROJECT_ROOT / "models" / "rubric_catboost"
TARGET_COLUMN = "band"
OVERALL_COLUMN = "overall"
CATBOOST_PARAMS = {
    "iterations": 2000,
    "depth": 6,
    "learning_rate": 0.03,
    "loss_function": "MAE",
    "random_seed": 42,
    "verbose": False,
}
MODEL_FILENAME = "overall_model.cbm"


@dataclass(frozen=True)
class DatasetBundle:
    features: np.ndarray
    targets: pd.Series
    feature_names: list[str]
    feature_flags: dict[str, object]


@dataclass(frozen=True)
class TrainingBundle:
    model: CatBoostRegressor
    results: pd.DataFrame
    y_test: pd.Series
    predictions: pd.Series
    train_size: int
    test_size: int


def load_data() -> pd.DataFrame:
    print("Loading and cleaning dataset...")
    df = load_clean_data()
    print(f"  Loaded {len(df)} samples")
    return df


def extract_dataset_bundle(
    df: pd.DataFrame,
    feature_flags: dict[str, object] | None = None,
) -> DatasetBundle:
    """Extract the full feature matrix and aligned overall target."""
    flags = resolve_feature_flags(feature_flags)
    print("Extracting features...")

    df_working = df.reset_index(drop=True)
    llm_block: np.ndarray | None = None

    if bool(flags["llm"]):
        llm_full = get_llm_feature_array(len(df_working))
        if llm_full is not None:
            llm_block = llm_full
            print(f"  LLM features loaded from full cache ({llm_full.shape[1]} features)")
        else:
            partial = get_partial_llm_cache()
            if partial is not None:
                indices, llm_vals = partial
                df_working = df_working.loc[indices].reset_index(drop=True)
                llm_block = llm_vals
                print(f"  Using partial LLM cache: {len(indices)} essays with LLM features")
            else:
                print("  LLM cache not found — training without LLM feature block.")

    raw_targets = pd.to_numeric(df_working[TARGET_COLUMN], errors="coerce")
    valid_target_mask = raw_targets.notna() & raw_targets.between(0.0, 9.0)

    dropped_rows = int((~valid_target_mask).sum())
    if dropped_rows:
        print(
            "  Dropping "
            f"{dropped_rows} essays with incomplete or invalid {TARGET_COLUMN} labels."
        )
        if llm_block is not None:
            llm_block = llm_block[valid_target_mask.to_numpy()]
        df_working = df_working.loc[valid_target_mask].reset_index(drop=True)
        raw_targets = raw_targets.loc[valid_target_mask].reset_index(drop=True)

    prompts = df_working["prompt"].tolist()
    essays = df_working["essay"].tolist()
    targets = raw_targets.astype(float).rename(OVERALL_COLUMN)
    model = get_sbert_model()

    feature_names = list(get_classical_feature_names(flags))
    feature_blocks = [
        extract_classical_features(prompts, essays, model, feature_flags=flags)
    ]

    if bool(flags["essay_embeddings"]):
        print("  Extracting full essay embeddings...")
        essay_embeddings = extract_essay_embedding_features(
            essays,
            model=model,
            batch_size=int(flags["embedding_batch_size"]),
            use_cache=bool(flags["cache_embeddings"]),
        )
        feature_blocks.append(essay_embeddings)
        feature_names.extend(EMBEDDING_FEATURE_NAMES)
        print(f"  Essay embeddings: {essay_embeddings.shape[1]}")

    if llm_block is not None:
        feature_blocks.append(llm_block)
        feature_names.extend(LLM_FEATURE_NAMES)

    if bool(flags["languagetool"]):
        print("  Extracting LanguageTool features...")
        lt_block = extract_lt_features_batch(essays, get_languagetool())
        feature_blocks.append(lt_block)
        feature_names.extend(LT_FEATURE_NAMES)
        print(f"  LanguageTool features: {lt_block.shape[1]}")

    X = np.hstack(feature_blocks) if len(feature_blocks) > 1 else feature_blocks[0]
    print(f"  Final feature matrix: {X.shape} (n_samples={len(targets)})")
    return DatasetBundle(
        features=X,
        targets=targets,
        feature_names=feature_names,
        feature_flags=flags,
    )


def _clip_scores(values: np.ndarray) -> np.ndarray:
    return np.clip(values, 0.0, 9.0)


def _mae_clipped(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return mean_absolute_error(y_true, _clip_scores(y_pred))


def accuracy_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    """Compute band-style accuracy: exact match, within 0.5, within 1.0."""
    pred = _clip_scores(y_pred)
    pred_band = np.round(pred * 2) / 2
    true_band = np.round(y_true * 2) / 2
    exact = np.mean(pred_band == true_band)
    within_05 = np.mean(np.abs(pred - y_true) <= 0.5)
    within_1 = np.mean(np.abs(pred - y_true) <= 1.0)
    return {
        "exact": float(exact),
        "within_0.5": float(within_05),
        "within_1.0": float(within_1),
    }


def build_catboost_regressor() -> CatBoostRegressor:
    if CatBoostRegressor is None:
        raise RuntimeError(
            "CatBoost is required for training. Install dependencies from apps/ai/requirements.txt."
        )
    return CatBoostRegressor(**CATBOOST_PARAMS)


def train_overall_model(bundle: DatasetBundle) -> TrainingBundle:
    """Train one CatBoost regressor for the overall band target."""
    X_train, X_test, y_train, y_test = train_test_split(
        bundle.features,
        bundle.targets,
        test_size=0.2,
        random_state=42,
    )
    print(f"\nTraining split: {len(X_train)} | Test split: {len(X_test)}")
    print(f"Training CatBoost model with {len(bundle.feature_names)} features...")

    model = build_catboost_regressor()
    model.fit(X_train, y_train.to_numpy())
    predictions = pd.Series(
        _clip_scores(model.predict(X_test)),
        index=y_test.index,
        name=OVERALL_COLUMN,
    )
    acc = accuracy_metrics(y_test.to_numpy(), predictions.to_numpy())
    results = pd.DataFrame([
        {
            "Target": OVERALL_COLUMN,
            "Model": "CatBoost",
            "MAE": _mae_clipped(y_test.to_numpy(), predictions.to_numpy()),
            "ACC_EXACT": acc["exact"],
            "ACC_0.5": acc["within_0.5"],
            "ACC_1.0": acc["within_1.0"],
        }
    ])

    print("\n" + "=" * 84)
    print("  Overall CatBoost evaluation")
    print("=" * 84)
    print(
        results.to_string(
            index=False,
            formatters={
                "MAE": "{:.4f}".format,
                "ACC_EXACT": "{:.2%}".format,
                "ACC_0.5": "{:.2%}".format,
                "ACC_1.0": "{:.2%}".format,
            },
        )
    )

    return TrainingBundle(
        model=model,
        results=results,
        y_test=y_test.copy(),
        predictions=predictions,
        train_size=len(X_train),
        test_size=len(X_test),
    )


def save_training_artifacts(bundle: DatasetBundle, training: TrainingBundle) -> None:
    """Persist trained models, evaluation metrics, and feature metadata."""
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    model_path = ARTIFACT_DIR / MODEL_FILENAME
    training.model.save_model(str(model_path))

    training.results.to_csv(ARTIFACT_DIR / "metrics.csv", index=False)

    evaluation_payload = {
        OVERALL_COLUMN: {
            "true": [float(x) for x in training.y_test.to_list()],
            "pred": [float(x) for x in training.predictions.to_list()],
        }
    }

    metadata = {
        "model_family": "CatBoostRegressor",
        "model_params": CATBOOST_PARAMS,
        "feature_flags": bundle.feature_flags,
        "feature_names": bundle.feature_names,
        "target_column": TARGET_COLUMN,
        "prediction_name": OVERALL_COLUMN,
        "n_features": len(bundle.feature_names),
        "n_samples": int(len(bundle.targets)),
        "train_size": int(training.train_size),
        "test_size": int(training.test_size),
        "artifact_dir": str(ARTIFACT_DIR),
        "model_file": MODEL_FILENAME,
        "scaler": None,
    }

    (ARTIFACT_DIR / "metadata.json").write_text(
        json.dumps(metadata, indent=2),
        encoding="utf-8",
    )
    (ARTIFACT_DIR / "evaluation.json").write_text(
        json.dumps(evaluation_payload, indent=2),
        encoding="utf-8",
    )

    print(f"\nSaved CatBoost overall artifact to {ARTIFACT_DIR}")


def main() -> None:
    feature_flags = dict(DEFAULT_FEATURE_FLAGS)
    df = load_data()
    dataset_bundle = extract_dataset_bundle(df, feature_flags=feature_flags)
    training_bundle = train_overall_model(dataset_bundle)
    save_training_artifacts(dataset_bundle, training_bundle)


if __name__ == "__main__":
    main()
