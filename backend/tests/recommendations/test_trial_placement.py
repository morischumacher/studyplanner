"""
The semester a candidate is offered to the rule checker in.

A candidate has no semester of its own: the recommender proposes a course, not a
placement. The filter has to invent one, and which one it invents decides how the
curriculum's ordering reads. Offered only in a semester past the whole plan, a
course put forward *because a planned course needs it first* is judged as
arriving after the course that needs it, and the filter refuses the one
recommendation the student most needed to see.

Both directions of the ordering are driven here, because a placement that fixes
one by moving the candidate to the other end of the plan breaks the other.

The pools come from the recorded corpus rather than the database, so this file
runs without one.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.recommendations.context import build_context
from app.recommendations.rules import filter_by_rules
from app.recommendations.sequence import ordered_pairs
from app.rules import checker_for

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


def row_for(program_code: str, code: str) -> dict[str, Any]:
    for row in POOLS[program_code]:
        if row["code"] == code:
            return row
    raise AssertionError(f"{code} is not in the {program_code} catalogue")


def as_planned(program_code: str, code: str, lane: int = 0) -> dict[str, Any]:
    row = row_for(program_code, code)
    return {
        "code": code,
        "title": row["title"],
        "ects": row["ects"],
        "category": row["category"],
        "examSubject": row["exam_subject"],
        "laneIndex": lane,
    }


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


def survives(program_code: str, candidate: str, **plan_over: Any) -> bool:
    plan = plan_for(program_code, **plan_over)
    kept = filter_by_rules(
        plan,
        [{"courseCode": candidate, "score": 0.9}],
        checker_for(program_code, strict=False),
    )
    return [rec["courseCode"] for rec in kept] == [candidate]


@pytest.mark.parametrize("program_code", PROGRAMMES)
def test_a_prerequisite_of_a_planned_course_survives_the_filter(program_code: str) -> None:
    earlier, later = ordered_pairs(program_code, POOLS[program_code])[0]

    assert survives(
        program_code, earlier, planned_courses=[as_planned(program_code, later, lane=1)]
    )


@pytest.mark.parametrize("program_code", PROGRAMMES)
def test_a_successor_of_a_completed_course_survives_the_filter(program_code: str) -> None:
    earlier, later = ordered_pairs(program_code, POOLS[program_code])[0]

    assert survives(
        program_code, later, done_courses=[as_planned(program_code, earlier, lane=0)]
    )
