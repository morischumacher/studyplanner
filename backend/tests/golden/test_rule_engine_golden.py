"""
Golden-master tests for the rule engine.

These exist to make the architectural refactor safe. The rule checkers currently
carry the curriculum as hand-written Python inside their constructors, and the
plan is to replace that with a declarative rule model. That change is only
defensible if the engine's answers stay identical, so every answer is recorded
here first and compared afterwards.

The comparison is exact and structural. A test failure names the scenario and the
first differing path, so a diff points at a rule rather than at a blob of JSON.

Fixtures come from `build_fixtures.py` and are committed, so these tests need no
database and run in milliseconds.
"""
from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

import pytest

from app.rules import BachelorRuleChecker, MasterRuleChecker

HERE = Path(__file__).resolve().parent
MASTER_PROGRAM_CODE = "066 937"

FIXTURES: dict[str, Any] = json.loads((HERE / "fixtures.json").read_text())
SNAPSHOTS: dict[str, Any] = json.loads((HERE / "snapshots.json").read_text())


def evaluate(payload: dict[str, Any]) -> dict[str, Any]:
    """Run the checker the route would pick for this payload."""
    checker = (
        MasterRuleChecker()
        if payload.get("programCode") == MASTER_PROGRAM_CODE
        else BachelorRuleChecker()
    )
    try:
        return asdict(checker.evaluate(payload))
    except Exception as exc:
        return {"__raised__": f"{type(exc).__name__}: {exc}"}


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
def test_rule_engine_answer_is_unchanged(scenario: str) -> None:
    diff = differences(SNAPSHOTS[scenario], evaluate(FIXTURES[scenario]))
    assert not diff, "scenario '%s' changed:\n  %s" % (scenario, "\n  ".join(diff[:20]))


def test_every_fixture_has_a_snapshot() -> None:
    """Guards against a fixture being added without regenerating the snapshots."""
    assert sorted(FIXTURES) == sorted(SNAPSHOTS)


def test_evaluation_is_deterministic() -> None:
    """The same payload twice must give the same answer, or the corpus is worthless."""
    for scenario, payload in FIXTURES.items():
        assert evaluate(payload) == evaluate(payload), f"'{scenario}' is not deterministic"


def test_evaluation_does_not_mutate_its_input() -> None:
    """A checker that edits the caller's payload cannot be safely reordered."""
    for scenario, payload in FIXTURES.items():
        before = json.dumps(payload, sort_keys=True)
        evaluate(payload)
        assert json.dumps(payload, sort_keys=True) == before, f"'{scenario}' mutated its input"
