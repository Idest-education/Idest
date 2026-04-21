from __future__ import annotations

import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import pika
from pydantic import BaseModel, ValidationError
from pymongo import DESCENDING, MongoClient

from ielts_ai.inference.task1_scorer import get_task1_scorer
from ielts_ai.main import grade_essay_overall_direct

logger = logging.getLogger(__name__)


class WritingGradeMessage(BaseModel):
    assignmentId: str
    userId: str
    contentOne: str
    contentTwo: str
    submissionId: str | None = None


class WritingQueueConsumer:
    def __init__(self) -> None:
        self.rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://localhost:5672")
        self.queue_name = os.getenv("WRITING_GRADE_QUEUE", "writing_grade_queue")
        self.mongo_uri = os.getenv("MONGODB_URI")
        self.mongo_db = os.getenv("MONGODB_DB", "idest")
        if not self.mongo_uri:
            raise RuntimeError("MONGODB_URI is required for writing queue consumer")

        self._mongo_client = MongoClient(self.mongo_uri)
        self._db = self._mongo_client[self.mongo_db]
        self._assignments = self._db["writing_assignments"]
        self._submissions = self._db["writing_submissions"]

    def run_forever(self) -> None:
        while True:
            connection = None
            try:
                params = pika.URLParameters(self.rabbitmq_url)
                connection = pika.BlockingConnection(params)
                channel = connection.channel()
                channel.queue_declare(queue=self.queue_name, durable=True)
                channel.basic_qos(prefetch_count=1)
                channel.basic_consume(queue=self.queue_name, on_message_callback=self._consume_message)
                logger.info("Writing queue consumer started for queue=%s", self.queue_name)
                channel.start_consuming()
            except Exception:
                logger.exception("Writing queue consumer crashed, retrying in 5s")
                time.sleep(5)
            finally:
                if connection and connection.is_open:
                    connection.close()

    def _consume_message(self, ch: Any, method: Any, _properties: Any, body: bytes) -> None:
        try:
            payload = WritingGradeMessage.model_validate_json(body)
            self._grade_submission(payload)
        except ValidationError:
            logger.exception("Invalid writing queue payload: %s", body.decode("utf-8", errors="ignore"))
        except Exception:
            logger.exception("Failed to process writing queue payload")
        finally:
            ch.basic_ack(delivery_tag=method.delivery_tag)

    def _grade_submission(self, payload: WritingGradeMessage) -> None:
        assignment = self._assignments.find_one({"_id": payload.assignmentId})
        if not assignment:
            self._mark_failed(payload, f"Writing assignment not found: {payload.assignmentId}")
            return

        tasks = assignment.get("tasks") or []
        task1 = next((task for task in tasks if task.get("task_number") == 1), None)
        task2 = next((task for task in tasks if task.get("task_number") == 2), None)
        if not task1 or not task2:
            self._mark_failed(payload, "Writing assignment must contain both task 1 and task 2")
            return

        submission_id = self._ensure_submission_id(payload, task1, task2)

        task1_prompt = self._build_task_prompt(task1)
        task2_prompt = self._build_task_prompt(task2)
        task1_image_desc = ((task1.get("stimulus") or {}).get("data_description_md") or "").strip()
        if not task1_image_desc:
            task1_image_desc = "No chart description available."

        task1_result, _ = get_task1_scorer().score(
            task1_prompt,
            payload.contentOne,
            image_description=task1_image_desc,
            image_bytes=None,
        )
        task2_result = grade_essay_overall_direct(task2_prompt, payload.contentTwo)

        task1_overall = float(task1_result.scores.get("overall", 0.0))
        task2_overall = float(task2_result.get("grade", 0.0))
        final_score = round((task1_overall + task2_overall) / 2, 1)

        feedback = (
            f"Task 1 ({task1_overall:.1f}):\n{task1_result.description}\n\n"
            f"Task 2 ({task2_overall:.1f}):\n{task2_result.get('description', '')}"
        )
        now = datetime.now(timezone.utc)

        self._submissions.update_one(
            {"_id": submission_id},
            {
                "$set": {
                    "score": final_score,
                    "feedback": feedback,
                    "status": "graded",
                    "updated_at": now,
                    "grading_breakdown": {
                        "task1": {
                            "score": task1_overall,
                            "description": task1_result.description,
                            "metadata": task1_result.metadata,
                        },
                        "task2": {
                            "score": task2_overall,
                            "description": task2_result.get("description"),
                            "metadata": task2_result.get("metadata", {}),
                        },
                    },
                }
            },
        )
        logger.info(
            "Writing submission graded. assignmentId=%s userId=%s score=%.1f",
            payload.assignmentId,
            payload.userId,
            final_score,
        )

    def _mark_failed(self, payload: WritingGradeMessage, reason: str) -> None:
        logger.error("Writing grading failed: %s", reason)
        self._submissions.update_one(
            self._submission_filter(payload),
            {
                "$set": {
                    "status": "failed",
                    "feedback": reason,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

    def _ensure_submission_id(
        self,
        payload: WritingGradeMessage,
        task1: dict[str, Any],
        task2: dict[str, Any],
    ) -> str:
        if payload.submissionId:
            return payload.submissionId

        latest_submission = self._submissions.find_one(
            {
                "assignment_id": payload.assignmentId,
                "user_id": payload.userId,
                "status": "pending",
            },
            sort=[("created_at", DESCENDING)],
        )
        if latest_submission:
            return str(latest_submission["_id"])

        submission_id = str(uuid4())
        now = datetime.now(timezone.utc)
        content_by_task_id = {
            str(task1.get("id") or "task1"): payload.contentOne,
            str(task2.get("id") or "task2"): payload.contentTwo,
        }
        self._submissions.insert_one(
            {
                "_id": submission_id,
                "assignment_id": payload.assignmentId,
                "user_id": payload.userId,
                "content_by_task_id": content_by_task_id,
                "status": "pending",
                "created_at": now,
            }
        )
        logger.info(
            "Created writing submission automatically. assignmentId=%s userId=%s submissionId=%s",
            payload.assignmentId,
            payload.userId,
            submission_id,
        )
        return submission_id

    def _submission_filter(self, payload: WritingGradeMessage) -> dict[str, Any]:
        if payload.submissionId:
            return {"_id": payload.submissionId}

        latest_submission = self._submissions.find_one(
            {
                "assignment_id": payload.assignmentId,
                "user_id": payload.userId,
                "status": "pending",
            },
            sort=[("created_at", DESCENDING)],
        )
        if latest_submission:
            return {"_id": latest_submission["_id"]}

        return {
            "assignment_id": payload.assignmentId,
            "user_id": payload.userId,
        }

    @staticmethod
    def _build_task_prompt(task: dict[str, Any]) -> str:
        prompt = str(task.get("prompt_md") or "").strip()
        data_description = str(((task.get("stimulus") or {}).get("data_description_md") or "")).strip()
        if not data_description:
            return prompt
        return f"{prompt}\n\nData / context:\n{data_description}"


_worker_thread: threading.Thread | None = None


def maybe_start_writing_queue_consumer() -> None:
    global _worker_thread
    enabled = os.getenv("ENABLE_WRITING_QUEUE_CONSUMER", "true").lower() in {"1", "true", "yes"}
    if not enabled:
        logger.info("Writing queue consumer disabled by ENABLE_WRITING_QUEUE_CONSUMER")
        return
    if _worker_thread and _worker_thread.is_alive():
        return

    try:
        consumer = WritingQueueConsumer()
    except Exception:
        logger.exception("Writing queue consumer not started due to configuration error")
        return
    _worker_thread = threading.Thread(
        target=consumer.run_forever,
        daemon=True,
        name="writing-grade-queue-consumer",
    )
    _worker_thread.start()
    logger.info("Writing queue consumer thread started")
