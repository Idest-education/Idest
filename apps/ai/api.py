from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel

from main import grade_essay

app = FastAPI(title="AI", version="0.1.0")


class GradeRequest(BaseModel):
    question: str
    essay: str


@app.post("/grade/writing")
def grade_writing(req: GradeRequest):
    scores = grade_essay(req.question, req.essay)

    return {
        "task_achievement": scores["task_achievement"],
        "coherence": scores["coherence"],
        "lexical": scores["lexical"],
        "grammar": scores["grammar"],
        "overall": scores["overall"],
        "description": (
            "Your essay addresses the task with adequate ideas and supporting details. "
            "There is reasonable coherence and cohesion, with some effective use of linking devices. "
            "Lexical resource is sufficient with occasional flexibility. "
            "Grammatical range and accuracy are generally good with minor errors."
        ),
    }
