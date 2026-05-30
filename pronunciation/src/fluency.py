from __future__ import annotations

import statistics

from src.scoring import WordTiming, FluencyMetrics

FILLERS = {"um", "uh", "er", "erm", "hmm", "uhh", "umm", "ah", "eh", "mm"}

_PAUSE_THRESHOLD_S = 0.8        # gap longer than this counts as a pause
_HESITATION_THRESHOLD_S = 1.5   # a pre-word gap this long counts as hesitation


def _clean(word: str) -> str:
    return word.strip().lower().strip(".,!?;:\"'")


def analyze_fluency(words: list[WordTiming], duration: float) -> FluencyMetrics:
    cleaned = [_clean(w.word) for w in words]

    filler_word_count = sum(1 for w in cleaned if w in FILLERS)

    repeated_word_count = sum(
        1 for a, b in zip(cleaned, cleaned[1:]) if a == b and a and a not in FILLERS
    )

    gaps = [b.start - a.end for a, b in zip(words, words[1:]) if b.start > a.end]
    pause_count = sum(1 for g in gaps if g >= _PAUSE_THRESHOLD_S)
    hesitation_count = sum(1 for g in gaps if g >= _HESITATION_THRESHOLD_S)

    speech_rate_wpm = (len(words) / duration * 60.0) if duration > 0 else 0.0

    # rhythm consistency: lower variance of word durations -> higher score
    durations = [w.end - w.start for w in words if w.end > w.start]
    if len(durations) >= 2:
        cv = statistics.pstdev(durations) / max(statistics.mean(durations), 1e-6)
        rhythm_consistency = max(0.0, min(100.0, 100.0 - cv * 60.0))
    else:
        rhythm_consistency = 50.0

    return FluencyMetrics(
        hesitation_count=hesitation_count,
        pause_count=pause_count,
        filler_word_count=filler_word_count,
        repeated_word_count=repeated_word_count,
        speech_rate_wpm=round(speech_rate_wpm, 2),
        rhythm_consistency=round(rhythm_consistency, 2),
    )
