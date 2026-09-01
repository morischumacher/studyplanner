"""
A course whose credits cannot be read is reported, not raised.

The checker already refuses such a course while summing the plan, so the verdict
it belongs in is `rejected: invalid ects`. Every pass that runs afterwards has to
agree that the course is not in the plan, otherwise the first one to ask for its
credits raises and the route answers 500 instead of the verdict the student
should see.

The credit value is read in four places after the totals pass, so each is driven
here separately: a course outside the introductory phase reaches the
transferable-skills cap, one inside it reaches the introductory-phase snapshot,
and a completed one reaches both the completion-semester scan and the pre-phase
allowance.
"""
from __future__ import annotations

import pytest

from app.rules import BachelorRuleChecker

BACHELOR = "033 521"

# The pool of the introductory phase, so that the introductory-phase passes read
# this course rather than skipping it.
STEOP_POOL_COURSE = "Algebra und Diskrete Mathematik"

UNREADABLE = [None, "", "n/a", "2,5 ECTS", {}]


def payload(**over):
    base = {
        "programCode": BACHELOR,
        "plannedCourses": [],
        "doneCourses": [],
    }
    base.update(over)
    return base


def course(ects, *, code="ADM", name=STEOP_POOL_COURSE, lane=0):
    return {"code": code, "name": name, "ects": ects, "laneIndex": lane}


@pytest.mark.parametrize("ects", UNREADABLE, ids=repr)
@pytest.mark.parametrize("status", ["plannedCourses", "doneCourses"])
def test_an_unreadable_credit_value_is_rejected_rather_than_raised(status, ects) -> None:
    result = BachelorRuleChecker().evaluate(payload(**{status: [course(ects)]}))

    assert result.ok is False
    assert "rejected: invalid ects for 'ADM'" in result.errors


@pytest.mark.parametrize("ects", UNREADABLE, ids=repr)
def test_a_course_outside_the_introductory_phase_is_rejected_too(ects) -> None:
    """This one is only ever read by the transferable-skills cap."""
    result = BachelorRuleChecker().evaluate(
        payload(plannedCourses=[course(ects, code="X1", name="No ECTS")])
    )

    assert result.ok is False
    assert "rejected: invalid ects for 'X1'" in result.errors


def test_the_rest_of_the_plan_is_still_summed() -> None:
    """The broken course drops out; the courses around it keep their credits."""
    result = BachelorRuleChecker().evaluate(
        payload(
            plannedCourses=[
                course(None, code="X1", name="No ECTS"),
                course(6.0, code="EIDI1", name="Einführung in die Programmierung 1"),
            ]
        )
    )

    assert result.ok is False
    assert result.stats["totalEcts"] == 6.0
    assert result.stats["ectsPerSemester"] == {"0": 6.0}


def test_a_broken_credit_value_does_not_count_towards_the_introductory_pool() -> None:
    result = BachelorRuleChecker().evaluate(
        payload(doneCourses=[course("n/a"), course(8.0, code="ANA", name="Analysis")])
    )

    assert result.ok is False
    assert result.stats["steop"]["planned"]["poolEcts"] == 8.0
