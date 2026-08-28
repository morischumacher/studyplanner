"""
Build the recommender fixture corpus.

`Recommender.evaluate` takes the candidate pool as an argument, so the whole
recommender is pure once that pool is in hand. This script captures the pool
from the development database once and records what the current implementation
answers for a spread of inputs; `test_recommender_golden.py` then fails if any
answer changes.

Three things about the capture are not obvious.

The pool is read through the same JSON codecs the application registers on its
connection pool. Without them asyncpg returns the `content` and
`similar_courses` columns as JSON text rather than lists, and the recommender
would iterate a string character by character instead of reading course topics.

`ects` is a Decimal and `id` a UUID. Both survive the file as tagged objects, in
the same style `app/curriculum` uses for sets and tuples, because a plain string
would reach the rule checker's arithmetic and the API response as a string and
the recorded behaviour would not be the real behaviour.

The captured rows are sorted by code, which the repository's query now asks for
too. Sorting again here is not redundant: the corpus should pin the order it
records rather than inherit it, so that a query whose ordering changed shows up
as a moved snapshot instead of as a silently different pool. The recommender's
answer depends on that order, since candidates are considered in the order given
and the final sort by score is stable, so ties keep it.

    python3 -m tests.golden.build_recommender_fixtures

Regenerating is a deliberate act. If a snapshot changes, either a behaviour
change was intended and the diff should be reviewed line by line, or a
regression has just been recorded as the new truth.
"""
from __future__ import annotations

import json
import os
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID

from app.recommendations import Recommender
from app.recommendations.peer import forget_cohorts
from app.rules import checker_for

HERE = Path(__file__).resolve().parent
CORPUS = HERE / "recommender_fixtures.json"
SNAPSHOT = HERE / "recommender_snapshots.json"

BACHELOR = "033 521"
MASTER = "066 937"

CHANNELS = ("interest", "similarity", "sequence", "completed", "internship", "peer")
ALL_ON = {name: True for name in CHANNELS}
ALL_OFF = {name: False for name in CHANNELS}

# The ordering each curriculum states, as the catalogue codes it resolves to:
# `soft_prereqs` in the bachelor document, `prerequisites` in the master one. The
# sequence channel has nothing to say about a plan that touches none of these,
# so the scenarios that exercise it are built from them.
ORDERED_PAIRS = {
    BACHELOR: (("EIDI1", "EIDI2"), ("SE", "SEP")),
    MASTER: (("MTH", "FOE"), ("MTH", "SDS")),
}

INTERESTS = ["machine learning", "web security", "software architecture"]
OTHER_INTERESTS = ["databases", "human computer interaction"]
CAREER = "data science engineer"
OTHER_CAREER = "distributed systems architect"

# The bachelor catalogue is written in German and the master one in English, so a
# profile that matches most of one matches nothing at all in the other. Without a
# profile in each programme's own language, half the corpus records only silence.
LOCAL_PROFILE = {
    BACHELOR: (
        ["mengenlehre", "prädikatenlogik", "datenstrukturen"],
        "Softwareentwicklung Datenstrukturen Algorithmen",
    ),
    MASTER: (["distributed systems", "automation"], "machine learning researcher"),
}


def encode(value: Any) -> Any:
    """Tag the two database types JSON has no room for."""
    if isinstance(value, Decimal):
        return {"__decimal__": str(value)}
    if isinstance(value, UUID):
        return {"__uuid__": str(value)}
    if isinstance(value, dict):
        return {key: encode(item) for key, item in value.items()}
    if isinstance(value, list):
        return [encode(item) for item in value]
    return value


def restore(value: Any) -> Any:
    """Undo `encode`, giving back the types the database produced."""
    if isinstance(value, dict):
        if "__decimal__" in value and len(value) == 1:
            return Decimal(value["__decimal__"])
        if "__uuid__" in value and len(value) == 1:
            return UUID(value["__uuid__"])
        return {key: restore(item) for key, item in value.items()}
    if isinstance(value, list):
        return [restore(item) for item in value]
    return value


def load_pools() -> dict[str, list[dict[str, Any]]]:
    """Read both programmes' candidate pools from the development database."""
    import asyncio
    import asyncpg

    from app.infrastructure.database import _register_json_codecs
    from app.repositories.catalog import CatalogRepository

    async def _run() -> dict[str, list[dict[str, Any]]]:
        connection = await asyncpg.connect(os.environ["DATABASE_URL"])
        await _register_json_codecs(connection)
        try:
            catalog = CatalogRepository(connection)
            pools = {}
            for code in (BACHELOR, MASTER):
                rows = [dict(row) for row in await catalog.candidates(code)]
                pools[code] = sorted(rows, key=lambda row: (row["code"], str(row["id"])))
            return pools
        finally:
            await connection.close()

    return asyncio.run(_run())


def planned(pool: list[dict[str, Any]], start: int, stop: int, lane: int = 0) -> list[dict[str, Any]]:
    """Shape catalogue rows the way the frontend sends a plan."""
    return [
        {
            "code": row["code"],
            "title": row["title"],
            "ects": row["ects"],
            "category": row["category"],
            "examSubject": row["exam_subject"],
            "laneIndex": lane + (index % 4),
        }
        for index, row in enumerate(pool[start:stop])
    ]


def course(pool: list[dict[str, Any]], code: str, lane: int = 0) -> dict[str, Any]:
    """One named catalogue row, shaped the same way."""
    row = next(row for row in pool if row["code"] == code)
    return {
        "code": code,
        "title": row["title"],
        "ects": row["ects"],
        "category": row["category"],
        "examSubject": row["exam_subject"],
        "laneIndex": lane,
    }


def scenario(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "programCode": MASTER,
        "pools": [MASTER],
        "interests": list(INTERESTS),
        "careerDirection": CAREER,
        "toggles": dict(ALL_ON),
        "plannedCourses": [],
        "doneCourses": [],
        "parkedCourses": [],
        "ruleChecker": True,
    }
    base.update(over)
    return base


def build(pools: dict[str, list[dict[str, Any]]]) -> dict[str, dict[str, Any]]:
    """Return {scenario name: scenario}. Names appear in test failure output."""
    cases: dict[str, dict[str, Any]] = {}

    for code, tag in ((BACHELOR, "bachelor"), (MASTER, "master")):
        pool = pools[code]
        here = dict(programCode=code, pools=[code])
        plan = planned(pool, 0, 4)
        done = planned(pool, 4, 8, lane=4)
        parked = [row["code"] for row in pool[8:11]]

        cases[f"{tag}-empty-plan"] = scenario(**here)
        cases[f"{tag}-done-and-planned"] = scenario(
            **here, plannedCourses=plan, doneCourses=done
        )
        cases[f"{tag}-parked"] = scenario(
            **here, plannedCourses=plan, doneCourses=done, parkedCourses=parked
        )
        cases[f"{tag}-parked-only"] = scenario(**here, parkedCourses=parked)

        # --- the rule filter is a second exit from evaluate, and takes a
        # different route to the same fifteen results
        cases[f"{tag}-without-rule-checker"] = scenario(
            **here, plannedCourses=plan, doneCourses=done, ruleChecker=False
        )
        cases[f"{tag}-without-rule-checker-empty-plan"] = scenario(
            **here, ruleChecker=False
        )

        earlier = [pair[0] for pair in ORDERED_PAIRS[code]]
        later = [pair[1] for pair in ORDERED_PAIRS[code]]

        # --- one channel at a time, then one channel missing at a time.
        # The isolated cases finish the courses the curriculum puts first, so
        # that the sequence channel has something to answer about; without it it
        # would be recorded answering an empty list.
        ordered_done = done + [course(pool, c, 5) for c in earlier]

        cases[f"{tag}-all-toggles-off"] = scenario(
            **here, toggles=dict(ALL_OFF), plannedCourses=plan, doneCourses=done
        )
        for channel in CHANNELS:
            cases[f"{tag}-only-{channel}"] = scenario(
                **here,
                toggles={**ALL_OFF, channel: True},
                plannedCourses=plan,
                doneCourses=ordered_done,
            )
            cases[f"{tag}-without-{channel}"] = scenario(
                **here,
                toggles={**ALL_ON, channel: False},
                plannedCourses=plan,
                doneCourses=done,
            )

        # --- what the student told us, and what happens when they told us nothing
        cases[f"{tag}-no-interests"] = scenario(
            **here, interests=[], plannedCourses=plan, doneCourses=done
        )
        cases[f"{tag}-no-career"] = scenario(
            **here, careerDirection="", plannedCourses=plan, doneCourses=done
        )
        cases[f"{tag}-no-profile-at-all"] = scenario(
            **here, interests=[], careerDirection="", plannedCourses=plan, doneCourses=done
        )
        cases[f"{tag}-other-interests"] = scenario(
            **here, interests=list(OTHER_INTERESTS), plannedCourses=plan, doneCourses=done
        )
        cases[f"{tag}-other-career"] = scenario(
            **here, careerDirection=OTHER_CAREER, plannedCourses=plan, doneCourses=done
        )
        cases[f"{tag}-blank-interests"] = scenario(
            **here, interests=["  ", "", " Machine Learning "], plannedCourses=plan
        )
        local_interests, local_career = LOCAL_PROFILE[code]
        cases[f"{tag}-local-language-profile"] = scenario(
            **here,
            interests=list(local_interests),
            careerDirection=local_career,
            plannedCourses=plan,
            doneCourses=done,
        )
        cases[f"{tag}-local-language-interests-only"] = scenario(
            **here,
            interests=list(local_interests),
            careerDirection="",
            toggles={**ALL_OFF, "interest": True},
            plannedCourses=plan,
        )
        cases[f"{tag}-local-language-career-only"] = scenario(
            **here,
            interests=[],
            careerDirection=local_career,
            toggles={**ALL_OFF, "internship": True},
            plannedCourses=plan,
        )

        # --- plans of increasing size, up to one that leaves nothing to recommend
        cases[f"{tag}-large-plan"] = scenario(
            **here, plannedCourses=planned(pool, 0, 30), doneCourses=planned(pool, 30, 45, lane=4)
        )
        cases[f"{tag}-plan-leaves-three-candidates"] = scenario(
            **here, plannedCourses=planned(pool, 0, len(pool) - 3)
        )
        cases[f"{tag}-plan-leaves-nothing"] = scenario(
            **here, plannedCourses=planned(pool, 0, len(pool))
        )

        # --- the two channels that read a relation rather than a course.
        # Both are recorded with the earlier channels switched off: a candidate
        # is only ever recommended once, so with everything on the interest
        # channel claims these courses first and the channel under test leaves
        # no trace.
        cases[f"{tag}-sequence-prerequisite-of-planned"] = scenario(
            **here,
            toggles={**ALL_OFF, "sequence": True},
            plannedCourses=[course(pool, c, index) for index, c in enumerate(later)],
            # With the checker off this records what the channel itself
            # answered, and the scenario below records what the filter then does
            # with it. The pair is what shows whether the semester the filter
            # invents for a candidate costs the student a recommendation.
            ruleChecker=False,
        )
        cases[f"{tag}-sequence-prerequisite-through-the-rule-filter"] = scenario(
            **here,
            toggles={**ALL_OFF, "sequence": True},
            plannedCourses=[course(pool, c, index) for index, c in enumerate(later)],
        )
        cases[f"{tag}-sequence-successor-of-done"] = scenario(
            **here,
            toggles={**ALL_OFF, "sequence": True},
            doneCourses=[course(pool, c, index) for index, c in enumerate(earlier)],
        )
        cases[f"{tag}-completed-co-occurrence"] = scenario(
            **here, toggles={**ALL_OFF, "completed": True}, doneCourses=done
        )
        cases[f"{tag}-sequence-with-co-occurrence"] = scenario(
            **here,
            toggles={**ALL_OFF, "sequence": True, "completed": True},
            doneCourses=[course(pool, c) for c in earlier] + done,
        )
        cases[f"{tag}-curriculum-order-every-channel"] = scenario(
            **here,
            plannedCourses=plan,
            doneCourses=[course(pool, c, 1) for c in earlier] + done,
        )
        cases[f"{tag}-curriculum-order-every-channel-no-rule-checker"] = scenario(
            **here,
            plannedCourses=plan,
            doneCourses=[course(pool, c, 1) for c in earlier] + done,
            ruleChecker=False,
        )

    # --- degenerate inputs, which is where an unguarded refactor breaks first
    cases["unknown-programme-code"] = scenario(programCode="999 999")
    cases["missing-programme-code"] = scenario(programCode=None)
    cases["empty-candidate-pool"] = scenario(pools=[])
    cases["toggles-as-json-string"] = scenario(
        toggles=json.dumps({"interest": True, "peer": False}),
        plannedCourses=planned(pools[MASTER], 0, 4),
    )
    cases["toggles-as-unparseable-string"] = scenario(
        toggles="not json at all", plannedCourses=planned(pools[MASTER], 0, 4)
    )
    cases["toggles-none"] = scenario(
        toggles=None, plannedCourses=planned(pools[MASTER], 0, 4)
    )
    cases["toggles-empty"] = scenario(
        toggles={}, plannedCourses=planned(pools[MASTER], 0, 4)
    )
    cases["duplicate-candidate-rows"] = scenario(pools=[MASTER, MASTER])
    cases["parked-course-not-in-catalogue"] = scenario(parkedCourses=["not-a-code", ""])

    return cases


def run(case: dict[str, Any], pools: dict[str, list[dict[str, Any]]]) -> Any:
    """
    Answer one scenario.

    The synthetic peer cohort is memoised in a module-level dictionary keyed by
    programme code. Two scenarios that share a programme code but not a candidate
    pool would otherwise answer differently depending on which ran first, so each
    scenario starts from the state a freshly started server would be in.
    """
    forget_cohorts()

    pool = [row for name in case["pools"] for row in pools[name]]
    recommender = Recommender(
        case["interests"],
        case["careerDirection"],
        case["toggles"],
        rule_checker=checker_for(case["programCode"], strict=False) if case["ruleChecker"] else None,
        program_code=case["programCode"],
    )
    try:
        return recommender.evaluate(
            case["plannedCourses"],
            case["doneCourses"],
            pool,
            case["parkedCourses"],
        )
    except Exception as exc:  # a raising input is behaviour too, and must be pinned
        return {"__raised__": f"{type(exc).__name__}: {exc}"}


def main() -> None:
    pools = load_pools()
    cases = build(pools)

    snapshots = {name: run(case, pools) for name, case in cases.items()}

    CORPUS.write_text(
        json.dumps(
            {"pools": encode(pools), "scenarios": encode(cases)},
            indent=1,
            sort_keys=True,
            ensure_ascii=False,
        )
    )
    SNAPSHOT.write_text(
        json.dumps(encode(snapshots), indent=1, sort_keys=True, ensure_ascii=False)
    )

    raised = sum(1 for value in snapshots.values() if isinstance(value, dict))
    empty = sum(1 for value in snapshots.values() if value == [])
    distinct = len({json.dumps(encode(value), sort_keys=True) for value in snapshots.values()})
    # A corpus whose scenarios nearly all answer the same thing pins nothing. The
    # failure this guards against is real: an earlier draft agreed with itself
    # almost everywhere, because two channels read a table of course codes the
    # catalogue does not contain and only the interest channel was doing work.
    if distinct < len(snapshots) * 0.5:
        raise SystemExit(
            f"corpus is degenerate: only {distinct} distinct answers across "
            f"{len(snapshots)} scenarios; the channels are probably not firing"
        )
    print(
        f"{len(cases)} scenarios, {distinct} distinct answers, "
        f"{empty} empty, {raised} raising"
    )


if __name__ == "__main__":
    main()
