from unittest.mock import patch

import pytest

from ielts_ai.speaking_scorer.features.acoustic_features import AcousticFeatures, SentenceError
from ielts_ai.speaking_scorer.features.grammar_features import GrammarFeatures
from ielts_ai.speaking_scorer.features.lexical_features import LexicalFeatures
from ielts_ai.speaking_scorer.ollama_judge import OllamaJudgment
from ielts_ai.speaking_scorer.scorer import RubricScore, SpeakingScorer, SpeakingScoringResult

_ACOUSTIC = AcousticFeatures(
    segmental=70.0, intelligibility=65.0, stress=72.0, prosody=68.0,
    reliability=0.75, fluency=60.0, rhythm=55.0, discourse_marker_density=40.0,
    transcript="I think the environment is very important.",
    sentence_errors=[],
)
_LEXICAL = LexicalFeatures(ttr_lemma=0.65, freq_tier_ratio=0.30, lexical_density=0.45, mean_word_length=4.5)
_GRAMMAR = GrammarFeatures(
    lt_error_rate=2.0, lt_grammar_error_rate=1.0, lt_spelling_error_rate=1.0,
    clause_count=1.5, subordination_ratio=0.3, mean_sentence_length=12.0,
)
_OLLAMA = OllamaJudgment(lr_band=6.5, gr_band=6.0, lr_feedback="Good range.", gr_feedback="Minor errors.", pronunciation_tips={})


def _patch_features(ollama_result=None):
    return [
        patch("ielts_ai.speaking_scorer.scorer.extract_acoustic_features", return_value=_ACOUSTIC),
        patch("ielts_ai.speaking_scorer.scorer.extract_lexical_features", return_value=_LEXICAL),
        patch("ielts_ai.speaking_scorer.scorer.extract_grammar_features", return_value=_GRAMMAR),
        patch("ielts_ai.speaking_scorer.scorer.judge", return_value=ollama_result),
    ]


def test_returns_scoring_result():
    with _patch_features(_OLLAMA)[0], _patch_features(_OLLAMA)[1], \
         _patch_features(_OLLAMA)[2], _patch_features(_OLLAMA)[3]:
        scorer = SpeakingScorer()
        result = scorer.score([b"audio"], ["audio/webm"])
    assert isinstance(result, SpeakingScoringResult)


def test_overall_band_in_valid_range():
    patches = _patch_features(_OLLAMA)
    with patches[0], patches[1], patches[2], patches[3]:
        result = SpeakingScorer().score([b"audio"], ["audio/webm"])
    assert 1.0 <= result.overall_band <= 9.0
    assert result.overall_band % 0.5 == 0.0


def test_all_four_rubrics_present():
    patches = _patch_features(_OLLAMA)
    with patches[0], patches[1], patches[2], patches[3]:
        result = SpeakingScorer().score([b"audio"], ["audio/webm"])
    assert set(result.rubrics.keys()) == {"FC", "LR", "GR", "P"}


def test_each_rubric_has_valid_band():
    patches = _patch_features(_OLLAMA)
    with patches[0], patches[1], patches[2], patches[3]:
        result = SpeakingScorer().score([b"audio"], ["audio/webm"])
    for key, rubric in result.rubrics.items():
        assert isinstance(rubric, RubricScore), f"{key} is not RubricScore"
        assert 1.0 <= rubric.band <= 9.0, f"{key}.band={rubric.band} out of range"


def test_ollama_bands_used_when_available():
    patches = _patch_features(_OLLAMA)
    with patches[0], patches[1], patches[2], patches[3]:
        result = SpeakingScorer().score([b"audio"], ["audio/webm"])
    assert result.rubrics["LR"].band == 6.5
    assert result.rubrics["GR"].band == 6.0


def test_heuristic_bands_when_ollama_unavailable():
    patches = _patch_features(ollama_result=None)
    with patches[0], patches[1], patches[2], patches[3]:
        result = SpeakingScorer().score([b"audio"], ["audio/webm"])
    assert "ollama_lr_gr" in result.metadata["degraded_features"]
    assert 1.0 <= result.rubrics["LR"].band <= 9.0
    assert 1.0 <= result.rubrics["GR"].band <= 9.0


def test_p_rubric_has_sentence_errors_key():
    patches = _patch_features(_OLLAMA)
    with patches[0], patches[1], patches[2], patches[3]:
        result = SpeakingScorer().score([b"audio"], ["audio/webm"])
    assert result.rubrics["P"].sentence_errors is not None
    assert isinstance(result.rubrics["P"].sentence_errors, list)
