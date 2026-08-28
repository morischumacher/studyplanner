"""
Schema migrations.

A migration is a SQL file named `YYYYMMDDHHMM_slug.sql`. Lexical order is
therefore chronological order, and two people working in parallel cannot produce
the same identifier by accident, which sequential numbering could not promise.

Migrations are forward-only. There are no down-migrations, because one that is
never exercised is not a rollback path, it is an untested claim.

Each applied file is recorded with a checksum. Editing a migration after it has
run means the database and the repository disagree about the schema, and that is
reported rather than discovered later.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path

import asyncpg

# Creates the ledger and remaps the old sequential filenames. Not a migration,
# and deliberately not matched by the *.sql scan below.
LEDGER = "_ledger.psql"


class MigrationDrift(RuntimeError):
    """An already-applied migration no longer matches the file on disk."""


def checksum(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def migrations_directory(configured: str) -> str:
    """Resolve the migrations directory relative to the backend package root."""
    if os.path.isabs(configured):
        return configured
    return str(Path(__file__).resolve().parents[2] / configured)


async def _verify(
    connection: asyncpg.Connection, applied: dict[str, str | None], files: dict[str, str]
) -> None:
    """
    Compare recorded checksums against the files, and fill in the missing ones.

    Rows written before checksums existed have none. Those are backfilled from
    what is on disk now, which is the truthful best guess: whether they matched
    at the time cannot be recovered.
    """
    drifted = []
    for name, recorded in applied.items():
        current = files.get(name)
        if current is None:
            continue
        if recorded is None:
            await connection.execute(
                "UPDATE migration_history SET checksum = $2 WHERE filename = $1",
                name,
                current,
            )
        elif recorded != current:
            drifted.append(name)

    if drifted:
        raise MigrationDrift(
            "these migrations were applied and have since been edited: "
            + ", ".join(sorted(drifted))
        )


async def apply_pending(connection: asyncpg.Connection, directory: str) -> None:
    root = Path(directory)
    await connection.execute((root / LEDGER).read_text(encoding="utf-8"))

    paths = sorted(root.glob("*.sql"))
    files = {path.name: checksum(path.read_text(encoding="utf-8")) for path in paths}
    applied = {
        row["filename"]: row["checksum"]
        for row in await connection.fetch("SELECT filename, checksum FROM migration_history")
    }
    await _verify(connection, applied, files)

    for path in paths:
        if path.name in applied:
            continue
        try:
            # Files carry their own COMMIT statements, so each is executed whole
            # rather than split into statements.
            await connection.execute(path.read_text(encoding="utf-8"))
            await connection.execute(
                """
                INSERT INTO migration_history (filename, checksum)
                VALUES ($1, $2) ON CONFLICT DO NOTHING
                """,
                path.name,
                files[path.name],
            )
            print(f"✅ {path.name}")
        except Exception as error:  # noqa: BLE001 - reported, not fatal
            print(f"❌ {path.name}: {error}")
