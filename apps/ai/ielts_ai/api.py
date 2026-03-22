from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, Field

from ielts_ai.main import grade_essay, grade_essay_overall_direct

app = FastAPI(title="AI", version="0.1.0")


class GradeRequest(BaseModel):
    question: str
    essay: str


class GradeResponse(BaseModel):
    task_achievement: float
    coherence: float
    lexical: float
    grammar: float
    overall: float
    overall_display: str | None = None
    description: str
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


@app.post("/grade/writing")
def grade_writing(req: GradeRequest) -> GradeResponse:
    scores = grade_essay(req.question, req.essay)
    metadata = scores.get("metadata", {})
    scores["confidence"] = metadata.get("confidence")
    scores["abstained"] = bool(metadata.get("abstained", False))
    return GradeResponse(**scores)


@app.post("/writing_task_2_grading")
def writing_task_2_grading(req: GradeRequest) -> WritingTask2GradeResponse:
    payload = grade_essay_overall_direct(req.question, req.essay)
    metadata = payload.get("metadata", {})
    payload["confidence"] = metadata.get("confidence")
    payload["abstained"] = bool(metadata.get("abstained", False))
    return WritingTask2GradeResponse(**payload)
