"""Sign-up, sign-in, sign-out, and who am I."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field

from ..domain.errors import NotAuthenticated
from ..services.auth import SESSION_TTL_DAYS, AuthService
from ..settings import settings
from .dependencies import current_user, get_auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

SESSION_COOKIE_NAME = "session_token"


class Credentials(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=256)


def _cross_site() -> bool:
    """
    True when the frontend is served from somewhere other than this machine.

    A cross-site cookie has to be SameSite=None and Secure or the browser drops
    it, and those settings would stop the cookie working over plain HTTP in
    development, so the two cases are distinguished here.
    """
    origin = settings.CORS_ORIGIN
    return bool(origin and "localhost" not in origin and "127.0.0.1" not in origin)


def _set_session_cookie(response: Response, token: str) -> None:
    cross_site = _cross_site()
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="none" if cross_site else "lax",
        secure=cross_site,
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        path="/",
    )


@router.post("/signup")
async def sign_up(
    credentials: Credentials,
    response: Response,
    auth: AuthService = Depends(get_auth_service),
):
    session = await auth.sign_up(credentials.username, credentials.password)
    _set_session_cookie(response, session["token"])
    return session


@router.post("/signin")
async def sign_in(
    credentials: Credentials,
    response: Response,
    auth: AuthService = Depends(get_auth_service),
):
    session = await auth.sign_in(credentials.username, credentials.password)
    _set_session_cookie(response, session["token"])
    return session


@router.post("/signout")
async def sign_out(
    response: Response,
    user: dict[str, Any] | None = Depends(current_user),
    auth: AuthService = Depends(get_auth_service),
):
    await auth.sign_out(user.get("token") if user else None)
    cross_site = _cross_site()
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        samesite="none" if cross_site else "lax",
        secure=cross_site,
    )
    return {"ok": True}


@router.get("/me")
async def me(user: dict[str, Any] | None = Depends(current_user)) -> dict[str, Any]:
    if not user:
        raise NotAuthenticated("Not authenticated")
    return {"user": {"id": user["sub"], "username": user["username"]}}
