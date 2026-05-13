from __future__ import annotations


def _scale_to_ielts_band(score_0_100: float) -> float:
    """Map a 0–100 score linearly to IELTS [1.0, 9.0], rounded to nearest 0.5."""
    clamped = max(0.0, min(100.0, score_0_100))
    band = 1.0 + (clamped / 100.0) * 8.0
    return round(band * 2) / 2


def map_pronunciation_band(segmental: float, intelligibility: float, prosody: float) -> float:
    """P = 0.5×segmental + 0.3×intelligibility + 0.2×prosody, all in [0, 100]."""
    raw = 0.5 * segmental + 0.3 * intelligibility + 0.2 * prosody
    return _scale_to_ielts_band(raw)


def map_fluency_band(fluency: float, rhythm: float, discourse_marker_density: float) -> float:
    """FC = 0.45×fluency + 0.25×rhythm + 0.30×discourse_density, all in [0, 100]."""
    raw = 0.45 * fluency + 0.25 * rhythm + 0.30 * discourse_marker_density
    return _scale_to_ielts_band(raw)


def heuristic_lr_band(ttr_lemma: float, freq_tier_ratio: float, lexical_density: float) -> float:
    """LR heuristic — used when Ollama is unavailable. Inputs are [0, 1] ratios."""
    score = ttr_lemma * 40.0 + freq_tier_ratio * 40.0 + lexical_density * 20.0
    return _scale_to_ielts_band(score)


def heuristic_gr_band(lt_error_rate: float, subordination_ratio: float, mean_sentence_length: float) -> float:
    """GR heuristic — used when Ollama is unavailable. lt_error_rate is errors per 100 words."""
    error_score = max(0.0, 100.0 - lt_error_rate * 10.0)
    complexity_score = min(100.0, subordination_ratio * 200.0 + mean_sentence_length * 2.0)
    score = 0.7 * error_score + 0.3 * complexity_score
    return _scale_to_ielts_band(score)
