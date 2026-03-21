"""
Grammar and spelling feature extraction for IELTS scoring.

LanguageTool-based features:
- lt_spelling_error_per_100_words
- lt_grammar_error_per_100_words
- lt_grammar_spelling_ratio (grammar / max(spelling, 1))
"""

from __future__ import annotations

import logging

import numpy as np

logger = logging.getLogger(__name__)

LT_FEATURE_NAMES = [
    "lt_spelling_error_per_100_words",
    "lt_grammar_error_per_100_words",
    "lt_grammar_spelling_ratio",
    "lt_punctuation_error_per_100_words",
    "lt_style_error_per_100_words",
    "lt_unique_rule_ratio",
]

GRAMMAR_FEATURE_NAMES = LT_FEATURE_NAMES

_tool = None


def get_languagetool(lang: str = "en-US", **kwargs):
    """Return shared LT instance. Lazy-init on first use."""
    global _tool
    if _tool is None:
        import language_tool_python

        _tool = language_tool_python.LanguageTool(
            lang,
            config={"cacheSize": 1000, "pipelineCaching": True},
            **kwargs,
        )
    return _tool


def _is_spelling(match) -> bool:
    """True if match is spelling-related (TYPOS or misspelling)."""
    cat = getattr(match, "category", None) or ""
    rit = getattr(match, "rule_issue_type", None) or ""
    return cat == "TYPOS" or rit == "misspelling"


def _is_punctuation(match) -> bool:
    category = (getattr(match, "category", None) or "").upper()
    issue_type = (getattr(match, "rule_issue_type", None) or "").lower()
    return category == "PUNCTUATION" or issue_type == "typographical"


def _is_style(match) -> bool:
    category = (getattr(match, "category", None) or "").upper()
    issue_type = (getattr(match, "rule_issue_type", None) or "").lower()
    return category == "STYLE" or issue_type == "style"


def _zero_features() -> dict[str, float]:
    """Return zero-filled feature dict."""
    return {n: 0.0 for n in LT_FEATURE_NAMES}


def extract_lt_features(essay: str, tool=None) -> dict[str, float]:
    """
    Extract LanguageTool-based features for one essay.

    Returns numeric feature dict. On LT failure, returns zero-filled dict and logs.
    """
    if tool is None:
        tool = get_languagetool()

    try:
        matches = tool.check(essay)
    except Exception as e:
        logger.warning("LanguageTool check failed for essay (len=%d): %s", len(essay), e)
        return _zero_features()

    word_count = max(len(essay.split()), 1)
    spelling_count = sum(1 for m in matches if _is_spelling(m))
    punctuation_count = sum(1 for m in matches if _is_punctuation(m))
    style_count = sum(1 for m in matches if _is_style(m))
    grammar_count = len(matches) - spelling_count
    unique_rule_count = len({getattr(m, "ruleId", "") for m in matches if getattr(m, "ruleId", "")})

    spelling_per_100 = 100.0 * spelling_count / word_count
    grammar_per_100 = 100.0 * grammar_count / word_count
    grammar_spelling_ratio = grammar_count / max(spelling_count, 1)
    punctuation_per_100 = 100.0 * punctuation_count / word_count
    style_per_100 = 100.0 * style_count / word_count
    unique_rule_ratio = unique_rule_count / word_count

    return {
        "lt_spelling_error_per_100_words": spelling_per_100,
        "lt_grammar_error_per_100_words": grammar_per_100,
        "lt_grammar_spelling_ratio": grammar_spelling_ratio,
        "lt_punctuation_error_per_100_words": punctuation_per_100,
        "lt_style_error_per_100_words": style_per_100,
        "lt_unique_rule_ratio": unique_rule_ratio,
    }


def extract_lt_features_batch(essays: list[str], tool=None) -> np.ndarray:
    """
    Extract LT features for all essays. Reuses single tool instance.
    Returns (N, len(LT_FEATURE_NAMES)) array.
    """
    if tool is None:
        tool = get_languagetool()

    rows = [extract_lt_features(e, tool) for e in essays]
    arr = np.array([[d[n] for n in LT_FEATURE_NAMES] for d in rows], dtype=np.float64)
    return arr
