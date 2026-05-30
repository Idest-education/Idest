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
