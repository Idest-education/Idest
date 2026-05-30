# Pronunciation Module Rebuild + Two-Flow Report — Design

**Date:** 2026-05-30
**Status:** Approved (design), pending implementation plan
**App:** `apps/ai` (FastAPI ML service) + standalone `pronunciation/` package

## Problem

The standalone `pronunciation/` package — described in `CLAUDE.md` as "Standalone Python, `python main.py --audio voice-sample.wav`" — was accidentally deleted. It was never committed to git, so it cannot be recovered from history and must be rebuilt.

The deletion broke the build: `apps/ai/ielts_ai/speaking_scorer/features/acoustic_features.py` imports from the missing package:

```python
from src.pipeline import PronunciationPipeline, PronunciationReport
from src.scoring import PhoneAssessment, WordAssessment
```

The speaking grading flow (RabbitMQ consumer → `SpeakingScorer` → `acoustic_features` → band mappers → Mongo `speaking_submissions.grading_breakdown` → Next.js result page) is therefore non-functional until the package is restored.

## Goals

1. **Restore `pronunciation/`** so the existing P (Pronunciation) and FC (Fluency & Coherence) scoring works again — i.e. satisfy the interface that `acoustic_features.py` imports.
2. **Add a two-flow pronunciation report** (per the requested spec) additively into `grading_breakdown.pronunciation_report`, without changing the existing FC/LR/GR/P output or the frontend.

## Non-Goals

- Changing the existing `grading_breakdown` shape (FC/LR/GR/P + `sentence_errors`). The just-built Next.js result page depends on it and must keep rendering.
- Adding a frontend section to display the new report. That is a possible follow-up, out of scope here.
- Adding new external service dependencies or `requirements.txt` entries.
- Re-tuning band-score weights against real graded data (placeholder weights now; recalibrate later).

## Key Decisions (resolved during brainstorming)

| Decision | Choice |
|---|---|
| Scope vs. exact old interface | Redesign the pronunciation engine cleanly along Flow A / Flow B lines. |
| Downstream output contract | **Add a separate pronunciation report** additively; keep FC/LR/GR/P intact. |
| LLM for Flow A Step A2 (intent prediction) | **Reuse Ollama** (same setup as `ollama_judge.py`) with graceful degradation. |
| Forced-alignment algorithm | **Needleman–Wunsch edit-distance** over IPA, behind a swappable interface. |

## Interface Contract (must be preserved)

The rebuilt package must expose exactly what `acoustic_features.py` consumes:

- `src.pipeline.PronunciationPipeline` — `__init__(...)` + `.run(audio_path: Path) -> PronunciationReport`
- `src.pipeline.PronunciationReport`:
  - `.transcript: str`
  - `.transcript_segments: list` — each item `.start: float`, `.end: float`, `.text: str`
  - `.words: list[WordAssessment]`
  - `.audio_quality` — `.duration_seconds: float`
  - `.reliability` — `.overall: float`
  - `.scores` — `.segmental`, `.intelligibility`, `.stress`, `.prosody`, `.fluency`, `.rhythm` (each 0–100)
- `src.scoring.WordAssessment` — `.word: str`, `.start: float | None`, `.end: float | None`, `.reliable: bool`, `.segmental_score: float`, `.phones: list[PhoneAssessment]`
- `src.scoring.PhoneAssessment` — `.token: str`, `.score: float` (0–100)

New fields added to `PronunciationReport` for the two-flow report (additive, ignored by the legacy path):

- `.intended_transcript: str` — the LLM-corrected transcript (Flow A2)
- `.fluency_metrics` — `hesitation_count: int`, `pause_count: int`, `filler_word_count: int`, `speech_rate_wpm: float`, `rhythm_consistency: float`

## Architecture

### Package layout

```
pronunciation/
  main.py                 # CLI: python main.py --audio voice-sample.wav
  voice-sample.wav        # regenerated test fixture (short English utterance)
  src/
    __init__.py
    pipeline.py     # PronunciationPipeline + PronunciationReport  (orchestrator)
    asr.py          # Flow A1 — WhisperTranscriber: audio -> transcript, segments, word timestamps
    intent.py       # Flow A2 — TranscriptCorrector: Ollama intent prediction (+ graceful fallback)
    phonemes.py     # Flow B1 — PhonemeRecognizer: wav2vec2 audio -> phoneme seq + posteriors
    g2p.py          # ReferenceG2P: phonemizer text -> reference IPA per word
    alignment.py    # Flow B2 — ForcedAligner: reference vs recognized phones -> Word/PhoneAssessment
    fluency.py      # Flow B3 — FluencyAnalyzer: pauses, hesitations, fillers, repeats, rate, rhythm
    audio.py        # AudioQuality + loading + reliability
    scoring.py      # PhoneAssessment, WordAssessment, dataclasses + score aggregation
```

Each component is constructor-injected into `PronunciationPipeline`. The STT, phoneme, and LLM backends sit behind their own module interfaces so they can be swapped without touching the orchestrator.

### Data flow

```
audio.wav
  |- Flow A1 Whisper ----> raw transcript + word timestamps -----+
  |                                                              +--> A2 Ollama --> predictedTranscript
  |- Flow B1 wav2vec2 ---> recognized phonemes + posteriors -----+                       |
  |                                                                                      v
  predicted transcript --> G2P --> reference IPA --> B2 ForcedAligner --> per-word/phone scores
  word timestamps + audio -------------------------> B3 FluencyAnalyzer --> fluency metrics
                                                                                      |
                                            PronunciationReport (scores, words, reliability,
                                            audio_quality, intended_transcript, fluency_metrics)
                              |- extract_acoustic_features() -> AcousticFeatures  (existing, unchanged)
                              |- build_pronunciation_report() -> {bandScore, pronunciationAccuracy,
                                                                  fluencyScore, feedback[]}  (NEW)
```

- **Flow A1 and B1 run concurrently** via `ThreadPoolExecutor` (torch releases the GIL during inference). Flow B2 joins on A2 + B1. A correct sequential fallback is acceptable; concurrency is an optimization.
- **Mispronunciation feedback** ("Mispronounced 'fast' as 'fat'") is derived by diffing the *raw* Whisper transcript against the *corrected* predicted transcript at word level. Flow A produces both.

### Flow A — Intended transcript prediction

- **A1 `WhisperTranscriber`** (`asr.py`): `faster-whisper` → `transcript`, `transcript_segments[]`, and `words[]` with start/end timestamps. Word timestamps feed both fluency analysis (B3) and per-word scoring.
- **A2 `TranscriptCorrector`** (`intent.py`): sends the raw transcript to Ollama (`OLLAMA_SPEAKING_MODEL` / `OLLAMA_HOST`, reusing the `ollama_judge.py` connection pattern) and asks for the most likely *intended* words. On any failure (Ollama down, timeout, malformed response) it returns the raw transcript unchanged and the pipeline flags `degraded_features: ["ollama_intent"]`.

### Flow B — Pronunciation assessment

- **B1 `PhonemeRecognizer`** (`phonemes.py`): wav2vec2 phoneme-CTC model (`facebook/wav2vec2-lv-60-espeak-cv-ft`) → recognized phoneme sequence + frame posteriors used for per-phone confidence.
- **G2P `ReferenceG2P`** (`g2p.py`): `phonemizer` (espeak backend) converts the predicted transcript into reference IPA, per word.
- **B2 `ForcedAligner`** (`alignment.py`): Needleman–Wunsch alignment between reference IPA and recognized IPA → per-word `WordAssessment` and per-phone `PhoneAssessment`, classifying each phone as match / substitution / missing / extra. Per-phone `score` comes from wav2vec2 posteriors. Behind an interface so a later swap to `torchaudio.functional.forced_align` or a GOP toolkit is a localized change.
- **B3 `FluencyAnalyzer`** (`fluency.py`): from word timestamps + `librosa` energy:
  - `hesitation_count` — long inter-word gaps before content words
  - `pause_count` — silences above a threshold
  - `filler_word_count` — "um", "uh", "er", etc. from the transcript
  - repeated-word detection
  - `speech_rate_wpm`
  - `rhythm_consistency` — variance of inter-word/syllable intervals

### Score aggregation (`scoring.py`)

Aggregates B2/B3 outputs into the 0–100 `scores` the contract requires (`segmental`, `intelligibility`, `stress`, `prosody`, `fluency`, `rhythm`) plus `reliability.overall` (driven by audio quality + posterior confidence + transcript non-emptiness).

### The two-flow report builder

A new module in `apps/ai/ielts_ai/speaking_scorer/` (e.g. `pronunciation_report.py`) maps `PronunciationReport` → the requested output:

```json
{
  "predictedTranscript": "the car is fast",
  "bandScore": 7.5,
  "pronunciationAccuracy": 82,
  "fluencyScore": 78,
  "hesitationCount": 3,
  "pauseCount": 5,
  "fillerWordCount": 2,
  "feedback": [
    "Mispronounced 'fast' as 'fat'",
    "Frequent hesitation before longer sentences",
    "Good overall speech rhythm"
  ]
}
```

- `pronunciationAccuracy` ← `scores.segmental`; `fluencyScore` ← `scores.fluency`.
- `bandScore = scale_to_ielts_band(0.7 * pronunciationAccuracy + 0.3 * fluencyScore)` — **placeholder weights, to be recalibrated** (consistent with the existing `# TODO recalibrate` note in `acoustic_features.py`). Reuses `band_mapper._scale_to_ielts_band`.
- `feedback[]` assembled from: top mispronounced words (raw-vs-predicted diff + worst phones), notable fluency observations (hesitations, pauses, fillers), and a rhythm comment.

## Integration Points (minimal, additive)

- `apps/ai/ielts_ai/speaking_scorer/scorer.py`: attach the report to `SpeakingScoringResult.metadata["pronunciation_report"]`.
- `apps/ai/ielts_ai/speaking_queue_consumer.py`: write it to `grading_breakdown["pronunciation_report"]`. FC/LR/GR/P and `sentence_errors` untouched → existing result page keeps rendering.
- `acoustic_features.py`: unchanged behavior; continues to consume `PronunciationReport` via the preserved contract.

## Error Handling, Logging, Reliability

- Per-stage `try/except` with structured logs scoped to each component.
- Ollama unavailable (Flow A2) → raw transcript fallback + `degraded_features: ["ollama_intent"]`.
- Empty transcript / low-confidence audio → reflected in `reliability.overall`; downstream `WordAssessment.reliable` gates whether a word contributes to error reporting.
- Temp audio files are always cleaned up (`finally` unlink) — already asserted by `test_no_temp_files_left_behind`.
- The queue consumer's existing `_mark_failed` handles unrecoverable pipeline errors (status `failed`, ack to avoid redelivery loops).

## Testing

**Unit tests (mocked models — fast):**
- `intent.py`: Ollama success path + graceful fallback on failure.
- `alignment.py`: Needleman–Wunsch over synthetic phone sequences — match / substitution / missing / extra.
- `fluency.py`: metrics from synthetic word-timestamp lists (fillers, pauses, rate, repeats).
- `scoring.py`: aggregation maps to 0–100 ranges; reliability behavior.
- report builder: maps a fixture `PronunciationReport` to the expected JSON shape, including raw-vs-predicted mispronunciation feedback.

**Integration tests (slow, real models — `@pytest.mark.slow`):**
- Existing `test_acoustic_features.py` keeps passing once models + `voice-sample.wav` are present.
- A new slow test asserts the two-flow report shape end-to-end.

## Assumptions

1. **Phoneme model**: `facebook/wav2vec2-lv-60-espeak-cv-ft` (eSpeak-IPA output, pairs with phonemizer's espeak backend). Swappable behind `PhonemeRecognizer`.
2. **`voice-sample.wav`** was deleted with the package and is not in git; it will be regenerated as a short English-utterance WAV fixture.
3. **Band-score weights** are placeholders pending recalibration against graded submissions.
4. **No new dependencies** — uses only what `requirements.txt` already pins (faster-whisper, transformers/torch/torchaudio, phonemizer, librosa, soundfile, ollama).
5. The espeak backend for `phonemizer` is available in the runtime/Docker image (already implied by `phonemizer` being a dependency).
