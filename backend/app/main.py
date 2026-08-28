"""
The application object: middleware, lifespan, and the routers.

Everything of substance lives below this file. What is here is assembly.
"""
from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .api import router as api_router
from .api.dependencies import database
from .api.errors import handle_domain_error
from .domain.errors import DomainError
from .infrastructure.migrations import apply_pending, migrations_directory
from .settings import settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    async with database.connection() as connection:
        await apply_pending(connection, migrations_directory(settings.MIGRATIONS_DIR))
    yield


app = FastAPI(
    title="Study Planner API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(DomainError, handle_domain_error)


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


@app.get("/", tags=["meta"])
async def root() -> dict[str, str]:
    return {"status": "ok", "message": "Study Planner API is running"}


@app.get("/health", tags=["meta"])
async def health() -> dict[str, bool]:
    """Liveness plus a round trip to the database, which is what actually fails."""
    await database.check()
    return {"ok": True}


app.include_router(api_router)
