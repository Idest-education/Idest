# Speaking Grading Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the OpenAI GPT speaking grader in `apps/assignments` with a hybrid Python pipeline in `apps/ai` that scores IELTS speaking submissions across FC, LR, GR, and P rubrics using acoustic features + Ollama.

**Architecture:** `SpeakingQueueConsumer` in `apps/ai` reads from `speaking_grade_queue`, runs the `pronunciation/` pipeline for P and FC signals, extracts lexical/grammar features from the transcript, calls Ollama for LR and GR bands, then writes `grading_breakdown` to MongoDB. `apps/assignments` publishes to the new queue and no longer grades speaking internally.

**Tech Stack:** Python 3.11, FastAPI, pika (RabbitMQ), PyMongo, faster-whisper, spaCy (en_core_web_sm), wordfreq, language-tool-python, requests (Ollama HTTP), TypeScript/NestJS (queue name change + schema update).

**Spec:** `docs/superpowers/specs/2026-05-13-speaking-grading-design.md`

---

## File Map

**Create:**
- `pronunciation/pyproject.toml` — makes pronunciation importable as a package
- `apps/ai/ielts_ai/speaking_scorer/__init__.py`
- `apps/ai/ielts_ai/speaking_scorer/features/__init__.py`
- `apps/ai/ielts_ai/speaking_scorer/features/acoustic_features.py` — wraps PronunciationPipeline, returns AcousticFeatures + sentence_errors
- `apps/ai/ielts_ai/speaking_scorer/features/lexical_features.py` — TTR, freq tier, lexical density via spaCy + wordfreq
- `apps/ai/ielts_ai/speaking_scorer/features/grammar_features.py` — LanguageTool + spaCy dep parse
- `apps/ai/ielts_ai/speaking_scorer/band_mapper.py` — pure functions mapping feature scores to IELTS bands
- `apps/ai/ielts_ai/speaking_scorer/ollama_judge.py` — Ollama HTTP call for LR + GR bands
- `apps/ai/ielts_ai/speaking_scorer/scorer.py` — SpeakingScorer orchestrator
- `apps/ai/ielts_ai/speaking_queue_consumer.py` — consumer thread + maybe_start_speaking_queue_consumer()
- `apps/ai/ielts_ai/tests/test_speaking_band_mapper.py`
- `apps/ai/ielts_ai/tests/test_speaking_lexical_features.py`
- `apps/ai/ielts_ai/tests/test_speaking_grammar_features.py`
- `apps/ai/ielts_ai/tests/test_speaking_ollama_judge.py`
- `apps/ai/ielts_ai/tests/test_speaking_scorer.py`
- `apps/ai/ielts_ai/tests/test_acoustic_features.py`

**Modify:**
- `apps/ai/requirements.txt` — add faster-whisper, librosa, soundfile, phonemizer, torchaudio
- `apps/ai/ielts_ai/api.py` — call `maybe_start_speaking_queue_consumer()` on startup
- `apps/assignments/src/assignment/speaking/schemas/speaking-submission.schema.ts` — add `grading_breakdown` field
- `apps/assignments/src/assignment/speaking/speaking.service.ts` — publish to `speaking_grade_queue`
- `apps/assignments/src/grade/grade.service.ts` — remove `gradeSpeaking()`, remove `SpeakingService` injection

---

## Task 1: Add pronunciation dependencies and pyproject.toml

**Files:**
- Create: `pronunciation/pyproject.toml`
- Modify: `apps/ai/requirements.txt`

- [ ] **Step 1: Add pyproject.toml to pronunciation/**

```toml
# pronunciation/pyproject.toml
[build-system]
requires = ["setuptools>=61"]
build-backend = "setuptools.backends.legacy:build"

[project]
name = "pronunciation"
version = "0.1.0"
requires-python = ">=3.11"
```

- [ ] **Step 2: Add missing pronunciation deps to apps/ai/requirements.txt**

Add these lines to `apps/ai/requirements.txt` (check each isn't already present):

```
faster-whisper>=1.2.1
librosa>=0.11.0
phonemizer>=3.3.0
soundfile>=0.13.1
torchaudio>=2.8.0
```

- [ ] **Step 3: Install updated deps**

Run from `apps/ai/`:
```bash
pip install -r requirements.txt
```

Expected: installs without error. faster-whisper, librosa, phonemizer are now available.

- [ ] **Step 4: Download spaCy model (if not already present)**

```bash
python -m spacy download en_core_web_sm
```

Expected: `✔ Download and installation successful`

- [ ] **Step 5: Verify pronunciation import path works**

```bash
cd /path/to/repo
python -c "
import sys
sys.path.insert(0, 'pronunciation')
from src.pipeline import PronunciationPipeline
print('OK:', PronunciationPipeline)
"
```

Expected: `OK: <class 'src.pipeline.PronunciationPipeline'>`

- [ ] **Step 6: Commit**

```bash
git add pronunciation/pyproject.toml apps/ai/requirements.txt
git commit -m "chore: add pronunciation deps to apps/ai and pyproject.toml to pronunciation/"
```

---

## Task 2: Band mapper (pure functions, TDD)

**Files:**
- Create: `apps/ai/ielts_ai/speaking_scorer/__init__.py`
- Create: `apps/ai/ielts_ai/speaking_scorer/band_mapper.py`
- Create: `apps/ai/ielts_ai/tests/test_speaking_band_mapper.py`

- [ ] **Step 1: Create the package skeleton**

```python
# apps/ai/ielts_ai/speaking_scorer/__init__.py
```

```python
# apps/ai/ielts_ai/speaking_scorer/features/__init__.py
```

- [ ] **Step 2: Write the failing tests**

```python
# apps/ai/ielts_ai/tests/test_speaking_band_mapper.py
import pytest
from ielts_ai.speaking_scorer.band_mapper import (
    heuristic_gr_band,
    heuristic_lr_band,
    map_fluency_band,
    map_pronunciation_band,
)


def _is_valid_band(band: float) -> bool:
    return 1.0 <= band <= 9.0 and band % 0.5 == 0.0


def test_map_pronunciation_band_high_signals():
    band = map_pronunciation_band(segmental=80.0, intelligibility=80.0, prosody=80.0)
    assert _is_valid_band(band)
    assert band >= 6.5


def test_map_pronunciation_band_low_signals():
    band = map_pronunciation_band(segmental=20.0, intelligibility=20.0, prosody=20.0)
    assert _is_valid_band(band)
    assert band <= 3.0


def test_map_pronunciation_band_clips_to_bounds():
    assert map_pronunciation_band(0.0, 0.0, 0.0) == 1.0
    assert map_pronunciation_band(100.0, 100.0, 100.0) == 9.0


def test_map_fluency_band_high_signals():
    band = map_fluency_band(fluency=80.0, rhythm=80.0, discourse_marker_density=80.0)
    assert _is_valid_band(band)
    assert band >= 6.5


def test_map_fluency_band_low_signals():
    band = map_fluency_band(fluency=15.0, rhythm=15.0, discourse_marker_density=15.0)
    assert _is_valid_band(band)
    assert band <= 3.0


def test_map_fluency_band_clips():
    assert map_fluency_band(0.0, 0.0, 0.0) == 1.0
    assert map_fluency_band(100.0, 100.0, 100.0) == 9.0


def test_heuristic_lr_band_returns_valid():
    band = heuristic_lr_band(ttr_lemma=0.6, freq_tier_ratio=0.4, lexical_density=0.5)
    assert _is_valid_band(band)


def test_heuristic_lr_band_high_diversity():
    high = heuristic_lr_band(ttr_lemma=0.9, freq_tier_ratio=0.8, lexical_density=0.6)
    low = heuristic_lr_band(ttr_lemma=0.2, freq_tier_ratio=0.1, lexical_density=0.2)
    assert high > low


def test_heuristic_gr_band_low_errors_higher_band():
    high = heuristic_gr_band(lt_error_rate=0.5, subordination_ratio=0.4, mean_sentence_length=15.0)
    low = heuristic_gr_band(lt_error_rate=20.0, subordination_ratio=0.05, mean_sentence_length=5.0)
    assert high > low


def test_heuristic_gr_band_returns_valid():
    band = heuristic_gr_band(lt_error_rate=3.0, subordination_ratio=0.3, mean_sentence_length=12.0)
    assert _is_valid_band(band)
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd apps/ai
python -m pytest ielts_ai/tests/test_speaking_band_mapper.py -v
```

Expected: `ModuleNotFoundError: No module named 'ielts_ai.speaking_scorer.band_mapper'`

- [ ] **Step 4: Implement band_mapper.py**

```python
# apps/ai/ielts_ai/speaking_scorer/band_mapper.py
from __future__ import annotations


def _scale_to_ielts_band(score_0_100: float) -> float:
    """Map a 0–100 score linearly to IELTS [1.0, 9.0], rounded to nearest 0.5."""
    clamped = max(0.0, min(100.0, score_0_100))
    band = 1.0 + (clamped / 100.0) * 8.0
    return round(band * 2) / 2


def map_pronunciation_band(segmental: float, intelligibility: float, prosody: float) -> float:
    """P = 0.5×segmental + 0.3×intelligibility + 0.2×prosody, all in [0, 100]."""
    raw = 0.5 * segmental + 0.3 * intelligibility + 0.2 * prosody
    return _scale_to_ielts_band(raw)


def map_fluency_band(fluency: float, rhythm: float, discourse_marker_density: float) -> float:
    """FC = 0.45×fluency + 0.25×rhythm + 0.30×discourse_density, all in [0, 100]."""
    raw = 0.45 * fluency + 0.25 * rhythm + 0.30 * discourse_marker_density
    return _scale_to_ielts_band(raw)


def heuristic_lr_band(ttr_lemma: float, freq_tier_ratio: float, lexical_density: float) -> float:
    """LR heuristic — used when Ollama is unavailable. Inputs are [0, 1] ratios."""
    score = ttr_lemma * 40.0 + freq_tier_ratio * 40.0 + lexical_density * 20.0
    return _scale_to_ielts_band(score)


def heuristic_gr_band(lt_error_rate: float, subordination_ratio: float, mean_sentence_length: float) -> float:
    """GR heuristic — used when Ollama is unavailable. lt_error_rate is errors per 100 words."""
    error_score = max(0.0, 100.0 - lt_error_rate * 10.0)
    complexity_score = min(100.0, subordination_ratio * 200.0 + mean_sentence_length * 2.0)
    score = 0.7 * error_score + 0.3 * complexity_score
    return _scale_to_ielts_band(score)
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
python -m pytest ielts_ai/tests/test_speaking_band_mapper.py -v
```

Expected: all 10 tests PASSED.

- [ ] **Step 6: Commit**

```bash
git add ielts_ai/speaking_scorer/__init__.py ielts_ai/speaking_scorer/features/__init__.py \
        ielts_ai/speaking_scorer/band_mapper.py ielts_ai/tests/test_speaking_band_mapper.py
git commit -m "feat(speaking): add band mapper with P and FC scoring functions"
```

---

## Task 3: Lexical features (TDD)

**Files:**
- Create: `apps/ai/ielts_ai/speaking_scorer/features/lexical_features.py`
- Create: `apps/ai/ielts_ai/tests/test_speaking_lexical_features.py`

- [ ] **Step 1: Write the failing tests**

```python
# apps/ai/ielts_ai/tests/test_speaking_lexical_features.py
import pytest
from ielts_ai.speaking_scorer.features.lexical_features import LexicalFeatures, extract_lexical_features


def test_returns_lexical_features_dataclass():
    result = extract_lexical_features("The cat sat on the mat.")
    assert isinstance(result, LexicalFeatures)


def test_empty_transcript_returns_zeros():
    result = extract_lexical_features("")
    assert result.ttr_lemma == 0.0
    assert result.freq_tier_ratio == 0.0
    assert result.lexical_density == 0.0
    assert result.mean_word_length == 0.0


def test_ttr_range():
    result = extract_lexical_features("I think that the environment is very important for all people.")
    assert 0.0 <= result.ttr_lemma <= 1.0


def test_high_repetition_lowers_ttr():
    repetitive = "cat cat cat cat cat dog dog dog dog dog"
    diverse = "I enjoy reading philosophy science history literature technology"
    r = extract_lexical_features(repetitive)
    d = extract_lexical_features(diverse)
    assert r.ttr_lemma < d.ttr_lemma


def test_lexical_density_range():
    result = extract_lexical_features("Scientists discovered unprecedented atmospheric phenomena.")
    assert 0.0 < result.lexical_density <= 1.0


def test_academic_vocabulary_raises_freq_tier_ratio():
    # Rare academic words → higher freq_tier_ratio (B2+ words)
    academic = "unprecedented phenomena amalgamation electromagnetic biodiversity"
    basic = "cat dog house run eat see big small go come"
    a = extract_lexical_features(academic)
    b = extract_lexical_features(basic)
    assert a.freq_tier_ratio > b.freq_tier_ratio


def test_mean_word_length_positive():
    result = extract_lexical_features("I think education is important.")
    assert result.mean_word_length > 0.0
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
python -m pytest ielts_ai/tests/test_speaking_lexical_features.py -v
```

Expected: `ModuleNotFoundError: No module named 'ielts_ai.speaking_scorer.features.lexical_features'`

- [ ] **Step 3: Implement lexical_features.py**

```python
# apps/ai/ielts_ai/speaking_scorer/features/lexical_features.py
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from wordfreq import word_frequency

_CONTENT_POS = {"NOUN", "VERB", "ADJ", "ADV"}
_B2_FREQ_THRESHOLD = 1e-5  # words with frequency below this are CEFR B2+


@dataclass
class LexicalFeatures:
    ttr_lemma: float        # lemmatised type-token ratio [0, 1]
    freq_tier_ratio: float  # proportion of content words at B2+ level [0, 1]
    lexical_density: float  # content words / total tokens [0, 1]
    mean_word_length: float # mean characters per token


@lru_cache(maxsize=1)
def _get_nlp():
    import spacy
    return spacy.load("en_core_web_sm", disable=["ner", "parser"])


def extract_lexical_features(transcript: str) -> LexicalFeatures:
    if not transcript.strip():
        return LexicalFeatures(ttr_lemma=0.0, freq_tier_ratio=0.0, lexical_density=0.0, mean_word_length=0.0)

    nlp = _get_nlp()
    doc = nlp(transcript)

    tokens = [t for t in doc if not t.is_punct and not t.is_space and t.text.strip()]
    if not tokens:
        return LexicalFeatures(ttr_lemma=0.0, freq_tier_ratio=0.0, lexical_density=0.0, mean_word_length=0.0)

    lemmas = [t.lemma_.lower() for t in tokens]
    ttr_lemma = len(set(lemmas)) / max(len(lemmas), 1)

    content_tokens = [t for t in tokens if t.pos_ in _CONTENT_POS]
    lexical_density = len(content_tokens) / max(len(tokens), 1)

    low_freq_count = sum(
        1 for t in content_tokens
        if word_frequency(t.text.lower(), "en") < _B2_FREQ_THRESHOLD
    )
    freq_tier_ratio = low_freq_count / max(len(content_tokens), 1)

    mean_word_length = sum(len(t.text) for t in tokens) / max(len(tokens), 1)

    return LexicalFeatures(
        ttr_lemma=round(ttr_lemma, 4),
        freq_tier_ratio=round(freq_tier_ratio, 4),
        lexical_density=round(lexical_density, 4),
        mean_word_length=round(mean_word_length, 4),
    )
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
python -m pytest ielts_ai/tests/test_speaking_lexical_features.py -v
```

Expected: all 7 tests PASSED.

- [ ] **Step 5: Commit**

```bash
git add ielts_ai/speaking_scorer/features/lexical_features.py \
        ielts_ai/tests/test_speaking_lexical_features.py
git commit -m "feat(speaking): add lexical feature extractor (TTR, freq tier, density)"
```

---

## Task 4: Grammar features (TDD)

**Files:**
- Create: `apps/ai/ielts_ai/speaking_scorer/features/grammar_features.py`
- Create: `apps/ai/ielts_ai/tests/test_speaking_grammar_features.py`

- [ ] **Step 1: Write the failing tests**

```python
# apps/ai/ielts_ai/tests/test_speaking_grammar_features.py
import pytest
from ielts_ai.speaking_scorer.features.grammar_features import GrammarFeatures, extract_grammar_features


def test_returns_grammar_features_dataclass():
    result = extract_grammar_features("I go to school every day.")
    assert isinstance(result, GrammarFeatures)


def test_empty_transcript_returns_zeros():
    result = extract_grammar_features("")
    assert result.lt_error_rate == 0.0
    assert result.clause_count == 0.0
    assert result.mean_sentence_length == 0.0


def test_error_rate_non_negative():
    result = extract_grammar_features("She go to school yesterday and he don't like it.")
    assert result.lt_error_rate >= 0.0


def test_clean_text_has_lower_error_rate_than_errors():
    clean = "She went to school yesterday and he did not like it."
    errors = "She go to school yesterday and he don't liked it very much badly."
    c = extract_grammar_features(clean)
    e = extract_grammar_features(errors)
    assert c.lt_error_rate <= e.lt_error_rate


def test_subordination_ratio_range():
    result = extract_grammar_features(
        "Although she studied hard, she failed because the exam was harder than she expected."
    )
    assert 0.0 <= result.subordination_ratio <= 1.0


def test_complex_sentence_has_higher_subordination_than_simple():
    complex_text = (
        "Although the government introduced new policies, many citizens who lived in rural areas "
        "were not affected because they relied on traditional practices that had persisted for decades."
    )
    simple_text = "The government made new rules. People live in rural areas. They use old methods."
    c = extract_grammar_features(complex_text)
    s = extract_grammar_features(simple_text)
    assert c.subordination_ratio > s.subordination_ratio


def test_mean_sentence_length_positive():
    result = extract_grammar_features("I study English every day. It is very useful for my career.")
    assert result.mean_sentence_length > 0.0
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
python -m pytest ielts_ai/tests/test_speaking_grammar_features.py -v
```

Expected: `ModuleNotFoundError: No module named 'ielts_ai.speaking_scorer.features.grammar_features'`

- [ ] **Step 3: Implement grammar_features.py**

```python
# apps/ai/ielts_ai/speaking_scorer/features/grammar_features.py
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from ielts_ai.writing_scorer.features.grammar_features import get_languagetool

_SUBORDINATE_DEPS = {"advcl", "relcl", "acl", "ccomp", "xcomp"}


@dataclass
class GrammarFeatures:
    lt_error_rate: float          # total LanguageTool errors per 100 words
    lt_grammar_error_rate: float  # grammar-only errors per 100 words
    lt_spelling_error_rate: float # spelling-only errors per 100 words
    clause_count: float           # mean clauses per sentence
    subordination_ratio: float    # subordinate clauses / total clauses
    mean_sentence_length: float   # words per sentence


@lru_cache(maxsize=1)
def _get_nlp():
    import spacy
    return spacy.load("en_core_web_sm", disable=["ner"])


def extract_grammar_features(transcript: str) -> GrammarFeatures:
    if not transcript.strip():
        return GrammarFeatures(
            lt_error_rate=0.0,
            lt_grammar_error_rate=0.0,
            lt_spelling_error_rate=0.0,
            clause_count=0.0,
            subordination_ratio=0.0,
            mean_sentence_length=0.0,
        )

    words = transcript.split()
    word_count = max(len(words), 1)

    lt = get_languagetool()
    matches = lt.check(transcript)

    grammar_errors = [
        m for m in matches
        if "GRAMMAR" in (m.ruleIssueType or "").upper()
    ]
    spelling_errors = [
        m for m in matches
        if "SPELLING" in (m.ruleIssueType or "").upper()
        or getattr(m, "ruleId", "").startswith("MORFOLOGIK")
    ]

    lt_error_rate = len(matches) / word_count * 100
    lt_grammar_error_rate = len(grammar_errors) / word_count * 100
    lt_spelling_error_rate = len(spelling_errors) / word_count * 100

    nlp = _get_nlp()
    doc = nlp(transcript)
    sentences = list(doc.sents)

    if not sentences:
        return GrammarFeatures(
            lt_error_rate=round(lt_error_rate, 4),
            lt_grammar_error_rate=round(lt_grammar_error_rate, 4),
            lt_spelling_error_rate=round(lt_spelling_error_rate, 4),
            clause_count=0.0,
            subordination_ratio=0.0,
            mean_sentence_length=float(word_count),
        )

    total_clauses = 0
    total_sub_clauses = 0

    for sent in sentences:
        roots = [t for t in sent if t.dep_ == "ROOT"]
        sub_clauses = [t for t in sent if t.dep_ in _SUBORDINATE_DEPS]
        total_clauses += len(roots) + len(sub_clauses)
        total_sub_clauses += len(sub_clauses)

    n_sents = len(sentences)
    mean_clause_count = total_clauses / max(n_sents, 1)
    subordination_ratio = total_sub_clauses / max(total_clauses, 1)
    mean_sentence_length = word_count / max(n_sents, 1)

    return GrammarFeatures(
        lt_error_rate=round(lt_error_rate, 4),
        lt_grammar_error_rate=round(lt_grammar_error_rate, 4),
        lt_spelling_error_rate=round(lt_spelling_error_rate, 4),
        clause_count=round(mean_clause_count, 4),
        subordination_ratio=round(subordination_ratio, 4),
        mean_sentence_length=round(mean_sentence_length, 4),
    )
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
python -m pytest ielts_ai/tests/test_speaking_grammar_features.py -v
```

Expected: all 7 tests PASSED. Note: first run is slow (~5s) due to LanguageTool JVM startup.

- [ ] **Step 5: Commit**

```bash
git add ielts_ai/speaking_scorer/features/grammar_features.py \
        ielts_ai/tests/test_speaking_grammar_features.py
git commit -m "feat(speaking): add grammar feature extractor (LanguageTool + spaCy dep parse)"
```

---

## Task 5: Acoustic features (pronunciation pipeline wrapper)

**Files:**
- Create: `apps/ai/ielts_ai/speaking_scorer/features/acoustic_features.py`
- Create: `apps/ai/ielts_ai/tests/test_acoustic_features.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/ai/ielts_ai/tests/test_acoustic_features.py
"""Integration test — requires pronunciation models (Whisper + wav2vec2). Slow (~30s)."""
import pytest
from pathlib import Path

from ielts_ai.paths import REPO_ROOT
from ielts_ai.speaking_scorer.features.acoustic_features import (
    AcousticFeatures,
    SentenceError,
    WordError,
    extract_acoustic_features,
)

WAV_FIXTURE = REPO_ROOT / "pronunciation" / "voice-sample.wav"


@pytest.mark.slow
def test_returns_acoustic_features(tmp_path):
    audio_bytes = WAV_FIXTURE.read_bytes()
    result = extract_acoustic_features([audio_bytes], ["audio/wav"])
    assert isinstance(result, AcousticFeatures)


@pytest.mark.slow
def test_scores_in_valid_range():
    audio_bytes = WAV_FIXTURE.read_bytes()
    result = extract_acoustic_features([audio_bytes], ["audio/wav"])
    for field_name in ("segmental", "intelligibility", "stress", "prosody", "fluency", "rhythm"):
        value = getattr(result, field_name)
        assert 0.0 <= value <= 100.0, f"{field_name}={value} out of range"


@pytest.mark.slow
def test_transcript_is_non_empty():
    audio_bytes = WAV_FIXTURE.read_bytes()
    result = extract_acoustic_features([audio_bytes], ["audio/wav"])
    assert isinstance(result.transcript, str)
    assert len(result.transcript) > 0


@pytest.mark.slow
def test_sentence_errors_is_list():
    audio_bytes = WAV_FIXTURE.read_bytes()
    result = extract_acoustic_features([audio_bytes], ["audio/wav"])
    assert isinstance(result.sentence_errors, list)


@pytest.mark.slow
def test_word_errors_have_required_fields():
    audio_bytes = WAV_FIXTURE.read_bytes()
    result = extract_acoustic_features([audio_bytes], ["audio/wav"])
    for sent_err in result.sentence_errors:
        assert isinstance(sent_err, SentenceError)
        assert isinstance(sent_err.sentence, str)
        assert sent_err.start_time >= 0.0
        assert sent_err.end_time > sent_err.start_time
        for word_err in sent_err.word_errors:
            assert isinstance(word_err, WordError)
            assert isinstance(word_err.word, str)
            assert 0.0 <= word_err.score <= 100.0
            assert isinstance(word_err.fix_hint, str)
            assert len(word_err.fix_hint) > 0


@pytest.mark.slow
def test_no_temp_files_left_behind(tmp_path):
    import os
    import tempfile
    before = set(os.listdir(tempfile.gettempdir()))
    audio_bytes = WAV_FIXTURE.read_bytes()
    extract_acoustic_features([audio_bytes], ["audio/wav"])
    after = set(os.listdir(tempfile.gettempdir()))
    new_files = [f for f in (after - before) if f.endswith((".wav", ".webm"))]
    assert not new_files, f"Temp files not cleaned up: {new_files}"
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
python -m pytest ielts_ai/tests/test_acoustic_features.py -v -m slow
```

Expected: `ModuleNotFoundError: No module named 'ielts_ai.speaking_scorer.features.acoustic_features'`

- [ ] **Step 3: Implement acoustic_features.py**

```python
# apps/ai/ielts_ai/speaking_scorer/features/acoustic_features.py
from __future__ import annotations

import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import List

from ielts_ai.paths import REPO_ROOT
from ielts_ai.writing_scorer.features.task_achievement_features import discourse_marker_features

_PRONUNCIATION_ROOT = REPO_ROOT / "pronunciation"
if str(_PRONUNCIATION_ROOT) not in sys.path:
    sys.path.insert(0, str(_PRONUNCIATION_ROOT))

from src.pipeline import PronunciationPipeline, PronunciationReport  # noqa: E402
from src.scoring import PhoneAssessment, WordAssessment  # noqa: E402

_WORD_ERROR_THRESHOLD = 60.0

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
    problematic_phones: List[ProblematicPhone]
    fix_hint: str


@dataclass
class SentenceError:
    sentence: str
    start_time: float
    end_time: float
    word_errors: List[WordError]


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
    sentence_errors: List[SentenceError]


_pipeline: PronunciationPipeline | None = None


def _get_pipeline() -> PronunciationPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = PronunciationPipeline()
    return _pipeline


def _build_fix_hint(bad_phones: List[PhoneAssessment]) -> str:
    if not bad_phones:
        return "Focus on producing each sound clearly and distinctly."
    worst = min(bad_phones, key=lambda p: p.score)
    hint = _PHONE_FIX_HINTS.get(worst.token)
    return hint or f"Practice the /{worst.token}/ sound — try it slowly in isolation first."


def _build_sentence_errors(report: PronunciationReport, time_offset: float = 0.0) -> List[SentenceError]:
    errors: List[SentenceError] = []
    for seg in report.transcript_segments:
        seg_words = [
            w for w in report.words
            if w.start is not None
            and w.end is not None
            and w.start >= seg.start - 0.1
            and w.end <= seg.end + 0.1
        ]
        word_errors: List[WordError] = []
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
    reports: List[PronunciationReport],
    durations: List[float],
) -> AcousticFeatures:
    total_dur = max(sum(durations), 1e-6)
    weights = [d / total_dur for d in durations]

    def wavg(attr: str) -> float:
        return sum(getattr(r.scores, attr) * w for r, w in zip(reports, weights))

    transcript = " ".join(r.transcript for r in reports if r.transcript)
    dm = discourse_marker_features(transcript)
    discourse_density = min(100.0, dm["discourse_marker_density_score"] * 100.0)

    sentence_errors: List[SentenceError] = []
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
    audio_parts: List[bytes],
    mimetypes: List[str],
) -> AcousticFeatures:
    """Run pronunciation pipeline on one or more audio parts; merge and return features."""
    if not audio_parts:
        raise ValueError("No audio parts provided")

    pipeline = _get_pipeline()
    reports: List[PronunciationReport] = []
    durations: List[float] = []

    for audio_bytes, mimetype in zip(audio_parts, mimetypes):
        suffix = ".wav" if "wav" in mimetype else ".webm"
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
```

- [ ] **Step 4: Run tests (slow — will take ~30s)**

```bash
python -m pytest ielts_ai/tests/test_acoustic_features.py -v -m slow
```

Expected: all 6 tests PASSED. First run downloads Whisper + wav2vec2 models (~1GB total).

- [ ] **Step 5: Commit**

```bash
git add ielts_ai/speaking_scorer/features/acoustic_features.py \
        ielts_ai/tests/test_acoustic_features.py
git commit -m "feat(speaking): add acoustic feature extractor wrapping pronunciation pipeline"
```

---

## Task 6: Ollama judge (TDD with mocks)

**Files:**
- Create: `apps/ai/ielts_ai/speaking_scorer/ollama_judge.py`
- Create: `apps/ai/ielts_ai/tests/test_speaking_ollama_judge.py`

- [ ] **Step 1: Write the failing tests**

```python
# apps/ai/ielts_ai/tests/test_speaking_ollama_judge.py
import json
from unittest.mock import MagicMock, patch

import pytest

from ielts_ai.speaking_scorer.features.grammar_features import GrammarFeatures
from ielts_ai.speaking_scorer.features.lexical_features import LexicalFeatures
from ielts_ai.speaking_scorer.ollama_judge import OllamaJudgment, judge

_LEXICAL = LexicalFeatures(ttr_lemma=0.6, freq_tier_ratio=0.3, lexical_density=0.45, mean_word_length=4.5)
_GRAMMAR = GrammarFeatures(
    lt_error_rate=2.0, lt_grammar_error_rate=1.0, lt_spelling_error_rate=1.0,
    clause_count=1.5, subordination_ratio=0.3, mean_sentence_length=12.0,
)
_TRANSCRIPT = "I think the environment is very important for future generations."


def _ok_response(data: dict) -> MagicMock:
    mock = MagicMock()
    mock.raise_for_status.return_value = None
    mock.json.return_value = {"message": {"content": json.dumps(data)}}
    return mock


def test_happy_path_returns_judgment():
    with patch("requests.post", return_value=_ok_response({
        "lr_band": 6.0, "lr_feedback": "Good vocabulary.",
        "gr_band": 5.5, "gr_feedback": "Some errors.",
        "pronunciation_tips": {"environment": "Stress the second syllable."},
    })):
        result = judge(_TRANSCRIPT, _LEXICAL, _GRAMMAR, [], model="llama3")

    assert result is not None
    assert isinstance(result, OllamaJudgment)
    assert result.lr_band == 6.0
    assert result.gr_band == 5.5
    assert result.pronunciation_tips.get("environment") == "Stress the second syllable."


def test_returns_none_when_model_is_empty():
    result = judge(_TRANSCRIPT, _LEXICAL, _GRAMMAR, [], model="")
    assert result is None


def test_returns_none_on_connection_refused():
    with patch("requests.post", side_effect=ConnectionError("refused")):
        result = judge(_TRANSCRIPT, _LEXICAL, _GRAMMAR, [], model="llama3")
    assert result is None


def test_returns_none_on_malformed_json():
    mock = MagicMock()
    mock.raise_for_status.return_value = None
    mock.json.return_value = {"message": {"content": "not valid json {"}}
    with patch("requests.post", return_value=mock):
        result = judge(_TRANSCRIPT, _LEXICAL, _GRAMMAR, [], model="llama3")
    assert result is None


def test_returns_none_when_required_keys_missing():
    with patch("requests.post", return_value=_ok_response({"lr_band": 5.0})):
        result = judge(_TRANSCRIPT, _LEXICAL, _GRAMMAR, [], model="llama3")
    assert result is None


def test_pronunciation_tips_defaults_to_empty_dict():
    with patch("requests.post", return_value=_ok_response({
        "lr_band": 6.0, "lr_feedback": "OK.",
        "gr_band": 5.5, "gr_feedback": "Fine.",
    })):
        result = judge(_TRANSCRIPT, _LEXICAL, _GRAMMAR, [], model="llama3")
    assert result is not None
    assert result.pronunciation_tips == {}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
python -m pytest ielts_ai/tests/test_speaking_ollama_judge.py -v
```

Expected: `ModuleNotFoundError: No module named 'ielts_ai.speaking_scorer.ollama_judge'`

- [ ] **Step 3: Implement ollama_judge.py**

```python
# apps/ai/ielts_ai/speaking_scorer/ollama_judge.py
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import List

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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
python -m pytest ielts_ai/tests/test_speaking_ollama_judge.py -v
```

Expected: all 6 tests PASSED.

- [ ] **Step 5: Commit**

```bash
git add ielts_ai/speaking_scorer/ollama_judge.py \
        ielts_ai/tests/test_speaking_ollama_judge.py
git commit -m "feat(speaking): add Ollama judge for LR and GR band scoring"
```

---

## Task 7: Speaking scorer orchestrator (TDD with mocked features)

**Files:**
- Create: `apps/ai/ielts_ai/speaking_scorer/scorer.py`
- Create: `apps/ai/ielts_ai/tests/test_speaking_scorer.py`

- [ ] **Step 1: Write the failing tests**

```python
# apps/ai/ielts_ai/tests/test_speaking_scorer.py
from unittest.mock import patch

import pytest

from ielts_ai.speaking_scorer.features.acoustic_features import AcousticFeatures, SentenceError
from ielts_ai.speaking_scorer.features.grammar_features import GrammarFeatures
from ielts_ai.speaking_scorer.features.lexical_features import LexicalFeatures
from ielts_ai.speaking_scorer.ollama_judge import OllamaJudgment
from ielts_ai.speaking_scorer.scorer import RubricScore, SpeakingScorer, SpeakingScoringResult

_ACOUSTIC = AcousticFeatures(
    segmental=70.0, intelligibility=65.0, stress=72.0, prosody=68.0,
    reliability=0.75, fluency=60.0, rhythm=55.0, discourse_marker_density=40.0,
    transcript="I think the environment is very important.",
    sentence_errors=[],
)
_LEXICAL = LexicalFeatures(ttr_lemma=0.65, freq_tier_ratio=0.30, lexical_density=0.45, mean_word_length=4.5)
_GRAMMAR = GrammarFeatures(
    lt_error_rate=2.0, lt_grammar_error_rate=1.0, lt_spelling_error_rate=1.0,
    clause_count=1.5, subordination_ratio=0.3, mean_sentence_length=12.0,
)
_OLLAMA = OllamaJudgment(lr_band=6.5, gr_band=6.0, lr_feedback="Good range.", gr_feedback="Minor errors.", pronunciation_tips={})


def _patch_features(ollama_result=None):
    return [
        patch("ielts_ai.speaking_scorer.scorer.extract_acoustic_features", return_value=_ACOUSTIC),
        patch("ielts_ai.speaking_scorer.scorer.extract_lexical_features", return_value=_LEXICAL),
        patch("ielts_ai.speaking_scorer.scorer.extract_grammar_features", return_value=_GRAMMAR),
        patch("ielts_ai.speaking_scorer.scorer.judge", return_value=ollama_result),
    ]


def test_returns_scoring_result():
    with _patch_features(_OLLAMA)[0], _patch_features(_OLLAMA)[1], \
         _patch_features(_OLLAMA)[2], _patch_features(_OLLAMA)[3]:
        scorer = SpeakingScorer()
        result = scorer.score([b"audio"], ["audio/webm"])
    assert isinstance(result, SpeakingScoringResult)


def test_overall_band_in_valid_range():
    patches = _patch_features(_OLLAMA)
    with patches[0], patches[1], patches[2], patches[3]:
        result = SpeakingScorer().score([b"audio"], ["audio/webm"])
    assert 1.0 <= result.overall_band <= 9.0
    assert result.overall_band % 0.5 == 0.0


def test_all_four_rubrics_present():
    patches = _patch_features(_OLLAMA)
    with patches[0], patches[1], patches[2], patches[3]:
        result = SpeakingScorer().score([b"audio"], ["audio/webm"])
    assert set(result.rubrics.keys()) == {"FC", "LR", "GR", "P"}


def test_each_rubric_has_valid_band():
    patches = _patch_features(_OLLAMA)
    with patches[0], patches[1], patches[2], patches[3]:
        result = SpeakingScorer().score([b"audio"], ["audio/webm"])
    for key, rubric in result.rubrics.items():
        assert isinstance(rubric, RubricScore), f"{key} is not RubricScore"
        assert 1.0 <= rubric.band <= 9.0, f"{key}.band={rubric.band} out of range"


def test_ollama_bands_used_when_available():
    patches = _patch_features(_OLLAMA)
    with patches[0], patches[1], patches[2], patches[3]:
        result = SpeakingScorer().score([b"audio"], ["audio/webm"])
    assert result.rubrics["LR"].band == 6.5
    assert result.rubrics["GR"].band == 6.0


def test_heuristic_bands_when_ollama_unavailable():
    patches = _patch_features(ollama_result=None)
    with patches[0], patches[1], patches[2], patches[3]:
        result = SpeakingScorer().score([b"audio"], ["audio/webm"])
    assert "ollama_lr_gr" in result.metadata["degraded_features"]
    assert 1.0 <= result.rubrics["LR"].band <= 9.0
    assert 1.0 <= result.rubrics["GR"].band <= 9.0


def test_p_rubric_has_sentence_errors_key():
    patches = _patch_features(_OLLAMA)
    with patches[0], patches[1], patches[2], patches[3]:
        result = SpeakingScorer().score([b"audio"], ["audio/webm"])
    assert result.rubrics["P"].sentence_errors is not None
    assert isinstance(result.rubrics["P"].sentence_errors, list)
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
python -m pytest ielts_ai/tests/test_speaking_scorer.py -v
```

Expected: `ModuleNotFoundError: No module named 'ielts_ai.speaking_scorer.scorer'`

- [ ] **Step 3: Implement scorer.py**

```python
# apps/ai/ielts_ai/speaking_scorer/scorer.py
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any, List

from ielts_ai.speaking_scorer.band_mapper import (
    heuristic_gr_band,
    heuristic_lr_band,
    map_fluency_band,
    map_pronunciation_band,
)
from ielts_ai.speaking_scorer.features.acoustic_features import (
    AcousticFeatures,
    extract_acoustic_features,
)
from ielts_ai.speaking_scorer.features.grammar_features import GrammarFeatures, extract_grammar_features
from ielts_ai.speaking_scorer.features.lexical_features import LexicalFeatures, extract_lexical_features
from ielts_ai.speaking_scorer.ollama_judge import OllamaJudgment, judge

logger = logging.getLogger(__name__)


@dataclass
class RubricScore:
    band: float
    feedback: str
    feature_evidence: dict[str, float]
    sentence_errors: list | None = None  # P only


@dataclass
class SpeakingScoringResult:
    overall_band: float
    rubrics: dict[str, RubricScore]
    feedback: str
    metadata: dict[str, Any]


def _round_to_half(value: float) -> float:
    return round(value * 2) / 2


def _clamp(value: float, lo: float = 1.0, hi: float = 9.0) -> float:
    return max(lo, min(hi, value))


class SpeakingScorer:
    def __init__(self) -> None:
        self.ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
        self.ollama_model = os.getenv("OLLAMA_SPEAKING_MODEL", "")

    def score(self, audio_parts: List[bytes], mimetypes: List[str]) -> SpeakingScoringResult:
        degraded: list[str] = []

        acoustic = extract_acoustic_features(audio_parts, mimetypes)
        lexical = extract_lexical_features(acoustic.transcript)
        grammar = extract_grammar_features(acoustic.transcript)

        p_band = _clamp(map_pronunciation_band(acoustic.segmental, acoustic.intelligibility, acoustic.prosody))
        fc_band = _clamp(map_fluency_band(acoustic.fluency, acoustic.rhythm, acoustic.discourse_marker_density))

        worst_words = sorted(
            [w for s in acoustic.sentence_errors for w in s.word_errors],
            key=lambda w: w.score,
        )[:5]

        ollama_result: OllamaJudgment | None = None
        if self.ollama_model:
            ollama_result = judge(
                transcript=acoustic.transcript,
                lexical=lexical,
                grammar=grammar,
                worst_words=worst_words,
                model=self.ollama_model,
                host=self.ollama_host,
            )
            if ollama_result is None:
                degraded.append("ollama")

        if ollama_result is not None:
            lr_band = _clamp(ollama_result.lr_band)
            gr_band = _clamp(ollama_result.gr_band)
            lr_feedback = ollama_result.lr_feedback
            gr_feedback = ollama_result.gr_feedback
            for sent_err in acoustic.sentence_errors:
                for word_err in sent_err.word_errors:
                    tip = ollama_result.pronunciation_tips.get(word_err.word)
                    if tip:
                        word_err.fix_hint = tip
        else:
            degraded.append("ollama_lr_gr")
            lr_band = _clamp(heuristic_lr_band(lexical.ttr_lemma, lexical.freq_tier_ratio, lexical.lexical_density))
            gr_band = _clamp(heuristic_gr_band(grammar.lt_error_rate, grammar.subordination_ratio, grammar.mean_sentence_length))
            lr_feedback = "Lexical resource assessed from vocabulary diversity and frequency."
            gr_feedback = "Grammar assessed from error rate and sentence complexity."

        overall = _round_to_half((fc_band + lr_band + gr_band + p_band) / 4.0)

        p_feedback = f"Pronunciation band {p_band:.1f}: segmental accuracy {acoustic.segmental:.0f}/100."
        fc_feedback = f"Fluency and coherence band {fc_band:.1f}: speech rate and rhythm assessed."
        feedback = (
            f"Fluency & Coherence: {fc_band:.1f}. {fc_feedback}\n"
            f"Lexical Resource: {lr_band:.1f}. {lr_feedback}\n"
            f"Grammatical Range: {gr_band:.1f}. {gr_feedback}\n"
            f"Pronunciation: {p_band:.1f}. {p_feedback}\n"
            f"Overall Band: {overall:.1f}"
        )

        return SpeakingScoringResult(
            overall_band=overall,
            rubrics={
                "FC": RubricScore(
                    band=fc_band,
                    feedback=fc_feedback,
                    feature_evidence={
                        "fluency": round(acoustic.fluency, 1),
                        "rhythm": round(acoustic.rhythm, 1),
                        "discourse_marker_density": round(acoustic.discourse_marker_density, 1),
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
                        "segmental": round(acoustic.segmental, 1),
                        "intelligibility": round(acoustic.intelligibility, 1),
                        "prosody": round(acoustic.prosody, 1),
                        "reliability": round(acoustic.reliability, 3),
                    },
                    sentence_errors=[
                        {
                            "sentence": s.sentence,
                            "start_time": s.start_time,
                            "end_time": s.end_time,
                            "word_errors": [
                                {
                                    "word": w.word,
                                    "score": w.score,
                                    "reference_ipa": w.reference_ipa,
                                    "problematic_phones": [
                                        {"phone": p.phone, "score": p.score}
                                        for p in w.problematic_phones
                                    ],
                                    "fix_hint": w.fix_hint,
                                }
                                for w in s.word_errors
                            ],
                        }
                        for s in acoustic.sentence_errors
                    ],
                ),
            },
            feedback=feedback,
            metadata={
                "degraded_features": sorted(set(degraded)),
                "reliability": round(acoustic.reliability, 3),
                "transcript": acoustic.transcript,
                "ollama_model": self.ollama_model,
            },
        )
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
python -m pytest ielts_ai/tests/test_speaking_scorer.py -v
```

Expected: all 7 tests PASSED.

- [ ] **Step 5: Commit**

```bash
git add ielts_ai/speaking_scorer/scorer.py ielts_ai/tests/test_speaking_scorer.py
git commit -m "feat(speaking): add SpeakingScorer orchestrator"
```

---

## Task 8: Speaking queue consumer + api.py startup

**Files:**
- Create: `apps/ai/ielts_ai/speaking_queue_consumer.py`
- Modify: `apps/ai/ielts_ai/api.py`

- [ ] **Step 1: Create speaking_queue_consumer.py**

```python
# apps/ai/ielts_ai/speaking_queue_consumer.py
from __future__ import annotations

import base64
import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Any

import pika
from pydantic import BaseModel, ValidationError
from pymongo import MongoClient

from ielts_ai.speaking_scorer.scorer import SpeakingScorer

logger = logging.getLogger(__name__)


class SpeakingGradeMessage(BaseModel):
    responseId: str
    assignmentId: str
    userId: str
    audios: dict[str, Any]


class SpeakingQueueConsumer:
    def __init__(self) -> None:
        self.rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://localhost:5672")
        self.queue_name = os.getenv("SPEAKING_GRADE_QUEUE", "speaking_grade_queue")
        self.mongo_uri = os.getenv("MONGODB_URI")
        self.mongo_db = os.getenv("MONGODB_DB", "idest")
        if not self.mongo_uri:
            raise RuntimeError("MONGODB_URI is required for speaking queue consumer")
        self._mongo_client = MongoClient(self.mongo_uri)
        self._db = self._mongo_client[self.mongo_db]
        self._submissions = self._db["speaking_submissions"]
        self._scorer = SpeakingScorer()

    def run_forever(self) -> None:
        while True:
            connection = None
            try:
                params = pika.URLParameters(self.rabbitmq_url)
                connection = pika.BlockingConnection(params)
                channel = connection.channel()
                channel.queue_declare(queue=self.queue_name, durable=True)
                channel.basic_qos(prefetch_count=1)
                channel.basic_consume(queue=self.queue_name, on_message_callback=self._consume)
                logger.info("Speaking queue consumer started for queue=%s", self.queue_name)
                channel.start_consuming()
            except Exception:
                logger.exception("Speaking queue consumer crashed, retrying in 5s")
                time.sleep(5)
            finally:
                if connection and connection.is_open:
                    connection.close()

    def _consume(self, ch: Any, method: Any, _props: Any, body: bytes) -> None:
        try:
            payload = SpeakingGradeMessage.model_validate_json(body)
            self._grade(payload)
        except ValidationError:
            logger.exception("Invalid speaking queue payload: %s", body[:200])
        except Exception:
            logger.exception("Unhandled error processing speaking queue payload")
        finally:
            ch.basic_ack(delivery_tag=method.delivery_tag)

    def _grade(self, payload: SpeakingGradeMessage) -> None:
        audio_parts: list[bytes] = []
        mimetypes: list[str] = []

        for key in ("audioOne", "audioTwo", "audioThree"):
            raw = payload.audios.get(key)
            if not raw:
                continue
            if isinstance(raw, dict):
                audio_parts.append(base64.b64decode(raw["data"]))
                mimetypes.append(raw.get("mimetype", "audio/webm"))
            elif isinstance(raw, str):
                audio_parts.append(base64.b64decode(raw))
                mimetypes.append("audio/webm")

        if not audio_parts:
            self._mark_failed(payload.responseId, "No audio parts in message")
            return

        try:
            result = self._scorer.score(audio_parts, mimetypes)
        except Exception as exc:
            self._mark_failed(payload.responseId, str(exc))
            raise

        grading_breakdown = {
            "overall_band": result.overall_band,
            "rubrics": {
                key: {
                    "band": rubric.band,
                    "feedback": rubric.feedback,
                    "feature_evidence": rubric.feature_evidence,
                    **({"sentence_errors": rubric.sentence_errors} if rubric.sentence_errors is not None else {}),
                }
                for key, rubric in result.rubrics.items()
            },
            "metadata": result.metadata,
        }

        self._submissions.update_one(
            {"_id": payload.responseId},
            {
                "$set": {
                    "score": result.overall_band,
                    "feedback": result.feedback,
                    "status": "graded",
                    "updated_at": datetime.now(timezone.utc),
                    "grading_breakdown": grading_breakdown,
                }
            },
        )
        logger.info(
            "Speaking submission graded. responseId=%s score=%.1f",
            payload.responseId,
            result.overall_band,
        )

    def _mark_failed(self, response_id: str, reason: str) -> None:
        logger.error("Speaking grading failed for %s: %s", response_id, reason)
        self._submissions.update_one(
            {"_id": response_id},
            {"$set": {"status": "failed", "feedback": reason, "updated_at": datetime.now(timezone.utc)}},
        )


_worker_thread: threading.Thread | None = None


def maybe_start_speaking_queue_consumer() -> None:
    global _worker_thread
    enabled = os.getenv("ENABLE_SPEAKING_QUEUE_CONSUMER", "true").lower() in {"1", "true", "yes"}
    if not enabled:
        logger.info("Speaking queue consumer disabled by ENABLE_SPEAKING_QUEUE_CONSUMER")
        return
    if _worker_thread and _worker_thread.is_alive():
        return
    try:
        consumer = SpeakingQueueConsumer()
    except Exception:
        logger.exception("Speaking queue consumer not started due to configuration error")
        return
    _worker_thread = threading.Thread(
        target=consumer.run_forever,
        daemon=True,
        name="speaking-grade-queue-consumer",
    )
    _worker_thread.start()
    logger.info("Speaking queue consumer thread started")
```

- [ ] **Step 2: Wire into api.py startup**

In `apps/ai/ielts_ai/api.py`, add the import and startup call:

```python
# At the top of ielts_ai/api.py, add alongside the existing import:
from ielts_ai.speaking_queue_consumer import maybe_start_speaking_queue_consumer

# In the startup_queue_consumers function, add the call:
@app.on_event("startup")
def startup_queue_consumers() -> None:
    maybe_start_writing_queue_consumer()
    maybe_start_speaking_queue_consumer()   # ← add this line
```

- [ ] **Step 3: Add env vars to apps/ai/.env**

```
SPEAKING_GRADE_QUEUE=speaking_grade_queue
ENABLE_SPEAKING_QUEUE_CONSUMER=true
OLLAMA_HOST=http://localhost:11434
OLLAMA_SPEAKING_MODEL=llama3
```

- [ ] **Step 4: Smoke-test the startup**

```bash
cd apps/ai
ENABLE_SPEAKING_QUEUE_CONSUMER=false uvicorn api:app --reload --port 8001
```

Expected: server starts cleanly, log line `Speaking queue consumer disabled by ENABLE_SPEAKING_QUEUE_CONSUMER` appears. No crash.

Press Ctrl+C to stop.

- [ ] **Step 5: Commit**

```bash
git add ielts_ai/speaking_queue_consumer.py ielts_ai/api.py
git commit -m "feat(speaking): add SpeakingQueueConsumer and wire into api.py startup"
```

---

## Task 9: NestJS changes (apps/assignments)

**Files:**
- Modify: `apps/assignments/src/assignment/speaking/schemas/speaking-submission.schema.ts`
- Modify: `apps/assignments/src/assignment/speaking/speaking.service.ts`
- Modify: `apps/assignments/src/grade/grade.service.ts`

- [ ] **Step 1: Add grading_breakdown to SpeakingSubmission schema**

In `apps/assignments/src/assignment/speaking/schemas/speaking-submission.schema.ts`, add `grading_breakdown` after the existing `feedback` prop:

```typescript
// Add after the existing imports at the top:
import { Document, SchemaTypes } from 'mongoose';

// Add after the existing `feedback` @Prop:
@Prop({ type: SchemaTypes.Mixed })
grading_breakdown?: Record<string, any>;
```

The full updated class body (only the changed portion shown):

```typescript
@Schema({ collection: 'speaking_submissions', timestamps: { createdAt: 'created_at', updatedAt: false } })
export class SpeakingSubmission {
  @Prop({ type: String, default: () => uuidv4() })
  _id: string;

  @Prop({ required: true })
  assignment_id: string;

  @Prop({ required: true })
  user_id: string;

  @Prop()
  audio_url?: string;

  @Prop({ type: [TranscriptItemSchema], default: [] })
  transcripts?: TranscriptItem[];

  @Prop()
  score?: number;

  @Prop()
  feedback?: string;

  @Prop({ type: SchemaTypes.Mixed })
  grading_breakdown?: Record<string, any>;

  @Prop({ default: 'pending', enum: ['pending', 'graded', 'failed'] })
  status: SubmissionStatus;
}
```

- [ ] **Step 2: Change speaking.service.ts to publish to speaking_grade_queue**

In `apps/assignments/src/assignment/speaking/speaking.service.ts`, find the `submitResponse` method's `rabbitService.send` call (around line 130) and change it:

```typescript
// Before:
await this.rabbitService.send('grade_queue', {
  skill: 'speaking',
  responseId: submissionId,
  assignmentId: dto.assignment_id,
  userId: dto.user_id,
  audios: { ... },
});

// After:
await this.rabbitService.send('speaking_grade_queue', {
  responseId: submissionId,
  assignmentId: dto.assignment_id,
  userId: dto.user_id,
  audios: { ... },
});
```

The `audios` payload block (audioOne, audioTwo, audioThree) stays exactly the same. Only the queue name and removal of `skill: 'speaking'` change.

- [ ] **Step 3: Remove gradeSpeaking and SpeakingService from grade.service.ts**

Replace the full `GradeService` class with the cleaned-up version below. The changes are: remove `SpeakingService` constructor injection, remove `@Inject(forwardRef(() => SpeakingService))`, remove the `gradeSpeaking` private method, remove `case 'speaking':` from `processGradeMessage`.

```typescript
// apps/assignments/src/grade/grade.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';
import { RabbitService } from '../rabbit/rabbit.service';
import { ReadingService } from '../assignment/reading/reading.service';
import { ListeningService } from '../assignment/listening/listening.service';

@Injectable()
export class GradeService implements OnModuleInit {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(GradeService.name);

  constructor(
    private readonly rabbitService: RabbitService,
    private readonly readingService: ReadingService,
    private readonly listeningService: ListeningService,
  ) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async onModuleInit() {
    this.logger.log('Starting to consume from grade_queue...');
    await this.rabbitService.consume('grade_queue', async (message) => {
      await this.processGradeMessage(message);
    });
  }

  private async processGradeMessage(message: any) {
    this.logger.log(`Processing grade message for skill: ${message.skill}`);
    try {
      switch (message.skill) {
        case 'reading':
          await this.gradeReading(message);
          break;
        case 'listening':
          await this.gradeListening(message);
          break;
        default:
          this.logger.warn(`Unknown or unhandled skill type: ${message.skill}`);
      }
    } catch (error) {
      this.logger.error(`Error processing ${message.skill} grade:`, error);
      throw error;
    }
  }

  private async gradeReading(message: any) {
    this.logger.log(`Grading reading assignment: ${message.assignmentId}`);
    const submission = {
      assignment_id: message.assignmentId,
      submitted_by: message.userId,
      section_answers: message.sections,
    };
    const result = await this.readingService.gradeSubmission(submission);
    this.logger.log(`Reading graded successfully. Score: ${result.score}`);
  }

  private async gradeListening(message: any) {
    this.logger.log(`Grading listening assignment: ${message.assignmentId}`);
    const submission = {
      assignment_id: message.assignmentId,
      submitted_by: message.userId,
      section_answers: message.sections,
    };
    const result = await this.listeningService.gradeSubmission(submission);
    this.logger.log(`Listening graded successfully. Score: ${result.score}`);
  }

  async speechToText(file: Express.Multer.File) {
    const uint8Array = new Uint8Array(file.buffer);
    const blob = new Blob([uint8Array], { type: file.mimetype });
    const audioFile = new File([blob], file.originalname, { type: file.mimetype });
    const response = await this.openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    });
    return response.text;
  }
}
```

- [ ] **Step 4: Check that GradeModule no longer imports SpeakingModule**

Open `apps/assignments/src/grade/grade.module.ts`. If it imports `SpeakingModule` solely for the circular dep, remove that import. If `SpeakingModule` is imported for another reason (e.g., it provides GradeService to the speaking controller), leave it. The circular ref (`forwardRef`) is now gone so the import is safe to remove.

- [ ] **Step 5: Build assignments service to verify no TypeScript errors**

```bash
cd apps/assignments
pnpm run build
```

Expected: exits 0 with no TypeScript errors. If there are import errors related to removed SpeakingService references, fix them by removing those imports.

- [ ] **Step 6: Commit**

```bash
git add apps/assignments/src/assignment/speaking/schemas/speaking-submission.schema.ts \
        apps/assignments/src/assignment/speaking/speaking.service.ts \
        apps/assignments/src/grade/grade.service.ts
git commit -m "feat(speaking): route submissions to speaking_grade_queue, remove NestJS grader"
```

---

## Task 10: End-to-end contract test

**Files:**
- Create: `apps/ai/ielts_ai/tests/test_speaking_queue_consumer_contract.py`

This test requires RabbitMQ and MongoDB running locally. Skip it in CI unless those services are available.

- [ ] **Step 1: Write the contract test**

```python
# apps/ai/ielts_ai/tests/test_speaking_queue_consumer_contract.py
"""
End-to-end contract test for SpeakingQueueConsumer.
Requires: RabbitMQ on amqp://localhost:5672, MongoDB on MONGODB_URI.
Models are loaded from pronunciation/ — first run is slow (~60s).

Run with: pytest -v -m contract --timeout=120
"""
import base64
import json
import os
import time
import uuid

import pika
import pytest
from pymongo import MongoClient

from ielts_ai.paths import REPO_ROOT
from ielts_ai.speaking_queue_consumer import SpeakingQueueConsumer

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://localhost:5672")
MONGODB_URI = os.getenv("MONGODB_URI")
MONGO_DB = os.getenv("MONGODB_DB", "idest")
WAV_FIXTURE = REPO_ROOT / "pronunciation" / "voice-sample.wav"

pytestmark = pytest.mark.contract


@pytest.fixture
def mongo_submissions():
    client = MongoClient(MONGODB_URI)
    col = client[MONGO_DB]["speaking_submissions"]
    yield col
    client.close()


@pytest.fixture
def rabbitmq_channel():
    params = pika.URLParameters(RABBITMQ_URL)
    conn = pika.BlockingConnection(params)
    ch = conn.channel()
    ch.queue_declare(queue="speaking_grade_queue", durable=True)
    yield ch
    conn.close()


def _publish_message(channel, response_id: str, audio_bytes: bytes) -> None:
    audio_b64 = base64.b64encode(audio_bytes).decode()
    message = {
        "responseId": response_id,
        "assignmentId": "test-assignment-id",
        "userId": "test-user-id",
        "audios": {
            "audioOne": {"data": audio_b64, "mimetype": "audio/wav", "originalname": "test.wav"}
        },
    }
    channel.basic_publish(
        exchange="",
        routing_key="speaking_grade_queue",
        body=json.dumps(message).encode(),
        properties=pika.BasicProperties(delivery_mode=2),
    )


def _wait_for_graded(col, response_id: str, timeout: int = 90) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        doc = col.find_one({"_id": response_id})
        if doc and doc.get("status") in ("graded", "failed"):
            return doc
        time.sleep(2)
    raise TimeoutError(f"Submission {response_id} not graded within {timeout}s")


@pytest.mark.skipif(not MONGODB_URI, reason="MONGODB_URI not set")
def test_submission_transitions_to_graded(mongo_submissions, rabbitmq_channel):
    response_id = str(uuid.uuid4())
    audio_bytes = WAV_FIXTURE.read_bytes()

    # Insert a pending submission (mirrors what SpeakingService does)
    mongo_submissions.insert_one({
        "_id": response_id,
        "assignment_id": "test-assignment-id",
        "user_id": "test-user-id",
        "status": "pending",
        "audio_url": "",
        "transcripts": [],
    })

    try:
        _publish_message(rabbitmq_channel, response_id, audio_bytes)

        # Start a consumer that processes one message then stops
        consumer = SpeakingQueueConsumer()
        # Process exactly one message in this thread (blocking)
        params = pika.URLParameters(RABBITMQ_URL)
        conn = pika.BlockingConnection(params)
        ch = conn.channel()
        ch.queue_declare(queue="speaking_grade_queue", durable=True)
        ch.basic_qos(prefetch_count=1)

        processed = []

        def _consume_one(ch, method, props, body):
            consumer._consume(ch, method, props, body)
            processed.append(True)
            ch.stop_consuming()

        ch.basic_consume(queue="speaking_grade_queue", on_message_callback=_consume_one)
        ch.start_consuming()
        conn.close()

        doc = mongo_submissions.find_one({"_id": response_id})

        assert doc is not None
        assert doc["status"] == "graded"
        assert isinstance(doc["score"], float)
        assert 1.0 <= doc["score"] <= 9.0
        assert doc["score"] % 0.5 == 0.0

        breakdown = doc.get("grading_breakdown", {})
        assert breakdown, "grading_breakdown must be present"
        assert "overall_band" in breakdown
        rubrics = breakdown.get("rubrics", {})
        assert set(rubrics.keys()) == {"FC", "LR", "GR", "P"}
        for key, rubric in rubrics.items():
            assert 1.0 <= rubric["band"] <= 9.0, f"{key}.band out of range"
            assert "feature_evidence" in rubric

        assert isinstance(rubrics["P"].get("sentence_errors"), list)

    finally:
        mongo_submissions.delete_one({"_id": response_id})


@pytest.mark.skipif(not MONGODB_URI, reason="MONGODB_URI not set")
def test_grading_breakdown_with_ollama_disabled(mongo_submissions, rabbitmq_channel):
    """Verify heuristic fallback path: Ollama disabled, still produces valid bands."""
    import os
    original_model = os.environ.get("OLLAMA_SPEAKING_MODEL", "")
    os.environ["OLLAMA_SPEAKING_MODEL"] = ""

    response_id = str(uuid.uuid4())
    audio_bytes = WAV_FIXTURE.read_bytes()

    mongo_submissions.insert_one({
        "_id": response_id,
        "assignment_id": "test-assignment-id",
        "user_id": "test-user-id",
        "status": "pending",
        "audio_url": "",
        "transcripts": [],
    })

    try:
        _publish_message(rabbitmq_channel, response_id, audio_bytes)

        consumer = SpeakingQueueConsumer()
        params = pika.URLParameters(RABBITMQ_URL)
        conn = pika.BlockingConnection(params)
        ch = conn.channel()
        ch.queue_declare(queue="speaking_grade_queue", durable=True)
        ch.basic_qos(prefetch_count=1)

        def _consume_one(ch, method, props, body):
            consumer._consume(ch, method, props, body)
            ch.stop_consuming()

        ch.basic_consume(queue="speaking_grade_queue", on_message_callback=_consume_one)
        ch.start_consuming()
        conn.close()

        doc = mongo_submissions.find_one({"_id": response_id})
        assert doc["status"] == "graded"
        breakdown = doc["grading_breakdown"]
        assert "ollama_lr_gr" in breakdown["metadata"]["degraded_features"]

    finally:
        mongo_submissions.delete_one({"_id": response_id})
        os.environ["OLLAMA_SPEAKING_MODEL"] = original_model
```

- [ ] **Step 2: Run the contract test**

Make sure RabbitMQ is running:
```bash
docker run -d -p 5672:5672 rabbitmq
```

Then run (from `apps/ai/`):
```bash
MONGODB_URI=<your-mongo-uri> python -m pytest ielts_ai/tests/test_speaking_queue_consumer_contract.py -v -m contract --timeout=120
```

Expected:
```
test_submission_transitions_to_graded PASSED
test_grading_breakdown_with_ollama_disabled PASSED
```

Both tests confirm the pipeline writes a graded document with all four rubrics and a valid overall band.

- [ ] **Step 3: Commit**

```bash
git add ielts_ai/tests/test_speaking_queue_consumer_contract.py
git commit -m "test(speaking): add contract test for SpeakingQueueConsumer end-to-end"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Architecture: `SpeakingQueueConsumer` in `apps/ai` — Task 8
- [x] Data flow: audio decode → pipeline → feature extraction → Ollama → MongoDB write — Tasks 5–8
- [x] P band: acoustic pipeline (segmental, intelligibility, prosody) — Tasks 5, 2
- [x] FC band: fluency + rhythm + discourse markers — Tasks 5, 2
- [x] LR features + Ollama scoring — Tasks 3, 6
- [x] GR features + Ollama scoring — Tasks 4, 6
- [x] Sentence-level word errors with fix_hint — Task 5
- [x] Ollama pronunciation tips override rule-based fix_hint — Task 7
- [x] Heuristic fallback when Ollama unavailable — Tasks 2, 7
- [x] `grading_breakdown` schema on SpeakingSubmission — Task 9
- [x] Queue name change in SpeakingService — Task 9
- [x] Remove `gradeSpeaking()` from GradeService — Task 9
- [x] `maybe_start_speaking_queue_consumer()` in api.py startup — Task 8
- [x] Temp file cleanup — Task 5 (test_no_temp_files_left_behind)
- [x] Multi-part audio merge (duration-weighted average) — Task 5 (implementation)
- [x] `degraded_features` metadata — Task 7 (test_heuristic_bands_when_ollama_unavailable)
- [x] Contract test — Task 10

**Type consistency:**
- `AcousticFeatures`, `LexicalFeatures`, `GrammarFeatures`, `OllamaJudgment`, `RubricScore`, `SpeakingScoringResult` — all defined once, used consistently across tasks 5–8.
- `extract_acoustic_features`, `extract_lexical_features`, `extract_grammar_features`, `judge` — function signatures match between definition (Tasks 5–6) and usage (Task 7, mocked in tests).
- `SpeakingGradeMessage` defined in `speaking_queue_consumer.py` (Task 8) with `responseId`, `assignmentId`, `userId`, `audios` — matches what `SpeakingService` publishes (Task 9).
