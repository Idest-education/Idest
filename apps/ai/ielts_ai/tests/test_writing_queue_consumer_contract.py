from __future__ import annotations

import unittest
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]


class WritingQueueConsumerContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.source = (BASE_DIR / "writing_queue_consumer.py").read_text(encoding="utf-8")

    def test_queue_consumer_uses_full_task2_rubric_grader(self) -> None:
        self.assertIn("from ielts_ai.main import grade_essay", self.source)
        self.assertIn("task2_result = grade_essay(task2_prompt, payload.contentTwo)", self.source)

    def test_queue_consumer_has_task_breakdown_normalizer(self) -> None:
        self.assertIn("def _normalize_task_breakdown(", self.source)
        self.assertIn('"rubrics": rubrics', self.source)
        self.assertIn('"feedback": _normalize_rubric_feedback(', self.source)

    def test_queue_consumer_persists_minimal_breakdown_shape(self) -> None:
        self.assertIn('"overall_band": final_score', self.source)
        self.assertIn('"tasks": {', self.source)
        self.assertIn('"task1": _normalize_task_breakdown(task1_result.scores, task1_result.metadata)', self.source)
        self.assertIn('"task2": _normalize_task_breakdown(', self.source)

    def test_queue_consumer_does_not_store_task_metadata_blob(self) -> None:
        self.assertNotIn('"metadata": task1_result.metadata', self.source)
        self.assertNotIn('"metadata": task2_result.get("metadata", {})', self.source)


if __name__ == "__main__":
    unittest.main()
