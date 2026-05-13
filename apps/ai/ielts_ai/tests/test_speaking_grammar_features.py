import pytest
from ielts_ai.speaking_scorer.features.grammar_features import GrammarFeatures, extract_grammar_features


def test_returns_grammar_features_dataclass():
    result = extract_grammar_features("I go to school every day.")
    assert isinstance(result, GrammarFeatures)


def test_empty_transcript_returns_zeros():
    result = extract_grammar_features("")
    assert result.lt_error_rate == 0.0
    assert result.clause_count == 0.0
    assert result.mean_sentence_length == 0.0


def test_error_rate_non_negative():
    result = extract_grammar_features("She go to school yesterday and he don't like it.")
    assert result.lt_error_rate >= 0.0


def test_clean_text_has_lower_error_rate_than_errors():
    clean = "She went to school yesterday and he did not like it."
    errors = "She go to school yesterday and he don't liked it very much badly."
    c = extract_grammar_features(clean)
    e = extract_grammar_features(errors)
    assert c.lt_error_rate <= e.lt_error_rate


def test_subordination_ratio_range():
    result = extract_grammar_features(
        "Although she studied hard, she failed because the exam was harder than she expected."
    )
    assert 0.0 <= result.subordination_ratio <= 1.0


def test_complex_sentence_has_higher_subordination_than_simple():
    complex_text = (
        "Although the government introduced new policies, many citizens who lived in rural areas "
        "were not affected because they relied on traditional practices that had persisted for decades."
    )
    simple_text = "The government made new rules. People live in rural areas. They use old methods."
    c = extract_grammar_features(complex_text)
    s = extract_grammar_features(simple_text)
    assert c.subordination_ratio > s.subordination_ratio


def test_mean_sentence_length_positive():
    result = extract_grammar_features("I study English every day. It is very useful for my career.")
    assert result.mean_sentence_length > 0.0
