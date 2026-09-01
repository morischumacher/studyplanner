"""
The introductory-phase numbers belong to the curriculum, not to the checker.

ADR 0002 divides the two: what the regulations say is data in
`app/curriculum/bachelor.json`, and what a rule does with it is code. A threshold
written as a literal inside a check is on the wrong side of that line, and the
next curriculum revision would be a programming task rather than an edit.

Each of these asserts twice. Once that the document and the checker agree, which
a copied literal would also satisfy, and once that changing the checker's value
changes the verdict, which is what catches a literal left behind in one of the
several places the same number is used.
"""
from __future__ import annotations

import pytest

from app.curriculum import BACHELOR, load
from app.rules import BachelorRuleChecker

CURRICULUM = load(BACHELOR)


def payload(**over):
    base = {"programCode": BACHELOR, "plannedCourses": [], "doneCourses": []}
    base.update(over)
    return base


def course(code, name, ects, lane=0):
    return {"code": code, "name": name, "ects": ects, "laneIndex": lane}


def pool_course(ects, lane=0):
    return course("ADM", "Algebra und Diskrete Mathematik", ects, lane)


def eidi1(lane=0):
    return course("EIDI1", "Einführung in die Programmierung 1", 5.5, lane)


def test_the_pool_minimum_comes_from_the_document() -> None:
    assert BachelorRuleChecker.STEOP_POOL_MIN_ECTS == CURRICULUM.STEOP_POOL_MIN_ECTS


def test_the_pool_verdict_follows_the_pool_minimum(monkeypatch) -> None:
    plan = payload(plannedCourses=[pool_course(8.0)])
    assert BachelorRuleChecker().evaluate(plan).stats["steop"]["planned"]["poolOk"]

    monkeypatch.setattr(BachelorRuleChecker, "STEOP_POOL_MIN_ECTS", 12.0)
    result = BachelorRuleChecker().evaluate(plan)

    assert not result.stats["steop"]["planned"]["poolOk"]
    assert any("StEOP Pool: 4.0 ECTS fehlen" in line for line in result.missing)


def test_the_pre_phase_allowance_comes_from_the_document() -> None:
    assert (
        BachelorRuleChecker.MAX_NON_STEOP_ECTS_BEFORE_STEOP
        == CURRICULUM.MAX_NON_STEOP_ECTS_BEFORE_STEOP
    )


def test_the_pre_phase_verdict_follows_the_allowance(monkeypatch) -> None:
    # Permitted before the phase is complete, so only the allowance can refuse it.
    plan = payload(doneCourses=[course("DBS", "Datenbanksysteme", 6.0)])
    assert BachelorRuleChecker().evaluate(plan).ok

    monkeypatch.setattr(BachelorRuleChecker, "MAX_NON_STEOP_ECTS_BEFORE_STEOP", 5.0)
    result = BachelorRuleChecker().evaluate(plan)

    assert not result.ok
    assert any("6.0 ECTS outside StEOP are DONE (max 5)" in e for e in result.errors)


def test_the_allowance_the_dashboard_reports_is_the_one_that_is_enforced(monkeypatch) -> None:
    monkeypatch.setattr(BachelorRuleChecker, "MAX_NON_STEOP_ECTS_BEFORE_STEOP", 5.0)
    stats = BachelorRuleChecker().evaluate(payload()).stats

    assert stats["steop"]["done"]["maxNonSteopBeforeCompletion"] == 5.0


def test_the_phase_tags_come_from_the_document() -> None:
    assert list(BachelorRuleChecker().steop_mandatory_tags) == list(
        CURRICULUM.steop_mandatory_tags
    )


def test_the_mandatory_verdict_follows_the_phase_tags() -> None:
    plan = payload(plannedCourses=[eidi1()])
    assert not BachelorRuleChecker().evaluate(plan).stats["steop"]["planned"]["mandatoryOk"]

    checker = BachelorRuleChecker()
    checker.steop_mandatory_tags = ["eidi1"]
    result = checker.evaluate(plan)

    assert result.stats["steop"]["planned"]["mandatoryOk"]
    assert not [line for line in result.missing if "StEOP Pflicht-LV fehlt" in line]


@pytest.mark.parametrize(
    "name", ["STEOP_POOL_MIN_ECTS", "MAX_NON_STEOP_ECTS_BEFORE_STEOP", "steop_mandatory_tags"]
)
def test_the_document_carries_the_entry(name: str) -> None:
    assert getattr(CURRICULUM, name) is not None
