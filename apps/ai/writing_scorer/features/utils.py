"""
Shared utilities for IELTS feature extraction.

Re-exports text segmentation from text_utils; provides marker loading and
lazy SentenceTransformer model for embedding-based features.
"""

from __future__ import annotations

import re
from pathlib import Path

from ..text_utils import body_paragraphs, split_paragraphs, split_sentences

__all__ = [
    "split_sentences",
    "split_paragraphs",
    "body_paragraphs",
    "MARKER_GROUPS",
    "OPTIMAL_DENSITY",
    "SIGMA",
    "SBERT_MODEL_NAME",
    "SPACY_MODEL_NAME",
    "get_cache_dir",
    "get_sbert_model",
    "get_spacy_model",
]

_MARKERS_DIR = Path(__file__).resolve().parent.parent / "markers"

OPTIMAL_DENSITY = 0.15
SIGMA = 0.08
SBERT_MODEL_NAME = "all-MiniLM-L6-v2"
SPACY_MODEL_NAME = "en_core_web_sm"

_sbert_model = None
_spacy_model = None


def _load_marker_groups() -> dict[str, list[str]]:
    """Load marker groups from markers/*.txt (one phrase per line, used for grading)."""
    groups: dict[str, list[str]] = {}
    for path in sorted(_MARKERS_DIR.glob("*.txt")):
        name = path.stem
        patterns: list[str] = []
        with open(path, encoding="utf-8") as f:
            for line in f:
                phrase = line.strip()
                if not phrase or phrase.startswith("#"):
                    continue
                escaped = re.escape(phrase)
                patterns.append(rf"\b{escaped}\b")
        if patterns:
            groups[name] = patterns
    return groups


MARKER_GROUPS: dict[str, list[str]] = _load_marker_groups()


def get_cache_dir() -> Path:
    """Return the shared cache directory for reusable feature artifacts."""
    cache_dir = Path(__file__).resolve().parents[2] / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def get_sbert_model():
    """Return shared SentenceTransformer instance. Lazy-init on first use."""
    global _sbert_model
    if _sbert_model is None:
        from sentence_transformers import SentenceTransformer

        _sbert_model = SentenceTransformer(SBERT_MODEL_NAME)
    return _sbert_model


def get_spacy_model():
    """Return a shared spaCy pipeline with parser support for syntax features."""
    global _spacy_model
    if _spacy_model is None:
        import spacy

        try:
            _spacy_model = spacy.load(SPACY_MODEL_NAME, exclude=["ner", "textcat"])
        except OSError as exc:
            raise RuntimeError(
                f"spaCy model '{SPACY_MODEL_NAME}' is not installed. "
                f"Run: python -m spacy download {SPACY_MODEL_NAME}"
            ) from exc
    return _spacy_model
