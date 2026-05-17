"""Integration test — requires pronunciation models (Whisper + wav2vec2). Slow (~30s)."""
import pytest
from pathlib import Path

from ielts_ai.paths import REPO_ROOT
from ielts_ai.speaking_scorer.features.acoustic_features import (
    AcousticFeatures,
    SentenceError,
    WordError,
    extract_acoustic_features,
)

WAV_FIXTURE = REPO_ROOT / "pronunciation" / "voice-sample.wav"


@pytest.mark.slow
def test_returns_acoustic_features(tmp_path):
    audio_bytes = WAV_FIXTURE.read_bytes()
    result = extract_acoustic_features([audio_bytes], ["audio/wav"])
    assert isinstance(result, AcousticFeatures)


@pytest.mark.slow
def test_scores_in_valid_range():
    audio_bytes = WAV_FIXTURE.read_bytes()
    result = extract_acoustic_features([audio_bytes], ["audio/wav"])
    for field_name in ("segmental", "intelligibility", "stress", "prosody", "fluency", "rhythm"):
        value = getattr(result, field_name)
        assert 0.0 <= value <= 100.0, f"{field_name}={value} out of range"


@pytest.mark.slow
def test_transcript_is_non_empty():
    audio_bytes = WAV_FIXTURE.read_bytes()
    result = extract_acoustic_features([audio_bytes], ["audio/wav"])
    assert isinstance(result.transcript, str)
    assert len(result.transcript) > 0


@pytest.mark.slow
def test_sentence_errors_is_list():
    audio_bytes = WAV_FIXTURE.read_bytes()
    result = extract_acoustic_features([audio_bytes], ["audio/wav"])
    assert isinstance(result.sentence_errors, list)


@pytest.mark.slow
def test_word_errors_have_required_fields():
    audio_bytes = WAV_FIXTURE.read_bytes()
    result = extract_acoustic_features([audio_bytes], ["audio/wav"])
    for sent_err in result.sentence_errors:
        assert isinstance(sent_err, SentenceError)
        assert isinstance(sent_err.sentence, str)
        assert sent_err.start_time >= 0.0
        assert sent_err.end_time >= sent_err.start_time
        for word_err in sent_err.word_errors:
            assert isinstance(word_err, WordError)
            assert isinstance(word_err.word, str)
            assert 0.0 <= word_err.score <= 100.0
            assert isinstance(word_err.fix_hint, str)
            assert len(word_err.fix_hint) > 0


@pytest.mark.slow
def test_no_temp_files_left_behind(tmp_path):
    import os
    import tempfile
    before = set(os.listdir(tempfile.gettempdir()))
    audio_bytes = WAV_FIXTURE.read_bytes()
    extract_acoustic_features([audio_bytes], ["audio/wav"])
    after = set(os.listdir(tempfile.gettempdir()))
    new_files = [f for f in (after - before) if f.endswith((".wav", ".webm"))]
    assert not new_files, f"Temp files not cleaned up: {new_files}"
