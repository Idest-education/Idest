from ielts_ai.writing_scorer.features.lexical_features import extract_lexical_features
from ielts_ai.writing_scorer.features.coherence_features import structural_features


def test_type_token_ratio_present():
    result = extract_lexical_features("The cat sat on the mat the cat")
    assert "type_token_ratio" in result


def test_type_token_ratio_value():
    result = extract_lexical_features("the cat sat on the mat the cat")
    assert 0.0 < result["type_token_ratio"] <= 1.0


def test_type_token_ratio_perfect_diversity():
    result = extract_lexical_features("quickly runs the agile brown fox")
    assert result["type_token_ratio"] == 1.0


def test_structural_features_has_sentence_length_std():
    result = structural_features("Short sentence. This is a longer sentence with more words.")
    assert "sentence_length_std" in result
    assert result["sentence_length_std"] >= 0.0


def test_structural_features_has_avg_paragraph_length():
    result = structural_features("First paragraph has some words.\n\nSecond paragraph is here.")
    assert "avg_paragraph_length" in result
    assert result["avg_paragraph_length"] > 0.0


def test_avg_paragraph_length_single_paragraph():
    essay = "One two three four five."
    result = structural_features(essay)
    assert result["avg_paragraph_length"] == result["avg_paragraph_length"]  # not NaN
