from __future__ import annotations

import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from ollama import Client
from pydantic import BaseModel, Field, ValidationError

RUBRIC_KEYS = ("task_achievement", "coherence", "lexical", "grammar")
DEFAULT_FEEDBACK_MODEL = "phi3:mini"
DEFAULT_FEEDBACK_HOST = "http://127.0.0.1:11434"
DEFAULT_TIMEOUT = 180.0
DEFAULT_NUM_PREDICT = 320
DEFAULT_MAX_WORKERS = 4
DEFAULT_MAX_ATTEMPTS = 2

RUBRIC_LABELS = {
    "task_achievement": "Task Achievement / Task Response",
    "coherence": "Coherence and Cohesion",
    "lexical": "Lexical Resource",
    "grammar": "Grammatical Range and Accuracy",
}

RUBRIC_CRITERIA = {
    "task_achievement": (
        "Does the essay fully address all parts of the prompt, present a clear position, "
        "and develop ideas with relevant support?"
    ),
    "coherence": (
        "Is the essay logically organised with clear paragraphing, effective cohesion, "
        "and smooth progression between ideas?"
    ),
    "lexical": (
        "Is vocabulary varied, precise, and used with control? Are there collocation, "
        "register, or word-choice issues?"
    ),
    "grammar": (
        "Is grammar accurate and varied? Consider sentence structure range, tense control, "
        "articles, agreement, and punctuation."
    ),
}


class RubricFeedbackItem(BaseModel):
    strengths: list[str] = Field(default_factory=list, min_length=1, max_length=2)
    flaws: list[str] = Field(default_factory=list, min_length=1, max_length=2)
    improvements: list[str] = Field(default_factory=list, min_length=1, max_length=2)
    example_rewrite: str = Field(min_length=16, max_length=240)
    evidence_quote: str = Field(min_length=8, max_length=200)


class DetailedFeedback(BaseModel):
    task_achievement: RubricFeedbackItem
    coherence: RubricFeedbackItem
    lexical: RubricFeedbackItem
    grammar: RubricFeedbackItem


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _feedback_settings(task: str) -> tuple[str, str]:
    host = os.environ.get("FEEDBACK_OLLAMA_HOST") or os.environ.get("OLLAMA_HOST") or DEFAULT_FEEDBACK_HOST
    task_key = task.strip().upper()
    model = (
        os.environ.get(f"{task_key}_FEEDBACK_OLLAMA_MODEL")
        or os.environ.get("FEEDBACK_OLLAMA_MODEL")
        or DEFAULT_FEEDBACK_MODEL
    )
    return host, model


def _compact_scores(scores: dict[str, Any]) -> dict[str, float]:
    out: dict[str, float] = {}
    for key in RUBRIC_KEYS:
        value = scores.get(key)
        if isinstance(value, int | float):
            out[key] = float(value)
    return out


def _rubric_item_issues(item: RubricFeedbackItem) -> list[str]:
    issues: list[str] = []
    if not item.strengths:
        issues.append("strengths must not be empty")
    if not item.flaws:
        issues.append("flaws must not be empty")
    if not item.improvements:
        issues.append("improvements must not be empty")
    if not item.evidence_quote or not item.evidence_quote.strip():
        issues.append("evidence_quote must not be empty")
    if not item.example_rewrite or not item.example_rewrite.strip():
        issues.append("example_rewrite must not be empty")
    return issues


def _rubric_system_prompt(rubric_key: str) -> str:
    label = RUBRIC_LABELS[rubric_key]
    criteria = RUBRIC_CRITERIA[rubric_key]
    return (
        "You are an IELTS examiner and writing coach. "
        f"Produce feedback ONLY for the rubric '{label}'. {criteria} "
        "Return a single JSON object that matches the provided schema. "
        "Include 1-2 concrete strengths, 1-2 concrete flaws, and 1-2 actionable improvements. "
        "Flaws and improvements must be specific and grounded in the essay's wording. "
        "Provide a short evidence_quote copied from (or closely matching) the essay. "
        "Provide a concise example_rewrite (no more than about 45 words). "
        "Do not leave any array empty. Do not emit generic praise without a concrete weakness. "
        "Do not include any keys other than strengths, flaws, improvements, evidence_quote, example_rewrite."
    )


def _rubric_user_prompt(
    *,
    rubric_key: str,
    task: str,
    question: str,
    essay: str,
    score: float | None,
    image_description: str | None,
) -> str:
    reference_block = ""
    if task == "task1" and image_description:
        reference_block = f"\nREFERENCE_FIGURE_DESCRIPTION:\n{image_description.strip()}\n"
    score_line = f"RUBRIC_SCORE: {score:.1f}\n" if isinstance(score, int | float) else ""
    return (
        f"RUBRIC: {RUBRIC_LABELS[rubric_key]}\n"
        f"TASK_TYPE: {task}\n"
        f"QUESTION:\n{question.strip()}\n"
        f"{reference_block}"
        f"{score_line}"
        f"ESSAY:\n{essay.strip()}\n\n"
        "Return JSON only with these keys: "
        "strengths, flaws, improvements, evidence_quote, example_rewrite.\n"
        "Rules:\n"
        "- 1-2 strengths, 1-2 flaws, 1-2 improvements (never empty)\n"
        "- every bullet <= ~18 words\n"
        "- example_rewrite <= ~45 words\n"
        "- evidence_quote drawn from the essay\n"
        "- scores below 7.0 must have substantive weaknesses"
    )


def _repair_truncated_json(raw: str) -> str | None:
    """Best-effort repair for a single-object JSON that was cut off mid-string.

    Only attempts a repair when the raw response clearly starts as an object
    and has a hanging string. Returns a candidate JSON string, or None.
    """
    text = raw.strip()
    if not text.startswith("{"):
        return None
    quote_count = 0
    escaped = False
    in_string = False
    for ch in text:
        if escaped:
            escaped = False
            continue
        if ch == "\\":
            escaped = True
            continue
        if ch == '"':
            in_string = not in_string
            quote_count += 1
    candidate = text
    if in_string:
        candidate += '"'
    candidate = candidate.rstrip().rstrip(",")
    opens = candidate.count("{")
    closes = candidate.count("}")
    if opens > closes:
        candidate += "}" * (opens - closes)
    return candidate


def _call_ollama_for_rubric(
    *,
    client: Client,
    model: str,
    rubric_key: str,
    task: str,
    question: str,
    essay: str,
    score: float | None,
    image_description: str | None,
    num_predict: int,
    max_attempts: int,
    debug: bool,
) -> tuple[RubricFeedbackItem | None, dict[str, Any]]:
    """Generate feedback for a single rubric with retry + best-effort JSON repair."""
    system_prompt = _rubric_system_prompt(rubric_key)
    base_user_prompt = _rubric_user_prompt(
        rubric_key=rubric_key,
        task=task,
        question=question,
        essay=essay,
        score=score,
        image_description=image_description,
    )
    schema = RubricFeedbackItem.model_json_schema()

    last_error: Exception | None = None
    raw_last: str = ""
    correction: str = ""
    for attempt in range(max(1, max_attempts)):
        user_prompt = base_user_prompt if not correction else f"{base_user_prompt}\n\n{correction}"
        try:
            response = client.chat(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                format=schema,
                options={
                    "temperature": 0,
                    "num_predict": num_predict,
                    "stop": ["\n\n\n"],
                },
            )
            raw = (response.message.content or "").strip()
            raw_last = raw
            if not raw:
                raise ValueError("empty model response")

            parsed: RubricFeedbackItem | None = None
            try:
                parsed = RubricFeedbackItem.model_validate_json(raw)
            except (ValidationError, json.JSONDecodeError, ValueError) as parse_exc:
                repaired = _repair_truncated_json(raw)
                if repaired is not None:
                    try:
                        parsed = RubricFeedbackItem.model_validate_json(repaired)
                    except (ValidationError, json.JSONDecodeError, ValueError):
                        parsed = None
                if parsed is None:
                    raise parse_exc

            issues = _rubric_item_issues(parsed)
            if issues:
                last_error = ValueError("; ".join(issues))
                if attempt + 1 < max(1, max_attempts):
                    correction = (
                        "Your previous JSON was invalid. Fix these issues and return JSON only:\n- "
                        + "\n- ".join(issues)
                    )
                    continue
                raise last_error

            meta: dict[str, Any] = {"status": "ok", "attempts": attempt + 1}
            if debug:
                meta["raw"] = raw[:2000]
            return parsed, meta
        except (
            ValidationError,
            json.JSONDecodeError,
            ValueError,
            KeyError,
            AttributeError,
        ) as exc:
            last_error = exc
            correction = (
                "Your previous response was not valid JSON or missed required fields. "
                "Return JSON ONLY matching the schema (strengths, flaws, improvements, "
                "evidence_quote, example_rewrite)."
            )
        except Exception as exc:  # pragma: no cover - runtime client failures
            last_error = exc
            break

    meta = {
        "status": "error",
        "attempts": max(1, max_attempts),
        "error": str(last_error)[:500] if last_error else "unknown_error",
    }
    if debug and raw_last:
        meta["raw"] = raw_last[:2000]
    return None, meta


def generate_detailed_feedback(
    *,
    task: str,
    question: str,
    essay: str,
    scores: dict[str, Any],
    image_description: str | None = None,
    max_attempts: int | None = None,
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    """Generate rubric feedback by running one Ollama call per rubric in parallel.

    Returns ``(feedback_payload_or_none, metadata)``. Scoring must never fail
    because of this function, so all errors are returned via metadata.
    """
    normalized_scores = _compact_scores(scores)
    if not normalized_scores:
        return None, {"feedback_status": "skipped", "feedback_error": "missing_rubric_scores"}

    host, model = _feedback_settings(task)
    timeout = _env_float("FEEDBACK_OLLAMA_TIMEOUT", DEFAULT_TIMEOUT)
    num_predict = _env_int("FEEDBACK_NUM_PREDICT", DEFAULT_NUM_PREDICT)
    max_workers = max(1, min(len(RUBRIC_KEYS), _env_int("FEEDBACK_MAX_WORKERS", DEFAULT_MAX_WORKERS)))
    debug = _env_bool("FEEDBACK_DEBUG", False)
    attempts = max_attempts if isinstance(max_attempts, int) and max_attempts > 0 else DEFAULT_MAX_ATTEMPTS

    client = Client(host=host, timeout=timeout)

    per_rubric_items: dict[str, RubricFeedbackItem] = {}
    per_rubric_status: dict[str, dict[str, Any]] = {}
    debug_payload: dict[str, Any] = {}

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        future_to_key = {
            pool.submit(
                _call_ollama_for_rubric,
                client=client,
                model=model,
                rubric_key=rubric_key,
                task=task,
                question=question,
                essay=essay,
                score=normalized_scores.get(rubric_key),
                image_description=image_description,
                num_predict=num_predict,
                max_attempts=attempts,
                debug=debug,
            ): rubric_key
            for rubric_key in RUBRIC_KEYS
        }
        for future in as_completed(future_to_key):
            rubric_key = future_to_key[future]
            try:
                item, meta = future.result()
            except Exception as exc:  # pragma: no cover - defensive
                item, meta = None, {"status": "error", "error": str(exc)[:500]}
            status_entry = {"status": meta.get("status"), "attempts": meta.get("attempts")}
            if meta.get("error"):
                status_entry["error"] = meta["error"]
            per_rubric_status[rubric_key] = status_entry
            if debug and "raw" in meta:
                debug_payload[rubric_key] = meta["raw"]
            if item is not None:
                per_rubric_items[rubric_key] = item

    metadata: dict[str, Any] = {
        "feedback_model": model,
        "feedback_ollama_host": host,
        "feedback_num_predict": num_predict,
        "feedback_max_workers": max_workers,
        "feedback_per_rubric_status": per_rubric_status,
    }
    if debug and debug_payload:
        metadata["feedback_debug"] = debug_payload

    missing = [key for key in RUBRIC_KEYS if key not in per_rubric_items]
    if missing:
        errors = [f"{key}:{per_rubric_status.get(key, {}).get('error', 'unknown')}" for key in missing]
        metadata["feedback_status"] = "error"
        metadata["feedback_error"] = f"missing_rubrics={','.join(missing)}; " + " | ".join(errors)
        return None, metadata

    feedback = DetailedFeedback(**per_rubric_items)
    metadata["feedback_status"] = "ok"
    return feedback.model_dump(), metadata
