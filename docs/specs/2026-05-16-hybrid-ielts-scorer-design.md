# Hybrid IELTS Writing Scorer — Design Spec
**Date:** 2026-05-16  
**Scope:** `apps/ai` — writing scoring pipeline only

---

## Problem

The current CatBoost scorer collapses predictions to Band 5–7 regardless of actual essay quality.  
Confirmed by evaluation data:

- Task 2 Band 9.0 TA: MAE **2.39** — nearly 2.5 bands wrong
- Task 2 CC real-test MAE: **1.04** — nearly a full band off on average
- Task 1 TA ≤4 slice: ACC_exact **0.000%** — never correct on weak essays
- Root cause: regression-to-mean from class imbalance (only 95 Band 9 essays in 9,189)

The fix is not retraining. CatBoost operates on surface features (error counts, n-grams, readability scores) and cannot assess semantic qualities that differentiate Band 6 from Band 8: argument development, task response depth, discourse coherence. Only an LLM can do that.

---

## Approach

**CatBoost as feature extractor → Ollama as judge.**

CatBoost never produces a band score. It extracts 18 interpretable quantitative signals. Those signals are formatted as an annotation block and included in the Ollama prompt alongside the essay text and IELTS rubric descriptors. Ollama scores all four rubrics and the overall band.

Word count gate:
- `< 100` or `> 500` words → skip feature extraction (out-of-distribution), Ollama scores alone
- `100–500` words → extract features, include annotation in prompt

Fully local. No external APIs. Uses `llama3.1:8b` already running in Ollama.

---

## Architecture

```
grade_essay(question, essay)
      │
      ├─ word_count < 100 or > 500?
      │       └─ yes → OllamaIELTSJudge.score(question, essay, profile=None)
      │
      └─ no
          ├─ build_feature_profile(essay, sent_model)  → EssayFeatureProfile
          └─ OllamaIELTSJudge.score(question, essay, profile)  → scores
```

No blending. Ollama is the sole scorer. CatBoost features are context, not votes.

---

## New Files

### `ielts_ai/scoring/feature_profile.py`

Dataclass + builder. Calls existing extractors, returns `EssayFeatureProfile`.

```python
@dataclass
class EssayFeatureProfile:
    # GR signals
    grammar_errors_per_100w: float
    spelling_errors_per_100w: float
    sentence_length_mean: float
    sentence_length_std: float
    subordinate_clause_ratio: float

    # LR signals
    lexical_diversity_mtld: float
    type_token_ratio: float
    lexical_density: float
    rare_word_ratio: float
    academic_word_ratio: float
    repetition_ratio: float
    collocation_quality: float

    # CC signals
    discourse_marker_count: int
    discourse_density_score: float
    sentence_coherence_mean: float
    body_paragraph_count: int
    avg_paragraph_length: float

    # Readability
    flesch_kincaid_grade: float

def build_feature_profile(essay: str, sent_model) -> EssayFeatureProfile: ...
```

### `ielts_ai/scoring/ollama_ielts_judge.py`

Sends structured prompt to Ollama, parses JSON response.

- Temperature: `0.1`
- Model: `llama3.1:8b` (configurable via `OLLAMA_MODEL` env var)
- Retries: 2 on parse failure
- Validation: clamps scores to nearest 0.5 in [1.0, 9.0]; recomputes `overall` as `round(mean(TA,CC,LR,GR)*2)/2`
- Fallback: if 2 retries fail → raises `OllamaJudgeError`

System prompt embeds IELTS band descriptors for TA, CC, LR, GR (bands 4–9).  
Requires JSON output only — no prose.

Task 1 uses a separate system prompt with Task Response descriptors (data description, not argumentation).

### `ielts_ai/scoring/hybrid_scorer.py`

Orchestrator. Exposes `score_task2(question, essay)` and `score_task1(question, essay, image_description)`.

On `OllamaJudgeError`: logs, returns `None` scores with `llm_failed: true` in metadata.  
On Ollama unavailable: same fallback.

---

## Modified Files

### `writing_scorer/features/lexical_features.py`
Add `type_token_ratio` to `extract_lexical_features()` return dict.  
One line: `"type_token_ratio": _safe_ratio(len(set(tokens)), len(tokens))`

### `writing_scorer/features/coherence_features.py`
Add `sentence_length_std` and `avg_paragraph_length` to `structural_features()`.  
Both trivial arithmetic on existing data (`split_sentences`, `split_paragraphs`).

### `inference/scorer.py`
Replace `Scorer._predict()` internals with `HybridScorer.score_task2()`.  
Public signatures unchanged: `grade_essay(question, essay)` still works.

### `inference/task1_scorer.py`
Replace `Task1Scorer.score()` internals with `HybridScorer.score_task1()`.  
Public signatures unchanged.

### `writing_queue_consumer.py`
Change image description resolution:
```python
# Before
task1_image_desc = ((task1.get("stimulus") or {}).get("data_description_md") or "").strip()
if not task1_image_desc:
    task1_image_desc = "No chart description available."

# After
image_url = ((task1.get("stimulus") or {}).get("images") or [{}])[0].get("url") or ""
task1_image_desc = resolve_task1_figure_description(
    subject=task1_prompt,
    image_url=image_url,
    data_description_md=((task1.get("stimulus") or {}).get("data_description_md") or ""),
)
```

---

## Ollama Prompt Design

### System prompt (Task 2)
```
You are a certified IELTS examiner. Score the candidate's essay on four rubrics.
Scores must be multiples of 0.5, range 1.0–9.0.

TASK ACHIEVEMENT (TA):
9: Fully addresses all parts; position fully developed with extended ideas
8: Sufficiently addresses all parts; well-developed, relevant response
7: Covers all parts adequately; clear position throughout
6: Addresses all parts but unequally; relevant position, some development
5: Partially addresses requirements; position sometimes unclear
4: Minimally addresses task; position unclear or irrelevant

COHERENCE & COHESION (CC): [same band structure]
LEXICAL RESOURCE (LR):     [same band structure]
GRAMMATICAL RANGE (GR):    [same band structure]

Return ONLY valid JSON, no prose:
{"TA": float, "CC": float, "LR": float, "GR": float, "overall": float,
 "reasoning": {"TA": "...", "CC": "...", "LR": "...", "GR": "..."}}
```

### User prompt
```
TASK PROMPT:
{question}

CANDIDATE ESSAY ({word_count} words):
{essay}

AUTOMATED ANALYSIS (corroborating signals — do not override your reading):
Grammar:  {grammar_errors_per_100w:.1f} errors/100w | {spelling_errors_per_100w:.1f} spelling/100w | subordinate_clause_ratio={subordinate_clause_ratio:.2f}
Lexical:  MTLD={lexical_diversity_mtld:.0f} | TTR={type_token_ratio:.2f} | rare={rare_word_ratio:.0%} | academic={academic_word_ratio:.0%} | repetition={repetition_ratio:.0%}
Cohesion: {discourse_marker_count} markers | density={discourse_density_score:.2f} | sentence_flow={sentence_coherence_mean:.2f} | {body_paragraph_count} body paragraphs
Register: FK_grade={flesch_kincaid_grade:.1f} | lexical_density={lexical_density:.2f}

Score this essay.
```

---

## Feature Sourcing

| Feature | Source | Change needed |
|---------|--------|--------------|
| `grammar_errors_per_100w` | `extract_lt_features()` | none |
| `spelling_errors_per_100w` | `extract_lt_features()` | none |
| `sentence_length_mean` | `extract_syntax_features()` | none |
| `sentence_length_std` | `_syntax_features_from_doc()` | add `np.std` to return |
| `subordinate_clause_ratio` | `extract_syntax_features()` | none |
| `lexical_diversity_mtld` | `extract_lexical_features()` | none |
| `type_token_ratio` | `extract_lexical_features()` | add 1 line |
| `lexical_density` | `extract_lexical_features()` | none |
| `rare_word_ratio` | `extract_lexical_features()` | none |
| `academic_word_ratio` | `extract_lexical_features()` | none |
| `repetition_ratio` | `extract_lexical_features()` | none |
| `collocation_quality` | `extract_lexical_features()` | none |
| `discourse_marker_count` | `discourse_marker_features()` | sum 4 keys |
| `discourse_density_score` | `discourse_marker_features()` | none |
| `sentence_coherence_mean` | `extract_sentence_coherence_features_batch()` | inject sent_model |
| `body_paragraph_count` | `structural_features()` | none |
| `avg_paragraph_length` | `structural_features()` | add 1 line |
| `flesch_kincaid_grade` | `extract_readability_features()` | none |

---

## Word Count Gate

| Word count | Behaviour |
|-----------|-----------|
| < 100 | Ollama only, no feature annotation, `word_count_warning: true` in metadata |
| 100–500 | Feature profile computed + included in prompt |
| > 500 | Ollama only, no feature annotation, `word_count_warning: true` in metadata |

---

## Error Handling

| Failure | Behaviour |
|---------|-----------|
| Ollama unreachable | Return `None` scores, `llm_failed: true`, log error |
| JSON parse fails × 2 | Same fallback |
| Feature extraction error | Skip annotation block, proceed with Ollama alone |
| LanguageTool timeout | Skip grammar features, partial profile still passed |

---

## What Stays the Same

- `grade_essay(question, essay)` — same signature, same return shape
- `Task1Scorer.score()` — same signature
- REST endpoints `/grade/writing`, `/grade/writing_task1`
- Queue consumer message format
- MongoDB schema
- Docker image (no new dependencies)
