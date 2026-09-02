# Speaking Grading Pipeline — Design Spec

**Date:** 2026-05-13
**Status:** Approved

## Overview

Replace the current OpenAI GPT-based speaking grader (running inside `apps/assignments` NestJS) with a structured, feature-driven pipeline running in `apps/ai` (Python/FastAPI). The new pipeline scores all four IELTS Speaking rubric dimensions:

- **FC** — Fluency and Coherence (acoustic + discourse markers)
- **LR** — Lexical Resource (text features + Ollama)
- **GR** — Grammatical Range and Accuracy (text features + Ollama)
- **P** — Pronunciation (acoustic pipeline, sentence-level word errors)

No labeled training data is required. No CatBoost models are used. Scoring is hybrid: P and FC are deterministic from acoustic signals; LR and GR use Ollama anchored by computed text features.

---

## Architecture

```
apps/assignments (NestJS)
  SpeakingService.submitResponse()
    └── publishes to "speaking_grade_queue" (RabbitMQ)
          { responseId, assignmentId, userId,
            audios: { audioOne?, audioTwo?, audioThree? } }

apps/ai (Python / FastAPI)
  SpeakingQueueConsumer              ← new, mirrors WritingQueueConsumer
    │
    ├── acoustic_features.py         ← wraps pronunciation/src/pipeline.py
    │     PronunciationPipeline.run(audio)
    │     → PronunciationScores { fluency, rhythm, prosody, segmental, intelligibility }
    │     → Whisper transcript (free byproduct)
    │     → sentence_errors (word-level pronunciation mistakes)
    │
    ├── lexical_features.py          ← adapted from writing_scorer/features/lexical_features.py
    │     TTR, word-frequency tier ratio, lexical density, mean word length
    │     → LR feature vector (passed as evidence to Ollama)
    │
    ├── grammar_features.py          ← adapted from writing_scorer/features/grammar_features.py
    │     LanguageTool error rate + error type breakdown
    │     spaCy dep-parse → clause count, subordination ratio, mean sentence length
    │     → GR feature vector (passed as evidence to Ollama)
    │
    ├── band_mapper.py               ← pure functions: feature values → IELTS band (1–9)
    │     map_pronunciation_band(scores)  → P band
    │     map_fluency_band(scores)        → FC band
    │
    └── ollama_judge.py              ← new, analogous to writing_scorer/llm_features.py
          transcript + LR features + GR features + top worst words
          → Ollama structured prompt
          → { lr_band, gr_band, lr_feedback, gr_feedback, pronunciation_tips }
```

### New file layout in `apps/ai/ielts_ai/`

```
ielts_ai/
  speaking_scorer/
    __init__.py
    features/
      __init__.py
      acoustic_features.py     # wraps pronunciation pipeline
      lexical_features.py      # TTR, freq tiers, lexical density
      grammar_features.py      # LanguageTool + spaCy
    band_mapper.py             # feature scores → IELTS 1–9 bands
    ollama_judge.py            # Ollama structured prompting for LR + GR
    scorer.py                  # SpeakingScorer orchestrator (returns ScoringResult)
  speaking_queue_consumer.py   # SpeakingQueueConsumer + maybe_start_speaking_queue_consumer()
```

### Pronunciation pipeline integration

`pronunciation/src/` is imported via `sys.path` manipulation inside `acoustic_features.py`, using `REPO_ROOT` from `ielts_ai/paths.py`. A minimal `pyproject.toml` is added to `pronunciation/` to make the package importable. Dependencies from `pronunciation/requirements.txt` are merged into `apps/ai/requirements.txt`.

---

## Data Flow

```
1. Student submits speaking response
   POST /speaking/submit (apps/assignments)
   → concatenate + upload audio to Supabase
   → create SpeakingSubmission { status: 'pending', audio_url }
   → publish to "speaking_grade_queue"

2. SpeakingQueueConsumer receives message
   → validate with Pydantic SpeakingGradeMessage
   → look up speaking_assignment in MongoDB (for title + parts context)
   → decode base64 audio parts → write temp .wav files
   → run PronunciationPipeline.run() per part (Whisper + CTC aligner)
   → merge per-part PronunciationReports (scores averaged by duration,
     transcripts concatenated in part order)
   → clean up temp files

3. Feature extraction on merged transcript + scores
   → acoustic_features: P + FC feature values + sentence_errors
   → lexical_features: TTR, freq-tier ratio, lexical density
   → grammar_features: LanguageTool error rate + spaCy parse signals

4. Band computation
   → band_mapper: P band + FC band (deterministic from acoustic features)
   → ollama_judge: transcript + LR/GR feature evidence → LR band + GR band
     fallback if Ollama unavailable: heuristic LR + GR bands from features alone

5. Result assembly
   overall_band = round_to_half(mean([FC, LR, GR, P]))
   feedback = combined narrative from band_mapper + ollama_judge

6. MongoDB write (direct PyMongo, same pattern as WritingQueueConsumer)
   speaking_submissions.update_one({ _id: responseId }, {
     $set: {
       score: overall_band,
       feedback: feedback_string,
       status: 'graded',
       updated_at: now,
       grading_breakdown: { ... }
     }
   })
   → on failure: status: 'failed'
```

---

## Feature Extraction & Band Mapping

### Pronunciation (P) — deterministic

Signals from `PronunciationPipeline.run()`:

| Signal | Description |
|--------|-------------|
| `segmental` | Phoneme-level accuracy (GOP scores, duration-weighted) |
| `intelligibility` | ASR confidence × alignment confidence × coverage |
| `stress` | Stressed vowel duration ratio |
| `prosody` | Composite of stress + fluency + rhythm |
| `reliability` | Confidence gate; low-reliability submissions flagged in metadata |

Band mapping:
```
P = 0.5 × segmental + 0.3 × intelligibility + 0.2 × prosody
Scaled [0, 100] → IELTS [1, 9] via piecewise linear curve
```

### Fluency & Coherence (FC) — deterministic

Acoustic signals:

| Signal | Description |
|--------|-------------|
| `fluency` | Words/min + pause gap distribution |
| `rhythm` | Word duration coefficient of variation |

Text signals (from transcript, reusing `discourse_marker_features`):

| Signal | Description |
|--------|-------------|
| `discourse_marker_density_score` | Linking words per clause |
| `n_reason_markers`, `n_contrast_markers`, `n_addition_markers` | Discourse category counts |

Band mapping:
```
FC = 0.45 × fluency + 0.25 × rhythm + 0.30 × discourse_marker_density
Scaled to IELTS [1, 9]
```

### Lexical Resource (LR) — Ollama-scored, feature-anchored

Features computed and passed as evidence to Ollama:

| Feature | Description |
|---------|-------------|
| `ttr_lemma` | Lemmatised type-token ratio |
| `freq_tier_ratio` | % of words in CEFR B2+ frequency band (wordfreq) |
| `lexical_density` | Content words / total words |
| `mean_word_length` | Proxy for morphological complexity |

### Grammatical Range & Accuracy (GR) — Ollama-scored, feature-anchored

Features computed and passed as evidence to Ollama:

| Feature | Description |
|---------|-------------|
| `lt_error_rate` | LanguageTool errors per 100 words |
| `lt_grammar_error_rate` | Grammar-only subset |
| `lt_spelling_error_rate` | Spelling-only subset |
| `clause_count` | Total clauses per sentence (spaCy dep parse) |
| `subordination_ratio` | Subordinate clauses / total clauses |
| `mean_sentence_length` | Words per sentence |

### Ollama prompt structure

```
System: You are an IELTS examiner. Score two rubric dimensions on a 1–9 band scale
        in 0.5 increments. Respond with JSON only.

User:
  Transcript:
  <merged transcript text>

  Measured signals:
  - Lexical: TTR={ttr_lemma:.2f}, freq_tier_ratio={:.2f}, lexical_density={:.2f}
  - Grammar: error_rate={lt_error_rate:.2f}/100w, grammar_errors={lt_grammar_error_rate:.2f},
             clause_count={clause_count}, subordination_ratio={subordination_ratio:.2f}

  Poorly pronounced words (for tips): environment (38), particularly (41), ...

  {
    "lr_band": <float>, "lr_feedback": "<string>",
    "gr_band": <float>, "gr_feedback": "<string>",
    "pronunciation_tips": { "<word>": "<fix tip>", ... }
  }
```

Fallback: if Ollama is unreachable or returns malformed JSON, heuristic bands are computed from features alone. Logged in `grading_breakdown.metadata.degraded_features`.

---

## Schema Changes

### `SpeakingSubmission` — new `grading_breakdown` field

```typescript
// apps/assignments/src/assignment/speaking/schemas/speaking-submission.schema.ts

@Schema({ _id: false })
class RubricFeedback {
  @Prop() band: number;
  @Prop() feedback: string;
  @Prop({ type: SchemaTypes.Mixed }) feature_evidence?: Record<string, number>;
  @Prop({ type: SchemaTypes.Mixed }) sentence_errors?: SentenceError[];  // P only
}

@Schema({ _id: false })
class SpeakingGradingBreakdown {
  @Prop() overall_band: number;
  @Prop({ type: SchemaTypes.Mixed })
  rubrics: {
    FC: RubricFeedback;
    LR: RubricFeedback;
    GR: RubricFeedback;
    P:  RubricFeedback;
  };
  @Prop({ type: SchemaTypes.Mixed }) metadata?: Record<string, any>;
}

// Added to SpeakingSubmission:
@Prop({ type: SpeakingGradingBreakdownSchema })
grading_breakdown?: SpeakingGradingBreakdown;
```

Existing `score` and `feedback` top-level fields are preserved unchanged for frontend compatibility.

### Pronunciation sentence-level errors (P rubric)

```json
"P": {
  "band": 6.0,
  "feedback": "Pronunciation is generally intelligible with some phoneme-level errors.",
  "feature_evidence": {
    "segmental": 71.2, "intelligibility": 68.4, "stress": 74.0, "fluency": 61.3
  },
  "sentence_errors": [
    {
      "sentence": "I think the environment is very important for future generations.",
      "start_time": 1.2,
      "end_time": 5.8,
      "word_errors": [
        {
          "word": "environment",
          "score": 38.4,
          "reference_ipa": "ɪnˈvaɪrənmənt",
          "problematic_phones": [
            { "phone": "aɪ", "score": 29.1 },
            { "phone": "ə",  "score": 41.7 }
          ],
          "fix_hint": "Stress the second syllable: en-VI-ron-ment. The vowel /aɪ/ sounds like 'eye'."
        }
      ]
    }
  ]
}
```

Sentence boundaries come from Whisper `TranscriptSegment` timestamps. Words with `segmental_score < 60` and `reliable = True` become `word_errors`. `fix_hint` is always populated rule-based from a phone confusion table (deterministic, no Ollama dependency). Additionally, the top 5 worst-scoring words are passed to Ollama in the LR/GR judging call; if Ollama returns `pronunciation_tips` for those words, those tips replace the rule-based `fix_hint` for that word only.

### `SpeakingAssignment` — no changes required

### New environment variables in `apps/ai/.env`

```
SPEAKING_GRADE_QUEUE=speaking_grade_queue
ENABLE_SPEAKING_QUEUE_CONSUMER=true
OLLAMA_HOST=http://localhost:11434
OLLAMA_SPEAKING_MODEL=llama3
```

### `apps/assignments` queue change

```typescript
// SpeakingService.submitResponse() — one line change:
// Before:
await this.rabbitService.send('grade_queue', { skill: 'speaking', ... });
// After:
await this.rabbitService.send('speaking_grade_queue', { ... });
```

`GradeService.gradeSpeaking()` is removed. `SpeakingService` injection in `GradeService` is removed. `GradeService.speechToText()` (used by the controller's direct STT endpoint) is kept.

---

## Testing Strategy

### Contract tests (highest value)

`test_speaking_queue_consumer_contract.py`:
- Sends real RabbitMQ message with small base64 audio fixture
- Asserts `status` transitions `pending` → `graded`
- Asserts `grading_breakdown` has all four rubric keys with `band`, `feedback`, `feature_evidence`
- Asserts `sentence_errors` is a list
- Asserts `score` is float in `[1.0, 9.0]` rounded to 0.5
- Runs with `OLLAMA_SPEAKING_MODEL=` unset to test heuristic fallback

`test_pronunciation_sentence_errors.py`:
- Uses `pronunciation/voice-sample.wav` fixture
- Asserts `sentence_errors` contains entries for audio of sufficient length
- Asserts each `word_error` has `word`, `score`, `reference_ipa`, `fix_hint`
- Does not assert specific words (acoustic output varies by model version)

### Unit tests

`test_band_mapper.py` — pure function tests with known feature vectors → expected band ranges, 0.5 rounding, `[1, 9]` clip.

`test_ollama_judge.py` — mocked Ollama HTTP calls, malformed JSON fallback, connection refused fallback.

`test_lexical_features.py`, `test_grammar_features.py` — short transcript fixtures, assert feature names and value ranges.

### Intentionally not tested

- Absolute band accuracy against gold IELTS standard (no labeled data)
- Ollama model quality or response coherence
- Pronunciation pipeline internals (tested separately in `pronunciation/`)
- MongoDB schema validation (handled by Mongoose in `apps/assignments`)

---

## Phased Rollout

### Phase 1 — Infrastructure

- Add `pyproject.toml` to `pronunciation/`
- Create `ielts_ai/speaking_scorer/` skeleton with stub implementations
- Create `SpeakingQueueConsumer` reading from `speaking_grade_queue`, writing placeholder scores
- Update `api.py` startup to call `maybe_start_speaking_queue_consumer()`
- Update `SpeakingService.submitResponse()` to publish to `speaking_grade_queue`
- Remove `gradeSpeaking()` from `GradeService`
- Add `grading_breakdown` field to `SpeakingSubmission` schema (optional, ignored by frontend)
- Verify queue messages flow end-to-end

### Phase 2 — Pronunciation + FC scoring

- Implement `acoustic_features.py` with real `PronunciationPipeline` import
- Implement `band_mapper.py` with P and FC band functions
- Implement sentence-level `word_errors` extraction
- P and FC bands are real; LR and GR stubbed to `5.0`
- Contract test green against real audio fixture
- Validate band outputs manually against real student recordings

### Phase 3 — LR + GR + Ollama

- Implement `lexical_features.py` and `grammar_features.py`
- Implement `ollama_judge.py` with heuristic fallback
- Wire all four dimensions into `SpeakingScorer`
- Update frontend to display `grading_breakdown.rubrics` and `sentence_errors`
- Full contract test suite green including Ollama fallback path

---

## Technical Debt

| Item | Risk | Mitigation |
|------|------|------------|
| Band thresholds in `band_mapper.py` are hand-crafted | FC and P bands may not align with real IELTS examiner scores | Flag for recalibration once ~50 graded submissions exist; all thresholds in one file |
| `pronunciation/` added to `sys.path` in `acoustic_features.py` | Fragile if monorepo layout changes | Acceptable short-term; migrate to editable install when `pronunciation/` matures |
| Ollama is optional/local | Grading degrades silently to heuristic LR/GR if Ollama is down | `degraded_features` logged in `grading_breakdown.metadata`; monitor in production |
| LanguageTool JVM startup cost | First GR extraction per process is slow (~3–5s) | `get_languagetool()` uses `@lru_cache(maxsize=1)`, same pattern as writing pipeline |
| No deduplication on queue retry | Consumer crash + redeliver causes second run to overwrite first | Acceptable — idempotent `update_one` on `_id`; both runs produce valid output |
| `SpeakingAssignment.parts` has only `question` string | Ollama prompt has no per-part structured context | Feed `title + parts[].question` as context; richer schema is a future improvement |
