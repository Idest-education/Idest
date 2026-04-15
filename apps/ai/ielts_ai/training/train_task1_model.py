"""
Train CatBoost rubric + overall models for IELTS Academic Writing Task 1.

Uses the same evaluation stack as Task 2 (``evaluate_pipeline``) but Task 1–specific data
and features (no Task 2 ``llm_features.parquet`` / ``get_llm_feature_array``).

Prerequisites
  - Default HF dataset: TraTacXiMuoi/Ielts_writing_task1_academic.
  - Optional caches (see below): VLM image descriptions and Task 1 LLM judgments are keyed for
    **HF train split rows only** in the stock scripts (``row_index`` 0..n-1 of ``split="train"``).
    Dev/test rows do not match ``task1_image_descriptions.parquet`` unless you extend those scripts
    with ``--split`` and rebuild caches including ``hf_split`` alignment.

  - If you pass ``--hf-splits train`` only, every row starts in split ``train``; the trainer then
    **re-splits by ``prompt_family``** (same locked logic as Task 2) so ``dev``/``real_test`` exist
    for CatBoost metrics. Use all three HF splits when you want the publisher's dev/test labels
    without that fallback.

Run (from ``apps/ai``)::

  cd apps/ai && PYTHONPATH=. python -m ielts_ai.training.train_task1_model --fast

Environment (optional overrides for paths and dataset)::

  TASK1_TRAIN_DATASET       — Hugging Face dataset id
  TASK1_TRAIN_PARQUET     — If set, load labeled rows from this Parquet instead of HF
  TASK1_IMAGE_DESC_PARQUET — Path to task1_image_descriptions.parquet
  TASK1_LLM_FEATURES_CACHE — Path to task1_llm_features.parquet (merge by cache_key)
  IELTS_TASK1_ARTIFACT_DIR — Output directory (fallback: TASK1_ARTIFACT_DIR)

Flags mirror Task 2 training where applicable: ``--fast``, ``--skip-ablation``, ``--skip-stress-tests``.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import pandas as pd

from ielts_ai.data.task1_benchmark import (
    DEFAULT_TASK1_DATASET,
    ensure_task1_eval_splits,
    load_task1_frame,
    summarize_task1_frame,
)
from ielts_ai.paths import APPS_AI_DIR, TASK1_ARTIFACT_DIR
from ielts_ai.training.task1_feature_blocks import (
    TASK1_DEFAULT_FEATURE_FLAGS,
    build_task1_dataset_bundle,
    resolve_task1_feature_flags,
)
from ielts_ai.training.train_model import (
    TrainingConfig,
    evaluate_pipeline,
    format_evaluation_summary_text,
    save_training_artifacts,
)


def _env_str(key: str, default: str) -> str:
    v = os.environ.get(key)
    return v if v is not None and v != "" else default


def _env_path(key: str, default: Path) -> Path:
    v = os.environ.get(key)
    return Path(v) if v else default


def _resolve_artifact_dir() -> Path:
    for key in ("IELTS_TASK1_ARTIFACT_DIR", "TASK1_ARTIFACT_DIR"):
        v = os.environ.get(key)
        if v is not None and v != "":
            return Path(v)
    return TASK1_ARTIFACT_DIR


def parse_args() -> tuple[argparse.Namespace, TrainingConfig]:
    p = argparse.ArgumentParser(description="Train IELTS Task 1 CatBoost scoring stack.")
    p.add_argument(
        "--dataset",
        default=_env_str("TASK1_TRAIN_DATASET", DEFAULT_TASK1_DATASET),
        help="Hugging Face Task 1 dataset id",
    )
    p.add_argument(
        "--parquet",
        type=Path,
        default=None,
        help="Load labeled data from Parquet instead of HF (columns: subject, content, evaluation, overall_band_score; optional hf_split, row_index)",
    )
    p.add_argument(
        "--image-desc-parquet",
        type=Path,
        default=_env_path(
            "TASK1_IMAGE_DESC_PARQUET",
            APPS_AI_DIR / "cache" / "task1_image_descriptions.parquet",
        ),
        help="VLM image descriptions cache (train split row_index alignment by default)",
    )
    p.add_argument(
        "--task1-llm-parquet",
        type=Path,
        default=None,
        help="Task 1 LLM feature cache (default: apps/ai/cache/task1_llm_features.parquet via loader)",
    )
    p.add_argument(
        "--no-task1-llm-parquet",
        action="store_true",
        help="Do not merge task1_llm_features.parquet (disables task1_llm features unless columns exist)",
    )
    p.add_argument(
        "--split-strategy",
        choices=("hf_native", "locked_prompt"),
        default="hf_native",
        help="hf_native: HF train/validation/test → train/dev/real_test. locked_prompt: locked prompt_family splits.",
    )
    p.add_argument(
        "--hf-splits",
        type=str,
        default="train,validation,test",
        help="Comma-separated HF splits to load (e.g. train only when using train-only VLM cache)",
    )
    p.add_argument(
        "--require-image-desc",
        action="store_true",
        help="Drop rows without non-empty image_description (use with --hf-splits train for cache-aligned training)",
    )
    p.add_argument(
        "--require-task1-llm",
        action="store_true",
        help="Drop rows missing Task 1 LLM feature columns after cache merge",
    )
    p.add_argument("--fast", action="store_true", help="Quicker dev mode (passed through to training config).")
    p.add_argument("--skip-ablation", action="store_true", help="Skip ablation study.")
    p.add_argument("--skip-stress-tests", action="store_true", help="Skip stress tests.")
    p.add_argument(
        "--no-essay-embeddings",
        action="store_true",
        help="Disable full essay embedding block.",
    )
    p.add_argument("--no-languagetool", action="store_true", help="Disable LanguageTool features.")
    p.add_argument("--no-task1-llm", action="store_true", help="Disable Task 1 LLM judgment columns.")
    p.add_argument(
        "--no-reference-feats",
        action="store_true",
        help="Disable cosine/year overlap reference-aware features.",
    )
    p.add_argument(
        "--artifact-dir",
        type=Path,
        default=None,
        help="Output directory for .cbm and JSON (default: env or models/rubric_catboost_task1)",
    )
    args = p.parse_args()
    config = TrainingConfig(
        fast_mode=bool(args.fast),
        run_ablation_study=not args.skip_ablation and not args.fast,
        run_stress_tests=not args.skip_stress_tests,
        cv_splits=3 if args.fast else 5,
        early_stopping_rounds=50 if args.fast else 100,
        stress_sample_size=100 if args.fast else 250,
        bootstrap_samples=50 if args.fast else 200,
    )
    return args, config


def main() -> None:
    args, config = parse_args()

    hf_splits = tuple(s.strip() for s in args.hf_splits.split(",") if s.strip())
    llm_path = None if args.no_task1_llm_parquet else args.task1_llm_parquet

    df = load_task1_frame(
        dataset_id=args.dataset,
        parquet_path=args.parquet,
        split_strategy=args.split_strategy,
        hf_splits=hf_splits,
        image_desc_parquet=args.image_desc_parquet,
        task1_llm_parquet=llm_path,
        require_image_desc=args.require_image_desc,
        require_task1_llm=args.require_task1_llm,
        merge_task1_llm_parquet=not args.no_task1_llm_parquet,
    )
    if df.empty:
        raise SystemExit("No rows after load_task1_frame; check filters and data paths.")

    df, locked_fallback = ensure_task1_eval_splits(df)

    summary = summarize_task1_frame(df, dataset_id=None if args.parquet else args.dataset)
    print(f"Loaded {len(df)} Task 1 samples | split_counts={summary['summary']['split_counts']}")
    if locked_fallback:
        print(
            "(Applied locked prompt_family train/dev/real_test because dev or real_test was empty — "
            "e.g. when using --hf-splits train only.)",
            flush=True,
        )

    feat_overrides: dict[str, object] = dict(TASK1_DEFAULT_FEATURE_FLAGS)
    if args.no_essay_embeddings:
        feat_overrides["essay_embeddings"] = False
    if args.no_languagetool:
        feat_overrides["languagetool"] = False
    if args.no_task1_llm:
        feat_overrides["task1_llm"] = False
    if args.no_reference_feats:
        feat_overrides["task1_reference_feats"] = False
    feature_flags = resolve_task1_feature_flags(feat_overrides)

    bundle = build_task1_dataset_bundle(df, feature_flags=feature_flags)

    if config.run_ablation_study:
        print("\nTask 1: ablation study not wired to Task 1 LLM block; skipping.")
        ablation_df = pd.DataFrame()
    else:
        ablation_df = pd.DataFrame()

    print("\nTraining Task 1 CatBoost stack...")
    metrics_df, reports, models, artifacts = evaluate_pipeline(bundle, config)

    out_dir = args.artifact_dir or _resolve_artifact_dir()
    manifest = summarize_task1_frame(bundle.frame, dataset_id=None if args.parquet else args.dataset)
    meta_extras: dict[str, object] = {
        "task": "writing_task1",
        "dataset_id": str(args.parquet) if args.parquet else args.dataset,
        "split_strategy": args.split_strategy,
        "hf_splits": list(hf_splits),
        "image_desc_parquet": str(args.image_desc_parquet),
        "task1_llm_parquet": None
        if args.no_task1_llm_parquet
        else (str(llm_path) if llm_path is not None else None),
        "require_image_desc": args.require_image_desc,
        "require_task1_llm": args.require_task1_llm,
        "locked_splits_fallback": locked_fallback,
    }
    save_training_artifacts(
        bundle,
        models,
        metrics_df,
        reports,
        artifacts,
        ablation_df,
        artifact_dir=out_dir,
        benchmark_manifest=manifest,
        metadata_extras=meta_extras,
    )

    print("\n" + format_evaluation_summary_text(metrics_df))
    print(json.dumps({"artifact_dir": str(out_dir), "n_features": len(bundle.feature_names)}, indent=2))


if __name__ == "__main__":
    main()
