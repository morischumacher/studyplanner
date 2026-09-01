"""Tests for the shared prerequisite relations.

These need no database and no running service: the relations are data, and the
point of the module is that the checkers and the graph read the same copy of it.
Run with `python -m pytest backend/test_prerequisites.py` or `python backend/test_prerequisites.py`.
"""

from app.services.prerequisites import (
    BACHELOR_SOFT_PREREQS,
    MASTER_PREREQUISITES,
    prerequisite_relations,
)
from app.services.rule_checker_bachelor import RuleChecker as BachelorRuleChecker
from app.services.rule_checker_master import RuleChecker as MasterRuleChecker


def test_bachelor_relations_are_the_two_soft_pairs():
    relations = prerequisite_relations("033 521")
    assert len(relations) == 2
    assert all(r["kind"] == "soft" for r in relations)
    assert {(r["source"], r["target"]) for r in relations} == {
        ("Einführung in die Programmierung 1", "Einführung in die Programmierung 2"),
        ("Software Engineering", "Software Engineering Projekt"),
    }


def test_master_relations_are_the_thesis_before_its_two_dependants():
    relations = prerequisite_relations("066937")
    assert len(relations) == 2
    assert all(r["kind"] == "hard" for r in relations)
    assert all(r["source"] == "Master Thesis" for r in relations)
    assert {r["target"] for r in relations} == {
        "Final Oral Exam / Defense",
        "Seminar for Diploma Students",
    }


def test_abbreviated_aliases_do_not_produce_duplicate_relations():
    # The checker accepts FOE and SDS as aliases of the written-out names; they
    # name the same two relations and must not be drawn a second time.
    targets = [r["target"] for r in prerequisite_relations("066937")]
    assert "FOE" not in targets
    assert "SDS" not in targets


def test_unknown_or_missing_programme_yields_no_relations():
    assert prerequisite_relations("") == []
    assert prerequisite_relations(None) == []
    assert prerequisite_relations("999999") == []


def test_programme_code_is_matched_regardless_of_spacing():
    assert prerequisite_relations("033521") == prerequisite_relations("033 521")


def test_checkers_read_the_shared_relations():
    # The regression this guards: a copy of the pairs drifting back into a
    # checker, so that the graph draws one thing and the engine enforces another.
    assert list(BachelorRuleChecker().soft_prereqs) == list(BACHELOR_SOFT_PREREQS)
    assert MasterRuleChecker().prerequisites == MASTER_PREREQUISITES


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if not name.startswith("test_") or not callable(fn):
            continue
        try:
            fn()
            print(f"ok   {name}")
        except AssertionError as exc:
            failures += 1
            print(f"FAIL {name}: {exc}")
    raise SystemExit(1 if failures else 0)
