from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from src.asr import WhisperTranscriber, Transcription


def _fake_segment():
    word = SimpleNamespace(word=" fast", start=0.5, end=0.9, probability=0.97)
    return SimpleNamespace(start=0.0, end=1.0, text=" the car is fast", words=[word])


def test_transcribe_maps_segments_and_words():
    fake_model = SimpleNamespace(
        transcribe=lambda *a, **k: ([_fake_segment()], SimpleNamespace(language="en"))
    )
    with patch("src.asr.WhisperModel", return_value=fake_model):
        t = WhisperTranscriber()
        result = t.transcribe(Path("ignored.wav"))
    assert isinstance(result, Transcription)
    assert result.text.strip() == "the car is fast"
    assert result.segments[0].text.strip() == "the car is fast"
    assert result.words[0].word.strip() == "fast"
    assert result.words[0].start == 0.5
