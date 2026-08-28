"""
Serving the course catalogue.

The catalogue comes out of a materialised view already shaped the way the
frontend wants it. The one thing the view cannot answer is when a course is
offered, because that has two sources: the curriculum, and whatever the student
has corrected for their own plan. The student's answer wins.
"""
from __future__ import annotations

from typing import Any

from ..domain.errors import ProgrammeNotFound, StorageFailure
from ..repositories import UnitOfWork, UnitOfWorkFactory

TERMS = ("winter", "summer", "both")
DEFAULT_TERM = "both"


def normalise_term(value: Any) -> str:
    """Anything unrecognised means 'both', so an odd value never hides a course."""
    raw = str(value or "").strip().lower()
    return raw if raw in TERMS else DEFAULT_TERM


def _clean(mapping: dict[str, Any]) -> dict[str, str]:
    cleaned = {}
    for code, term in mapping.items():
        key = (code or "").strip()
        if key:
            cleaned[key] = normalise_term(term)
    return cleaned


def apply_terms(catalog: list, terms_by_code: dict[str, str]) -> list:
    """Stamp each course in the nested catalogue with its term availability."""
    for subject in catalog or []:
        modules = subject.get("modules") if isinstance(subject, dict) else []
        for module in modules or []:
            courses = module.get("courses") if isinstance(module, dict) else []
            for course in courses or []:
                if not isinstance(course, dict):
                    continue
                code = (course.get("code") or "").strip()
                course["term_availability"] = (
                    normalise_term(terms_by_code.get(code)) if code else DEFAULT_TERM
                )
    return catalog


class CatalogService:
    def __init__(self, unit_of_work: UnitOfWorkFactory) -> None:
        self._unit_of_work = unit_of_work

    @staticmethod
    async def _terms_for(work: UnitOfWork, user_id: str, program_code: str) -> dict[str, str]:
        curriculum = _clean(await work.catalog.term_availability(program_code))
        student = _clean(await work.course_term_overrides.as_map(user_id, program_code))
        return {**curriculum, **student}

    async def for_programme(self, user_id: str, program_code: str) -> list:
        async with self._unit_of_work.read() as work:
            try:
                rows = await work.catalog.programmes(program_code)
            except Exception as error:  # noqa: BLE001 - reported to the caller
                raise StorageFailure(f"Catalog query failed: {error}") from error
            if not rows:
                raise ProgrammeNotFound("Program not found in catalog view")
            terms = await self._terms_for(work, user_id, program_code)
            return apply_terms(rows[0]["catalog"] or [], terms)

    async def for_all_programmes(self, user_id: str) -> list[dict[str, Any]]:
        async with self._unit_of_work.read() as work:
            try:
                rows = await work.catalog.programmes(None)
            except Exception as error:  # noqa: BLE001 - reported to the caller
                raise StorageFailure(f"Catalog query failed: {error}") from error

            catalogues = []
            for row in rows:
                terms = await self._terms_for(work, user_id, row["program_code"])
                catalogues.append(
                    {
                        "program_id": str(row["program_id"]),
                        "program_code": row["program_code"],
                        "catalog": apply_terms(row["catalog"] or [], terms),
                    }
                )
            return catalogues
