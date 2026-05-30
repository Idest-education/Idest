from src.scoring import WordTiming
from src.fluency import analyze_fluency, FILLERS


def _w(word, start, end, prob=0.95):
    return WordTiming(word=word, start=start, end=end, probability=prob)


def test_counts_filler_words():
    words = [_w("um", 0.0, 0.4), _w("i", 0.5, 0.6), _w("uh", 0.7, 1.0), _w("think", 1.1, 1.5)]
    m = analyze_fluency(words, duration=2.0)
    assert m.filler_word_count == 2


def test_counts_long_pauses():
    # a 1.2s gap between word 1 and word 2 is a pause
    words = [_w("hello", 0.0, 0.5), _w("world", 1.7, 2.2)]
    m = analyze_fluency(words, duration=3.0)
    assert m.pause_count >= 1


def test_speech_rate_wpm():
    # 4 words in 60s -> 4 wpm
    words = [_w("a", 0, 1), _w("b", 2, 3), _w("c", 4, 5), _w("d", 6, 7)]
    m = analyze_fluency(words, duration=60.0)
    assert abs(m.speech_rate_wpm - 4.0) < 0.01


def test_counts_repeated_words():
    words = [_w("the", 0.0, 0.2), _w("the", 0.3, 0.5), _w("cat", 0.6, 0.9)]
    m = analyze_fluency(words, duration=2.0)
    assert m.repeated_word_count == 1


def test_empty_words_safe():
    m = analyze_fluency([], duration=5.0)
    assert m.speech_rate_wpm == 0.0
    assert m.filler_word_count == 0
    assert 0.0 <= m.rhythm_consistency <= 100.0
