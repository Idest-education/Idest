from types import SimpleNamespace

from ielts_ai.speaking_scorer.features.acoustic_features import _merge_features, AcousticFeatures


def _fake_report():
    scores = SimpleNamespace(segmental=70.0, intelligibility=65.0, stress=60.0,
                             prosody=68.0, fluency=72.0, rhythm=55.0)
    fluency = SimpleNamespace(hesitation_count=2, pause_count=3, filler_word_count=1)
    return SimpleNamespace(
        transcript="the car is fat",
        intended_transcript="the car is fast",
        transcript_segments=[],
        words=[],
        scores=scores,
        reliability=SimpleNamespace(overall=0.8),
        audio_quality=SimpleNamespace(duration_seconds=10.0),
        fluency_metrics=fluency,
    )


def test_merge_populates_two_flow_fields():
    result = _merge_features([_fake_report()], [10.0])
    assert isinstance(result, AcousticFeatures)
    assert result.intended_transcript == "the car is fast"
    assert result.hesitation_count == 2
    assert result.pause_count == 3
    assert result.filler_word_count == 1


def test_merge_sums_counts_across_parts():
    result = _merge_features([_fake_report(), _fake_report()], [10.0, 10.0])
    assert result.hesitation_count == 4
    assert result.filler_word_count == 2
