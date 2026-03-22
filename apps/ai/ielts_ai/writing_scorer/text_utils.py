"""
Shared text segmentation for essay scoring.

Paragraphs are split on one or more newlines (single-newline convention).
"""

from __future__ import annotations

import re

_SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
_PARA_SPLIT_RE = re.compile(r"(?:\n\s*)+")


def split_sentences(text: str) -> list[str]:
    """Split text into sentences on sentence-ending punctuation."""
    return [s.strip() for s in _SENT_SPLIT_RE.split(text) if s.strip()]


def split_paragraphs(text: str) -> list[str]:
    """Split text into paragraphs on one or more newlines."""
    return [p.strip() for p in _PARA_SPLIT_RE.split(text) if p.strip()]


def body_paragraphs(paragraphs: list[str]) -> list[str]:
    """Return body paragraphs only (exclude first and last if at least 3 paragraphs)."""
    if len(paragraphs) >= 3:
        return paragraphs[1:-1]
    return paragraphs


def segment_essay(essay: str) -> tuple[list[str], list[str], list[str]]:
    """Split essay into (intro, body, conclusion) paragraph lists."""
    paragraphs = split_paragraphs(essay)
    if len(paragraphs) <= 2:
        intro = paragraphs[:1] if paragraphs else []
        conclusion = paragraphs[1:2] if len(paragraphs) == 2 else []
        return (intro, [], conclusion)
    return (paragraphs[:1], paragraphs[1:-1], paragraphs[-1:])
