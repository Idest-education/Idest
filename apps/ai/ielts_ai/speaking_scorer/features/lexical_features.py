from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from wordfreq import word_frequency

_CONTENT_POS = {"NOUN", "VERB", "ADJ", "ADV"}
_B2_FREQ_THRESHOLD = 1e-5  # words with frequency below this are CEFR B2+


@dataclass
class LexicalFeatures:
    ttr_lemma: float        # lemmatised type-token ratio [0, 1]
    freq_tier_ratio: float  # proportion of content words at B2+ level [0, 1]
    lexical_density: float  # content words / total tokens [0, 1]
    mean_word_length: float # mean characters per token


@lru_cache(maxsize=1)
def _get_nlp():
    import spacy
    return spacy.load("en_core_web_sm", disable=["ner", "parser"])


def extract_lexical_features(transcript: str) -> LexicalFeatures:
    if not transcript.strip():
        return LexicalFeatures(ttr_lemma=0.0, freq_tier_ratio=0.0, lexical_density=0.0, mean_word_length=0.0)

    nlp = _get_nlp()
    doc = nlp(transcript)

    tokens = [t for t in doc if not t.is_punct and not t.is_space and t.text.strip()]
    if not tokens:
        return LexicalFeatures(ttr_lemma=0.0, freq_tier_ratio=0.0, lexical_density=0.0, mean_word_length=0.0)

    lemmas = [t.lemma_.lower() for t in tokens]
    ttr_lemma = len(set(lemmas)) / max(len(lemmas), 1)

    content_tokens = [t for t in tokens if t.pos_ in _CONTENT_POS]
    lexical_density = len(content_tokens) / max(len(tokens), 1)

    low_freq_count = sum(
        1 for t in content_tokens
        if word_frequency(t.text.lower(), "en") < _B2_FREQ_THRESHOLD
    )
    freq_tier_ratio = low_freq_count / max(len(content_tokens), 1)

    mean_word_length = sum(len(t.text) for t in tokens) / max(len(tokens), 1)

    return LexicalFeatures(
        ttr_lemma=round(ttr_lemma, 4),
        freq_tier_ratio=round(freq_tier_ratio, 4),
        lexical_density=round(lexical_density, 4),
        mean_word_length=round(mean_word_length, 4),
    )
