"""
Build the rule-engine fixture corpus.

The rule checkers are pure: `RuleChecker.evaluate(payload) -> RuleCheckResult` reads
only the dictionary it is given, with no database and no I/O. That makes them the
best possible subject for a golden master. This script generates a spread of
payloads from the real catalogue and records what the current implementation
answers for each; `test_rule_engine_golden.py` then fails if any answer changes.

The corpus is deliberately adversarial rather than representative. It includes the
states the evaluation study showed students actually reaching, which is where
regressions would hurt most: over-filled semesters, an under-filled reduced-load
semester, courses placed in the wrong term, an incomplete introductory phase, and
plans that the tool reported as complete while a stated constraint was unmet.

    python3 -m tests.golden.build_fixtures        # regenerate fixtures + snapshots

Regenerating is a deliberate act. If a snapshot changes, either a behaviour change
was intended and the diff should be reviewed line by line, or a regression has just
been recorded as the new truth.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
CORPUS = HERE / "fixtures.json"
SNAPSHOT = HERE / "snapshots.json"

# The checkers compare against the spaced form printed in the curriculum
# regulations. The route normalises the spacing before choosing a checker but
# passes the payload through untouched, so fixtures must use the spaced form
# or every scenario short-circuits on a programme mismatch.
BACHELOR = "033 521"
MASTER = "066 937"


def load_catalogue() -> list[dict[str, Any]]:
    """Read the course catalogue straight from the development database."""
    import asyncio
    import asyncpg

    async def _run() -> list[dict[str, Any]]:
        dsn = os.environ["DATABASE_URL"]
        conn = await asyncpg.connect(dsn)
        try:
            rows = await conn.fetch(
                """
                SELECT c.code, c.title, c.ects::float AS ects, c.type,
                       c.term_availability::text AS term_availability,
                       m.name AS module, m.category AS category,
                       es.name AS exam_subject
                FROM course c
                LEFT JOIN module_course mc ON mc.course_id = c.id
                LEFT JOIN module m ON m.id = mc.module_id
                LEFT JOIN module_grouping mg ON mg.module_id = m.id
                LEFT JOIN exam_subject es ON es.id = mg.exam_subject_id
                ORDER BY c.code
                """
            )
            return [dict(r) for r in rows]
        finally:
            await conn.close()

    return asyncio.run(_run())


def course(entry: dict[str, Any], lane: int) -> dict[str, Any]:
    """Shape a catalogue row the way the frontend sends it to /rulecheck."""
    return {
        "code": entry["code"],
        "title": entry["title"],
        "ects": entry["ects"],
        "type": entry.get("type"),
        "module": entry.get("module"),
        "category": entry.get("category"),
        "examSubject": entry.get("exam_subject"),
        "termAvailability": entry.get("term_availability"),
        "laneIndex": lane,
    }


def payload(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "programCode": BACHELOR,
        "plannedCourses": [],
        "doneCourses": [],
        "change": {},
        "selectedFocus": None,
        "maxEctsPerSemester": 42.0,
        "recommendedEctsPerSemester": 30.0,
    }
    base.update(over)
    return base


def build(catalogue: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Return {scenario name: payload}. Names appear in test failure output."""
    by_code = {c["code"]: c for c in catalogue}
    ordered = [c for c in catalogue if c.get("ects")]
    cases: dict[str, dict[str, Any]] = {}

    # --- degenerate inputs, which is where an unguarded refactor breaks first
    cases["empty-plan"] = payload()
    cases["empty-plan-master"] = payload(programCode=MASTER)
    cases["missing-program-code"] = payload(programCode=None)
    cases["course-without-ects"] = payload(
        plannedCourses=[{"code": "X1", "title": "No ECTS", "laneIndex": 0}]
    )
    cases["course-in-lane-zero"] = payload(
        plannedCourses=[course(ordered[0], 0)]
    )
    cases["negative-lane"] = payload(plannedCourses=[course(ordered[0], -1)])

    # --- plans of increasing size, spread evenly over the lanes
    for size in (5, 20, 60, len(ordered)):
        spread = [course(c, i % 8) for i, c in enumerate(ordered[:size])]
        cases[f"spread-{size}-courses"] = payload(plannedCourses=spread)
        cases[f"spread-{size}-courses-master"] = payload(
            programCode=MASTER, plannedCourses=spread
        )

    # --- workload band: the study's most consequential rule surface
    heavy = [course(c, 0) for c in ordered[:12]]          # everything in one lane
    cases["all-in-one-lane"] = payload(plannedCourses=heavy)
    cases["all-in-one-lane-low-cap"] = payload(
        plannedCourses=heavy, maxEctsPerSemester=27.0, recommendedEctsPerSemester=24.0
    )
    cases["under-filled-lane"] = payload(
        plannedCourses=[course(ordered[0], 0), course(ordered[1], 5)]
    )
    for cap in (21.0, 27.0, 30.0, 33.0, 42.0):
        cases[f"cap-{int(cap)}"] = payload(
            plannedCourses=[course(c, i % 7) for i, c in enumerate(ordered[:40])],
            maxEctsPerSemester=cap,
            recommendedEctsPerSemester=cap - 3,
        )

    # --- introductory phase, planned versus completed
    steop_like = [c for c in ordered if "Denkweisen" in (c["title"] or "")
                  or "Programmierung 1" in (c["title"] or "")]
    if steop_like:
        cases["steop-planned-only"] = payload(
            plannedCourses=[course(c, 0) for c in steop_like]
        )
        cases["steop-done"] = payload(
            doneCourses=[course(c, 0) for c in steop_like]
        )
        cases["steop-done-plus-later"] = payload(
            doneCourses=[course(c, 0) for c in steop_like],
            plannedCourses=[course(c, 3) for c in ordered[20:30]],
        )

    # --- focus area, including values the engine has to normalise
    for focus in (None, "", "Cybersecurity", "cyber", "Artificial Intelligence",
                  "ai", "Visual Computing", "not-a-real-focus"):
        cases[f"focus-{focus or 'none'}"] = payload(
            plannedCourses=[course(c, i % 6) for i, c in enumerate(ordered[:35])],
            selectedFocus=focus,
        )

    # --- a change event, which is what a drag actually sends
    if len(ordered) > 3:
        cases["change-move-between-lanes"] = payload(
            plannedCourses=[course(c, i % 4) for i, c in enumerate(ordered[:10])],
            change={"from": 0, "to": 2, "code": ordered[0]["code"]},
        )

    # --- done and planned interacting
    cases["half-done-half-planned"] = payload(
        doneCourses=[course(c, i % 4) for i, c in enumerate(ordered[:15])],
        plannedCourses=[course(c, 4 + (i % 4)) for i, c in enumerate(ordered[15:35])],
    )

    # --- duplicates, which the study saw the UI produce
    if ordered:
        dup = course(ordered[0], 0)
        cases["duplicate-course"] = payload(plannedCourses=[dup, dict(dup)])
        cases["same-course-two-lanes"] = payload(
            plannedCourses=[course(ordered[0], 0), course(ordered[0], 3)]
        )

    assert by_code  # catalogue actually loaded
    return cases


def main() -> None:
    catalogue = load_catalogue()
    cases = build(catalogue)

    from app.rules import BachelorRuleChecker as Bachelor
    from app.rules import MasterRuleChecker as Master
    from dataclasses import asdict

    snapshots: dict[str, Any] = {}
    for name, case in cases.items():
        checker = Master() if case.get("programCode") == MASTER else Bachelor()
        try:
            snapshots[name] = asdict(checker.evaluate(case))
        except Exception as exc:  # a raising input is behaviour too, and must be pinned
            snapshots[name] = {"__raised__": f"{type(exc).__name__}: {exc}"}

    CORPUS.write_text(json.dumps(cases, indent=1, sort_keys=True, ensure_ascii=False))
    SNAPSHOT.write_text(json.dumps(snapshots, indent=1, sort_keys=True, ensure_ascii=False))
    raised = sum(1 for v in snapshots.values() if "__raised__" in v)
    distinct = len({json.dumps(v, sort_keys=True) for v in snapshots.values()})
    # A corpus whose scenarios nearly all answer the same thing pins nothing. This
    # caught a first draft in which every payload was rejected on a programme-code
    # mismatch before any rule ran.
    if distinct < len(snapshots) * 0.5:
        raise SystemExit(
            f"corpus is degenerate: only {distinct} distinct answers across "
            f"{len(snapshots)} scenarios; the engine is probably short-circuiting"
        )
    print(f"{len(cases)} scenarios, {distinct} distinct answers, {raised} raising")


if __name__ == "__main__":
    main()
