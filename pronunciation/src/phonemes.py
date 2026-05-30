from __future__ import annotations

import logging

import numpy as np

from src.alignment import RecognizedPhone

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "facebook/wav2vec2-lv-60-espeak-cv-ft"


def decode_ctc(
    probs: np.ndarray,
    id_to_token: dict[int, str],
    blank_id: int,
    frame_seconds: float,
) -> list[RecognizedPhone]:
    """Greedy CTC decode -> recognized phones with per-phone confidence and timing."""
    pred_ids = probs.argmax(axis=-1)
    phones: list[RecognizedPhone] = []
    prev = blank_id
    run_frames: list[int] = []

    def flush(token_id: int, end_idx: int):
        if token_id == blank_id or not run_frames:
            return
        token = id_to_token.get(token_id, "")
        if not token or token.startswith("<"):
            return
        confidence = float(np.mean([probs[f, token_id] for f in run_frames]))
        phones.append(RecognizedPhone(
            token=token,
            start=round(run_frames[0] * frame_seconds, 3),
            end=round((end_idx) * frame_seconds, 3),
            confidence=confidence,
        ))

    for idx, tid in enumerate(pred_ids):
        if tid == prev:
            run_frames.append(idx)
        else:
            flush(prev, idx)
            prev = int(tid)
            run_frames = [idx]
    flush(prev, len(pred_ids))
    return phones


class PhonemeRecognizer:
    """Flow B1 — audio -> recognized IPA phones with confidence + timing."""

    def __init__(self, model_name: str = DEFAULT_MODEL, device: str = "cpu") -> None:
        self._model_name = model_name
        self._device = device
        self._processor = None
        self._model = None

    def _load(self):
        if self._model is None:
            import torch  # noqa: F401
            from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
            logger.info("Loading wav2vec2 phoneme model %s", self._model_name)
            self._processor = Wav2Vec2Processor.from_pretrained(self._model_name)
            self._model = Wav2Vec2ForCTC.from_pretrained(self._model_name).to(self._device)
            self._model.eval()

    def recognize(self, samples: np.ndarray, sr: int = 16000) -> list[RecognizedPhone]:
        import torch
        self._load()
        inputs = self._processor(samples, sampling_rate=sr, return_tensors="pt")
        with torch.no_grad():
            logits = self._model(inputs.input_values.to(self._device)).logits[0]
        probs = torch.softmax(logits, dim=-1).cpu().numpy()
        id_to_token = {i: t for t, i in self._processor.tokenizer.get_vocab().items()}
        blank_id = self._model.config.pad_token_id or 0
        # wav2vec2 stride: ~20ms per frame at 16kHz
        frame_seconds = (len(samples) / sr) / max(probs.shape[0], 1)
        return decode_ctc(probs, id_to_token, blank_id=blank_id, frame_seconds=frame_seconds)
