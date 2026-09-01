"""The saved plan, stored whole as a JSON document per user."""
from __future__ import annotations

from typing import Any

import asyncpg


class PlannerStateRepository:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self._connection = connection

    async def get(self, user_id: str) -> dict[str, Any]:
        row = await self._connection.fetchrow(
            "SELECT state FROM planner_state WHERE user_id = $1", user_id
        )
        return (row["state"] if row else {}) or {}

    async def save(self, user_id: str, state: dict[str, Any]) -> None:
        await self._connection.execute(
            """
            INSERT INTO planner_state (user_id, state, updated_at)
            VALUES ($1, $2::jsonb, now())
            ON CONFLICT (user_id)
            DO UPDATE SET state = EXCLUDED.state, updated_at = now()
            """,
            user_id,
            state or {},
        )
