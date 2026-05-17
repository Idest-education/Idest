from __future__ import annotations

import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

from ielts_ai.paths import REPO_ROOT
from ielts_ai.writing_scorer.features.task_achievement_features import discourse_marker_features

_PRONUNCIATION_ROOT = REPO_ROOT / "pronunciation"
if str(_PRONUNCIATION_ROOT) not in sys.path:
    sys.path.insert(0, str(_PRONUNCIATION_ROOT))

from src.pipeline import PronunciationPipeline, PronunciationReport  # noqa: E402
from src.scoring import PhoneAssessment, WordAssessment  # noqa: E402

_WORD_ERROR_THRESHOLD = 60.0

_WAV_MIMETYPES = {"audio/wav", "audio/x-wav", "audio/wave"}

_PHONE_FIX_HINTS: dict[str, str] = {
    "θ": "Place the tip of your tongue between your teeth for 'th' (as in 'think').",
    "ð": "Use a voiced 'th' — tongue between teeth with voice on (as in 'this').",
    "æ": "Open your mouth wider for /æ/, as in 'cat' — not like 'bet'.",
    "ɪ": "Keep /ɪ/ short and relaxed, as in 'sit' — not the long /iː/ in 'seat'.",
    "ʌ": "Raise your tongue slightly for /ʌ/, as in 'cup'.",
    "r": "Curl your tongue back slightly for English /r/ — don't trill it.",
    "l": "Place your tongue tip behind your upper front teeth for /l/.",
    "w": "Round your lips and don't let teeth touch your lip — /w/ as in 'wine'.",
    "v": "Touch your upper teeth to your lower lip for /v/, as in 'vine'.",
    "aɪ": "The /aɪ/ diphthong glides from 'ah' to 'ee', as in 'eye' or 'time'.",
    "eɪ": "The /eɪ/ diphthong glides from 'eh' to 'ee', as in 'day' or 'name'.",
    "ɔː": "Round your lips and hold /ɔː/ long, as in 'law' or 'thought'.",
    "ə": "The schwa /ə/ is short and unstressed — the 'a' sound in 'about'.",
    "ʃ": "Round your lips slightly and push air through for /ʃ/, as in 'she'.",
    "ʒ": "Like /ʃ/ but voiced — as in 'measure' or 'vision'.",
    "tʃ": "Start with /t/ then release into /ʃ/ for 'ch', as in 'chair'.",
    "dʒ": "Start with /d/ then release into /ʒ/ for 'j', as in 'jump'.",
}


@dataclass
class ProblematicPhone:
    phone: str
    score: float


@dataclass
class WordError:
    word: str
    score: float
    reference_ipa: str
    problematic_phones: list[ProblematicPhone]
    fix_hint: str


@dataclass
class SentenceError:
    sentence: str
    start_time: float
    end_time: float
    word_errors: list[WordError]


@dataclass
class AcousticFeatures:
    segmental: float
    intelligibility: float
    stress: float
    prosody: float
    reliability: float
    fluency: float
    rhythm: float
    discourse_marker_density: float  # 0-100 scaled
    transcript: str
    sentence_errors: list[SentenceError]


_pipeline: PronunciationPipeline | None = None


def _get_pipeline() -> PronunciationPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = PronunciationPipeline()
    return _pipeline


def _build_fix_hint(bad_phones: list[PhoneAssessment]) -> str:
    if not bad_phones:
        return "Focus on producing each sound clearly and distinctly."
    worst = min(bad_phones, key=lambda p: p.score)
    hint = _PHONE_FIX_HINTS.get(worst.token)
    return hint or f"Practice the /{worst.token}/ sound — try it slowly in isolation first."


def _build_sentence_errors(report: PronunciationReport, time_offset: float = 0.0) -> list[SentenceError]:
    errors: list[SentenceError] = []
    for seg in report.transcript_segments:
        seg_words = [
            w for w in report.words
            if w.start is not None
            and w.end is not None
            and seg.start <= (w.start + w.end) / 2 <= seg.end
        ]
        word_errors: list[WordError] = []
        for word in seg_words:
            if not word.reliable or word.segmental_score >= _WORD_ERROR_THRESHOLD:
                continue
            bad_phones = sorted(
                [p for p in word.phones if p.score < _WORD_ERROR_THRESHOLD],
                key=lambda p: p.score,
            )
            word_errors.append(WordError(
                word=word.word,
                score=round(word.segmental_score, 1),
                reference_ipa=" ".join(p.token for p in word.phones),
                problematic_phones=[
                    ProblematicPhone(phone=p.token, score=round(p.score, 1))
                    for p in bad_phones[:3]
                ],
                fix_hint=_build_fix_hint(bad_phones),
            ))
        if word_errors:
            errors.append(SentenceError(
                sentence=seg.text.strip(),
                start_time=round(seg.start + time_offset, 2),
                end_time=round(seg.end + time_offset, 2),
                word_errors=word_errors,
            ))
    return errors


def _merge_features(
    reports: list[PronunciationReport],
    durations: list[float],
) -> AcousticFeatures:
    total_dur = max(sum(durations), 1e-6)
    weights = [d / total_dur for d in durations]

    def wavg(attr: str) -> float:
        return sum(getattr(r.scores, attr) * w for r, w in zip(reports, weights))

    transcript = " ".join(r.transcript for r in reports if r.transcript)
    # TODO: discourse_marker_features is tuned for written essays; applying it to
    # speech transcripts is an approximation. Replace with a speech-specific
    # discourse marker ratio once 50+ graded submissions exist for recalibration.
    dm = discourse_marker_features(transcript)
    discourse_density = min(100.0, dm["discourse_marker_density_score"] * 100.0)

    sentence_errors: list[SentenceError] = []
    time_offset = 0.0
    for report, dur in zip(reports, durations):
        sentence_errors.extend(_build_sentence_errors(report, time_offset))
        time_offset += dur

    return AcousticFeatures(
        segmental=wavg("segmental"),
        intelligibility=wavg("intelligibility"),
        stress=wavg("stress"),
        prosody=wavg("prosody"),
        reliability=sum(r.reliability.overall * w for r, w in zip(reports, weights)),
        fluency=wavg("fluency"),
        rhythm=wavg("rhythm"),
        discourse_marker_density=discourse_density,
        transcript=transcript,
        sentence_errors=sentence_errors,
    )


def extract_acoustic_features(
    audio_parts: list[bytes],
    mimetypes: list[str],
) -> AcousticFeatures:
    """Run pronunciation pipeline on one or more audio parts; merge and return features."""
    if not audio_parts:
        raise ValueError("No audio parts provided")

    pipeline = _get_pipeline()
    reports: list[PronunciationReport] = []
    durations: list[float] = []

    for audio_bytes, mimetype in zip(audio_parts, mimetypes):
        suffix = ".wav" if mimetype in _WAV_MIMETYPES else ".webm"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = Path(tmp.name)
        try:
            report = pipeline.run(tmp_path)
            reports.append(report)
            durations.append(report.audio_quality.duration_seconds)
        finally:
            tmp_path.unlink(missing_ok=True)

    return _merge_features(reports, durations)
