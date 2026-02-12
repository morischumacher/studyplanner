from fastapi import APIRouter, Query, Depends, HTTPException
from typing import Optional
from ..db import get_pool
from ..deps import require_current_user

router = APIRouter()

@router.get("/catalog")
async def list_catalog(
        program_code: Optional[str] = Query(None),
        _user=Depends(require_current_user),
):
    pool = await get_pool()
    view = "public.v_catalog_json_mat"

    sql = f"""
      SELECT program_id, program_code, catalog
      FROM {view}
      WHERE ($1::text IS NULL OR program_code = $1)
      ORDER BY program_code
    """

    async with pool.acquire() as conn:
        try:
            rows = await conn.fetch(sql, program_code)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Catalog query failed: {e}")

    if program_code:
        if not rows:
            raise HTTPException(status_code=404, detail="Program not found in catalog view")
        # rows[0]["catalog"] is already a Python list (thanks to codecs)
        return rows[0]["catalog"] or []

    return [
        {
            "program_id": str(r["program_id"]),
            "program_code": r["program_code"],
            "catalog": r["catalog"] or [],  # already list
        }
        for r in rows
    ]
