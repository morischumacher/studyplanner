"""Accounts and the sessions that authenticate them."""
from __future__ import annotations

from datetime import datetime
from typing import Any

import asyncpg


class UserRepository:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self._connection = connection

    async def find_by_username(self, username: str) -> dict[str, Any] | None:
        row = await self._connection.fetchrow(
            "SELECT id, username, password_hash FROM app_user WHERE username = $1",
            username,
        )
        return dict(row) if row else None

    async def exists(self, username: str) -> bool:
        row = await self._connection.fetchrow(
            "SELECT id FROM app_user WHERE username = $1", username
        )
        return row is not None

    async def create(self, username: str, password_hash: str) -> dict[str, Any]:
        row = await self._connection.fetchrow(
            """
            INSERT INTO app_user (username, password_hash)
            VALUES ($1, $2)
            RETURNING id, username
            """,
            username,
            password_hash,
        )
        return dict(row)

    async def lock(self, user_id: str) -> None:
        """Serialise concurrent first-time setup for one account."""
        await self._connection.fetchrow(
            "SELECT id FROM app_user WHERE id = $1 FOR UPDATE", user_id
        )


class SessionRepository:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self._connection = connection

    async def create(self, token: str, user_id: Any, expires_at: datetime) -> None:
        await self._connection.execute(
            "INSERT INTO auth_session (token, user_id, expires_at) VALUES ($1, $2, $3)",
            token,
            user_id,
            expires_at,
        )

    async def find_user(self, token: str) -> dict[str, Any] | None:
        """The account behind an unexpired session token, if there is one."""
        row = await self._connection.fetchrow(
            """
            SELECT u.id, u.username
            FROM auth_session s
            JOIN app_user u ON u.id = s.user_id
            WHERE s.token = $1
              AND (s.expires_at IS NULL OR s.expires_at > now())
            """,
            token,
        )
        return dict(row) if row else None

    async def delete(self, token: str) -> None:
        await self._connection.execute(
            "DELETE FROM auth_session WHERE token = $1", token
        )
