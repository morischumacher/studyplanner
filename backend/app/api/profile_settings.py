"""The per-programme profile: start term, interests, and course term corrections."""
from __future__ import annotations

from typing import Any, List, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from ..services.profile import ProfileService
from .dependencies import get_profile_service, require_user

TermAvailability = Literal["winter", "summer", "both"]

router = APIRouter(tags=["profile-settings"])


class StartTermPayload(BaseModel):
    program_code: str = Field(min_length=1, max_length=64)
    season: TermAvailability
    year: int = Field(ge=1900, le=2600)


class CourseTermUpdate(BaseModel):
    course_code: str = Field(min_length=1, max_length=255)
    term_availability: TermAvailability


class CourseTermsPayload(BaseModel):
    program_code: str = Field(min_length=1, max_length=64)
    updates: List[CourseTermUpdate] = Field(default_factory=list)


class RecommendationProfilePayload(BaseModel):
    program_code: str = Field(min_length=1, max_length=64)
    interests: List[str] = Field(default_factory=list)
    career_direction: str | None = None
    recommendation_toggles: dict = Field(default_factory=dict)


@router.get("/profile-settings")
async def get_profile_settings(
    program_code: str = Query(...),
    user: dict[str, Any] = Depends(require_user),
    profiles: ProfileService = Depends(get_profile_service),
):
    return await profiles.get(user["sub"], program_code)


@router.put("/profile-settings/start-term")
async def put_start_term(
    payload: StartTermPayload,
    user: dict[str, Any] = Depends(require_user),
    profiles: ProfileService = Depends(get_profile_service),
):
    await profiles.set_start_term(
        user["sub"], payload.program_code, payload.season, payload.year
    )
    return {"ok": True, "locked": True}


@router.put("/profile-settings/course-terms")
async def put_course_terms(
    payload: CourseTermsPayload,
    user: dict[str, Any] = Depends(require_user),
    profiles: ProfileService = Depends(get_profile_service),
):
    updated = await profiles.set_course_terms(
        user["sub"],
        payload.program_code,
        [update.model_dump() for update in payload.updates],
    )
    return {"ok": True, "updated": updated}


@router.put("/profile-settings/recommendation-profile")
async def put_recommendation_profile(
    payload: RecommendationProfilePayload,
    user: dict[str, Any] = Depends(require_user),
    profiles: ProfileService = Depends(get_profile_service),
):
    await profiles.set_recommendation_profile(
        user["sub"],
        payload.program_code,
        payload.interests,
        payload.career_direction,
        payload.recommendation_toggles,
    )
    return {"ok": True}
