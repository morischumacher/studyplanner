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
    _pool = await asyncpg.create_pool(
                    dsn=settings.DATABASE_URL,
                min_size=1,
                max_size=10,
                init=_setup_codecs,   # <-- add this
            )
    return _pool

async def run_sql_file(conn: asyncpg.Connection, path: str):
    sql = open(path, "r", encoding="utf-8").read()
    # run whole file in a tx, like your Node db.js
    async with conn.transaction():
        await conn.execute(sql)

async def migrate_on_boot():
    pool = await get_pool()
    async with pool.acquire() as conn:
        # mirror Node boot: run schema then seed
        base = settings.MIGRATIONS_DIR
        files = [os.path.join(base, "001_schema.sql")]
        #files = [os.path.join(base, "001_schema.sql"), os.path.join(base, "002_mastercatalog.sql")]
        for f in files:
            if os.path.exists(f):
                try:
                    await run_sql_file(conn, f)
                    print(f"✅ {os.path.basename(f)}")
                except Exception as e:
                    # keep parity with Node’s behavior: report but don’t crash
                    print(f"❌ {os.path.basename(f)}: {e}")
        # quick “attach versions” / health step equivalent
        await conn.execute("DO $$ BEGIN PERFORM 1; END $$;")

