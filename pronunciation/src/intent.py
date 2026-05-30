from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass

import requests

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are a speech-recognition correction assistant. A learner's spoken English was transcribed "
    "by an ASR system that may have misheard mispronounced words. Infer the most likely INTENDED "
    "sentence based on linguistic context. Keep the wording faithful; only fix likely recognition "
    "errors. Respond with JSON only: {\"predictedTranscript\": \"...\"}"
)


@dataclass
class CorrectionResult:
    predicted_transcript: str
    degraded: bool


class TranscriptCorrector:
    """Flow A2 — predict the intended transcript via Ollama, with graceful fallback."""

    def __init__(
        self,
        model: str = "",
        host: str = "http://localhost:11434",
        timeout: int = 30,
    ) -> None:
        self.model = model or os.getenv("OLLAMA_SPEAKING_MODEL", "")
        self.host = host or os.getenv("OLLAMA_HOST", "http://localhost:11434")
        self.timeout = timeout

    def correct(self, transcript: str) -> CorrectionResult:
        raw = transcript.strip()
        if not raw:
            return CorrectionResult(predicted_transcript="", degraded=True)
        if not self.model:
            return CorrectionResult(predicted_transcript=raw, degraded=True)

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": f"ASR transcript:\n{raw}"},
            ],
            "stream": False,
        }
        try:
            response = requests.post(f"{self.host}/api/chat", json=payload, timeout=self.timeout)
            response.raise_for_status()
            content = response.json()["message"]["content"]
            predicted = str(json.loads(content)["predictedTranscript"]).strip()
        except Exception as exc:
            logger.warning("Transcript correction failed, using raw transcript: %s", exc)
            return CorrectionResult(predicted_transcript=raw, degraded=True)

        if not predicted:
            return CorrectionResult(predicted_transcript=raw, degraded=True)
        return CorrectionResult(predicted_transcript=predicted, degraded=False)
