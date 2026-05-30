import numpy as np

from src.alignment import RecognizedPhone
from src.phonemes import decode_ctc


def test_decode_ctc_collapses_repeats_and_blanks():
    # vocab: 0=<pad/blank>, 1="f", 2="æ"
    id_to_token = {0: "<pad>", 1: "f", 2: "æ"}
    # frames: f f <blank> æ æ  -> "f", "æ"
    probs = np.array([
        [0.1, 0.8, 0.1],
        [0.1, 0.7, 0.2],
        [0.9, 0.05, 0.05],
        [0.1, 0.2, 0.7],
        [0.1, 0.1, 0.8],
    ])
    phones = decode_ctc(probs, id_to_token, blank_id=0, frame_seconds=0.02)
    tokens = [p.token for p in phones]
    assert tokens == ["f", "æ"]
    assert all(isinstance(p, RecognizedPhone) for p in phones)
    assert phones[0].confidence > 0.6
    assert phones[1].start >= phones[0].end - 1e-6
