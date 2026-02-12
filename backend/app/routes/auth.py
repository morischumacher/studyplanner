from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from ..auth_utils import generate_session_token, hash_password, verify_password
from ..db import get_pool
from ..deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

SESSION_COOKIE_NAME = "session_token"
SESSION_TTL_DAYS = 30


class AuthPayload(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=256)


def _normalize_username(value: str) -> str:
    return (value or "").strip()


def _set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        path="/",
    )


@router.post("/signup")
async def signup(payload: AuthPayload, response: Response):
    username = _normalize_username(payload.username)
    password = payload.password
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")

    password_hash = hash_password(password)
    pool = await get_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT id FROM app_user WHERE username = $1", username)
        if existing:
            raise HTTPException(status_code=409, detail="Username already exists")
        user = await conn.fetchrow(
            """
            INSERT INTO app_user (username, password_hash)
            VALUES ($1, $2)
            RETURNING id, username
            """,
            username,
            password_hash,
        )

        token = generate_session_token()
        expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)
        await conn.execute(
            """
            INSERT INTO auth_session (token, user_id, expires_at)
            VALUES ($1, $2, $3)
            """,
            token,
            user["id"],
            expires_at,
        )

    _set_session_cookie(response, token)
    return {"user": {"id": str(user["id"]), "username": user["username"]}}


@router.post("/signin")
async def signin(payload: AuthPayload, response: Response):
    username = _normalize_username(payload.username)
    password = payload.password
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required")

    pool = await get_pool()
    async with pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT id, username, password_hash FROM app_user WHERE username = $1",
            username,
        )
        if not user or not verify_password(password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid username or password")

        token = generate_session_token()
        expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)
        await conn.execute(
            """
            INSERT INTO auth_session (token, user_id, expires_at)
            VALUES ($1, $2, $3)
            """,
            token,
            user["id"],
            expires_at,
        )

    _set_session_cookie(response, token)
    return {"user": {"id": str(user["id"]), "username": user["username"]}}


@router.post("/signout")
async def signout(
    response: Response,
    user=Depends(get_current_user),
):
    token = user.get("token") if user else None
    if token:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM auth_session WHERE token = $1", token)

    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me")
async def me(user=Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"user": {"id": user["sub"], "username": user["username"]}}
