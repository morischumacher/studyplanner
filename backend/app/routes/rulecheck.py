from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..deps import get_current_user
from ..services.rule_checker import RuleChecker

router = APIRouter()


class RuleCheckPayload(BaseModel):
    programCode: str | None = None
    plannedCourses: list[dict[str, Any]] = Field(default_factory=list)
    doneCourses: list[dict[str, Any]] = Field(default_factory=list)
    change: dict[str, Any] = Field(default_factory=dict)


@router.post("/rulecheck")
async def rulecheck(payload: RuleCheckPayload, _user=Depends(get_current_user)):
    checker = RuleChecker()
    result = checker.evaluate(payload.model_dump())
    return {"ok": result.ok, "message": result.message}
