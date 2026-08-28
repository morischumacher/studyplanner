"""
Signing up, signing in, and recognising a returning session.

Sessions are opaque tokens in a table rather than signed cookies, so signing out
is a delete and revocation is immediate. The token is returned in the body as
well as set as a cookie, because the frontend also runs against origins where a
third-party cookie would be dropped.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from ..auth_utils import generate_session_token, hash_password, verify_password
from ..domain.errors import InvalidRequest, NotAuthenticated, UsernameTaken
from ..repositories import UnitOfWorkFactory

SESSION_TTL_DAYS = 30


class AuthService:
    def __init__(self, unit_of_work: UnitOfWorkFactory) -> None:
        self._unit_of_work = unit_of_work

    @staticmethod
    def _expiry() -> datetime:
        return datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)

    async def sign_up(self, username: str, password: str) -> dict[str, Any]:
        username = (username or "").strip()
        if not username:
            raise InvalidRequest("Username is required")
        if not password:
            raise InvalidRequest("Password is required")

        async with self._unit_of_work.write() as work:
            if await work.users.exists(username):
                raise UsernameTaken("Username already exists")
            user = await work.users.create(username, hash_password(password))
            token = generate_session_token()
            await work.sessions.create(token, user["id"], self._expiry())

        return {
            "user": {"id": str(user["id"]), "username": user["username"]},
            "token": token,
        }

    async def sign_in(self, username: str, password: str) -> dict[str, Any]:
        username = (username or "").strip()
        if not username or not password:
            raise InvalidRequest("Username and password are required")

        async with self._unit_of_work.write() as work:
            user = await work.users.find_by_username(username)
            if not user or not verify_password(password, user["password_hash"]):
                # One message for both cases: which of the two failed is not the
                # caller's business.
                raise NotAuthenticated("Invalid username or password")
            token = generate_session_token()
            await work.sessions.create(token, user["id"], self._expiry())

        return {
            "user": {"id": str(user["id"]), "username": user["username"]},
            "token": token,
        }

    async def sign_out(self, token: str | None) -> None:
        if not token:
            return
        async with self._unit_of_work.write() as work:
            await work.sessions.delete(token)

    async def identify(self, token: str | None) -> dict[str, Any] | None:
        """The account behind a token, or None. Never raises for a bad token."""
        if not token:
            return None
        async with self._unit_of_work.read() as work:
            user = await work.sessions.find_user(token)
        if not user:
            return None
        return {"sub": str(user["id"]), "username": user["username"], "token": token}
