"""
The course catalogue.

The catalogue itself is served from a materialised view that already contains
the nested JSON the frontend expects. Term availability is not part of that view
because it is answered twice: once by the curriculum, and once by whatever the
student has overridden for their own plan.
"""
from __future__ import annotations

from typing import Any

import asyncpg

CATALOG_VIEW = "public.v_catalog_json_mat"


class CatalogRepository:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self._connection = connection

    async def programmes(self, program_code: str | None) -> list[dict[str, Any]]:
        """One row per programme, or just the one asked for."""
        rows = await self._connection.fetch(
            f"""
            SELECT program_id, program_code, catalog
            FROM {CATALOG_VIEW}
            WHERE ($1::text IS NULL OR program_code = $1)
            ORDER BY program_code
            """,
            program_code,
        )
        return [dict(row) for row in rows]

    async def term_availability(self, program_code: str) -> dict[str, str]:
        """What the curriculum says about when each course is offered."""
        rows = await self._connection.fetch(
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
        return {row["code"]: row["term_availability"] for row in rows}

    async def candidates(self, program_code: str) -> list[dict[str, Any]]:
        """
        Every course in a programme, flat.

        The recommender needs the courses without the catalogue's nesting. Going
        through the JSON view instead would mean materialising the whole
        document only to take it apart again.
        """
        rows = await self._connection.fetch(
            """
            SELECT DISTINCT
                c.id, c.code, c.title, c.type, c.ects, c.language, c.term_availability,
                c.attributes->'content' as content,
                c.attributes->'similar_courses' as similar_courses,
                m.category,
                es.name as exam_subject
            FROM course c
            JOIN module_course mc ON mc.course_id = c.id
            JOIN module m ON m.id = mc.module_id
            JOIN study_program sp ON sp.id = m.program_id
            LEFT JOIN module_grouping mg ON mg.module_id = m.id
            LEFT JOIN exam_subject es ON es.id = mg.exam_subject_id
            WHERE sp.code = $1
            """,
            program_code,
        )
        return [dict(row) for row in rows]
