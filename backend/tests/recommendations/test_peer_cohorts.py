"""
The memoised peer cohorts.

The cohort is expensive enough to be worth keeping and is shared by every request
the process serves, so it lives in a module-level dictionary keyed by programme
code. What that dictionary must not do is grow: a key that is not one of the two
programmes, arriving from a stored plan or from a programme list that has since
changed, would otherwise hold fifty sets of course codes for the life of the
process, and the next such key would hold fifty more.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.recommendations.peer import MAX_COHORTS, _COHORTS, cohort_for, forget_cohorts

from tests.golden.build_recommender_fixtures import restore

BACHELOR = "033 521"
MASTER = "066 937"

_CORPUS = restore(
    json.loads(
        (Path(__file__).resolve().parents[1] / "golden" / "recommender_fixtures.json")
        .read_text(encoding="utf-8")
    )
)
POOLS: dict[str, list[dict[str, Any]]] = _CORPUS["pools"]

POOL = [{"code": f"C{index}"} for index in range(20)]


@pytest.fixture(autouse=True)
def _fresh_cohorts():
    forget_cohorts()
    yield
    forget_cohorts()


def test_both_real_programmes_are_held_at_once() -> None:
    """The bound is useless if it evicts what the application actually asks for."""
    for program_code in (BACHELOR, MASTER):
        assert cohort_for(program_code, POOLS[program_code])

    assert set(_COHORTS) == {BACHELOR, MASTER}


def test_the_store_does_not_grow_without_bound() -> None:
    for index in range(MAX_COHORTS + 5):
        cohort_for(f"not-a-programme-{index}", POOL)

    assert len(_COHORTS) <= MAX_COHORTS


def test_a_programme_still_being_asked_for_is_not_evicted() -> None:
    cohort_for(BACHELOR, POOLS[BACHELOR])
    for index in range(MAX_COHORTS + 5):
        cohort_for(f"not-a-programme-{index}", POOL)
        cohort_for(BACHELOR, POOLS[BACHELOR])

    assert BACHELOR in _COHORTS
    assert len(_COHORTS) <= MAX_COHORTS


def test_an_evicted_programme_answers_the_same_as_before() -> None:
    """Eviction may cost a recomputation; it may not change what a student is told."""
    before = cohort_for(BACHELOR, POOLS[BACHELOR])
    for index in range(MAX_COHORTS + 5):
        cohort_for(f"not-a-programme-{index}", POOL)

    assert BACHELOR not in _COHORTS
    assert cohort_for(BACHELOR, POOLS[BACHELOR]) == before


def test_a_programme_with_no_code_is_not_stored_at_all() -> None:
    assert cohort_for("", POOL) == []
    assert _COHORTS == {}
