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
