from ielts_ai.speaking_scorer.features.acoustic_features import (
    AcousticFeatures, SentenceError, WordError, ProblematicPhone,
)
from ielts_ai.speaking_scorer.pronunciation_report import build_pronunciation_report


def _acoustic(**overrides):
    base = dict(
        segmental=82.0, intelligibility=70.0, stress=65.0, prosody=68.0,
        reliability=0.8, fluency=78.0, rhythm=60.0, discourse_marker_density=40.0,
        transcript="the car is fat", sentence_errors=[],
        intended_transcript="the car is fast",
        hesitation_count=3, pause_count=5, filler_word_count=2,
    )
    base.update(overrides)
    return AcousticFeatures(**base)


def test_report_has_expected_keys():
    report = build_pronunciation_report(_acoustic())
    for key in ("predictedTranscript", "bandScore", "pronunciationAccuracy",
                "fluencyScore", "hesitationCount", "pauseCount",
                "fillerWordCount", "feedback"):
        assert key in report


def test_accuracy_and_fluency_mapped():
    report = build_pronunciation_report(_acoustic())
    assert report["pronunciationAccuracy"] == 82
    assert report["fluencyScore"] == 78
    assert report["predictedTranscript"] == "the car is fast"


def test_band_score_in_range():
    report = build_pronunciation_report(_acoustic())
    assert 1.0 <= report["bandScore"] <= 9.0
    assert report["bandScore"] % 0.5 == 0.0


def test_feedback_flags_mispronunciation_from_diff():
    report = build_pronunciation_report(_acoustic())
    joined = " ".join(report["feedback"]).lower()
    assert "fast" in joined and "fat" in joined


def test_feedback_mentions_hesitation_when_high():
    report = build_pronunciation_report(_acoustic(hesitation_count=6))
    assert any("hesitat" in f.lower() for f in report["feedback"])


def test_counts_passed_through():
    report = build_pronunciation_report(_acoustic())
    assert report["hesitationCount"] == 3
    assert report["pauseCount"] == 5
    assert report["fillerWordCount"] == 2
