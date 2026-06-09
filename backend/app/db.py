import os
import glob
import asyncio
import asyncpg, json
from .settings import settings

_pool: asyncpg.pool.Pool | None = None

async def _setup_codecs(conn: asyncpg.Connection):
    #Ensure json/jsonb columns come back as Python dict/list
    await conn.set_type_codec('json',  encoder=json.dumps, decoder=json.loads, schema='pg_catalog')
    await conn.set_type_codec('jsonb', encoder=json.dumps, decoder=json.loads, schema='pg_catalog')

async def get_pool() -> asyncpg.pool.Pool:
    global _pool
    if _pool is not None:
        return _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=1,
        max_size=10,
        init=_setup_codecs,
    )
    return _pool

async def run_sql_file(conn: asyncpg.Connection, path: str):
    sql = open(path, "r", encoding="utf-8").read()
    # run whole file directly, since SQL files contain custom COMMIT statements
    await conn.execute(sql)

async def migrate_on_boot():
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Create a migration history table to track executed migrations
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS migration_history (
                filename TEXT PRIMARY KEY,
                executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        base = settings.MIGRATIONS_DIR
        # Run all SQL migrations in lexical order: 001..., 002..., 003..., 004...
        files = sorted(glob.glob(os.path.join(base, "*.sql")))

        # Fetch already executed migrations
        rows = await conn.fetch("SELECT filename FROM migration_history")
        executed_files = {row["filename"] for row in rows}

        for f in files:
            fname = os.path.basename(f)
            if fname in executed_files:
                print(f"⏭️ Skipping already executed migration: {fname}")
                continue

            if os.path.exists(f):
                try:
                    await run_sql_file(conn, f)
                    await conn.execute(
                        "INSERT INTO migration_history (filename) VALUES ($1) ON CONFLICT DO NOTHING",
                        fname
                    )
                    print(f"✅ {fname}")
                except Exception as e:
                    # keep parity with Node’s behavior: report but don’t crash
                    print(f"❌ {fname}: {e}")
        # quick “attach versions” / health step equivalent
        await conn.execute("DO $$ BEGIN PERFORM 1; END $$;")
