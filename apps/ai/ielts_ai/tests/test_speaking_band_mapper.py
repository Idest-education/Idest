import pytest
from ielts_ai.speaking_scorer.band_mapper import (
    heuristic_gr_band,
    heuristic_lr_band,
    map_fluency_band,
    map_pronunciation_band,
)


def _is_valid_band(band: float) -> bool:
    return 1.0 <= band <= 9.0 and band % 0.5 == 0.0


def test_map_pronunciation_band_high_signals():
    band = map_pronunciation_band(segmental=80.0, intelligibility=80.0, prosody=80.0)
    assert _is_valid_band(band)
    assert band >= 6.5


def test_map_pronunciation_band_low_signals():
    band = map_pronunciation_band(segmental=20.0, intelligibility=20.0, prosody=20.0)
    assert _is_valid_band(band)
    assert band <= 3.0


def test_map_pronunciation_band_clips_to_bounds():
    assert map_pronunciation_band(0.0, 0.0, 0.0) == 1.0
    assert map_pronunciation_band(100.0, 100.0, 100.0) == 9.0


def test_map_fluency_band_high_signals():
    band = map_fluency_band(fluency=80.0, rhythm=80.0, discourse_marker_density=80.0)
    assert _is_valid_band(band)
    assert band >= 6.5


def test_map_fluency_band_low_signals():
    band = map_fluency_band(fluency=15.0, rhythm=15.0, discourse_marker_density=15.0)
    assert _is_valid_band(band)
    assert band <= 3.0


def test_map_fluency_band_clips():
    assert map_fluency_band(0.0, 0.0, 0.0) == 1.0
    assert map_fluency_band(100.0, 100.0, 100.0) == 9.0


def test_heuristic_lr_band_returns_valid():
    band = heuristic_lr_band(ttr_lemma=0.6, freq_tier_ratio=0.4, lexical_density=0.5)
    assert _is_valid_band(band)


def test_heuristic_lr_band_high_diversity():
    high = heuristic_lr_band(ttr_lemma=0.9, freq_tier_ratio=0.8, lexical_density=0.6)
    low = heuristic_lr_band(ttr_lemma=0.2, freq_tier_ratio=0.1, lexical_density=0.2)
    assert high > low


def test_heuristic_gr_band_low_errors_higher_band():
    high = heuristic_gr_band(lt_error_rate=0.5, subordination_ratio=0.4, mean_sentence_length=15.0)
    low = heuristic_gr_band(lt_error_rate=20.0, subordination_ratio=0.05, mean_sentence_length=5.0)
    assert high > low


def test_heuristic_gr_band_returns_valid():
    band = heuristic_gr_band(lt_error_rate=3.0, subordination_ratio=0.3, mean_sentence_length=12.0)
    assert _is_valid_band(band)
