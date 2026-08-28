"""
Course recommendations.

Six channels answer the same question from different evidence: what the student
said they were interested in, which courses the catalogue calls similar, what the
curriculum expects to come first, what other students took next, what a career
direction needs, and what similar students chose. Each is a strategy in its own
module, and `engine` composes the ones the student has switched on.

The channels are independent of one another but not of their order. A course is
recommended once, with one reason, and the engine settles which channel gets to
give that reason.

`Recommender` is the only entry point anything outside this package should need.
"""
from __future__ import annotations

import json
from typing import Any

from .context import build_context
from .engine import enabled_channels, recommend
from .strategy import Strategy, Suggestion

__all__ = ["Recommender", "Strategy", "Suggestion"]


def _parse_toggles(toggles: Any) -> Any:
    """
    Read the channel switches, which do not always arrive as a dictionary.

    asyncpg hands back a JSON column as text when the connection's codecs are not
    yet registered, so the stored value may still be a string by the time it gets
    here.
    """
    if not isinstance(toggles, str):
        return toggles or {}
    try:
        return json.loads(toggles)
    except BaseException:
        return {}


class Recommender:
    def __init__(
        self,
        interests: list[str],
        career_direction: str,
        toggles: dict,
        rule_checker: Any = None,
        program_code: str | None = None,
    ) -> None:
        self.interests = {i.lower().strip() for i in interests if i.strip()}
        self.career_direction = (career_direction or "").lower().strip()
        self.rule_checker = rule_checker
        self.program_code = program_code
        self.toggles = _parse_toggles(toggles)

    def evaluate(
        self,
        planned_courses: list[dict[str, Any]],
        done_courses: list[dict[str, Any]],
        all_candidate_codes: list[dict[str, Any]],
        parked_courses: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        plan = build_context(
            interests=self.interests,
            career_direction=self.career_direction,
            program_code=self.program_code,
            toggles=self.toggles,
            planned_courses=planned_courses,
            done_courses=done_courses,
            pool=all_candidate_codes,
            parked_courses=parked_courses,
        )
        return recommend(plan, enabled_channels(self.toggles), self.rule_checker)
