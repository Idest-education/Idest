import numpy as np
import soundfile as sf

from src.audio import load_audio, assess_audio_quality
from src.scoring import AudioQuality


def _write_tone(path, seconds=1.0, sr=16000):
    t = np.linspace(0, seconds, int(sr * seconds), endpoint=False)
    sf.write(path, 0.2 * np.sin(2 * np.pi * 220 * t).astype("float32"), sr)


def test_load_audio_resamples_to_16k(tmp_path):
    wav = tmp_path / "a.wav"
    _write_tone(wav, seconds=1.0, sr=22050)
    samples, sr = load_audio(wav)
    assert sr == 16000
    assert len(samples) > 0


def test_assess_quality_returns_dataclass(tmp_path):
    wav = tmp_path / "a.wav"
    _write_tone(wav, seconds=2.0)
    samples, sr = load_audio(wav)
    q = assess_audio_quality(samples, sr)
    assert isinstance(q, AudioQuality)
    assert abs(q.duration_seconds - 2.0) < 0.1
    assert q.is_reliable is True


def test_silence_is_unreliable(tmp_path):
    wav = tmp_path / "s.wav"
    sf.write(wav, np.zeros(16000, dtype="float32"), 16000)
    samples, sr = load_audio(wav)
    q = assess_audio_quality(samples, sr)
    assert q.is_reliable is False
