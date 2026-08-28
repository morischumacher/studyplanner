"""
What the rule filter does when the rule checker cannot answer.

The filter's premise is that a recommendation the planner would immediately
refuse is worse than no recommendation, and it can only hold that premise for
candidates it managed to check. A checker that raises tells it nothing, and the
one reading it must not take for granted is that silence means consent.

The checker is a stub here rather than a real one. The property under test is how
the filter reads a failure, and driving a real checker into raising would pin the
filter's behaviour to whatever happens to make that checker fall over.
"""
from __future__ import annotations

from typing import Any

import pytest

from app.recommendations.context import build_context
from app.recommendations.rules import filter_by_rules

BACHELOR = "033 521"

POOL = [
    {"code": "A", "title": "Analysis", "ects": 6.0, "category": "mandatory"},
    {"code": "B", "title": "Betriebssysteme", "ects": 6.0, "category": "narrow"},
    {"code": "C", "title": "Computersysteme", "ects": 6.0, "category": "narrow"},
]

RECOMMENDATIONS = [{"courseCode": row["code"], "score": 0.5} for row in POOL]


class Result:
    """As much of a RuleCheckResult as the filter reads."""

    def __init__(self, ok: bool, errors: list[str] | None = None) -> None:
        self.ok = ok
        self.errors = errors or []
        self.stats: dict[str, Any] = {"warnings": []}


def trial_code(payload: dict[str, Any]) -> str | None:
    """The candidate this payload is trying out, or None for the plan on its own."""
    extra = [c for c in payload.get("plannedCourses") or [] if c.get("laneIndex") == 99]
    return extra[0]["code"] if extra else None


class Checker:
    """Accepts everything, except where it has been told to raise or to refuse."""

    def __init__(self, *, raises_on: tuple[str | None, ...] = (), refuses: tuple[str, ...] = (),
                 error: type[BaseException] = RuntimeError) -> None:
        self._raises_on = raises_on
        self._refuses = refuses
        self._error = error

    def evaluate(self, payload: dict[str, Any]):
        code = trial_code(payload)
        if code in self._raises_on:
            raise self._error("the checker fell over")
        if code in self._refuses:
            return Result(False, [f"rejected: {code}"])
        return Result(True)


def plan():
    return build_context(
        interests=set(),
        career_direction="",
        program_code=BACHELOR,
        toggles={},
        planned_courses=[],
        done_courses=[],
        pool=POOL,
        parked_courses=None,
    )


def kept(checker: Checker) -> list[str]:
    return [rec["courseCode"] for rec in filter_by_rules(plan(), RECOMMENDATIONS, checker)]


def test_a_candidate_the_checker_refuses_is_not_offered() -> None:
    """The filter doing its ordinary job, so that the tests below mean something."""
    assert kept(Checker(refuses=("B",))) == ["A", "C"]


def test_a_candidate_the_checker_could_not_judge_is_not_offered() -> None:
    assert kept(Checker(raises_on=("B",))) == ["A", "C"]


def test_a_checker_that_cannot_judge_the_plan_at_all_leaves_the_list_alone() -> None:
    """
    With no baseline there is nothing to compare a candidate against, so the
    filter stands down rather than measuring every candidate against a baseline
    it never computed. That is the same list the engine shows when no checker is
    configured at all.
    """
    assert kept(Checker(raises_on=(None,), refuses=("B",))) == ["A", "B", "C"]


@pytest.mark.parametrize("error", [KeyboardInterrupt, SystemExit])
@pytest.mark.parametrize("raises_on", [(None,), ("B",)])
def test_an_interrupt_is_not_read_as_a_verdict(error, raises_on) -> None:
    with pytest.raises(error):
        kept(Checker(raises_on=raises_on, error=error))
