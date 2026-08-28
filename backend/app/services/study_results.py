"""
Storing the evaluation study's questionnaire responses.

This endpoint exists for the user study rather than for the planner. Responses
are written to disk as JSON rather than to the database, so that a participant's
data is a file the researcher can copy off the machine, and so that a schema
change during the study cannot lose a response.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any


def _participant_slug(payload: dict[str, Any]) -> str:
    """Whatever the participant typed, reduced to something safe as a filename."""
    demographics = payload.get("demographics") or {}
    raw = str(demographics.get("participantId") or "").strip()
    slug = "".join(c for c in raw if c.isalnum() or c in ("-", "_"))
    return slug or "unknown"


class StudyResultsService:
    def __init__(self, directory: Path) -> None:
        self._directory = directory

    def save(self, payload: dict[str, Any]) -> str:
        self._directory.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"study-results_{_participant_slug(payload)}_{stamp}.json"
        (self._directory / filename).write_text(
            json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        return filename
