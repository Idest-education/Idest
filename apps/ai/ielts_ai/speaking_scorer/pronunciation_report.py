from __future__ import annotations

import difflib
from typing import Any

from ielts_ai.speaking_scorer.band_mapper import scale_to_ielts_band
from ielts_ai.speaking_scorer.features.acoustic_features import AcousticFeatures

_HESITATION_FEEDBACK_THRESHOLD = 4
_FILLER_FEEDBACK_THRESHOLD = 3
_GOOD_RHYTHM_THRESHOLD = 65.0


def _mispronunciation_feedback(raw: str, intended: str) -> list[str]:
    """Diff raw ASR vs intended transcript at word level -> 'Mispronounced X as Y'."""
    raw_words = raw.lower().split()
    intended_words = intended.lower().split()
    sm = difflib.SequenceMatcher(a=intended_words, b=raw_words)
    out: list[str] = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "replace":
            for intended_w, heard_w in zip(intended_words[i1:i2], raw_words[j1:j2]):
                if intended_w != heard_w:
                    out.append(f"Mispronounced '{intended_w}' as '{heard_w}'")
    return out[:3]


def build_pronunciation_report(acoustic: AcousticFeatures) -> dict[str, Any]:
    accuracy = round(acoustic.segmental)
    fluency = round(acoustic.fluency)
    band = scale_to_ielts_band(0.7 * acoustic.segmental + 0.3 * acoustic.fluency)

    feedback: list[str] = []
    feedback.extend(_mispronunciation_feedback(acoustic.transcript, acoustic.intended_transcript))

    # phone-level evidence from worst sentence-error words (if any)
    for sent in acoustic.sentence_errors:
        for w in sent.word_errors:
            if w.problematic_phones:
                worst = w.problematic_phones[0]
                feedback.append(f"Work on the /{worst.phone}/ sound in '{w.word}'")
                break
        if len(feedback) >= 4:
            break

    if acoustic.hesitation_count >= _HESITATION_FEEDBACK_THRESHOLD:
        feedback.append("Frequent hesitation before longer sentences")
    if acoustic.filler_word_count >= _FILLER_FEEDBACK_THRESHOLD:
        feedback.append("Reduce filler words such as 'um' and 'uh'")
    if acoustic.rhythm >= _GOOD_RHYTHM_THRESHOLD:
        feedback.append("Good overall speech rhythm")

    if not feedback:
        feedback.append("Clear pronunciation overall — keep practicing for consistency")

    return {
        "predictedTranscript": acoustic.intended_transcript,
        "bandScore": band,
        "pronunciationAccuracy": accuracy,
        "fluencyScore": fluency,
        "hesitationCount": acoustic.hesitation_count,
        "pauseCount": acoustic.pause_count,
        "fillerWordCount": acoustic.filler_word_count,
        "feedback": feedback,
    }
