from src.scoring import (
    PhoneAssessment,
    WordAssessment,
    TranscriptSegment,
    WordTiming,
    AudioQuality,
    Reliability,
    FluencyMetrics,
    PronunciationScores,
)


def test_phone_assessment_fields():
    p = PhoneAssessment(token="θ", score=42.0, status="substitution")
    assert p.token == "θ"
    assert p.score == 42.0
    assert p.status == "substitution"


def test_word_assessment_fields():
    p = PhoneAssessment(token="f", score=90.0, status="match")
    w = WordAssessment(
        word="fast", start=0.1, end=0.5, reliable=True,
        segmental_score=88.0, phones=[p],
    )
    assert w.word == "fast"
    assert w.phones[0].token == "f"


def test_scores_have_six_dimensions():
    s = PronunciationScores(
        segmental=70.0, intelligibility=65.0, stress=60.0,
        prosody=68.0, fluency=72.0, rhythm=55.0,
    )
    for attr in ("segmental", "intelligibility", "stress", "prosody", "fluency", "rhythm"):
        assert 0.0 <= getattr(s, attr) <= 100.0


from src.scoring import aggregate_scores, compute_reliability


def _word(score, reliable=True):
    return WordAssessment(word="x", start=0.0, end=0.5, reliable=reliable,
                          segmental_score=score, phones=[])


def _fluency(rhythm=70.0):
    return FluencyMetrics(hesitation_count=0, pause_count=1, filler_word_count=0,
                          repeated_word_count=0, speech_rate_wpm=120.0, rhythm_consistency=rhythm)


def test_aggregate_scores_in_range():
    words = [_word(80.0), _word(60.0), _word(90.0)]
    aq = AudioQuality(duration_seconds=10.0, rms_db=-20.0, is_reliable=True)
    s = aggregate_scores(words, _fluency(), aq)
    for attr in ("segmental", "intelligibility", "stress", "prosody", "fluency", "rhythm"):
        assert 0.0 <= getattr(s, attr) <= 100.0


def test_segmental_is_mean_of_reliable_words():
    words = [_word(80.0), _word(60.0), _word(0.0, reliable=False)]
    aq = AudioQuality(duration_seconds=10.0, rms_db=-20.0, is_reliable=True)
    s = aggregate_scores(words, _fluency(), aq)
    assert abs(s.segmental - 70.0) < 0.01  # unreliable word excluded


def test_reliability_drops_for_bad_audio():
    words = [_word(80.0)]
    good = compute_reliability(words, AudioQuality(10.0, -20.0, True))
    bad = compute_reliability(words, AudioQuality(10.0, -55.0, False))
    assert good.overall > bad.overall
    assert 0.0 <= bad.overall <= 1.0
