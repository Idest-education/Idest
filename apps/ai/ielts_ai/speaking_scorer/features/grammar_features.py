from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from ielts_ai.writing_scorer.features.grammar_features import get_languagetool

_SUBORDINATE_DEPS = {"advcl", "relcl", "acl", "ccomp", "xcomp"}


@dataclass
class GrammarFeatures:
    lt_error_rate: float          # total LanguageTool errors per 100 words
    lt_grammar_error_rate: float  # grammar-only errors per 100 words
    lt_spelling_error_rate: float # spelling-only errors per 100 words
    clause_count: float           # mean clauses per sentence
    subordination_ratio: float    # subordinate clauses / total clauses
    mean_sentence_length: float   # words per sentence


@lru_cache(maxsize=1)
def _get_nlp():
    import spacy
    # parser required for dep parse; only ner disabled
    return spacy.load("en_core_web_sm", disable=["ner"])


def _is_spelling(match) -> bool:
    cat = getattr(match, "category", None) or ""
    rit = getattr(match, "rule_issue_type", None) or ""
    return cat == "TYPOS" or rit == "misspelling"


def extract_grammar_features(transcript: str) -> GrammarFeatures:
    if not transcript.strip():
        return GrammarFeatures(
            lt_error_rate=0.0,
            lt_grammar_error_rate=0.0,
            lt_spelling_error_rate=0.0,
            clause_count=0.0,
            subordination_ratio=0.0,
            mean_sentence_length=0.0,
        )

    words = transcript.split()
    word_count = max(len(words), 1)

    lt = get_languagetool()
    matches = lt.check(transcript)

    spelling_count = sum(1 for m in matches if _is_spelling(m))
    grammar_count = len(matches) - spelling_count  # everything non-spelling is grammar

    lt_error_rate = len(matches) / word_count * 100
    lt_grammar_error_rate = grammar_count / word_count * 100
    lt_spelling_error_rate = spelling_count / word_count * 100

    nlp = _get_nlp()
    doc = nlp(transcript)
    sentences = list(doc.sents)

    if not sentences:
        return GrammarFeatures(
            lt_error_rate=round(lt_error_rate, 4),
            lt_grammar_error_rate=round(lt_grammar_error_rate, 4),
            lt_spelling_error_rate=round(lt_spelling_error_rate, 4),
            clause_count=0.0,
            subordination_ratio=0.0,
            mean_sentence_length=float(word_count),
        )

    total_clauses = 0
    total_sub_clauses = 0

    for sent in sentences:
        roots = [t for t in sent if t.dep_ == "ROOT"]
        sub_clauses = [t for t in sent if t.dep_ in _SUBORDINATE_DEPS]
        total_clauses += len(roots) + len(sub_clauses)
        total_sub_clauses += len(sub_clauses)

    n_sents = len(sentences)
    mean_clause_count = total_clauses / max(n_sents, 1)
    subordination_ratio = total_sub_clauses / max(total_clauses, 1)
    spacy_words = sum(1 for t in doc if not t.is_space and not t.is_punct)
    mean_sentence_length = spacy_words / max(n_sents, 1)

    return GrammarFeatures(
        lt_error_rate=round(lt_error_rate, 4),
        lt_grammar_error_rate=round(lt_grammar_error_rate, 4),
        lt_spelling_error_rate=round(lt_spelling_error_rate, 4),
        clause_count=round(mean_clause_count, 4),
        subordination_ratio=round(subordination_ratio, 4),
        mean_sentence_length=round(mean_sentence_length, 4),
    )
