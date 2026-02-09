from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .settings import settings
from .db import migrate_on_boot, get_pool
from .routes.catalog import router as catalog_router

app = FastAPI(
    title="My Service",
    version="1.0.0",
    docs_url="/docs",            # Swagger UI
    redoc_url=None,              # disable ReDoc (optional)
    openapi_url="/openapi.json", # OpenAPI schema
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["health"])
def health():
    # Return a tiny body to ensure bytes are written
    return {"status": "ok"}

@app.on_event("startup")
async def _startup():
    await migrate_on_boot()

@app.get("/health")
async def health():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("SELECT 1")
    return {"ok": True}

app.include_router(catalog_router)
