import pytest
from ielts_ai.speaking_scorer.features.lexical_features import LexicalFeatures, extract_lexical_features


def test_returns_lexical_features_dataclass():
    result = extract_lexical_features("The cat sat on the mat.")
    assert isinstance(result, LexicalFeatures)


def test_empty_transcript_returns_zeros():
    result = extract_lexical_features("")
    assert result.ttr_lemma == 0.0
    assert result.freq_tier_ratio == 0.0
    assert result.lexical_density == 0.0
    assert result.mean_word_length == 0.0


def test_ttr_range():
    result = extract_lexical_features("I think that the environment is very important for all people.")
    assert 0.0 <= result.ttr_lemma <= 1.0


def test_high_repetition_lowers_ttr():
    repetitive = "cat cat cat cat cat dog dog dog dog dog"
    diverse = "I enjoy reading philosophy science history literature technology"
    r = extract_lexical_features(repetitive)
    d = extract_lexical_features(diverse)
    assert r.ttr_lemma < d.ttr_lemma


def test_lexical_density_range():
    result = extract_lexical_features("Scientists discovered unprecedented atmospheric phenomena.")
    assert 0.0 < result.lexical_density <= 1.0


def test_academic_vocabulary_raises_freq_tier_ratio():
    # Rare academic words → higher freq_tier_ratio (B2+ words)
    academic = "unprecedented phenomena amalgamation electromagnetic biodiversity"
    basic = "cat dog house run eat see big small go come"
    a = extract_lexical_features(academic)
    b = extract_lexical_features(basic)
    assert a.freq_tier_ratio > b.freq_tier_ratio


def test_mean_word_length_positive():
    short_words = extract_lexical_features("I go eat run.")
    long_words = extract_lexical_features("electromagnetic biodiversity unprecedented amalgamation.")
    assert short_words.mean_word_length > 0.0
    assert long_words.mean_word_length > short_words.mean_word_length


def test_function_words_only_returns_zero_freq_tier_ratio():
    # When transcript has no content words, freq_tier_ratio is 0.0 by convention
    result = extract_lexical_features("the the the and and and")
    assert result.freq_tier_ratio == 0.0
