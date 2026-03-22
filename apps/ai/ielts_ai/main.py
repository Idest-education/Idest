from __future__ import annotations

from ielts_ai.inference import get_scorer
from ielts_ai.utils.preprocess import clean_text


def grade_essay(prompt: str, essay: str) -> dict:
    prompt = clean_text(prompt)
    essay = clean_text(essay)
    result = get_scorer().score(prompt, essay)
    return {
        **result.scores,
        "description": result.description,
        "metadata": result.metadata,
    }


def grade_essay_overall_direct(prompt: str, essay: str) -> dict:
    prompt = clean_text(prompt)
    essay = clean_text(essay)
    result = get_scorer().score_overall_direct(prompt, essay)
    return {
        **result.scores,
        "description": result.description,
        "metadata": result.metadata,
    }


if __name__ == "__main__":
    sample_prompt = (
        "Some people believe that universities should focus on providing "
        "academic skills rather than practical training. To what extent do "
        "you agree or disagree?"
    )

    sample_essay = (
        "In today's competitive world, the role of universities has become "
        "a subject of debate. While some argue that academic knowledge should "
        "be the primary focus, others believe practical skills are equally "
        "important. In my opinion, a balanced approach is essential.\n\n"
        "On one hand, academic skills form the foundation of critical thinking "
        "and analytical reasoning. Students who develop strong theoretical "
        "knowledge are better equipped to conduct research and contribute to "
        "their fields. For instance, medical students must understand anatomy "
        "before performing surgeries.\n\n"
        "On the other hand, practical training prepares graduates for the "
        "workforce. Employers increasingly value hands-on experience, and "
        "universities that incorporate internships and project-based learning "
        "produce more employable graduates.\n\n"
        "In conclusion, universities should strive to integrate both academic "
        "and practical elements into their curricula to prepare well-rounded "
        "graduates."
    )

    result = grade_essay(sample_prompt, sample_essay)

    print("IELTS Writing Task 2 - Band Scores")
    print("=" * 40)
    for criterion, score in result.items():
        if not isinstance(score, (int, float)):
            continue
        label = criterion.replace("_", " ").title()
        print(f"  {label:<25} {score:.1f}")
