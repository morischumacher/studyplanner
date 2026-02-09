from fastapi import Header, HTTPException

# JWT stub to match your existing shape if you add auth later
async def get_current_user(authorization: str = Header(None)):
    if not authorization:
        return None
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    token = authorization.split()[1]
    # TODO: verify and return claims; keep "sub" for user id
    return {"sub": "123"}  # placeholder
