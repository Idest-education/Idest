from __future__ import annotations

import unittest
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]


class FeedbackGeneratorContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.source = (BASE_DIR / "inference" / "feedback_generator.py").read_text(encoding="utf-8")

    def test_feedback_generator_uses_per_rubric_call(self) -> None:
        self.assertIn("def _call_ollama_for_rubric(", self.source)
        self.assertIn("format=schema", self.source)
        self.assertIn("RubricFeedbackItem.model_json_schema()", self.source)

    def test_feedback_generator_uses_threadpool_executor_with_four_rubrics(self) -> None:
        self.assertIn("from concurrent.futures import ThreadPoolExecutor, as_completed", self.source)
        self.assertIn("ThreadPoolExecutor(max_workers=max_workers)", self.source)
        self.assertIn("for rubric_key in RUBRIC_KEYS", self.source)

    def test_feedback_generator_has_stop_and_num_predict_defaults(self) -> None:
        self.assertIn("DEFAULT_NUM_PREDICT = 320", self.source)
        self.assertIn('"stop": ["\\n\\n\\n"]', self.source)

    def test_feedback_generator_supports_env_config(self) -> None:
        for env_var in (
            "FEEDBACK_OLLAMA_TIMEOUT",
            "FEEDBACK_NUM_PREDICT",
            "FEEDBACK_MAX_WORKERS",
            "FEEDBACK_DEBUG",
        ):
            self.assertIn(env_var, self.source, f"missing env var support: {env_var}")

    def test_feedback_generator_requires_balanced_feedback_fields(self) -> None:
        self.assertIn("def _rubric_item_issues(item: RubricFeedbackItem) -> list[str]:", self.source)
        self.assertIn('issues.append("flaws must not be empty")', self.source)
        self.assertIn('issues.append("improvements must not be empty")', self.source)
        self.assertIn('issues.append("evidence_quote must not be empty")', self.source)
        self.assertIn('issues.append("example_rewrite must not be empty")', self.source)

    def test_feedback_generator_has_json_repair_for_truncation(self) -> None:
        self.assertIn("def _repair_truncated_json(", self.source)
        self.assertIn("if in_string:", self.source)

    def test_feedback_generator_partial_failure_marks_error_with_missing_rubrics(self) -> None:
        self.assertIn('metadata["feedback_status"] = "error"', self.source)
        self.assertIn('metadata["feedback_status"] = "ok"', self.source)
        self.assertIn("missing_rubrics=", self.source)
        self.assertIn("feedback_per_rubric_status", self.source)


if __name__ == "__main__":
    unittest.main()
