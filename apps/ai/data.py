from __future__ import annotations

import re

import pandas as pd
from datasets import load_dataset


def _extract_scores(text: str) -> dict[str, float | None]:
    rubrics = [
        ("TA", "Task Achievement"),
        ("CC", "Coherence and Cohesion"),
        ("LR", "Lexical Resource"),
        ("GR", "Grammatical Range and Accuracy"),
    ]
    result: dict[str, float | None] = {}
    for i, (key, name) in enumerate(rubrics):
        start = text.find(name)
        if start == -1:
            result[key] = None
            continue
        search_start = start + len(name)
        end = (
            text.find(rubrics[i + 1][1], search_start)
            if i < len(rubrics) - 1
            else len(text)
        )
        if end == -1:
            end = len(text)
        section = text[search_start:end]
        match = re.search(r"(\d+\.?\d*)", section)
        result[key] = float(match.group(1)) if match else None
    return result


def load_clean_data() -> pd.DataFrame:
    dataset = load_dataset("chillies/IELTS-writing-task-2-evaluation")
    df = dataset["train"].to_pandas()

    scores = df["evaluation"].apply(_extract_scores)
    scores_df = pd.DataFrame(scores.tolist())

    df = pd.concat([df, scores_df], axis=1)
    df = df[(df["TA"] >= 0) & (df["TA"] <= 9)]
    df["band"] = (
        df["band"]
        .str.strip()
        .str.replace(r"\s+", "", regex=True)
        .replace("<4", "3.5")
        .astype(float)
    )
    df = df.reset_index(drop=True)
    return df


if __name__ == "__main__":
    df = load_clean_data()
    essay = df.loc[76, "essay"]

    paragraphs = [p.strip() for p in essay.split("\n\n") if p.strip()]
    print(f"Total paragraphs (our split): {len(paragraphs)}")
    for i, p in enumerate(paragraphs):
        print(f"\n--- Para {i} ({len(p.split())} words) ---")
        print(p[:200] + "..." if len(p) > 200 else p)
