"""
Golden-master tests for the recommender.

These exist to make the channel refactor safe. `Recommender.evaluate` is one long
method with six inline blocks, each gated on its own toggle, and the plan is to
replace it with one composable strategy per channel. That change is only
defensible if the recommendation lists stay identical, so every list is recorded
here first and compared afterwards.

The comparison is exact and structural. A test failure names the scenario and the
first differing path, so a diff points at a channel rather than at a blob of JSON.

The decoder and the call it wraps are imported from `build_recommender_fixtures`
rather than written again here. Everything else in this file is deliberately
independent of the builder, but a fixture read back with a different decoder than
the one that wrote it would fail silently rather than loudly, and the types it
would quietly change are the ones the rule checker does arithmetic on.

Fixtures come from `build_recommender_fixtures.py` and are committed, so these
tests need no database and run in milliseconds.
"""
from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID

import pytest

from .build_recommender_fixtures import encode, restore, run

HERE = Path(__file__).resolve().parent

_CORPUS = restore(json.loads((HERE / "recommender_fixtures.json").read_text()))
POOLS: dict[str, list[dict[str, Any]]] = _CORPUS["pools"]
FIXTURES: dict[str, Any] = _CORPUS["scenarios"]
SNAPSHOTS: dict[str, Any] = restore(
    json.loads((HERE / "recommender_snapshots.json").read_text())
)


def evaluate(case: dict[str, Any]) -> Any:
    """Answer one scenario the way the service would."""
    return run(case, POOLS)


def differences(expected: Any, actual: Any, path: str = "") -> list[str]:
    """Collect human-readable differences, deepest path first."""
    if type(expected) is not type(actual):
        return [f"{path or '<root>'}: type {type(expected).__name__} -> {type(actual).__name__}"]
    if isinstance(expected, dict):
        out: list[str] = []
        for key in sorted(set(expected) | set(actual)):
            if key not in expected:
                out.append(f"{path}.{key}: added ({actual[key]!r})")
            elif key not in actual:
                out.append(f"{path}.{key}: removed (was {expected[key]!r})")
            else:
                out += differences(expected[key], actual[key], f"{path}.{key}")
        return out
    if isinstance(expected, list):
        if len(expected) != len(actual):
            return [f"{path}: length {len(expected)} -> {len(actual)}"]
        out = []
        for i, (e, a) in enumerate(zip(expected, actual)):
            out += differences(e, a, f"{path}[{i}]")
        return out
    return [] if expected == actual else [f"{path}: {expected!r} -> {actual!r}"]


@pytest.mark.parametrize("scenario", sorted(FIXTURES))
def test_recommendations_are_unchanged(scenario: str) -> None:
    diff = differences(SNAPSHOTS[scenario], evaluate(FIXTURES[scenario]))
    assert not diff, "scenario '%s' changed:\n  %s" % (scenario, "\n  ".join(diff[:20]))


def test_every_fixture_has_a_snapshot() -> None:
    """Guards against a fixture being added without regenerating the snapshots."""
    assert sorted(FIXTURES) == sorted(SNAPSHOTS)


def test_evaluation_is_deterministic() -> None:
    """The same scenario twice must give the same answer, or the corpus is worthless."""
    for scenario, case in FIXTURES.items():
        assert evaluate(case) == evaluate(case), f"'{scenario}' is not deterministic"


def test_evaluation_does_not_mutate_its_input() -> None:
    """A recommender that edits the caller's plan cannot be safely reordered."""
    for scenario, case in FIXTURES.items():
        before = json.dumps(encode(case), sort_keys=True)
        evaluate(case)
        assert json.dumps(encode(case), sort_keys=True) == before, f"'{scenario}' mutated its input"


def test_evaluation_does_not_mutate_the_candidate_pool() -> None:
    """The pool is shared between scenarios, so a scenario that edits it poisons the rest."""
    before = json.dumps(encode(POOLS), sort_keys=True)
    for case in FIXTURES.values():
        evaluate(case)
    assert json.dumps(encode(POOLS), sort_keys=True) == before


def test_database_types_survive_the_fixture_file() -> None:
    """
    A candidate's credits are a Decimal and its identifier a UUID.

    Recorded as plain strings they would still compare equal to each other and
    the corpus would look green, while the rule checker downstream would be doing
    arithmetic on text. This asserts the tagged form gives the types back.
    """
    for name, pool in POOLS.items():
        assert pool, f"pool '{name}' is empty"
        for row in pool:
            assert isinstance(row["id"], UUID), f"{name}/{row['code']}: id is {type(row['id'])}"
            assert isinstance(row["ects"], Decimal), f"{name}/{row['code']}: ects is {type(row['ects'])}"

    recorded = [rec for recs in SNAPSHOTS.values() if recs for rec in recs]
    assert recorded, "no recommendations were recorded at all"
    assert any(isinstance(rec["ects"], Decimal) for rec in recorded)

    round_tripped = restore(json.loads(json.dumps(encode(POOLS))))
    assert round_tripped == POOLS


def test_corpus_is_not_degenerate() -> None:
    """
    A corpus whose scenarios nearly all answer the same thing pins nothing.

    The failure this guards against is real: while two of the six channels read a
    table of course codes the catalogue does not contain, a corpus built from
    real candidates agreed with itself almost everywhere and would have passed
    this file unchanged no matter what the refactor broke.
    """
    distinct = {json.dumps(encode(value), sort_keys=True) for value in SNAPSHOTS.values()}
    assert len(distinct) >= len(SNAPSHOTS) * 0.5, (
        f"only {len(distinct)} distinct answers across {len(SNAPSHOTS)} scenarios"
    )


def test_every_channel_is_exercised() -> None:
    """Each channel must appear somewhere, or its extraction is untested."""
    recorded = {rec["type"] for recs in SNAPSHOTS.values() if recs for rec in recs}
    assert recorded == {
        "interest",
        "similarity",
        "sequence",
        "completed",
        "internship",
        "peer",
    }
