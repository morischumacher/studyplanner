import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .settings import settings
from .db import migrate_on_boot, get_pool
from .routes.catalog import router as catalog_router
from .routes.rulecheck import router as rulecheck_router
from .routes.auth import router as auth_router
from .routes.planner_state import router as planner_state_router

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
app.include_router(auth_router)
app.include_router(planner_state_router)
