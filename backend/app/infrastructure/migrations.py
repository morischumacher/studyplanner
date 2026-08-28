"""
Schema migrations applied at startup.

Files in the migrations directory are applied in lexical order and recorded in
`migration_history`, so a file that has already run is skipped. A failure is
reported and does not stop the application from starting, which is how this has
always behaved; the development database script applies the same ledger, so the
two agree about what has run.
"""
from __future__ import annotations

import os
from pathlib import Path

import asyncpg

LEDGER = """
    CREATE TABLE IF NOT EXISTS migration_history (
        filename TEXT PRIMARY KEY,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
"""


async def _applied(connection: asyncpg.Connection) -> set[str]:
    rows = await connection.fetch("SELECT filename FROM migration_history")
    return {row["filename"] for row in rows}


async def apply_pending(connection: asyncpg.Connection, directory: str) -> None:
    await connection.execute(LEDGER)
    applied = await _applied(connection)

    for path in sorted(Path(directory).glob("*.sql")):
        if path.name in applied:
            print(f"⏭️  {path.name} (already applied)")
            continue
        try:
            # Files carry their own COMMIT statements, so each is executed whole
            # rather than split into statements.
            await connection.execute(path.read_text(encoding="utf-8"))
            await connection.execute(
                "INSERT INTO migration_history (filename) VALUES ($1) ON CONFLICT DO NOTHING",
                path.name,
            )
            print(f"✅ {path.name}")
        except Exception as error:  # noqa: BLE001 - reported, not fatal
            print(f"❌ {path.name}: {error}")


def migrations_directory(configured: str) -> str:
    """Resolve the migrations directory relative to the backend package root."""
    if os.path.isabs(configured):
        return configured
    return str(Path(__file__).resolve().parents[2] / configured)
