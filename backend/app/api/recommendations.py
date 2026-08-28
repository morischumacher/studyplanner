"""Course recommendations for the plan as it currently stands."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..services.recommendations import RecommendationService
from .dependencies import get_recommendation_service, require_user

router = APIRouter(tags=["recommendations"])


class RecommendationsPayload(BaseModel):
    programCode: str = Field(...)
    plannedCourses: list[dict[str, Any]] = Field(default_factory=list)
    doneCourses: list[dict[str, Any]] = Field(default_factory=list)
    parkedCourses: list[str] = Field(default_factory=list)


@router.post("/recommendations")
async def get_recommendations(
    payload: RecommendationsPayload,
    user: dict[str, Any] = Depends(require_user),
    recommendations: RecommendationService = Depends(get_recommendation_service),
):
    results = await recommendations.recommend(
        user["sub"],
        payload.programCode,
        payload.plannedCourses,
        payload.doneCourses,
        payload.parkedCourses,
    )
    return {"ok": True, "recommendations": results}
