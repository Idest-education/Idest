from __future__ import annotations

import logging

from phonemizer import phonemize
from phonemizer.separator import Separator

logger = logging.getLogger(__name__)


class ReferenceG2P:
    """Grapheme-to-phoneme for the reference (intended) transcript."""

    def __init__(self, language: str = "en-us") -> None:
        self._language = language
        self._separator = Separator(phone=" ", word="|", syllable="")

    def phonemize_words(self, words: list[str]) -> dict[str, list[str]]:
        if not words:
            return {}
        cleaned = [w.strip().lower().strip(".,!?;:\"'") for w in words]
        lines = phonemize(
            cleaned,
            language=self._language,
            backend="espeak",
            separator=self._separator,
            strip=True,
            with_stress=False,
            preserve_punctuation=False,
        )
        result: dict[str, list[str]] = {}
        for original, line in zip(words, lines):
            phones = [p for p in line.replace("|", " ").split() if p]
            result[original] = phones
        return result
