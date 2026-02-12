from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..db import get_pool
from ..deps import require_current_user

router = APIRouter(tags=["planner-state"])


class PlannerStatePayload(BaseModel):
    state: dict[str, Any] = Field(default_factory=dict)


@router.get("/planner-state")
async def get_planner_state(user=Depends(require_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT state FROM planner_state WHERE user_id = $1",
            user["sub"],
        )
    return {"state": (row["state"] if row else {}) or {}}


@router.put("/planner-state")
async def put_planner_state(payload: PlannerStatePayload, user=Depends(require_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO planner_state (user_id, state, updated_at)
            VALUES ($1, $2::jsonb, now())
            ON CONFLICT (user_id)
            DO UPDATE SET state = EXCLUDED.state, updated_at = now()
            """,
            user["sub"],
            payload.state or {},
        )
    return {"ok": True}
