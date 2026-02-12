from fastapi import Header, HTTPException, Cookie
from .db import get_pool


async def _resolve_user_from_token(token: str | None):
    if not token:
        return None
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT u.id, u.username
            FROM auth_session s
            JOIN app_user u ON u.id = s.user_id
            WHERE s.token = $1
              AND (s.expires_at IS NULL OR s.expires_at > now())
            """,
            token,
        )
    if not row:
        return None
    return {"sub": str(row["id"]), "username": row["username"], "token": token}


async def get_current_user(
    authorization: str | None = Header(None),
    session_token: str | None = Cookie(None),
):
    token = None
    if authorization:
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid token")
        token = authorization.split()[1]
    elif session_token:
        token = session_token
    return await _resolve_user_from_token(token)


async def require_current_user(
    authorization: str | None = Header(None),
    session_token: str | None = Cookie(None),
):
    user = await get_current_user(authorization=authorization, session_token=session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
