from typing import Any
from dataclasses import asdict, is_dataclass

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..deps import get_current_user
from ..services.rule_checker_master import RuleChecker as MasterRuleChecker
from ..services.rule_checker_bachelor import RuleChecker as BachelorRuleChecker

router = APIRouter()


class RuleCheckPayload(BaseModel):
    programCode: str | None = None
    plannedCourses: list[dict[str, Any]] = Field(default_factory=list)
    doneCourses: list[dict[str, Any]] = Field(default_factory=list)
    change: dict[str, Any] = Field(default_factory=dict)
    selectedFocus: str | None = None


def _normalize_program_code(value: str | None) -> str:
    return (value or "").strip().replace(" ", "")


def _select_checker(program_code: str | None):
    normalized = _normalize_program_code(program_code)
    if normalized == "066937":
        return MasterRuleChecker()
    if normalized == "033521":
        return BachelorRuleChecker()
    if not normalized:
        # keep backward compatibility if program code is missing
        return MasterRuleChecker()
    raise HTTPException(
        status_code=400,
        detail=f"Unsupported programCode '{program_code}'. Expected '066 937' (master) or '033 521' (bachelor).",
    )


@router.post("/rulecheck")
async def rulecheck(payload: RuleCheckPayload, _user=Depends(get_current_user)):
    checker = _select_checker(payload.programCode)
    try:
        result = checker.evaluate(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Rulecheck evaluation failed: {exc}") from exc

    if is_dataclass(result):
        return asdict(result)
    if isinstance(result, dict):
        return result
    if hasattr(result, "model_dump"):
        return result.model_dump()
    if hasattr(result, "dict"):
        return result.dict()

    return {"ok": True, "message": str(result)}
