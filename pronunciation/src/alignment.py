from __future__ import annotations

from dataclasses import dataclass

from src.scoring import PhoneAssessment

_MATCH = 1
_MISMATCH = -1
_GAP = -1


@dataclass
class RecognizedPhone:
    token: str
    start: float
    end: float
    confidence: float   # 0–1


def needleman_wunsch(ref: list[str], hyp: list[str]) -> list[tuple[str | None, str | None]]:
    """Global alignment. Returns aligned pairs; None marks a gap (insertion/deletion)."""
    n, m = len(ref), len(hyp)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        dp[i][0] = i * _GAP
    for j in range(1, m + 1):
        dp[0][j] = j * _GAP
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            sub = dp[i - 1][j - 1] + (_MATCH if ref[i - 1] == hyp[j - 1] else _MISMATCH)
            dp[i][j] = max(sub, dp[i - 1][j] + _GAP, dp[i][j - 1] + _GAP)

    pairs: list[tuple[str | None, str | None]] = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + (
            _MATCH if ref[i - 1] == hyp[j - 1] else _MISMATCH
        ):
            pairs.append((ref[i - 1], hyp[j - 1]))
            i, j = i - 1, j - 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + _GAP:
            pairs.append((ref[i - 1], None))   # deletion (missing in audio)
            i -= 1
        else:
            pairs.append((None, hyp[j - 1]))    # insertion (extra in audio)
            j -= 1
    pairs.reverse()
    return pairs


def align_phones(
    reference: list[str],
    recognized: list[RecognizedPhone],
) -> list[PhoneAssessment]:
    """Align reference IPA against recognized phones; produce per-phone assessments."""
    hyp_tokens = [r.token for r in recognized]
    conf_by_token: dict[str, float] = {r.token: r.confidence for r in recognized}
    pairs = needleman_wunsch(reference, hyp_tokens)

    assessments: list[PhoneAssessment] = []
    for ref_tok, hyp_tok in pairs:
        if ref_tok is not None and hyp_tok is not None and ref_tok == hyp_tok:
            assessments.append(PhoneAssessment(
                token=ref_tok, score=round(conf_by_token.get(hyp_tok, 0.8) * 100, 1), status="match"
            ))
        elif ref_tok is not None and hyp_tok is not None:
            assessments.append(PhoneAssessment(
                token=ref_tok, score=round(conf_by_token.get(hyp_tok, 0.5) * 50, 1), status="substitution"
            ))
        elif ref_tok is not None:
            assessments.append(PhoneAssessment(token=ref_tok, score=0.0, status="missing"))
        else:
            assessments.append(PhoneAssessment(token=hyp_tok or "", score=0.0, status="extra"))
    return assessments
