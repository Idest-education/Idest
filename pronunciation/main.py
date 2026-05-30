"""CLI: python main.py --audio voice-sample.wav"""
from __future__ import annotations

import argparse
import dataclasses
import json
import logging
import sys
from pathlib import Path

# Allow `import src.*` when run as a script from the package root.
_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from src.pipeline import PronunciationPipeline  # noqa: E402


def main() -> int:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="Pronunciation assessment")
    parser.add_argument("--audio", required=True, help="Path to a .wav audio file")
    args = parser.parse_args()

    audio_path = Path(args.audio)
    if not audio_path.exists():
        print(f"Audio file not found: {audio_path}", file=sys.stderr)
        return 1

    report = PronunciationPipeline().run(audio_path)
    print(json.dumps(dataclasses.asdict(report), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
