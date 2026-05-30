import json
from unittest.mock import MagicMock, patch

from src.intent import TranscriptCorrector


def _ok_response(predicted):
    resp = MagicMock()
    resp.raise_for_status.return_value = None
    resp.json.return_value = {"message": {"content": json.dumps({"predictedTranscript": predicted})}}
    return resp


def test_returns_corrected_transcript():
    corrector = TranscriptCorrector(model="llama3")
    with patch("src.intent.requests.post", return_value=_ok_response("the car is fast")):
        result = corrector.correct("the car is fat")
    assert result.predicted_transcript == "the car is fast"
    assert result.degraded is False


def test_no_model_falls_back_to_raw():
    corrector = TranscriptCorrector(model="")
    result = corrector.correct("the car is fat")
    assert result.predicted_transcript == "the car is fat"
    assert result.degraded is True


def test_request_failure_falls_back_to_raw():
    corrector = TranscriptCorrector(model="llama3")
    with patch("src.intent.requests.post", side_effect=ConnectionError("down")):
        result = corrector.correct("the car is fat")
    assert result.predicted_transcript == "the car is fat"
    assert result.degraded is True


def test_empty_transcript_returns_empty():
    corrector = TranscriptCorrector(model="llama3")
    result = corrector.correct("   ")
    assert result.predicted_transcript == ""
    assert result.degraded is True
