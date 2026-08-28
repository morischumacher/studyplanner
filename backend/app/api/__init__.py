"""
The HTTP surface.

A handler here validates its input, calls exactly one service, and shapes the
reply. It holds no business rules and no SQL. Domain errors raised below are
turned into responses in one place, `errors.py`, which is the only module in the
application that knows what a status code is.
"""
from fastapi import APIRouter

from .auth import router as auth_router
from .catalog import router as catalog_router
from .planner_state import router as planner_state_router
from .profile_settings import router as profile_settings_router
from .recommendations import router as recommendations_router
from .rulecheck import router as rulecheck_router
from .user_study import router as user_study_router

router = APIRouter()

for included in (
    catalog_router,
    rulecheck_router,
    auth_router,
    planner_state_router,
    profile_settings_router,
    recommendations_router,
    user_study_router,
):
    router.include_router(included)

__all__ = ["router"]
