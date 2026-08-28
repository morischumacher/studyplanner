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

The captured rows are sorted by code. The repository's query has no ORDER BY, so
the database does not promise an order, and the recommender's answer depends on
one: candidates are considered in the order given, and the final sort by score is
stable, so ties keep it. The fixture therefore pins an order rather than records
one.

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
from uuid import UUID, uuid5, NAMESPACE_URL

from app.recommendations import Recommender
from app.recommendations import knowledge
from app.recommendations.peer import forget_cohorts
from app.rules import checker_for

HERE = Path(__file__).resolve().parent
CORPUS = HERE / "recommender_fixtures.json"
SNAPSHOT = HERE / "recommender_snapshots.json"

BACHELOR = "033 521"
MASTER = "066 937"

# The knowledge graph the recommender consults is keyed by course codes that no
# longer exist in the catalogue, so the sequence and completed channels cannot
# fire against real candidates alone. This pool supplies those codes, which is
# the only way to record what those two channels do at all.
MOCK_GRAPH = "mock-graph"

CHANNELS = ("interest", "similarity", "sequence", "completed", "internship", "peer")
ALL_ON = {name: True for name in CHANNELS}
ALL_OFF = {name: False for name in CHANNELS}

INTERESTS = ["machine learning", "web security", "software architecture"]
OTHER_INTERESTS = ["databases", "human computer interaction"]
GRAPH_INTERESTS = ["cryptography", "neural networks", "frontend"]
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


def mock_graph_pool() -> list[dict[str, Any]]:
    """
    Candidate rows for the codes the hard-coded knowledge graph refers to.

    `content` is left empty on purpose: that is what makes the recommender fall
    back to its built-in tag table, a branch no real catalogue row reaches.
    """
    codes = set(knowledge.COURSE_TAGS)
    for mapping in (knowledge.SEQUENCES,
                    knowledge.DEPENDENCIES):
        codes.update(mapping)
        for successors in mapping.values():
            codes.update(successors)
    for source, targets in knowledge.CO_OCCURRENCES.items():
        codes.add(source)
        codes.update(targets)

    return [
        {
            "id": uuid5(NAMESPACE_URL, f"mock-graph/{code}"),
            "code": code,
            "title": f"Graph Course {code}",
            "type": "VU",
            "ects": Decimal("3.0"),
            "language": "en",
            "term_availability": "winter",
            "content": None,
            "similar_courses": None,
            "category": "elective",
            "exam_subject": None,
        }
        for code in sorted(codes)
    ]


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

        # --- one channel at a time, then one channel missing at a time.
        # The isolated cases carry the knowledge-graph pool and a plan that
        # reaches into it, because two of the six channels consult nothing else
        # and would otherwise be recorded answering an empty list.
        graph_plan = plan + [{"code": "193.111", "title": "Graph Course 193.111", "laneIndex": 2}]
        graph_done = done + [
            {"code": "193.052", "title": "Graph Course 193.052", "laneIndex": 5},
            {"code": "188.995", "title": "Graph Course 188.995", "laneIndex": 5},
        ]
        cases[f"{tag}-all-toggles-off"] = scenario(
            **here, toggles=dict(ALL_OFF), plannedCourses=plan, doneCourses=done
        )
        for channel in CHANNELS:
            cases[f"{tag}-only-{channel}"] = scenario(
                programCode=code,
                pools=[code, MOCK_GRAPH],
                toggles={**ALL_OFF, channel: True},
                plannedCourses=graph_plan,
                doneCourses=graph_done,
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

        # --- the knowledge graph, which real catalogue codes never reach.
        # The sequence and completed channels are recorded with the earlier
        # channels switched off: a candidate is only ever recommended once, so
        # with everything on the interest channel claims these courses first and
        # the two channels under test leave no trace.
        both = dict(programCode=code, pools=[code, MOCK_GRAPH])

        def graph_course(graph_code: str, lane: int = 0) -> dict[str, Any]:
            return {"code": graph_code, "title": f"Graph Course {graph_code}", "laneIndex": lane}

        cases[f"{tag}-graph-prerequisite-of-planned"] = scenario(
            **both,
            toggles={**ALL_OFF, "sequence": True},
            plannedCourses=[graph_course("193.111"), graph_course("184.739", 1)],
        )
        cases[f"{tag}-graph-successor-of-done"] = scenario(
            **both,
            toggles={**ALL_OFF, "sequence": True},
            doneCourses=[graph_course("193.052"), graph_course("184.735", 1)],
        )
        cases[f"{tag}-graph-co-occurrence"] = scenario(
            **both,
            toggles={**ALL_OFF, "completed": True},
            doneCourses=[graph_course("188.995"), graph_course("193.052", 1)],
        )
        cases[f"{tag}-graph-sequence-outranks-co-occurrence"] = scenario(
            **both,
            toggles={**ALL_OFF, "sequence": True, "completed": True},
            doneCourses=[graph_course("193.052")],
        )
        cases[f"{tag}-graph-built-in-tags"] = scenario(
            **both, toggles={**ALL_OFF, "interest": True}, interests=list(GRAPH_INTERESTS)
        )
        cases[f"{tag}-graph-every-channel"] = scenario(
            **both,
            interests=list(GRAPH_INTERESTS),
            plannedCourses=[graph_course("193.111")],
            doneCourses=[graph_course("188.995", 1)],
        )
        cases[f"{tag}-graph-every-channel-no-rule-checker"] = scenario(
            **both,
            interests=list(GRAPH_INTERESTS),
            plannedCourses=[graph_course("193.111")],
            doneCourses=[graph_course("188.995", 1)],
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
    pools[MOCK_GRAPH] = mock_graph_pool()
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
    # failure this guards against is real: with the candidate pool alone, four of
    # the six channels never fire, and a first draft agreed with itself almost
    # everywhere because only the interest channel was doing any work.
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
