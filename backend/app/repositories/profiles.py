"""
Per-programme profile: the start term, the recommendation profile, and any
course whose term the student has corrected for themselves.
"""
from __future__ import annotations

import json
from typing import Any

import asyncpg


class ProfileRepository:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self._connection = connection

    async def first_programme(self, user_id: str) -> str | None:
        """
        The programme the account is locked to.

        A student picks a programme once. The earliest profile row is what that
        choice became, and every later write is checked against it.
        """
        row = await self._connection.fetchrow(
            """
            SELECT program_code
            FROM user_program_profile
            WHERE user_id = $1
            ORDER BY updated_at ASC, program_code ASC
            LIMIT 1
            """,
            user_id,
        )
        return row["program_code"] if row else None

    async def get(self, user_id: str, program_code: str) -> dict[str, Any] | None:
        row = await self._connection.fetchrow(
            """
            SELECT start_term_season::text AS season, start_term_year AS year,
                   interests, career_direction, recommendation_toggles
            FROM user_program_profile
            WHERE user_id = $1 AND program_code = $2
            """,
            user_id,
            program_code,
        )
        return dict(row) if row else None

    async def get_start_term(self, user_id: str, program_code: str) -> dict[str, Any] | None:
        row = await self._connection.fetchrow(
            """
            SELECT start_term_season::text AS season, start_term_year AS year
            FROM user_program_profile
            WHERE user_id = $1 AND program_code = $2
            """,
            user_id,
            program_code,
        )
        return dict(row) if row else None

    async def get_recommendation_inputs(
        self, user_id: str, program_code: str
    ) -> dict[str, Any] | None:
        row = await self._connection.fetchrow(
            """
            SELECT interests, career_direction, recommendation_toggles
            FROM user_program_profile
            WHERE user_id = $1 AND program_code = $2
            """,
            user_id,
            program_code,
        )
        return dict(row) if row else None

    async def create_start_term(
        self, user_id: str, program_code: str, season: str, year: int
    ) -> dict[str, Any] | None:
        """
        Claim the start term, and report whether this call is what claimed it.

        `DO NOTHING` means a row already existed, and the caller has to decide
        whether the existing one agrees with what was asked for.
        """
        row = await self._connection.fetchrow(
            """
            INSERT INTO user_program_profile
                (user_id, program_code, start_term_season, start_term_year, updated_at)
            VALUES ($1, $2, $3::term_availability, $4, now())
            ON CONFLICT (user_id, program_code)
            DO NOTHING
            RETURNING start_term_season::text AS season, start_term_year AS year
            """,
            user_id,
            program_code,
            season,
            year,
        )
        return dict(row) if row else None

    async def update_recommendation_profile(
        self,
        user_id: str,
        program_code: str,
        interests: list[str],
        career_direction: str | None,
        toggles: dict[str, Any],
    ) -> bool:
        """False when there is no profile row yet, which means setup is incomplete."""
        result = await self._connection.execute(
            """
            UPDATE user_program_profile
            SET interests = $1,
                career_direction = $2,
                recommendation_toggles = $3::jsonb,
                updated_at = now()
            WHERE user_id = $4 AND program_code = $5
            """,
            interests,
            career_direction,
            json.dumps(toggles),
            user_id,
            program_code,
        )
        return result != "UPDATE 0"


class CourseTermOverrideRepository:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self._connection = connection

    async def list(self, user_id: str, program_code: str) -> list[dict[str, Any]]:
        rows = await self._connection.fetch(
            """
            SELECT course_code, term_availability::text AS term_availability
            FROM user_course_term_override
            WHERE user_id = $1 AND program_code = $2
            ORDER BY course_code
            """,
            user_id,
            program_code,
        )
        return [dict(row) for row in rows]

    async def as_map(self, user_id: str, program_code: str) -> dict[str, str]:
        rows = await self._connection.fetch(
            """
            SELECT course_code, term_availability::text AS term_availability
            FROM user_course_term_override
            WHERE user_id = $1 AND program_code = $2
            """,
            user_id,
            program_code,
        )
        return {row["course_code"]: row["term_availability"] for row in rows}

    async def upsert(
        self, user_id: str, program_code: str, course_code: str, term: str
    ) -> None:
        await self._connection.execute(
            """
            INSERT INTO user_course_term_override
                (user_id, program_code, course_code, term_availability, updated_at)
            VALUES ($1, $2, $3, $4::term_availability, now())
            ON CONFLICT (user_id, program_code, course_code)
            DO UPDATE SET
                term_availability = EXCLUDED.term_availability,
                updated_at = now()
            """,
            user_id,
            program_code,
            course_code,
            term,
        )
