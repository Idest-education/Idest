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
