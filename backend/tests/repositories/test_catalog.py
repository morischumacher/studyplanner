"""
The candidate query's ordering.

The recommender considers candidates in the order the pool arrives in, and its
final sort by score is stable, so ties keep that order. An unordered query
therefore makes the recommendation list a function of whatever row order the
planner happens to choose, and two students with the same plan can be shown
different courses.

These run against the development database, because the property under test is
what PostgreSQL returns rather than what the recommender does with it.
"""
from __future__ import annotations

from typing import Any

import asyncpg
import pytest
import pytest_asyncio

from app.repositories.catalog import CatalogRepository

BACHELOR = "033 521"
MASTER = "066 937"
PROGRAMMES = [BACHELOR, MASTER]


@pytest_asyncio.fixture(loop_scope="session")
async def catalog(database: str):
    connection = await asyncpg.connect(dsn=database)
    try:
        yield CatalogRepository(connection)
    finally:
        await connection.close()


def sort_key(row: dict[str, Any]) -> tuple[str, str, str, str]:
    """The order the query asks for, as Python can express it."""
    return (
        row["code"],
        str(row["id"]),
        str(row["category"] or ""),
        str(row["exam_subject"] or ""),
    )


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("program_code", PROGRAMMES)
async def test_candidates_come_back_in_a_stated_order(catalog, program_code: str) -> None:
    rows = await catalog.candidates(program_code)

    assert rows, f"no candidates for {program_code}"
    assert [sort_key(row) for row in rows] == sorted(sort_key(row) for row in rows)


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("program_code", PROGRAMMES)
async def test_the_order_is_total(catalog, program_code: str) -> None:
    """Two rows the ordering cannot separate would leave the tie to the planner."""
    rows = await catalog.candidates(program_code)

    keys = [sort_key(row) for row in rows]
    assert len(set(keys)) == len(keys)
