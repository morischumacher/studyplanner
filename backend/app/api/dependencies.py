"""
Wiring.

The services are stateless and cheap, so they are built once at import time and
handed to the handlers by FastAPI's dependency system. Building them here rather
than inside the handlers is what keeps the handlers free of any knowledge about
the database.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import Cookie, Depends, Header

from ..domain.errors import NotAuthenticated
from ..infrastructure.database import Database
from ..repositories import UnitOfWorkFactory
from ..services.auth import AuthService
from ..services.catalog import CatalogService
from ..services.planner import PlannerService
from ..services.profile import ProfileService
from ..services.recommendations import RecommendationService
from ..services.rulecheck import RuleCheckService
from ..services.study_results import StudyResultsService
from ..settings import settings

BACKEND_ROOT = Path(__file__).resolve().parents[2]

database = Database(settings.DATABASE_URL)
unit_of_work = UnitOfWorkFactory(database)

auth_service = AuthService(unit_of_work)
catalog_service = CatalogService(unit_of_work)
planner_service = PlannerService(unit_of_work)
profile_service = ProfileService(unit_of_work)
rule_check_service = RuleCheckService()
recommendation_service = RecommendationService(unit_of_work, profile_service)
study_results_service = StudyResultsService(BACKEND_ROOT / "study_results")


def get_auth_service() -> AuthService:
    return auth_service


def get_catalog_service() -> CatalogService:
    return catalog_service


def get_planner_service() -> PlannerService:
    return planner_service


def get_profile_service() -> ProfileService:
    return profile_service


def get_rule_check_service() -> RuleCheckService:
    return rule_check_service


def get_recommendation_service() -> RecommendationService:
    return recommendation_service


def get_study_results_service() -> StudyResultsService:
    return study_results_service


def _bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    if not authorization.startswith("Bearer "):
        raise NotAuthenticated("Invalid token")
    return authorization.split()[1]


async def current_user(
    authorization: str | None = Header(None),
    session_token: str | None = Cookie(None),
    auth: AuthService = Depends(get_auth_service),
) -> dict[str, Any] | None:
    """The signed-in account, or None. Endpoints that tolerate anonymity use this."""
    return await auth.identify(_bearer(authorization) or session_token)


async def require_user(
    user: dict[str, Any] | None = Depends(current_user),
) -> dict[str, Any]:
    if not user:
        raise NotAuthenticated("Not authenticated")
    return user
