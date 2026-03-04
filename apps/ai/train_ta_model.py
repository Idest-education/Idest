"""
Train a linear regression model to predict IELTS Task Achievement (TA) scores.

Pipeline: data loading -> feature extraction -> diagnostics -> model training -> evaluation

Features (Groups A-E + minimal LT):
  A: Discourse markers (with overuse penalty)
  B: Discourse-aware coherence (sentence embeddings + marker labels)
  C: Structural depth (sentence/paragraph counts)
  D: Semantic development depth (paragraph embeddings vs prompt)
  E: LLM-based structural judgment (Ollama/Phi-3 Mini, loaded from cache)
  LT: Minimal LanguageTool features (spelling/grammar per 100 words + ratio)

Experiments: A) Base 14 (no LT), B) Base + minimal LT, C) Base + LT + Ridge (alpha grid)
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.preprocessing import StandardScaler

from test import load_clean_data
from writing_scorer.features import FEATURE_NAMES, extract_classical_features
from writing_scorer.languagetool_features import (
    LT_FEATURE_NAMES,
    extract_lt_features_batch,
    get_languagetool,
)
from writing_scorer.llm_features import (
    LLM_FEATURE_NAMES,
    get_llm_feature_array,
    get_partial_llm_cache,
)
from writing_scorer.task_achievement import model as sbert_model


# Base reduced feature set (no LT): one per correlation cluster (|r|>0.8)
REDUCED_FEATURE_NAMES = [
    "cosine_sim",
    "word_count",
    "body_paragraph_count",
    "n_example_markers",
    "n_reason_markers",
    "n_contrast_markers",
    "n_addition_markers",
    "discourse_marker_density_score",
    "mean_discourse_coherence",
    "mean_prompt_paragraph_sim",
    "inter_paragraph_diversity",
]

# Base 14 = REDUCED + LLM (no LT)
# Base + LT = Base 14 + LT_FEATURE_NAMES (minimal: spelling/grammar per 100 words, ratio)


# ── Data Loading ─────────────────────────────────────────────────────────────

def load_data() -> pd.DataFrame:
    print("Loading and cleaning dataset...")
    df = load_clean_data()
    print(f"  Loaded {len(df)} samples")
    return df


# ── Feature Extraction ───────────────────────────────────────────────────────

def extract_features(
    df: pd.DataFrame,
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Extract features. Returns (X, y, feature_names)."""
    print("Extracting features...")
    feature_names = list(FEATURE_NAMES)

    llm_full = get_llm_feature_array(len(df))
    if llm_full is not None:
        prompts = df["prompt"].tolist()
        essays = df["essay"].tolist()
        X_classical = extract_classical_features(prompts, essays, sbert_model)
        X = np.hstack([X_classical, llm_full])
        feature_names.extend(LLM_FEATURE_NAMES)
        y = df["TA"].values
        print(f"  LLM features loaded from full cache ({llm_full.shape[1]} features)")
    else:
        partial = get_partial_llm_cache()
        if partial is not None:
            indices, llm_vals = partial
            df_sub = df.loc[indices].reset_index(drop=True)
            print(f"  Using partial LLM cache: {len(indices)} essays with LLM features")
            prompts = df_sub["prompt"].tolist()
            essays = df_sub["essay"].tolist()
            X_classical = extract_classical_features(prompts, essays, sbert_model)
            X = np.hstack([X_classical, llm_vals])
            feature_names.extend(LLM_FEATURE_NAMES)
            y = df_sub["TA"].values
        else:
            print("  LLM cache not found — training without Group E features.")
            prompts = df["prompt"].tolist()
            essays = df["essay"].tolist()
            X = extract_classical_features(prompts, essays, sbert_model)
            y = df["TA"].values

    # LanguageTool grammar/spelling features (always appended)
    print("  Extracting LanguageTool features...")
    tool = get_languagetool()
    X_lt = extract_lt_features_batch(essays, tool)
    X = np.hstack([X, X_lt])
    feature_names.extend(LT_FEATURE_NAMES)
    print(f"  LanguageTool features: {X_lt.shape[1]}")

    print(f"  Final feature matrix: {X.shape} (n_samples={len(y)})")
    return X, y, feature_names


# ── Diagnostics ──────────────────────────────────────────────────────────────

def compute_vif(X: np.ndarray, names: list[str]) -> dict[str, float]:
    """VIF for feature j = 1 / (1 - R²_j). VIF > 5 or 10 indicates multicollinearity."""
    vif: dict[str, float] = {}
    for j in range(X.shape[1]):
        y_j = X[:, j]
        X_j = np.delete(X, j, axis=1)
        lm = LinearRegression().fit(X_j, y_j)
        r2 = r2_score(y_j, lm.predict(X_j))
        vif[names[j]] = 1.0 / (1.0 - r2) if r2 < 1.0 else float("inf")
    return vif


def get_high_corr_pairs(
    X: np.ndarray, names: list[str], threshold: float = 0.7
) -> list[tuple[str, str, float]]:
    """Return pairs with |correlation| > threshold."""
    df = pd.DataFrame(X, columns=names)
    corr = df.corr()
    pairs: list[tuple[str, str, float]] = []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            r = corr.iloc[i, j]
            if abs(r) > threshold:
                pairs.append((names[i], names[j], float(r)))
    return sorted(pairs, key=lambda p: -abs(p[2]))


def identify_correlation_clusters(
    X: np.ndarray, names: list[str], threshold: float = 0.8
) -> list[list[str]]:
    """Group features into clusters where any pair in cluster has |r| > threshold."""
    df = pd.DataFrame(X, columns=names)
    corr = df.corr()

    # Union-Find to merge features in same cluster
    parent: dict[str, str] = {n: n for n in names}

    def find(x: str) -> str:
        if parent[x] != x:
            parent[x] = find(parent[x])
        return parent[x]

    def union(a: str, b: str) -> None:
        pa, pb = find(a), find(b)
        if pa != pb:
            parent[pa] = pb

    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            if abs(corr.iloc[i, j]) > threshold:
                union(names[i], names[j])

    clusters_map: dict[str, list[str]] = {}
    for n in names:
        root = find(n)
        if root not in clusters_map:
            clusters_map[root] = []
        clusters_map[root].append(n)

    return [sorted(c) for c in clusters_map.values() if len(c) > 1]


def select_feature_subset(
    X: np.ndarray,
    names: list[str],
    include_lt: bool = False,
) -> tuple[np.ndarray, list[str]]:
    """Select base features (REDUCED + LLM). Optionally add minimal LT features."""
    subset = [n for n in REDUCED_FEATURE_NAMES if n in names]
    for n in LLM_FEATURE_NAMES:
        if n in names and n not in subset:
            subset.append(n)
    if include_lt:
        for n in LT_FEATURE_NAMES:
            if n in names and n not in subset:
                subset.append(n)
    indices = [names.index(n) for n in subset]
    return X[:, indices], subset


def run_diagnostics(
    X_train: np.ndarray, feature_names: list[str]
) -> None:
    """Print correlation, VIF, and clusters."""
    print("\n" + "=" * 60)
    print("  Diagnostics")
    print("=" * 60)

    high_corr = get_high_corr_pairs(X_train, feature_names, threshold=0.7)
    print("\n  Correlation pairs with |r| > 0.7:")
    if high_corr:
        for a, b, r in high_corr[:15]:
            print(f"    {a} / {b}: {r:+.2f}")
        if len(high_corr) > 15:
            print(f"    ... and {len(high_corr) - 15} more")
    else:
        print("    (none)")

    vif = compute_vif(X_train, feature_names)
    print("\n  VIF (VIF > 5 flagged):")
    for name, val in vif.items():
        flag = " [HIGH]" if val > 5 else ""
        s = f"{val:.1f}" if val != float("inf") else "inf"
        print(f"    {name}: {s}{flag}")

    clusters = identify_correlation_clusters(X_train, feature_names, threshold=0.8)
    print("\n  Identified clusters (corr > 0.8):")
    if clusters:
        for c in clusters:
            print(f"    {c}")
    else:
        print("    (none)")


# ── Training ─────────────────────────────────────────────────────────────────

def _mae_clipped(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    pred = np.clip(y_pred, 0, 9)
    return mean_absolute_error(y_true, pred)


def main() -> None:
    df = load_data()
    X, y, feature_names = extract_features(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    print(f"\n  Train: {len(X_train)} | Test: {len(X_test)}")

    run_diagnostics(X_train, feature_names)

    # Scaling (fit on train only)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # A) Base 14 features (no LT)
    X_train_a, names_a = select_feature_subset(X_train_scaled, feature_names, include_lt=False)
    X_test_a = X_test_scaled[:, [feature_names.index(n) for n in names_a]]
    print(f"\n  Experiment A - Base features ({len(names_a)}): {names_a}")

    # B) Base + minimal LT
    X_train_b, names_b = select_feature_subset(X_train_scaled, feature_names, include_lt=True)
    X_test_b = X_test_scaled[:, [feature_names.index(n) for n in names_b]]
    print(f"  Experiment B - Base + LT ({len(names_b)}): + {[n for n in names_b if n not in names_a]}")

    # VIF for Base + LT (target: all VIF < 5, no inf)
    vif_b = compute_vif(X_train_b, names_b)
    print("\n  VIF (Base + LT features):")
    vif_ok = True
    for n in names_b:
        v = vif_b[n]
        flag = " [HIGH]" if v > 5 else ""
        if v == float("inf"):
            vif_ok = False
            flag = " [INF]"
        s = f"{v:.1f}" if v != float("inf") else "inf"
        print(f"    {n}: {s}{flag}")
    if vif_ok and all(v <= 5 for v in vif_b.values()):
        print("  All VIF <= 5 (no multicollinearity)")
    else:
        print("  Some VIF > 5 - consider dropping features or using Ridge")

    # Model training
    model_a = LinearRegression().fit(X_train_a, y_train)
    mae_a = _mae_clipped(y_test, model_a.predict(X_test_a))

    model_b = LinearRegression().fit(X_train_b, y_train)
    mae_b = _mae_clipped(y_test, model_b.predict(X_test_b))

    # C) Base + LT + Ridge with alpha grid search
    grid = GridSearchCV(
        Ridge(),
        param_grid={"alpha": [0.01, 0.1, 1.0, 10.0, 100.0]},
        scoring="neg_mean_absolute_error",
        cv=5,
    )
    grid.fit(X_train_b, y_train)
    best_alpha = grid.best_params_["alpha"]
    model_c = Ridge(alpha=best_alpha).fit(X_train_b, y_train)
    mae_c = _mae_clipped(y_test, model_c.predict(X_test_b))

    print("\n" + "=" * 60)
    print("  MAE Comparison")
    print("=" * 60)
    print(f"  A. Base {len(names_a)} feat (no LT), LR:     {mae_a:.4f}")
    print(f"  B. Base + LT ({len(names_b)} feat), LR:       {mae_b:.4f}")
    print(f"  C. Base + LT, Ridge(alpha={best_alpha}):  {mae_c:.4f}")

    print("\n  LT predictive value:")
    if mae_b < mae_a:
        print(f"    LT improves MAE by {mae_a - mae_b:.4f} (LR)")
    else:
        print(f"    LT does not improve MAE with LR (A: {mae_a:.4f} vs B: {mae_b:.4f})")
    best_mae = min(mae_a, mae_b, mae_c)
    if mae_c < mae_a:
        print(f"    Ridge + LT improves over base: {mae_a - mae_c:.4f}")
    print(f"    Best MAE: {best_mae:.4f}")

    print("\n" + "=" * 60)
    print("  Coefficients (Config B - Base + LT)")
    print("=" * 60)
    for name, coef in zip(names_b, model_b.coef_):
        print(f"    {name:>40s}: {coef:+.4f}")
    print(f"    {'intercept':>40s}: {model_b.intercept_:+.4f}")

    print("\n" + "=" * 60)
    print("  Coefficients (Config C - Ridge)")
    print("=" * 60)
    for name, coef in zip(names_b, model_c.coef_):
        print(f"    {name:>40s}: {coef:+.4f}")
    print(f"    {'intercept':>40s}: {model_c.intercept_:+.4f}")

    print("\n  First 10 predictions vs true (Config C):")
    preds = np.clip(model_c.predict(X_test_b), 0, 9)
    print(f"  {'Predicted':>10s} {'True':>10s} {'Error':>10s}")
    print(f"  {'-' * 32}")
    for pred, true in zip(preds[:10], y_test[:10]):
        print(f"  {pred:10.2f} {true:10.1f} {abs(pred - true):10.2f}")


if __name__ == "__main__":
    main()
