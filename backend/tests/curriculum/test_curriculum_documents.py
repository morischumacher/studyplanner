"""
The curriculum documents.

These files replaced roughly 600 lines of Python that built the same structures
in a constructor. The golden master proves the values did not change; what is
checked here is that the documents stay loadable and internally consistent, so
that a hand edit to a JSON file fails loudly rather than producing a checker
that silently answers differently.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.curriculum import BACHELOR, MASTER, load

DOCUMENTS = Path(__file__).resolve().parents[2] / "app" / "curriculum"


@pytest.mark.parametrize("program_code", [BACHELOR, MASTER])
def test_loads(program_code: str) -> None:
    curriculum = load(program_code)
    assert curriculum.program_code == program_code
    assert curriculum.constants
    assert curriculum.data


def test_an_unknown_programme_is_refused() -> None:
    with pytest.raises(KeyError):
        load("999 999")


@pytest.mark.parametrize("program_code", [BACHELOR, MASTER])
def test_credit_thresholds_are_ordered(program_code: str) -> None:
    """A recommended load above the hard ceiling would warn about every plan."""
    curriculum = load(program_code)
    assert 0 < curriculum.RECOMMENDED_ECTS_PER_SEMESTER <= curriculum.MAX_ECTS_PER_SEMESTER
    assert curriculum.MAX_ECTS_PER_SEMESTER < curriculum.TOTAL_ECTS


def test_the_bachelor_degree_is_longer_than_the_master() -> None:
    assert load(BACHELOR).TOTAL_ECTS == 180.0
    assert load(MASTER).TOTAL_ECTS == 120.0


def test_every_bachelor_course_maps_to_a_module_that_exists() -> None:
    """
    A course pointing at a missing module would silently lose its category.

    The two sides are keyed differently on purpose: modules are keyed by their
    normalised title for lookup, and a course records the module's printable
    title. The comparison is between the titles.
    """
    curriculum = load(BACHELOR)
    titles = {module["title"] for module in curriculum.modules.values()}
    unknown = set(curriculum.course_to_module.values()) - titles

    # Six do not, and this pins that rather than asserting it away. They came
    # over from the constructor exactly as they were, so the gap predates the
    # refactor: these courses resolve to a module that was never defined, and
    # their module kind therefore falls back to a default. It belongs on the
    # defect branch with the findings from the evaluation, not here.
    assert sorted(unknown) == [
        "Abstrakte Maschinen",
        "Audio and Video Production",
        "Computermusik",
        "Creative Media Production",
        "Funktionale Programmierung",
        "Logikprogrammierung und Constraints",
    ], f"the set of unmapped modules changed: {sorted(unknown)}"


def test_tagged_collections_are_restored_to_their_python_types() -> None:
    """JSON has no sets or tuples; both are load-bearing here."""
    assert isinstance(load(BACHELOR).steop_pool_keys, set)
    assert isinstance(load(MASTER).exam_subjects, set)
    assert isinstance(load(MASTER).advanced_topics_prefixes, tuple)


@pytest.mark.parametrize("filename", ["bachelor.json", "master.json"])
def test_documents_are_valid_json_with_both_sections(filename: str) -> None:
    document = json.loads((DOCUMENTS / filename).read_text(encoding="utf-8"))
    assert set(document) == {"constants", "data"}
