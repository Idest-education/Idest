"""Text preprocessing for essay grading."""

from __future__ import annotations

import re

def clean_text(text: str) -> str:
    paragraphs = [re.sub(r"\s+", " ", block).strip() for block in re.split(r"\n\s*\n+", text) if block.strip()]
    return "\n\n".join(paragraphs)
