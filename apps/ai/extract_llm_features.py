"""
Standalone script to extract LLM-based features using Ollama/Phi-3 Mini.

Run once to populate the cache. Resume-safe: re-running skips already-processed essays.

Usage:
    python extract_llm_features.py
"""

from __future__ import annotations

from data import load_clean_data
from writing_scorer.llm_features import run_and_cache


def main() -> None:
    print("Loading dataset...")
    df = load_clean_data()
    print(f"  {len(df)} essays loaded")
    run_and_cache(df)


if __name__ == "__main__":
    main()
