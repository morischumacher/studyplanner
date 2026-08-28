"""
Contract tests for the HTTP surface.

The refactor moves route handlers into services and repositories. Nothing about
the wire format may change while that happens, so this pins the shape of every
endpoint: status codes, the set of keys in each response, and the types behind
them.

Values that legitimately differ between runs, such as identifiers and
timestamps, are replaced by a marker before comparison. What is asserted is the
*structure*, which is what a client depends on, rather than a byte-for-byte body
that would break on every new UUID.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

HERE = Path(__file__).resolve().parent
SHAPES = HERE / "response_shapes.json"

BACHELOR = "033 521"
MASTER = "066 937"

UUID_LENGTH = 36


def shape_of(value: Any) -> Any:
    """Reduce a response to its structure, discarding volatile values."""
    if isinstance(value, dict):
        return {key: shape_of(value[key]) for key in sorted(value)}
    if isinstance(value, list):
        # A list's element shape matters; its length usually does not, because it
        # follows from seed data that may legitimately grow.
        return [shape_of(value[0])] if value else []
    if isinstance(value, str):
        if len(value) == UUID_LENGTH and value.count("-") == 4:
            return "<uuid>"
        return "<str>"
    if isinstance(value, bool):
        return "<bool>"
    if isinstance(value, (int, float)):
        return "<number>"
    if value is None:
        return None
    return f"<{type(value).__name__}>"


EXPECTED: dict[str, Any] = json.loads(SHAPES.read_text()) if SHAPES.exists() else {}


def compare(name: str, status: int, body: Any, record: dict[str, Any]) -> None:
    """Record the observed shape, and check it against the committed one."""
    observed = {"status": status, "shape": shape_of(body)}
    record[name] = observed
    expected = EXPECTED.get(name)
    if expected is None:
        pytest.skip(
            f"no recorded shape for '{name}'; "
            f"re-run with RECORD_RESPONSE_SHAPES=1 to capture it"
        )
    assert observed["status"] == expected["status"], (
        f"{name}: status {expected['status']} -> {status}"
    )
    assert observed["shape"] == expected["shape"], (
        f"{name}: response shape changed\n"
        f"  expected: {json.dumps(expected['shape'], sort_keys=True)[:400]}\n"
        f"  observed: {json.dumps(observed['shape'], sort_keys=True)[:400]}"
    )


# Recording is opt-in. Committing a shape is an assertion about the wire format,
# so it should be a deliberate act rather than a side effect of a green test run.
OBSERVED: dict[str, Any] = {}


@pytest.fixture
def record() -> dict[str, Any]:
    return OBSERVED


@pytest.mark.asyncio
async def test_root_and_health(client, record) -> None:
    for path in ("/", "/health"):
        response = await client.get(path)
        compare(f"GET {path}", response.status_code, response.json(), record)


@pytest.mark.asyncio
async def test_auth_lifecycle(client, record) -> None:
    import uuid

    username = f"contract-{uuid.uuid4().hex[:10]}"
    creds = {"username": username, "password": "correct horse"}

    response = await client.post("/auth/signup", json=creds)
    compare("POST /auth/signup", response.status_code, response.json(), record)
    token = response.json().get("token")
    if token:
        client.headers["Authorization"] = f"Bearer {token}"

    response = await client.get("/auth/me")
    compare("GET /auth/me", response.status_code, response.json(), record)

    response = await client.post("/auth/signin", json=creds)
    compare("POST /auth/signin", response.status_code, response.json(), record)

    response = await client.post("/auth/signout")
    compare("POST /auth/signout", response.status_code, response.json(), record)


@pytest.mark.asyncio
async def test_auth_rejects_bad_credentials(client, record) -> None:
    response = await client.post(
        "/auth/signin", json={"username": "nobody-at-all", "password": "wrong"}
    )
    compare("POST /auth/signin (bad)", response.status_code, response.json(), record)


@pytest.mark.asyncio
async def test_protected_routes_require_a_session(client, record) -> None:
    """Every route that reads user data must refuse an anonymous caller."""
    for method, path in (
        ("get", "/planner-state"),
        ("get", "/profile-settings"),
    ):
        response = await getattr(client, method)(path)
        assert response.status_code in (401, 403), (
            f"{method.upper()} {path} allowed an anonymous caller ({response.status_code})"
        )
        compare(f"{method.upper()} {path} (anon)", response.status_code, response.json(), record)


@pytest.mark.asyncio
async def test_catalog(signed_in, record) -> None:
    response = await signed_in.get("/catalog", params={"programCode": BACHELOR})
    compare("GET /catalog", response.status_code, response.json(), record)


@pytest.mark.asyncio
async def test_planner_state_round_trip(signed_in, record) -> None:
    response = await signed_in.get("/planner-state")
    compare("GET /planner-state", response.status_code, response.json(), record)

    state = {"semesters": [{"id": 1, "courses": []}], "parking": []}
    response = await signed_in.put("/planner-state", json={"state": state})
    compare("PUT /planner-state", response.status_code, response.json(), record)

    response = await signed_in.get("/planner-state")
    assert response.status_code == 200
    assert response.json() is not None, "a state written back did not survive a read"


@pytest.mark.asyncio
async def test_profile_settings_before_setup(signed_in, record) -> None:
    """A profile cannot be saved until the start term exists. That order matters."""
    response = await signed_in.get(
        "/profile-settings", params={"program_code": BACHELOR}
    )
    compare("GET /profile-settings", response.status_code, response.json(), record)

    response = await signed_in.put(
        "/profile-settings/recommendation-profile",
        json={
            "program_code": BACHELOR,
            "interests": ["artificial intelligence"],
            "career_direction": "research",
            "recommendation_toggles": {},
        },
    )
    assert response.status_code == 400, "saving a profile before setup should be refused"
    compare(
        "PUT /profile-settings/recommendation-profile (before setup)",
        response.status_code, response.json(), record,
    )


@pytest.mark.asyncio
async def test_profile_settings_after_setup(signed_in, record) -> None:
    """The full setup path: choose a start term, then save a profile against it."""
    response = await signed_in.put(
        "/profile-settings/start-term",
        json={"program_code": BACHELOR, "season": "winter", "year": 2026},
    )
    compare("PUT /profile-settings/start-term", response.status_code, response.json(), record)

    response = await signed_in.put(
        "/profile-settings/recommendation-profile",
        json={
            "program_code": BACHELOR,
            "interests": ["artificial intelligence", "security"],
            "career_direction": "research",
            "recommendation_toggles": {"similarity": True},
        },
    )
    compare(
        "PUT /profile-settings/recommendation-profile",
        response.status_code, response.json(), record,
    )

    response = await signed_in.put(
        "/profile-settings/course-terms",
        json={"program_code": BACHELOR, "updates": []},
    )
    compare("PUT /profile-settings/course-terms", response.status_code, response.json(), record)


@pytest.mark.asyncio
async def test_profile_settings_requires_a_program(signed_in, record) -> None:
    """The programme code is mandatory; losing that validation would be a change."""
    response = await signed_in.get("/profile-settings")
    compare(
        "GET /profile-settings (no program)", response.status_code, response.json(), record
    )


@pytest.mark.asyncio
async def test_rulecheck(signed_in, record) -> None:
    for label, program in (("bachelor", BACHELOR), ("master", MASTER)):
        response = await signed_in.post(
            "/rulecheck",
            json={
                "programCode": program,
                "plannedCourses": [],
                "doneCourses": [],
                "change": {},
                "selectedFocus": None,
                "maxEctsPerSemester": 33.0,
                "recommendedEctsPerSemester": 30.0,
            },
        )
        compare(f"POST /rulecheck ({label})", response.status_code, response.json(), record)


@pytest.mark.asyncio
async def test_rulecheck_rejects_unknown_program(signed_in, record) -> None:
    response = await signed_in.post("/rulecheck", json={"programCode": "999 999"})
    compare("POST /rulecheck (unknown program)", response.status_code, response.json(), record)


@pytest.mark.asyncio
async def test_recommendations(signed_in, record) -> None:
    response = await signed_in.post(
        "/recommendations",
        json={
            "programCode": BACHELOR,
            "plannedCourses": [],
            "doneCourses": [],
            "parkedCourses": [],
        },
    )
    compare("POST /recommendations", response.status_code, response.json(), record)
