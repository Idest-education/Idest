from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

from faster_whisper import WhisperModel

from src.scoring import TranscriptSegment, WordTiming

logger = logging.getLogger(__name__)


@dataclass
class Transcription:
    text: str
    segments: list[TranscriptSegment] = field(default_factory=list)
    words: list[WordTiming] = field(default_factory=list)


class WhisperTranscriber:
    """Flow A1 — audio -> transcript, sentence segments, word timestamps."""

    def __init__(self, model_size: str = "base.en", device: str = "cpu", compute_type: str = "int8") -> None:
        self._model_size = model_size
        self._device = device
        self._compute_type = compute_type
        self._model: WhisperModel | None = None

    def _get_model(self) -> WhisperModel:
        if self._model is None:
            logger.info("Loading Whisper model %s on %s", self._model_size, self._device)
            self._model = WhisperModel(self._model_size, device=self._device, compute_type=self._compute_type)
        return self._model

    def transcribe(self, audio_path: Path) -> Transcription:
        model = self._get_model()
        segments_iter, _info = model.transcribe(str(audio_path), word_timestamps=True, language="en")

        segments: list[TranscriptSegment] = []
        words: list[WordTiming] = []
        texts: list[str] = []
        for seg in segments_iter:
            segments.append(TranscriptSegment(start=float(seg.start), end=float(seg.end), text=seg.text))
            texts.append(seg.text)
            for w in (seg.words or []):
                words.append(WordTiming(
                    word=w.word, start=float(w.start), end=float(w.end),
                    probability=float(getattr(w, "probability", 1.0)),
                ))
        return Transcription(text="".join(texts).strip(), segments=segments, words=words)
