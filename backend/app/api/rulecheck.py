"""Checking a plan against its curriculum."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..services.rulecheck import RuleCheckService
from .dependencies import get_rule_check_service, require_user

router = APIRouter(tags=["rulecheck"])


class RuleCheckPayload(BaseModel):
    programCode: str | None = None
    plannedCourses: list[dict[str, Any]] = Field(default_factory=list)
    doneCourses: list[dict[str, Any]] = Field(default_factory=list)
    change: dict[str, Any] = Field(default_factory=dict)
    selectedFocus: str | None = None
    maxEctsPerSemester: float | None = None
    recommendedEctsPerSemester: float | None = None


@router.post("/rulecheck")
async def rulecheck(
    payload: RuleCheckPayload,
    _user: dict[str, Any] = Depends(require_user),
    rules: RuleCheckService = Depends(get_rule_check_service),
):
    return rules.evaluate(payload.model_dump())
