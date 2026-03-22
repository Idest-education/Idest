"""Stable filesystem paths for the IELTS scoring package (repo root, artifacts, crawled data)."""

from __future__ import annotations

from pathlib import Path

_IELTS_AI_DIR = Path(__file__).resolve().parent
APPS_AI_DIR = _IELTS_AI_DIR.parent
REPO_ROOT = APPS_AI_DIR.parent.parent

CRAWLED_DATA_PATH = APPS_AI_DIR.parent / "server" / "data" / "ielts_task2_dataset.json"
ARTIFACT_DIR = REPO_ROOT / "models" / "rubric_catboost"
