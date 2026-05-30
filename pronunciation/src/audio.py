from __future__ import annotations

import logging
from pathlib import Path

import librosa
import numpy as np

from src.scoring import AudioQuality

logger = logging.getLogger(__name__)

TARGET_SR = 16000
_RMS_DB_FLOOR = -45.0   # quieter than this overall -> treat as unreliable


def load_audio(path: Path) -> tuple[np.ndarray, int]:
    """Load mono audio resampled to 16 kHz float32."""
    samples, sr = librosa.load(str(path), sr=TARGET_SR, mono=True)
    return samples.astype("float32"), sr


def assess_audio_quality(samples: np.ndarray, sr: int) -> AudioQuality:
    duration = len(samples) / sr if sr else 0.0
    rms = float(np.sqrt(np.mean(np.square(samples)))) if len(samples) else 0.0
    rms_db = 20.0 * np.log10(rms) if rms > 1e-9 else -120.0
    is_reliable = rms_db > _RMS_DB_FLOOR and duration >= 0.5
    return AudioQuality(
        duration_seconds=round(duration, 3),
        rms_db=round(rms_db, 2),
        is_reliable=bool(is_reliable),
    )
