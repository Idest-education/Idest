from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

from src.alignment import RecognizedPhone, align_phones
from src.asr import Transcription, WhisperTranscriber
from src.audio import assess_audio_quality, load_audio
from src.fluency import analyze_fluency
from src.g2p import ReferenceG2P
from src.intent import TranscriptCorrector
from src.phonemes import PhonemeRecognizer
from src.scoring import (
    AudioQuality,
    FluencyMetrics,
    PronunciationScores,
    Reliability,
    TranscriptSegment,
    WordAssessment,
    aggregate_scores,
    compute_reliability,
)

logger = logging.getLogger(__name__)

_WORD_RELIABILITY_PROB = 0.5    # whisper word probability below this -> unreliable


@dataclass
class PronunciationReport:
    transcript: str
    intended_transcript: str
    transcript_segments: list[TranscriptSegment]
    words: list[WordAssessment]
    scores: PronunciationScores
    reliability: Reliability
    audio_quality: AudioQuality
    fluency_metrics: FluencyMetrics
    degraded: list[str] = field(default_factory=list)


class PronunciationPipeline:
    def __init__(
        self,
        transcriber=None,
        corrector=None,
        recognizer=None,
        g2p=None,
    ) -> None:
        self._transcriber = transcriber or WhisperTranscriber()
        self._corrector = corrector or TranscriptCorrector()
        self._recognizer = recognizer or PhonemeRecognizer()
        self._g2p = g2p or ReferenceG2P()

    def run(self, audio_path: Path) -> PronunciationReport:
        samples, sr = load_audio(audio_path)
        audio_quality = assess_audio_quality(samples, sr)

        # Flow A1 and Flow B1 are independent -> run concurrently.
        with ThreadPoolExecutor(max_workers=2) as pool:
            asr_future = pool.submit(self._transcriber.transcribe, audio_path)
            phon_future = pool.submit(self._recognizer.recognize, samples, sr)
            transcription: Transcription = asr_future.result()
            recognized: list[RecognizedPhone] = phon_future.result()

        # Flow A2 — intent correction (depends on A1).
        correction = self._corrector.correct(transcription.text)
        degraded: list[str] = []
        if correction.degraded:
            degraded.append("ollama_intent")

        # Flow B2 — align predicted words against recognized phones.
        intended_words = [w for w in correction.predicted_transcript.split() if w]
        ref_table = self._g2p.phonemize_words(intended_words)
        words = self._assess_words(transcription, intended_words, ref_table, recognized)

        # Flow B3 — fluency from word timings.
        fluency = analyze_fluency(transcription.words, audio_quality.duration_seconds)

        scores = aggregate_scores(words, fluency, audio_quality)
        reliability = compute_reliability(words, audio_quality)

        return PronunciationReport(
            transcript=transcription.text,
            intended_transcript=correction.predicted_transcript,
            transcript_segments=transcription.segments,
            words=words,
            scores=scores,
            reliability=reliability,
            audio_quality=audio_quality,
            fluency_metrics=fluency,
            degraded=degraded,
        )

    def _assess_words(
        self,
        transcription: Transcription,
        intended_words: list[str],
        ref_table: dict[str, list[str]],
        recognized: list[RecognizedPhone],
    ) -> list[WordAssessment]:
        """Pair intended words with ASR word timings; align each word's phones."""
        timings = transcription.words
        words: list[WordAssessment] = []
        for idx, token in enumerate(intended_words):
            timing = timings[idx] if idx < len(timings) else None
            ref_phones = ref_table.get(token, [])
            if timing is not None:
                window = [r for r in recognized if timing.start <= (r.start + r.end) / 2 <= timing.end]
            else:
                window = []
            phones = align_phones(ref_phones, window) if ref_phones else []
            non_extra = [p for p in phones if p.status != "extra"]
            seg_score = (sum(p.score for p in non_extra) / len(non_extra)) if non_extra else 0.0
            reliable = timing is not None and timing.probability >= _WORD_RELIABILITY_PROB
            words.append(WordAssessment(
                word=token,
                start=timing.start if timing else None,
                end=timing.end if timing else None,
                reliable=reliable,
                segmental_score=round(seg_score, 2),
                phones=phones,
            ))
        return words
