from pathlib import Path

import numpy as np

from src.scoring import TranscriptSegment, WordTiming
from src.asr import Transcription
from src.alignment import RecognizedPhone
from src.intent import CorrectionResult
from src.pipeline import PronunciationPipeline, PronunciationReport


class _FakeTranscriber:
    def transcribe(self, path):
        return Transcription(
            text="the car is fat",
            segments=[TranscriptSegment(start=0.0, end=1.5, text="the car is fat")],
            words=[
                WordTiming("the", 0.0, 0.2, 0.99),
                WordTiming("car", 0.3, 0.6, 0.98),
                WordTiming("is", 0.7, 0.8, 0.99),
                WordTiming("fat", 0.9, 1.4, 0.40),
            ],
        )


class _FakeCorrector:
    def correct(self, transcript):
        return CorrectionResult(predicted_transcript="the car is fast", degraded=False)


class _FakeRecognizer:
    def recognize(self, samples, sr=16000):
        return [RecognizedPhone(t, 0.0, 0.1, 0.9) for t in ["f", "æ", "t"]]


class _FakeG2P:
    def phonemize_words(self, words):
        table = {"the": ["ð", "ə"], "car": ["k", "ɑːr"], "is": ["ɪ", "z"], "fast": ["f", "æ", "s", "t"]}
        return {w: table.get(w.lower().strip(".,!?"), ["?"]) for w in words}


def _patch_audio(monkeypatch):
    import src.pipeline as pipeline_mod
    monkeypatch.setattr(pipeline_mod, "load_audio", lambda p: (np.zeros(16000, dtype="float32"), 16000))


def test_pipeline_produces_report(monkeypatch):
    _patch_audio(monkeypatch)
    pipe = PronunciationPipeline(
        transcriber=_FakeTranscriber(), corrector=_FakeCorrector(),
        recognizer=_FakeRecognizer(), g2p=_FakeG2P(),
    )
    report = pipe.run(Path("ignored.wav"))
    assert isinstance(report, PronunciationReport)
    assert report.transcript == "the car is fat"
    assert report.intended_transcript == "the car is fast"
    assert [w.word for w in report.words] == ["the", "car", "is", "fast"]
    for attr in ("segmental", "intelligibility", "stress", "prosody", "fluency", "rhythm"):
        assert 0.0 <= getattr(report.scores, attr) <= 100.0
    assert 0.0 <= report.reliability.overall <= 1.0
    assert report.audio_quality.duration_seconds > 0.0


def test_pipeline_flags_degraded(monkeypatch):
    _patch_audio(monkeypatch)

    class _DegradedCorrector:
        def correct(self, transcript):
            return CorrectionResult(predicted_transcript=transcript, degraded=True)

    pipe = PronunciationPipeline(
        transcriber=_FakeTranscriber(), corrector=_DegradedCorrector(),
        recognizer=_FakeRecognizer(), g2p=_FakeG2P(),
    )
    report = pipe.run(Path("ignored.wav"))
    assert "ollama_intent" in report.degraded
