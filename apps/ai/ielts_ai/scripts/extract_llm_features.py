"""Populate the LLM feature cache on disk (Ollama / Phi-3 structured judgment)."""

from __future__ import annotations

from ielts_ai.data import load_clean_data
from ielts_ai.writing_scorer.llm_features import run_and_cache


def main() -> None:
    df = load_clean_data()
    run_and_cache(df)


if __name__ == "__main__":
    main()
