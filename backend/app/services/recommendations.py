"""
Producing course recommendations.

The recommender needs three things: what the student has told us about their
interests, every course the programme offers, and a rule checker to discard
candidates the curriculum would refuse. The first two are reads; the third is
the same rule set the compliance check uses, so a recommendation can never be
something the planner would then reject.
"""
from __future__ import annotations

from typing import Any

from ..repositories import UnitOfWorkFactory
from ..rules import checker_for
from .profile import ProfileService
from ..recommendations import Recommender


class RecommendationService:
    def __init__(
        self, unit_of_work: UnitOfWorkFactory, profiles: ProfileService
    ) -> None:
        self._unit_of_work = unit_of_work
        self._profiles = profiles

    async def recommend(
        self,
        user_id: str,
        program_code: str,
        planned_courses: list[dict[str, Any]],
        done_courses: list[dict[str, Any]],
        parked_courses: list[str],
    ) -> list[dict[str, Any]]:
        interests, career_direction, toggles = await self._profiles.recommendation_inputs(
            user_id, program_code
        )

        async with self._unit_of_work.read() as work:
            candidates = await work.catalog.candidates(program_code)

        recommender = Recommender(
            interests,
            career_direction,
            toggles,
            rule_checker=checker_for(program_code, strict=False),
            program_code=program_code,
        )
        return recommender.evaluate(
            planned_courses, done_courses, candidates, parked_courses
        )
