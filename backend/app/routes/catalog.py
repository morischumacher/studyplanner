from fastapi import APIRouter, Query, Depends, HTTPException
from typing import Optional
from ..db import get_pool
from ..deps import require_current_user

router = APIRouter()


def _normalize_term(value: Optional[str]) -> str:
    raw = (value or "").strip().lower()
    if raw in ("winter", "summer", "both"):
        return raw
    return "both"


def _apply_course_terms(catalog: list, terms_by_code: dict[str, str]) -> list:
    for subject in catalog or []:
        modules = subject.get("modules") if isinstance(subject, dict) else []
        for module in modules or []:
            courses = module.get("courses") if isinstance(module, dict) else []
            for course in courses or []:
                if not isinstance(course, dict):
                    continue
                code = (course.get("code") or "").strip()
                if not code:
                    course["term_availability"] = "both"
                    continue
                course["term_availability"] = _normalize_term(terms_by_code.get(code))
    return catalog


async def _fetch_base_terms(conn, program_code: str) -> dict[str, str]:
    rows = await conn.fetch(
        """
        SELECT DISTINCT c.code, c.term_availability::text AS term_availability
        FROM module m
            JOIN study_program sp ON sp.id = m.program_id
            JOIN module_course mc ON mc.module_id = m.id
            JOIN course c ON c.id = mc.course_id
        WHERE sp.code = $1
          AND c.code IS NOT NULL
        """,
        program_code,
    )
    return {
        (r["code"] or "").strip(): _normalize_term(r["term_availability"])
        for r in rows
        if (r["code"] or "").strip()
    }


async def _fetch_user_overrides(conn, user_id: str, program_code: str) -> dict[str, str]:
    rows = await conn.fetch(
        """
        SELECT course_code, term_availability::text AS term_availability
        FROM user_course_term_override
        WHERE user_id = $1 AND program_code = $2
        """,
        user_id,
        program_code,
    )
    return {
        (r["course_code"] or "").strip(): _normalize_term(r["term_availability"])
        for r in rows
        if (r["course_code"] or "").strip()
    }


@router.get("/catalog")
async def list_catalog(
        program_code: Optional[str] = Query(None),
        user=Depends(require_current_user),
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
        catalog = rows[0]["catalog"] or []
        async with pool.acquire() as conn:
            base_terms = await _fetch_base_terms(conn, program_code)
            override_terms = await _fetch_user_overrides(conn, user["sub"], program_code)
        merged = dict(base_terms)
        merged.update(override_terms)
        return _apply_course_terms(catalog, merged)

    out = []
    async with pool.acquire() as conn:
        for r in rows:
            row_program_code = r["program_code"]
            row_catalog = r["catalog"] or []
            base_terms = await _fetch_base_terms(conn, row_program_code)
            override_terms = await _fetch_user_overrides(conn, user["sub"], row_program_code)
            merged = dict(base_terms)
            merged.update(override_terms)
            out.append({
                "program_id": str(r["program_id"]),
                "program_code": row_program_code,
                "catalog": _apply_course_terms(row_catalog, merged),
            })
    return out
