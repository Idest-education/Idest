"""Uvicorn entrypoint; implementation lives in `ielts_ai.api`."""

from dotenv import load_dotenv

load_dotenv()

from ielts_ai.api import app

__all__ = ["app"]
