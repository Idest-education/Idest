from __future__ import annotations

import base64
import dataclasses
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
                    **(
                        {
                            "sentence_errors": [dataclasses.asdict(s) for s in rubric.sentence_errors]
                        }
                        if rubric.sentence_errors is not None
                        else {}
                    ),
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
