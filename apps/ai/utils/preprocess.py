"""Text preprocessing for essay grading."""

from __future__ import annotations


def clean_text(text: str) -> str:
    # TODO: Add NLP preprocessing (tokenization, lowercasing, stopword removal) as needed
    return " ".join(text.split())
