from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

import requests

from ielts_ai.speaking_scorer.features.grammar_features import GrammarFeatures
from ielts_ai.speaking_scorer.features.lexical_features import LexicalFeatures

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are an IELTS examiner. Score Lexical Resource (LR) and Grammatical Range and Accuracy (GR) "
    "on a 1–9 band scale in 0.5 increments. Use the measured signals as evidence to anchor your judgment. "
    "Respond with JSON only — no markdown, no explanation outside the JSON."
)


@dataclass
class OllamaJudgment:
    lr_band: float
    gr_band: float
    lr_feedback: str
    gr_feedback: str
    pronunciation_tips: dict[str, str] = field(default_factory=dict)


def _build_user_message(
    transcript: str,
    lexical: LexicalFeatures,
    grammar: GrammarFeatures,
    worst_words: list,
) -> str:
    words_str = ", ".join(f"{w.word} (score {w.score:.0f})" for w in worst_words[:5]) or "none"
    return (
        f"Transcript:\n{transcript}\n\n"
        f"Measured signals:\n"
        f"- Lexical: TTR={lexical.ttr_lemma:.2f}, freq_tier_ratio={lexical.freq_tier_ratio:.2f}, "
        f"lexical_density={lexical.lexical_density:.2f}\n"
        f"- Grammar: error_rate={grammar.lt_error_rate:.2f}/100w, "
        f"grammar_errors={grammar.lt_grammar_error_rate:.2f}, "
        f"clause_count={grammar.clause_count:.1f}, "
        f"subordination_ratio={grammar.subordination_ratio:.2f}\n\n"
        f"Poorly pronounced words (provide fix tips if any): {words_str}\n\n"
        'Respond with this JSON only:\n'
        '{"lr_band": <float>, "lr_feedback": "<string>", '
        '"gr_band": <float>, "gr_feedback": "<string>", '
        '"pronunciation_tips": {"<word>": "<tip>"}}'
    )


def judge(
    transcript: str,
    lexical: LexicalFeatures,
    grammar: GrammarFeatures,
    worst_words: list,
    model: str,
    host: str = "http://localhost:11434",
    timeout: int = 30,
) -> OllamaJudgment | None:
    if not model:
        return None

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_message(transcript, lexical, grammar, worst_words)},
        ],
        "stream": False,
    }

    try:
        response = requests.post(f"{host}/api/chat", json=payload, timeout=timeout)
        response.raise_for_status()
        content = response.json()["message"]["content"]
        data = json.loads(content)
    except Exception as exc:
        logger.warning("Ollama judge failed: %s", exc)
        return None

    try:
        return OllamaJudgment(
            lr_band=float(data["lr_band"]),
            gr_band=float(data["gr_band"]),
            lr_feedback=str(data.get("lr_feedback", "")),
            gr_feedback=str(data.get("gr_feedback", "")),
            pronunciation_tips=dict(data.get("pronunciation_tips") or {}),
        )
    except (KeyError, TypeError, ValueError) as exc:
        logger.warning("Ollama judge returned unexpected shape: %s — %s", data, exc)
        return None
