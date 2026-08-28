"""
The evaluation study's response endpoint.

Deliberately unauthenticated: participants filled the questionnaire in a
separate browser context from the planner session being observed.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from ..services.study_results import StudyResultsService
from .dependencies import get_study_results_service

router = APIRouter(tags=["user-study"])


@router.post("/study-results", status_code=status.HTTP_201_CREATED)
async def save_study_results(
    payload: dict[str, Any],
    results: StudyResultsService = Depends(get_study_results_service),
):
    try:
        filename = results.save(payload)
    except OSError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save results: {error}",
        ) from error
    return {"ok": True, "filename": filename}
