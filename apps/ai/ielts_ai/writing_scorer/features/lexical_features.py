"""
Lexical Resource feature extraction for IELTS scoring.

The features in this module target key aspects of IELTS Lexical Resource:
- lexical diversity
- vocabulary sophistication
- lexical control
- lexical density
- collocation quality
"""

from __future__ import annotations

import math
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path

import numpy as np

from .utils import get_spacy_model

LEXICAL_FEATURE_NAMES: list[str] = [
    "mtld",
    "lexical_density",
    "rare_word_ratio",
    "academic_word_ratio",
    "repetition_ratio",
    "mean_bigram_pmi",
]
SYNTAX_FEATURE_NAMES: list[str] = [
    "avg_sentence_length",
    "avg_clause_per_sentence",
    "max_clause_per_sentence",
    "subordinate_clause_ratio",
]

_TOKEN_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")
_MTLD_TTR_THRESHOLD = 0.72
_RARE_ZIPF_THRESHOLD = 3.0
_MIN_PROBABILITY = 1e-9
_PMI_CLIP_RANGE = (-10.0, 15.0)
_AWL_PATH = Path(__file__).resolve().parents[2] / "AWL.txt"
_CONTENT_POS_PREFIXES = ("NN", "VB", "JJ", "RB")
_CLAUSE_DEP_LABELS = frozenset({"ccomp", "xcomp", "advcl", "relcl"})


def _tokenize_words(text: str) -> list[str]:
    """Return lowercase alphabetic tokens while discarding punctuation."""
    return [token.lower() for token in _TOKEN_RE.findall(text)]


def _safe_ratio(numerator: float, denominator: float) -> float:
    """Return a stable ratio for feature extraction."""
    if denominator <= 0:
        return 0.0
    return float(numerator / denominator)


@lru_cache(maxsize=1)
def _load_awl_words() -> frozenset[str]:
    """Load the Academic Word List once and reuse it across essays."""
    with _AWL_PATH.open(encoding="utf-8") as handle:
        words = {
            line.strip().lower()
            for line in handle
            if line.strip() and not line.startswith("#")
        }
    return frozenset(words)


@lru_cache(maxsize=1)
def _get_wordfreq_functions():
    """Import wordfreq lazily so the module stays lightweight until used."""
    from wordfreq import word_frequency, zipf_frequency

    return word_frequency, zipf_frequency


@lru_cache(maxsize=1)
def _get_nltk():
    """Import nltk lazily to avoid import cost when lexical features are unused."""
    import nltk

    return nltk


@lru_cache(maxsize=1)
def _ensure_pos_tagger() -> None:
    """Ensure the NLTK POS tagger resource is available."""
    nltk = _get_nltk()
    resource_candidates = (
        "taggers/averaged_perceptron_tagger_eng",
        "taggers/averaged_perceptron_tagger",
    )
    package_candidates = (
        "averaged_perceptron_tagger_eng",
        "averaged_perceptron_tagger",
    )

    for resource in resource_candidates:
        try:
            nltk.data.find(resource)
            return None
        except LookupError:
            continue

    for package in package_candidates:
        try:
            nltk.download(package, quiet=True)
        except Exception:
            continue

    for resource in resource_candidates:
        try:
            nltk.data.find(resource)
            return None
        except LookupError:
            continue

    raise LookupError("NLTK averaged perceptron tagger is not available.")


def _pos_tag_tokens(tokens: list[str]) -> list[tuple[str, str]]:
    """POS-tag normalized tokens, returning Penn Treebank-style tags."""
    if not tokens:
        return []
    _ensure_pos_tagger()
    nltk = _get_nltk()
    try:
        return nltk.pos_tag(tokens, lang="eng")
    except TypeError:
        return nltk.pos_tag(tokens)


def _mtld_for_direction(tokens: list[str], threshold: float) -> float:
    """Compute one directional MTLD pass."""
    if not tokens:
        return 0.0

    factor_count = 0.0
    token_count = 0
    types: set[str] = set()

    for token in tokens:
        token_count += 1
        types.add(token)
        current_ttr = len(types) / token_count
        if current_ttr <= threshold:
            factor_count += 1.0
            token_count = 0
            types.clear()

    if token_count > 0:
        current_ttr = len(types) / token_count
        if current_ttr == 1.0:
            factor_count += 1.0
        else:
            partial_factor = (1.0 - current_ttr) / (1.0 - threshold)
            factor_count += max(partial_factor, 0.0)

    if factor_count <= 0:
        return float(len(tokens))
    return float(len(tokens) / factor_count)


def compute_mtld(tokens: list[str], threshold: float = _MTLD_TTR_THRESHOLD) -> float:
    """Measure sustained lexical variety across the essay.

    MTLD is less sensitive to essay length than raw TTR, making it useful for
    IELTS Lexical Resource scoring where longer essays should not be penalized
    simply for being longer.
    """
    if not tokens:
        return 0.0
    forward = _mtld_for_direction(tokens, threshold)
    backward = _mtld_for_direction(list(reversed(tokens)), threshold)
    return float((forward + backward) / 2.0)


def compute_lexical_density(pos_tags: list[tuple[str, str]]) -> float:
    """Estimate how information-dense the essay vocabulary is.

    IELTS Lexical Resource rewards writing that carries meaning through content
    words rather than relying heavily on function words alone.
    """
    if not pos_tags:
        return 0.0
    content_words = sum(
        1 for _, tag in pos_tags if any(tag.startswith(prefix) for prefix in _CONTENT_POS_PREFIXES)
    )
    return _safe_ratio(content_words, len(pos_tags))


def compute_rare_word_ratio(tokens: list[str], zipf_threshold: float = _RARE_ZIPF_THRESHOLD) -> float:
    """Measure how often lower-frequency vocabulary appears.

    A moderate amount of low-frequency vocabulary is a useful proxy for
    sophistication in IELTS Lexical Resource.
    """
    if not tokens:
        return 0.0
    _, zipf_frequency = _get_wordfreq_functions()
    rare_count = sum(1 for token in tokens if zipf_frequency(token, "en") < zipf_threshold)
    return _safe_ratio(rare_count, len(tokens))


def compute_academic_word_ratio(tokens: list[str]) -> float:
    """Measure how much the essay draws on academic-register vocabulary.

    Academic vocabulary is common in stronger IELTS Task 2 essays and can
    indicate more precise and formal lexical choice.
    """
    if not tokens:
        return 0.0
    awl_words = _load_awl_words()
    awl_count = sum(1 for token in tokens if token in awl_words)
    return _safe_ratio(awl_count, len(tokens))


def compute_repetition_ratio(tokens: list[str]) -> float:
    """Measure lexical control by penalizing excessive repetition.

    A high repetition ratio suggests over-reliance on a small vocabulary range,
    which is often associated with weaker Lexical Resource performance.
    """
    if not tokens:
        return 0.0
    counts = Counter(tokens)
    return _safe_ratio(max(counts.values()), len(tokens))


def compute_mean_bigram_pmi(tokens: list[str]) -> float:
    """Estimate collocation quality using the PMI of adjacent word pairs.

    PMI rewards bigrams that occur together more often than expected by chance,
    providing a lightweight proxy for natural collocation usage.
    """
    if len(tokens) < 2:
        return 0.0

    word_frequency, _ = _get_wordfreq_functions()
    pmi_values: list[float] = []

    for left, right in zip(tokens, tokens[1:]):
        p_left = max(word_frequency(left, "en"), _MIN_PROBABILITY)
        p_right = max(word_frequency(right, "en"), _MIN_PROBABILITY)
        p_bigram = max(word_frequency(f"{left} {right}", "en"), _MIN_PROBABILITY)
        pmi = math.log2(p_bigram / (p_left * p_right))
        pmi_values.append(float(np.clip(pmi, *_PMI_CLIP_RANGE)))

    if not pmi_values:
        return 0.0
    return float(sum(pmi_values) / len(pmi_values))


def _syntax_features_from_doc(doc) -> dict[str, float]:
    sentences = list(doc.sents)
    if not sentences:
        return {name: 0.0 for name in SYNTAX_FEATURE_NAMES}

    sentence_lengths: list[float] = []
    clause_counts: list[float] = []
    subordinate_clauses = 0

    for sent in sentences:
        token_count = sum(1 for token in sent if not token.is_space and not token.is_punct)
        sentence_lengths.append(float(token_count))

        subordinate_count = sum(1 for token in sent if token.dep_ in _CLAUSE_DEP_LABELS)
        subordinate_clauses += subordinate_count
        clause_counts.append(float(1 + subordinate_count))

    total_clauses = sum(clause_counts)
    return {
        "avg_sentence_length": float(np.mean(sentence_lengths)),
        "avg_clause_per_sentence": float(np.mean(clause_counts)),
        "max_clause_per_sentence": float(np.max(clause_counts)),
        "subordinate_clause_ratio": float(subordinate_clauses / total_clauses) if total_clauses else 0.0,
    }


def extract_syntax_features(essay: str) -> dict[str, float]:
    """Extract syntax-complexity features from a spaCy dependency parse."""
    doc = get_spacy_model()(essay)
    return _syntax_features_from_doc(doc)


def extract_syntax_features_batch(essays: list[str], batch_size: int = 32) -> np.ndarray:
    """Extract syntax-complexity features for all essays using spaCy.pipe."""
    if not essays:
        return np.empty((0, len(SYNTAX_FEATURE_NAMES)), dtype=np.float64)

    nlp = get_spacy_model()
    rows = []
    for doc in nlp.pipe(essays, batch_size=batch_size):
        syntax_features = _syntax_features_from_doc(doc)
        rows.append([syntax_features[name] for name in SYNTAX_FEATURE_NAMES])
    return np.asarray(rows, dtype=np.float64)


def extract_lexical_features(essay: str, prompt: str | None = None) -> dict[str, float]:
    """Extract lexical features for one essay.

    The returned features target diversity, sophistication, density, control,
    and collocation quality, which together provide a compact representation of
    IELTS Lexical Resource performance.
    """
    del prompt  # Lexical features are essay-only for now.

    tokens = _tokenize_words(essay)
    pos_tags = _pos_tag_tokens(tokens)

    return {
        "mtld": compute_mtld(tokens),
        "lexical_density": compute_lexical_density(pos_tags),
        "rare_word_ratio": compute_rare_word_ratio(tokens),
        "academic_word_ratio": compute_academic_word_ratio(tokens),
        "repetition_ratio": compute_repetition_ratio(tokens),
        "mean_bigram_pmi": compute_mean_bigram_pmi(tokens),
    }


def extract_lexical_features_batch(
    essays: list[str],
    prompts: list[str] | None = None,
) -> np.ndarray:
    """Extract lexical features for all essays in a stable column order."""
    if prompts is None:
        prompts = [None] * len(essays)
    elif len(prompts) != len(essays):
        raise ValueError("prompts and essays must have the same length")
    rows = [
        [
            extract_lexical_features(essay, prompt)[name]
            for name in LEXICAL_FEATURE_NAMES
        ]
        for essay, prompt in zip(essays, prompts, strict=False)
    ]
    if not rows:
        return np.empty((0, len(LEXICAL_FEATURE_NAMES)), dtype=np.float64)
    return np.asarray(rows, dtype=np.float64)
