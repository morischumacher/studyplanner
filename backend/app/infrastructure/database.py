"""
The connection pool, and the two ways of borrowing a connection from it.

`connection()` borrows one for reads. `transaction()` borrows one and opens a
transaction around it, so a sequence of statements either all apply or none do.
Which of the two a use case needs is a decision that belongs to the use case, so
services choose, and repositories are handed whatever was chosen.

The pool is created once and never closed. asyncpg binds a pool to the event
loop that created it, which is why the test suite runs on a single loop.
"""
from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import AsyncIterator

import asyncpg


async def _register_json_codecs(connection: asyncpg.Connection) -> None:
    """Return json and jsonb columns as Python objects rather than strings."""
    for type_name in ("json", "jsonb"):
        await connection.set_type_codec(
            type_name,
            encoder=json.dumps,
            decoder=json.loads,
            schema="pg_catalog",
        )


class Database:
    """Owns the pool and hands out connections."""

    def __init__(self, dsn: str, *, min_size: int = 1, max_size: int = 10) -> None:
        self._dsn = dsn
        self._min_size = min_size
        self._max_size = max_size
        self._pool: asyncpg.pool.Pool | None = None

    async def pool(self) -> asyncpg.pool.Pool:
        if self._pool is None:
            self._pool = await asyncpg.create_pool(
                dsn=self._dsn,
                min_size=self._min_size,
                max_size=self._max_size,
                init=_register_json_codecs,
            )
        return self._pool

    @asynccontextmanager
    async def connection(self) -> AsyncIterator[asyncpg.Connection]:
        pool = await self.pool()
        async with pool.acquire() as connection:
            yield connection

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[asyncpg.Connection]:
        async with self.connection() as connection:
            async with connection.transaction():
                yield connection

    async def check(self) -> None:
        """Prove the database is reachable. Raises if it is not."""
        async with self.connection() as connection:
            await connection.execute("SELECT 1")
