from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..db import get_pool
from ..deps import require_current_user

TermAvailability = Literal["winter", "summer", "both"]

router = APIRouter(tags=["profile-settings"])


def _normalize_program_code(value: str) -> str:
    return str(value or "").strip()


class StartTermPayload(BaseModel):
    program_code: str = Field(min_length=1, max_length=64)
    season: TermAvailability
    year: int = Field(ge=1900, le=2600)


class CourseTermUpdate(BaseModel):
    course_code: str = Field(min_length=1, max_length=255)
    term_availability: TermAvailability


class CourseTermsPayload(BaseModel):
    program_code: str = Field(min_length=1, max_length=64)
    updates: List[CourseTermUpdate] = Field(default_factory=list)


class RecommendationProfilePayload(BaseModel):
    program_code: str = Field(min_length=1, max_length=64)
    interests: List[str] = Field(default_factory=list)
    career_direction: str | None = None
    recommendation_toggles: dict = Field(default_factory=dict)


@router.get("/profile-settings")
async def get_profile_settings(
    program_code: str = Query(...),
    user=Depends(require_current_user),
):
    code = _normalize_program_code(program_code)
    if not code:
        raise HTTPException(status_code=400, detail="program_code is required")

    pool = await get_pool()
    async with pool.acquire() as conn:
        locked_program_row = await conn.fetchrow(
            """
            SELECT program_code
            FROM user_program_profile
            WHERE user_id = $1
            ORDER BY updated_at ASC, program_code ASC
            LIMIT 1
            """,
            user["sub"],
        )
        start_term_row = await conn.fetchrow(
            """
            SELECT start_term_season::text AS season, start_term_year AS year,
                   interests, career_direction, recommendation_toggles
            FROM user_program_profile
            WHERE user_id = $1 AND program_code = $2
            """,
            user["sub"],
            code,
        )
        override_rows = await conn.fetch(
            """
            SELECT course_code, term_availability::text AS term_availability
            FROM user_course_term_override
            WHERE user_id = $1 AND program_code = $2
            ORDER BY course_code
            """,
            user["sub"],
            code,
        )

    toggles = {
        "interest": True, "similarity": True, "sequence": True, "completed": True, "internship": True
    }
    if start_term_row and start_term_row["recommendation_toggles"] is not None:
        raw_toggles = start_term_row["recommendation_toggles"]
        if isinstance(raw_toggles, str):
            import json
            try:
                toggles = json.loads(raw_toggles)
            except Exception:
                pass
        elif isinstance(raw_toggles, dict):
            toggles = raw_toggles

    return {
        "program_code": code,
        "start_term": (
            {
                "season": start_term_row["season"],
                "year": start_term_row["year"],
            }
            if start_term_row
            else None
        ),
        "interests": start_term_row["interests"] if start_term_row and start_term_row["interests"] is not None else [],
        "career_direction": start_term_row["career_direction"] if start_term_row else None,
        "recommendation_toggles": toggles,
        "start_term_locked": bool(start_term_row),
        "locked_program_code": (
            str(locked_program_row["program_code"]).strip()
            if locked_program_row and str(locked_program_row["program_code"]).strip()
            else None
        ),
        "course_term_overrides": {
            str(row["course_code"]).strip(): str(row["term_availability"]).strip().lower()
            for row in override_rows
            if str(row["course_code"]).strip()
        },
    }


@router.put("/profile-settings/start-term")
async def put_start_term(payload: StartTermPayload, user=Depends(require_current_user)):
    program_code = _normalize_program_code(payload.program_code)
    if not program_code:
        raise HTTPException(status_code=400, detail="program_code is required")
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.fetchrow(
            "SELECT id FROM app_user WHERE id = $1 FOR UPDATE",
            user["sub"],
        )
        locked_program_row = await conn.fetchrow(
            """
            SELECT program_code
            FROM user_program_profile
            WHERE user_id = $1
            ORDER BY updated_at ASC, program_code ASC
            LIMIT 1
            """,
            user["sub"],
        )
        if locked_program_row:
            locked_program_code = str(locked_program_row["program_code"] or "").strip()
            if locked_program_code and locked_program_code != program_code:
                raise HTTPException(
                    status_code=409,
                    detail=f"Study program is locked to {locked_program_code} after initial setup.",
                )

        inserted = await conn.fetchrow(
            """
            INSERT INTO user_program_profile (user_id, program_code, start_term_season, start_term_year, updated_at)
            VALUES ($1, $2, $3::term_availability, $4, now())
            ON CONFLICT (user_id, program_code)
            DO NOTHING
            RETURNING start_term_season::text AS season, start_term_year AS year
            """,
            user["sub"],
            program_code,
            payload.season,
            payload.year,
        )

        if inserted:
            return {"ok": True, "locked": True}

        existing = await conn.fetchrow(
            """
            SELECT start_term_season::text AS season, start_term_year AS year
            FROM user_program_profile
            WHERE user_id = $1 AND program_code = $2
            """,
            user["sub"],
            program_code,
        )
        if not existing:
            raise HTTPException(status_code=500, detail="Could not persist start semester.")

        same_season = str(existing["season"]).strip().lower() == str(payload.season).strip().lower()
        same_year = int(existing["year"]) == int(payload.year)
        if same_season and same_year:
            return {"ok": True, "locked": True}

        raise HTTPException(status_code=409, detail="Start semester is locked after first setup.")


@router.put("/profile-settings/course-terms")
async def put_course_terms(payload: CourseTermsPayload, user=Depends(require_current_user)):
    program_code = _normalize_program_code(payload.program_code)
    if not program_code:
        raise HTTPException(status_code=400, detail="program_code is required")
    if not payload.updates:
        return {"ok": True, "updated": 0}

    pool = await get_pool()
    async with pool.acquire() as conn:
        for update in payload.updates:
            course_code = str(update.course_code or "").strip()
            if not course_code:
                continue
            await conn.execute(
                """
                INSERT INTO user_course_term_override (user_id, program_code, course_code, term_availability, updated_at)
                VALUES ($1, $2, $3, $4::term_availability, now())
                ON CONFLICT (user_id, program_code, course_code)
                DO UPDATE SET
                    term_availability = EXCLUDED.term_availability,
                    updated_at = now()
                """,
                user["sub"],
                program_code,
                course_code,
                update.term_availability,
            )
    return {"ok": True, "updated": len(payload.updates)}


@router.put("/profile-settings/recommendation-profile")
async def put_recommendation_profile(payload: RecommendationProfilePayload, user=Depends(require_current_user)):
    program_code = _normalize_program_code(payload.program_code)
    if not program_code:
        raise HTTPException(status_code=400, detail="program_code is required")

    import json
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            UPDATE user_program_profile
            SET interests = $1,
                career_direction = $2,
                recommendation_toggles = $3::jsonb,
                updated_at = now()
            WHERE user_id = $4 AND program_code = $5
            """,
            payload.interests,
            payload.career_direction,
            json.dumps(payload.recommendation_toggles),
            user["sub"],
            program_code,
        )
        # If no row exists, we shouldn't insert here because start_term is required first (setup).
        # We can just return success or fail if not set up yet.
        if result == "UPDATE 0":
             raise HTTPException(status_code=400, detail="Please complete initial setup (start semester) before saving profile.")
             
    return {"ok": True}
