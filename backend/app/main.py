import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .settings import settings
from .db import migrate_on_boot, get_pool
from .routes.catalog import router as catalog_router
from .routes.rulecheck import router as rulecheck_router

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


@app.middleware("http")
async def log_http_requests(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started) * 1000
    print(
        f"[HTTP] {request.method} {request.url.path}"
        f" -> {response.status_code} ({elapsed_ms:.1f} ms)"
    )
    return response

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
app.include_router(rulecheck_router)
