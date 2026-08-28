"""Reading and writing the saved plan."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..services.planner import PlannerService
from .dependencies import get_planner_service, require_user

router = APIRouter(tags=["planner-state"])


class PlannerStatePayload(BaseModel):
    state: dict[str, Any] = Field(default_factory=dict)


@router.get("/planner-state")
async def get_planner_state(
    user: dict[str, Any] = Depends(require_user),
    planner: PlannerService = Depends(get_planner_service),
):
    return {"state": await planner.load(user["sub"])}


@router.put("/planner-state")
async def put_planner_state(
    payload: PlannerStatePayload,
    user: dict[str, Any] = Depends(require_user),
    planner: PlannerService = Depends(get_planner_service),
):
    await planner.save(user["sub"], payload.state)
    return {"ok": True}
