from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class PhoneAssessment:
    token: str          # IPA phone
    score: float        # 0–100
    status: str         # "match" | "substitution" | "missing" | "extra"


@dataclass
class WordAssessment:
    word: str
    start: float | None
    end: float | None
    reliable: bool
    segmental_score: float          # 0–100
    phones: list[PhoneAssessment] = field(default_factory=list)


@dataclass
class TranscriptSegment:
    start: float
    end: float
    text: str


@dataclass
class WordTiming:
    word: str
    start: float
    end: float
    probability: float


@dataclass
class AudioQuality:
    duration_seconds: float
    rms_db: float
    is_reliable: bool


@dataclass
class Reliability:
    overall: float      # 0–1


@dataclass
class FluencyMetrics:
    hesitation_count: int
    pause_count: int
    filler_word_count: int
    repeated_word_count: int
    speech_rate_wpm: float
    rhythm_consistency: float       # 0–100


@dataclass
class PronunciationScores:
    segmental: float
    intelligibility: float
    stress: float
    prosody: float
    fluency: float
    rhythm: float


def aggregate_scores(
    words: list["WordAssessment"],
    fluency: "FluencyMetrics",
    audio_quality: "AudioQuality",
) -> "PronunciationScores":
    reliable = [w for w in words if w.reliable]
    scored = reliable or words
    segmental = sum(w.segmental_score for w in scored) / len(scored) if scored else 0.0

    # intelligibility: share of words scoring above an intelligibility floor
    if scored:
        intelligibility = 100.0 * sum(1 for w in scored if w.segmental_score >= 50.0) / len(scored)
    else:
        intelligibility = 0.0

    rhythm = fluency.rhythm_consistency

    # fluency 0–100: penalise fillers/pauses/hesitations, reward a natural speech rate
    rate = fluency.speech_rate_wpm
    rate_score = max(0.0, 100.0 - abs(rate - 130.0) * 0.6)  # ~130 wpm ideal
    penalty = (fluency.filler_word_count * 4.0
               + fluency.pause_count * 3.0
               + fluency.hesitation_count * 5.0
               + fluency.repeated_word_count * 3.0)
    fluency_score = max(0.0, min(100.0, 0.6 * rate_score + 0.4 * rhythm - penalty))

    # stress / prosody proxies until a dedicated model is swapped in
    stress = max(0.0, min(100.0, 0.5 * segmental + 0.5 * rhythm))
    prosody = max(0.0, min(100.0, 0.4 * rhythm + 0.4 * fluency_score + 0.2 * segmental))

    return PronunciationScores(
        segmental=round(segmental, 2),
        intelligibility=round(intelligibility, 2),
        stress=round(stress, 2),
        prosody=round(prosody, 2),
        fluency=round(fluency_score, 2),
        rhythm=round(rhythm, 2),
    )


def compute_reliability(
    words: list["WordAssessment"],
    audio_quality: "AudioQuality",
) -> "Reliability":
    if not words:
        return Reliability(overall=0.0)
    reliable_ratio = sum(1 for w in words if w.reliable) / len(words)
    audio_factor = 1.0 if audio_quality.is_reliable else 0.4
    overall = max(0.0, min(1.0, reliable_ratio * audio_factor))
    return Reliability(overall=round(overall, 3))
