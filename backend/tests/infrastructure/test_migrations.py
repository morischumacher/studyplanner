"""
The migration ledger.

These run against a scratch database created for the test and dropped
afterwards, because what is being checked is what happens to an empty database
and to one that has already been migrated, and neither can be observed on the
shared development database.
"""
from __future__ import annotations

import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import asyncpg
import pytest
import pytest_asyncio

from app.infrastructure.migrations import (
    MigrationDrift,
    apply_pending,
    checksum,
    migrations_directory,
)

SQL_DIR = Path(migrations_directory("sql"))


def _dsn_for(database_url: str, name: str) -> str:
    """The same connection details, pointed at a different database."""
    parts = urlsplit(database_url)
    return urlunsplit(parts._replace(path=f"/{name}"))


@pytest_asyncio.fixture(loop_scope="session")
async def scratch(database: str):
    """An empty database, dropped when the test finishes."""
    name = f"migrations_test_{uuid.uuid4().hex[:12]}"
    admin = await asyncpg.connect(dsn=database)
    await admin.execute(f'CREATE DATABASE "{name}"')
    try:
        connection = await asyncpg.connect(dsn=_dsn_for(database, name))
        try:
            yield connection
        finally:
            await connection.close()
    finally:
        await admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        await admin.close()


async def _ledger(connection: asyncpg.Connection) -> dict[str, str | None]:
    rows = await connection.fetch("SELECT filename, checksum FROM migration_history")
    return {row["filename"]: row["checksum"] for row in rows}


@pytest.mark.asyncio(loop_scope="session")
async def test_a_fresh_database_gets_every_migration(scratch) -> None:
    await apply_pending(scratch, str(SQL_DIR))

    recorded = await _ledger(scratch)
    on_disk = {path.name for path in SQL_DIR.glob("*.sql")}
    assert set(recorded) == on_disk
    assert all(value for value in recorded.values()), "every applied file records a checksum"


@pytest.mark.asyncio(loop_scope="session")
async def test_applying_twice_changes_nothing(scratch) -> None:
    await apply_pending(scratch, str(SQL_DIR))
    before = await _ledger(scratch)
    await apply_pending(scratch, str(SQL_DIR))
    assert await _ledger(scratch) == before


@pytest.mark.asyncio(loop_scope="session")
async def test_a_ledger_row_without_a_checksum_is_backfilled(scratch) -> None:
    """Rows written before checksums existed must not be mistaken for pending."""
    await apply_pending(scratch, str(SQL_DIR))
    name = sorted(path.name for path in SQL_DIR.glob("*.sql"))[0]
    await scratch.execute(
        "UPDATE migration_history SET checksum = NULL WHERE filename = $1", name
    )

    await apply_pending(scratch, str(SQL_DIR))

    assert (await _ledger(scratch))[name] == checksum(
        (SQL_DIR / name).read_text(encoding="utf-8")
    )


@pytest.mark.asyncio(loop_scope="session")
async def test_an_edited_migration_is_reported(scratch) -> None:
    await apply_pending(scratch, str(SQL_DIR))
    name = sorted(path.name for path in SQL_DIR.glob("*.sql"))[0]
    await scratch.execute(
        "UPDATE migration_history SET checksum = 'not what is on disk' WHERE filename = $1",
        name,
    )

    with pytest.raises(MigrationDrift) as raised:
        await apply_pending(scratch, str(SQL_DIR))
    assert name in str(raised.value)


def test_identifiers_are_timestamped_and_unique() -> None:
    """
    Sequential numbers collide when two branches both add the next one, which is
    why these are timestamps.
    """
    names = sorted(path.name for path in SQL_DIR.glob("*.sql"))
    stamps = [name.split("_", 1)[0] for name in names]

    assert len(set(stamps)) == len(stamps), "two migrations share an identifier"
    for stamp in stamps:
        assert len(stamp) == 12 and stamp.isdigit(), f"'{stamp}' is not YYYYMMDDHHMM"
    assert stamps == sorted(stamps), "lexical order is not chronological order"


def test_the_ledger_file_is_not_treated_as_a_migration() -> None:
    """It runs before the scan, so picking it up would apply it twice."""
    assert (SQL_DIR / "_ledger.psql").exists()
    assert "_ledger.psql" not in {path.name for path in SQL_DIR.glob("*.sql")}
