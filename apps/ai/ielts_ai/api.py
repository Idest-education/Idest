from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from ielts_ai.inference.task1_scorer import decode_image_base64, get_task1_scorer
from ielts_ai.main import grade_essay, grade_essay_overall_direct
from ielts_ai.writing_queue_consumer import maybe_start_writing_queue_consumer

app = FastAPI(title="AI", version="0.1.0")
_task1_executor = ThreadPoolExecutor(max_workers=2)


@app.on_event("startup")
def startup_queue_consumers() -> None:
    maybe_start_writing_queue_consumer()


class GradeRequest(BaseModel):
    question: str
    essay: str


class RubricFeedbackItem(BaseModel):
    strengths: list[str] = Field(default_factory=list)
    flaws: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    example_rewrite: str | None = None
    evidence_quote: str | None = None


class DetailedFeedback(BaseModel):
    task_achievement: RubricFeedbackItem
    coherence: RubricFeedbackItem
    lexical: RubricFeedbackItem
    grammar: RubricFeedbackItem


class GradeResponse(BaseModel):
    task_achievement: float
    coherence: float
    lexical: float
    grammar: float
    overall: float
    overall_display: str | None = None
    description: str
    detailed_feedback: DetailedFeedback | None = None
    confidence: float | None = None
    abstained: bool = False
    metadata: dict = Field(default_factory=dict)


class WritingTask2GradeResponse(BaseModel):
    grade: float
    grade_display: str | None = None
    description: str
    confidence: float | None = None
    abstained: bool = False
    metadata: dict = Field(default_factory=dict)


class Task1GradeJsonRequest(BaseModel):
    """JSON alternative to multipart ``/grade/writing_task1``. Prefer ``image_description`` when available."""

    question: str
    essay: str
    image_description: str | None = None
    image_base64: str | None = Field(
        default=None,
        description="Raw or data-URL base64; used only when image_description is empty.",
    )


class Task1GradeResponse(BaseModel):
    task_achievement: float
    coherence: float
    lexical: float
    grammar: float
    overall: float
    overall_display: str | None = None
    description: str
    detailed_feedback: DetailedFeedback | None = None
    figure_description_source: str
    image_description_used: str | None = None
    confidence: float | None = None
    abstained: bool = False
    metadata: dict = Field(default_factory=dict)


@app.post("/grade/writing")
def grade_writing(req: GradeRequest) -> GradeResponse:
    scores = grade_essay(req.question, req.essay)
    metadata = scores.get("metadata", {})
    scores["confidence"] = metadata.get("confidence")
    scores["abstained"] = bool(metadata.get("abstained", False))
    scores["detailed_feedback"] = metadata.get("detailed_feedback")
    return GradeResponse(**scores)


@app.post("/writing_task_2_grading")
def writing_task_2_grading(req: GradeRequest) -> WritingTask2GradeResponse:
    payload = grade_essay_overall_direct(req.question, req.essay)
    metadata = payload.get("metadata", {})
    payload["confidence"] = metadata.get("confidence")
    payload["abstained"] = bool(metadata.get("abstained", False))
    return WritingTask2GradeResponse(**payload)


def _task1_grade_response(result, fig_meta: dict) -> Task1GradeResponse:
    raw = dict(result.scores)
    conf = raw.pop("confidence", None)
    metadata = dict(result.metadata)
    metadata["figure"] = fig_meta
    abst = bool(metadata.get("abstained", False))
    desc_full = str(fig_meta.get("resolved_description") or "")
    preview = desc_full if len(desc_full) <= 2000 else desc_full[:2000] + "…"
    return Task1GradeResponse(
        **raw,
        description=result.description,
        detailed_feedback=metadata.get("detailed_feedback"),
        figure_description_source=str(fig_meta.get("figure_description_source", "unknown")),
        image_description_used=preview or None,
        confidence=metadata.get("confidence") if metadata.get("confidence") is not None else conf,
        abstained=abst,
        metadata=metadata,
    )


@app.post("/grade/writing_task1")
async def grade_writing_task1(
    question: str = Form(..., description="Task 1 prompt (the chart/task wording)."),
    essay: str = Form(..., description="Candidate response."),
    image_description: str | None = Form(
        default=None,
        description="Neutral figure description; if set, VLM is not used.",
    ),
    image: UploadFile | None = File(
        default=None,
        description="Chart image; used only when image_description is empty (requires local Ollama VLM).",
    ),
) -> Task1GradeResponse:
    img_bytes: bytes | None = None
    if image is not None and getattr(image, "filename", None):
        img_bytes = await image.read()

    loop = asyncio.get_running_loop()

    def _run():
        return get_task1_scorer().score(
            question,
            essay,
            image_description=image_description,
            image_bytes=img_bytes,
        )

    try:
        result, fig_meta = await loop.run_in_executor(_task1_executor, _run)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    return _task1_grade_response(result, fig_meta)


@app.post("/grade/writing_task1/json")
async def grade_writing_task1_json(body: Task1GradeJsonRequest) -> Task1GradeResponse:
    img_bytes: bytes | None = None
    if not (body.image_description or "").strip() and body.image_base64:
        try:
            img_bytes = decode_image_base64(body.image_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image_base64: {e}") from e

    loop = asyncio.get_running_loop()

    def _run():
        return get_task1_scorer().score(
            body.question,
            body.essay,
            image_description=body.image_description,
            image_bytes=img_bytes,
        )

    try:
        result, fig_meta = await loop.run_in_executor(_task1_executor, _run)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    return _task1_grade_response(result, fig_meta)
