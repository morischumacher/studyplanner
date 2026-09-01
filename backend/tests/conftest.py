"""
Shared test fixtures.

Two properties of the application shape everything here.

The asyncpg pool is a module-level global created on startup and never closed,
so it stays bound to whichever event loop first touched it. Tests therefore share
one session-scoped loop and run the lifespan exactly once; a per-test lifespan
would hand the second test a pool belonging to a loop that has already closed.

Starlette's synchronous TestClient drives the app from a worker thread with its
own loop, which hits the same problem from the other direction. Everything here
is async against the ASGI app instead, which is also closer to how the app runs
under uvicorn.
"""
from __future__ import annotations

import os
import subprocess
import uuid
from pathlib import Path
from typing import AsyncIterator

import pytest
import pytest_asyncio

ROOT = Path(__file__).resolve().parents[2]


# Not autouse: the rule-engine golden tests are pure and must run without a
# database, so only fixtures that actually need one depend on this.
@pytest.fixture(scope="session")
def database() -> str:
    """Use DATABASE_URL if set, otherwise bring up the development database."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        script = ROOT / "scripts" / "dev-db.sh"
        subprocess.run([str(script), "up"], check=True, capture_output=True, text=True)
        url = subprocess.run(
            [str(script), "url"], check=True, capture_output=True, text=True
        ).stdout.strip()
        os.environ["DATABASE_URL"] = url
    return url


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def running_app(database: str):
    """Enter the app's lifespan once, so the connection pool is created once."""
    from app.main import app

    async with app.router.lifespan_context(app):
        yield app


@pytest_asyncio.fixture(loop_scope="session")
async def client(running_app) -> AsyncIterator["httpx.AsyncClient"]:
    """A fresh, anonymous HTTP client bound to the ASGI app."""
    import httpx

    transport = httpx.ASGITransport(app=running_app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as http:
        yield http


@pytest_asyncio.fixture(loop_scope="session")
async def signed_in(client) -> "httpx.AsyncClient":
    """A client carrying a session for a user created only for this test."""
    username = f"test-{uuid.uuid4().hex[:12]}"
    response = await client.post(
        "/auth/signup", json={"username": username, "password": "correct horse"}
    )
    assert response.status_code == 200, response.text
    token = response.json().get("token")
    if token:
        client.headers["Authorization"] = f"Bearer {token}"
    client.username = username  # type: ignore[attr-defined]
    return client
