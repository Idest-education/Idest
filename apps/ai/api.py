from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, Field

from main import grade_essay

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
    description: str
    metadata: dict = Field(default_factory=dict)


@app.post("/grade/writing")
def grade_writing(req: GradeRequest) -> GradeResponse:
    scores = grade_essay(req.question, req.essay)
    return GradeResponse(**scores)
