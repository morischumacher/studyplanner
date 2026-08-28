"""
The channels that read a relation, against real catalogue rows.

`sequence` and `completed` once read a hand-written table whose course codes were
in neither catalogue, so both channels were silent in the running system while
every structural test around them still passed. These tests are the ones that
noticed: they drive the channels with the recorded catalogue pools and real
plans, so a relation that stops resolving to catalogue codes fails here rather
than disappearing quietly.

The pools come from the recorded corpus rather than the database, so this file
runs without one.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.recommendations.completed import CompletedStrategy
from app.recommendations.context import Course, build_context
from app.recommendations.peer import cohort_for, forget_cohorts
from app.recommendations.sequence import SequenceStrategy, ordered_pairs

from tests.golden.build_recommender_fixtures import restore

BACHELOR = "033 521"
MASTER = "066 937"
PROGRAMMES = [BACHELOR, MASTER]

_CORPUS = restore(
    json.loads(
        (Path(__file__).resolve().parents[1] / "golden" / "recommender_fixtures.json")
        .read_text(encoding="utf-8")
    )
)
POOLS: dict[str, list[dict[str, Any]]] = _CORPUS["pools"]


@pytest.fixture(autouse=True)
def _fresh_cohorts():
    """The cohort is memoised for the life of the process, and other tests seed it."""
    forget_cohorts()
    yield
    forget_cohorts()


def plan_for(program_code: str, **over: Any):
    base = dict(
        interests=set(),
        career_direction="",
        program_code=program_code,
        toggles={},
        planned_courses=[],
        done_courses=[],
        pool=POOLS[program_code],
        parked_courses=None,
    )
    base.update(over)
    return build_context(**base)


def row_for(program_code: str, code: str) -> dict[str, Any]:
    for row in POOLS[program_code]:
        if row["code"] == code:
            return row
    raise AssertionError(f"{code} is not in the {program_code} catalogue")


def as_planned(program_code: str, code: str, lane: int = 0) -> dict[str, Any]:
    row = row_for(program_code, code)
    return {"code": code, "title": row["title"], "laneIndex": lane}


@pytest.mark.parametrize("program_code", PROGRAMMES)
def test_the_curriculum_ordering_resolves_to_catalogue_codes(program_code: str) -> None:
    pairs = ordered_pairs(program_code, POOLS[program_code])
    assert pairs, f"no ordering resolved for {program_code}"

    codes = {row["code"] for row in POOLS[program_code]}
    for earlier, later in pairs:
        assert earlier in codes and later in codes


@pytest.mark.parametrize("program_code", PROGRAMMES)
def test_a_prerequisite_of_a_planned_course_is_recommended(program_code: str) -> None:
    earlier, later = ordered_pairs(program_code, POOLS[program_code])[0]
    plan = plan_for(program_code, planned_courses=[as_planned(program_code, later)])

    suggestions = list(
        SequenceStrategy().suggest(plan, Course.of(row_for(program_code, earlier)))
    )

    assert [s.evidence for s in suggestions] == [
        f"the curriculum expects this before planned course {later}"
    ]


@pytest.mark.parametrize("program_code", PROGRAMMES)
def test_a_successor_of_a_completed_course_is_recommended(program_code: str) -> None:
    earlier, later = ordered_pairs(program_code, POOLS[program_code])[0]
    plan = plan_for(program_code, done_courses=[as_planned(program_code, earlier)])

    suggestions = list(
        SequenceStrategy().suggest(plan, Course.of(row_for(program_code, later)))
    )

    assert [s.evidence for s in suggestions] == [
        f"the curriculum places this after completed course {earlier}"
    ]


@pytest.mark.parametrize("program_code", PROGRAMMES)
def test_the_ordering_carries_no_relation_the_curriculum_does_not_state(
    program_code: str,
) -> None:
    """Resolving names to codes must not invent pairs, only translate them."""
    from app.recommendations.sequence import _curriculum_relations

    assert len(ordered_pairs(program_code, POOLS[program_code])) <= len(
        _curriculum_relations(program_code)
    )


def a_course_the_cohort_took(program_code: str) -> str:
    """A catalogue code some of the synthetic prior students have in common."""
    cohort = cohort_for(program_code, POOLS[program_code])
    assert cohort, f"no cohort for {program_code}"
    return sorted(cohort[0])[0]


@pytest.mark.parametrize("program_code", PROGRAMMES)
def test_a_finished_catalogue_course_has_co_occurrences(program_code: str) -> None:
    done = a_course_the_cohort_took(program_code)
    plan = plan_for(program_code, done_courses=[as_planned(program_code, done)])
    strategy = CompletedStrategy()

    suggestions = [s for c in plan.candidates for s in strategy.suggest(plan, c)]

    assert suggestions, f"no co-occurrence for {done} in {program_code}"
    assert all(f"who completed {done} also took this" in s.evidence for s in suggestions)
    assert all(s.score >= 0.5 for s in suggestions)


@pytest.mark.parametrize("program_code", PROGRAMMES)
def test_the_same_plan_gets_the_same_co_occurrences_twice(program_code: str) -> None:
    """The cohort is drawn from a fixed seed, so the shares must not move."""
    done = a_course_the_cohort_took(program_code)
    plan = plan_for(program_code, done_courses=[as_planned(program_code, done)])

    def answer() -> list[tuple[str, float, str]]:
        strategy = CompletedStrategy()
        return [
            (c.code, s.score, s.evidence)
            for c in plan.candidates
            for s in strategy.suggest(plan, c)
        ]

    first = answer()
    forget_cohorts()
    assert answer() == first


@pytest.mark.parametrize("program_code", PROGRAMMES)
def test_nothing_finished_means_nothing_to_report(program_code: str) -> None:
    plan = plan_for(program_code)
    strategy = CompletedStrategy()

    assert [s for c in plan.candidates for s in strategy.suggest(plan, c)] == []
