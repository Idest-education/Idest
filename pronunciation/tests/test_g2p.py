from unittest.mock import patch

from src.g2p import ReferenceG2P


def test_phonemize_words_splits_phones():
    # phonemizer returns one line per input word, phones space-separated
    fake_output = ["f æ s t", "k ɑːr"]
    with patch("src.g2p.phonemize", return_value=fake_output):
        g2p = ReferenceG2P()
        result = g2p.phonemize_words(["fast", "car"])
    assert result["fast"] == ["f", "æ", "s", "t"]
    assert result["car"] == ["k", "ɑːr"]


def test_phonemize_empty_input():
    g2p = ReferenceG2P()
    assert g2p.phonemize_words([]) == {}
