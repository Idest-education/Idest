import json
from unittest.mock import MagicMock, patch

import pytest

from ielts_ai.speaking_scorer.features.grammar_features import GrammarFeatures
from ielts_ai.speaking_scorer.features.lexical_features import LexicalFeatures
from ielts_ai.speaking_scorer.ollama_judge import OllamaJudgment, judge

_LEXICAL = LexicalFeatures(ttr_lemma=0.6, freq_tier_ratio=0.3, lexical_density=0.45, mean_word_length=4.5)
_GRAMMAR = GrammarFeatures(
    lt_error_rate=2.0, lt_grammar_error_rate=1.0, lt_spelling_error_rate=1.0,
    clause_count=1.5, subordination_ratio=0.3, mean_sentence_length=12.0,
)
_TRANSCRIPT = "I think the environment is very important for future generations."


def _ok_response(data: dict) -> MagicMock:
    mock = MagicMock()
    mock.raise_for_status.return_value = None
    mock.json.return_value = {"message": {"content": json.dumps(data)}}
    return mock


def test_happy_path_returns_judgment():
    with patch("requests.post", return_value=_ok_response({
        "lr_band": 6.0, "lr_feedback": "Good vocabulary.",
        "gr_band": 5.5, "gr_feedback": "Some errors.",
        "pronunciation_tips": {"environment": "Stress the second syllable."},
    })):
        result = judge(_TRANSCRIPT, _LEXICAL, _GRAMMAR, [], model="llama3")

    assert result is not None
    assert isinstance(result, OllamaJudgment)
    assert result.lr_band == 6.0
    assert result.gr_band == 5.5
    assert result.pronunciation_tips.get("environment") == "Stress the second syllable."


def test_returns_none_when_model_is_empty():
    result = judge(_TRANSCRIPT, _LEXICAL, _GRAMMAR, [], model="")
    assert result is None


def test_returns_none_on_connection_refused():
    with patch("requests.post", side_effect=ConnectionError("refused")):
        result = judge(_TRANSCRIPT, _LEXICAL, _GRAMMAR, [], model="llama3")
    assert result is None


def test_returns_none_on_malformed_json():
    mock = MagicMock()
    mock.raise_for_status.return_value = None
    mock.json.return_value = {"message": {"content": "not valid json {"}}
    with patch("requests.post", return_value=mock):
        result = judge(_TRANSCRIPT, _LEXICAL, _GRAMMAR, [], model="llama3")
    assert result is None


def test_returns_none_when_required_keys_missing():
    with patch("requests.post", return_value=_ok_response({"lr_band": 5.0})):
        result = judge(_TRANSCRIPT, _LEXICAL, _GRAMMAR, [], model="llama3")
    assert result is None


def test_pronunciation_tips_defaults_to_empty_dict():
    with patch("requests.post", return_value=_ok_response({
        "lr_band": 6.0, "lr_feedback": "OK.",
        "gr_band": 5.5, "gr_feedback": "Fine.",
    })):
        result = judge(_TRANSCRIPT, _LEXICAL, _GRAMMAR, [], model="llama3")
    assert result is not None
    assert result.pronunciation_tips == {}
