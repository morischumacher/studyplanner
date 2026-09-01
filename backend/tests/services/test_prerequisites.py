"""Tests for the prerequisite relations the graph view draws.

These need no database and no running service: the relations are data, and the
point of the module is that the checkers and the graph read the same copy of it,
namely the curriculum documents in `app/curriculum`.
"""
from app.curriculum import BACHELOR, MASTER, load
from app.services.prerequisites import prerequisite_relations


def _of_kind(relations, kind):
    return [r for r in relations if r["kind"] == kind]


def test_bachelor_relations_are_the_two_soft_pairs():
    relations = _of_kind(prerequisite_relations("033 521"), "soft")
    assert len(relations) == 2
    assert {(r["source"], r["target"]) for r in relations} == {
        ("Einführung in die Programmierung 1", "Einführung in die Programmierung 2"),
        ("Software Engineering", "Software Engineering Projekt"),
    }


def test_master_relations_are_the_thesis_before_its_two_dependants():
    relations = _of_kind(prerequisite_relations("066937"), "hard")
    assert len(relations) == 2
    assert all(r["source"] == "Master Thesis" for r in relations)
    assert {r["target"] for r in relations} == {
        "Final Oral Exam / Defense",
        "Seminar for Diploma Students",
    }


def test_abbreviated_aliases_do_not_produce_duplicate_relations():
    # The curriculum accepts FOE and SDS as aliases of the written-out names; they
    # name the same two relations and must not be drawn a second time.
    targets = [r["target"] for r in prerequisite_relations("066937")]
    assert "FOE" not in targets
    assert "SDS" not in targets


def test_recommended_relations_come_from_the_curriculum_and_carry_no_consequence():
    # "Erwartete Vorkenntnisse" in the published curricula: a module naming the
    # modules that teach what it expects. Read-only, so the rule engine must not
    # see them; the guard is that the checker's own lists are unchanged.
    recommended = _of_kind(prerequisite_relations(BACHELOR), "recommended")
    assert len(recommended) == 99
    assert {(r["source"], r["target"]) for r in recommended} >= {
        ("Einführung in die Programmierung", "Abstrakte Maschinen"),
        ("Programmierparadigmen", "Abstrakte Maschinen"),
        ("Übersetzerbau", "Abstrakte Maschinen"),
        ("Software Engineering", "Software Engineering Projekt"),
    }
    assert len(_of_kind(prerequisite_relations(MASTER), "recommended")) == 24

    # The engine still holds two advisory pairs and two enforced ones, whatever
    # the curriculum says about expected knowledge.
    assert len(load(BACHELOR).soft_prereqs) == 2
    assert len(_of_kind(prerequisite_relations(BACHELOR), "soft")) == 2
    assert len(_of_kind(prerequisite_relations(MASTER), "hard")) == 2


def test_no_module_is_its_own_prerequisite():
    for code in (BACHELOR, MASTER):
        for relation in prerequisite_relations(code):
            assert relation["source"] != relation["target"]


def test_every_recommended_endpoint_is_a_name_the_curriculum_uses():
    # A relation naming something the catalogue does not hold can never be drawn,
    # and would be invisible rather than wrong, so it is checked here instead.
    for code, document in ((BACHELOR, "bachelor"), (MASTER, "master")):
        entries = load(code).recommended_prereqs
        assert entries, f"{document} carries no expected-knowledge entries"
        for entry in entries:
            assert entry["target"], document
            assert entry["sources"], f"{entry['target']} names no source"
            assert entry["target"] not in entry["sources"]


def test_unknown_or_missing_programme_yields_no_relations():
    assert prerequisite_relations("") == []
    assert prerequisite_relations(None) == []
    assert prerequisite_relations("999999") == []


def test_programme_code_is_matched_regardless_of_spacing():
    assert prerequisite_relations("033521") == prerequisite_relations("033 521")


def test_relations_are_read_from_the_curriculum_the_checkers_read():
    # The regression this guards: a copy of the pairs drifting into this module,
    # so that the graph draws one thing and the engine enforces another.
    bachelor = {tuple(pair) for pair in load(BACHELOR).soft_prereqs}
    drawn = {
        (r["source"], r["target"])
        for r in prerequisite_relations(BACHELOR)
        if r["kind"] == "soft"
    }
    assert drawn == bachelor

    master = {
        (source, target)
        for target, sources in load(MASTER).prerequisites.items()
        for source in sources
        if target not in {"FOE", "SDS"}
    }
    enforced = {
        (r["source"], r["target"])
        for r in prerequisite_relations(MASTER)
        if r["kind"] == "hard"
    }
    assert enforced == master
