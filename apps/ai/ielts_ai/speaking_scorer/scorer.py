from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any

from ielts_ai.speaking_scorer.band_mapper import (
    heuristic_gr_band,
    heuristic_lr_band,
    map_fluency_band,
    map_pronunciation_band,
)
from ielts_ai.speaking_scorer.features.acoustic_features import (
    SentenceError,
    WordError,
    extract_acoustic_features,
)
from ielts_ai.speaking_scorer.features.grammar_features import extract_grammar_features
from ielts_ai.speaking_scorer.features.lexical_features import extract_lexical_features
from ielts_ai.speaking_scorer.ollama_judge import OllamaJudgment, judge

logger = logging.getLogger(__name__)


@dataclass
class RubricScore:
    band: float
    feedback: str
    feature_evidence: dict[str, float] = field(default_factory=dict)
    sentence_errors: list[SentenceError] | None = None


@dataclass
class SpeakingScoringResult:
    overall_band: float
    rubrics: dict[str, RubricScore]
    feedback: str
    metadata: dict[str, Any] = field(default_factory=dict)


def _round_to_half(value: float) -> float:
    return round(value * 2) / 2


class SpeakingScorer:
    def __init__(
        self,
        ollama_model: str = "",
        ollama_host: str = "http://localhost:11434",
    ) -> None:
        self.ollama_model = ollama_model or os.getenv("OLLAMA_SPEAKING_MODEL", "")
        self.ollama_host = ollama_host or os.getenv("OLLAMA_HOST", "http://localhost:11434")

    def score(
        self,
        audio_parts: list[bytes],
        mimetypes: list[str],
    ) -> SpeakingScoringResult:
        acoustic = extract_acoustic_features(audio_parts, mimetypes)
        lexical = extract_lexical_features(acoustic.transcript)
        grammar = extract_grammar_features(acoustic.transcript)

        p_band = map_pronunciation_band(
            acoustic.segmental, acoustic.intelligibility, acoustic.prosody
        )
        fc_band = map_fluency_band(
            acoustic.fluency, acoustic.rhythm, acoustic.discourse_marker_density
        )

        worst_words: list[WordError] = sorted(
            [
                w
                for sent in acoustic.sentence_errors
                for w in sent.word_errors
            ],
            key=lambda w: w.score,
        )[:5]

        judgment: OllamaJudgment | None = judge(
            acoustic.transcript,
            lexical,
            grammar,
            worst_words,
            model=self.ollama_model,
            host=self.ollama_host,
        )

        metadata: dict[str, Any] = {}
        degraded: list[str] = []

        if judgment is not None:
            lr_band = judgment.lr_band
            gr_band = judgment.gr_band
            lr_feedback = judgment.lr_feedback
            gr_feedback = judgment.gr_feedback
            # Apply pronunciation tips to worst words
            for sent in acoustic.sentence_errors:
                for w in sent.word_errors:
                    tip = judgment.pronunciation_tips.get(w.word)
                    if tip:
                        w.fix_hint = tip
        else:
            degraded.append("ollama_lr_gr")
            lr_band = heuristic_lr_band(
                lexical.ttr_lemma, lexical.freq_tier_ratio, lexical.lexical_density
            )
            gr_band = heuristic_gr_band(
                grammar.lt_error_rate, grammar.subordination_ratio, grammar.mean_sentence_length
            )
            lr_feedback = "Lexical scoring based on text features (Ollama unavailable)."
            gr_feedback = "Grammar scoring based on text features (Ollama unavailable)."

        if degraded:
            metadata["degraded_features"] = degraded

        overall_band = _round_to_half(
            (fc_band + lr_band + gr_band + p_band) / 4
        )
        overall_band = max(1.0, min(9.0, overall_band))

        p_feedback = f"Pronunciation band: {p_band}."
        fc_feedback = f"Fluency and coherence band: {fc_band}."
        feedback = " ".join([fc_feedback, lr_feedback, gr_feedback, p_feedback])

        rubrics = {
            "FC": RubricScore(
                band=fc_band,
                feedback=fc_feedback,
                feature_evidence={
                    "fluency": acoustic.fluency,
                    "rhythm": acoustic.rhythm,
                    "discourse_marker_density": acoustic.discourse_marker_density,
                },
            ),
            "LR": RubricScore(
                band=lr_band,
                feedback=lr_feedback,
                feature_evidence={
                    "ttr_lemma": lexical.ttr_lemma,
                    "freq_tier_ratio": lexical.freq_tier_ratio,
                    "lexical_density": lexical.lexical_density,
                },
            ),
            "GR": RubricScore(
                band=gr_band,
                feedback=gr_feedback,
                feature_evidence={
                    "lt_error_rate": grammar.lt_error_rate,
                    "subordination_ratio": grammar.subordination_ratio,
                    "mean_sentence_length": grammar.mean_sentence_length,
                },
            ),
            "P": RubricScore(
                band=p_band,
                feedback=p_feedback,
                feature_evidence={
                    "segmental": acoustic.segmental,
                    "intelligibility": acoustic.intelligibility,
                    "prosody": acoustic.prosody,
                },
                sentence_errors=acoustic.sentence_errors,
            ),
        }

        return SpeakingScoringResult(
            overall_band=overall_band,
            rubrics=rubrics,
            feedback=feedback,
            metadata=metadata,
        )
