from src.alignment import RecognizedPhone, needleman_wunsch, align_phones


def _rec(tokens, conf=0.9):
    return [RecognizedPhone(token=t, start=0.0, end=0.0, confidence=conf) for t in tokens]


def test_nw_perfect_match():
    pairs = needleman_wunsch(["f", "æ", "s", "t"], ["f", "æ", "s", "t"])
    assert pairs == [("f", "f"), ("æ", "æ"), ("s", "s"), ("t", "t")]


def test_nw_substitution():
    pairs = needleman_wunsch(["f", "æ", "s", "t"], ["f", "æ", "t"])
    # reference 's' and 't' vs recognized 't' -> a deletion then match, or substitution+deletion
    assert ("s", None) in pairs or ("s", "t") in pairs
    assert pairs[0] == ("f", "f")


def test_align_marks_missing_phone():
    # reference has 4 phones, audio only produced 3 -> one missing
    result = align_phones(["f", "æ", "s", "t"], _rec(["f", "æ", "t"]))
    statuses = [p.status for p in result]
    assert "missing" in statuses
    # every reference phone appears exactly once as a non-extra assessment
    ref_tokens = [p.token for p in result if p.status != "extra"]
    assert ref_tokens == ["f", "æ", "s", "t"]


def test_align_perfect_match_scores_high():
    result = align_phones(["f", "æ", "s", "t"], _rec(["f", "æ", "s", "t"], conf=0.95))
    assert all(p.status == "match" for p in result)
    assert all(p.score >= 90.0 for p in result)


def test_align_extra_phone_flagged():
    result = align_phones(["f", "æ"], _rec(["f", "æ", "s"]))
    assert any(p.status == "extra" for p in result)


def test_align_duplicate_tokens_use_correct_confidence():
    # Same token "f" appears twice in recognized with different confidences
    recognized = [
        RecognizedPhone(token="f", start=0.0, end=0.1, confidence=0.9),
        RecognizedPhone(token="æ", start=0.1, end=0.2, confidence=0.7),
        RecognizedPhone(token="f", start=0.2, end=0.3, confidence=0.5),  # second "f"
    ]
    result = align_phones(["f", "æ", "f"], recognized)
    assert result[0].status == "match"
    assert result[0].score == round(0.9 * 100, 1)  # first "f" gets 0.9 confidence
    assert result[2].status == "match"
    assert result[2].score == round(0.5 * 100, 1)  # second "f" gets 0.5 confidence
