"""
Recommending by what similar students chose.

This is the one channel that cannot answer from a candidate alone. It first finds
the prior students whose choices most overlap the plan, then weighs what those
students took and the candidate did not. So the whole cohort is scored once, on
the first candidate it is asked about, and every later candidate is a lookup.

Where no prior student overlaps the plan at all, there are no neighbours to weigh
and the channel falls back to raw popularity, which is what a student with an
empty plan sees.

The cohort itself is synthetic, stands in for real enrolment history, and is
memoised per programme for the life of the process.
"""
from __future__ import annotations

import hashlib
import random
from typing import Any, Iterable

from .context import Course, PlanContext
from .strategy import Suggestion

_COHORTS: dict[str, list[set[str]]] = {}

_COHORT_SIZE = 50
_TRACK_COUNT = 5
_TRACK_SIZE = 15
_NEIGHBOURS = 10


def cohort_for(program_code: str, pool: list[dict[str, Any]]) -> list[set[str]]:
    """
    The synthetic prior students for a programme.

    Seeded from the programme code so that the same cohort comes back on every
    run: peer evidence that changed between restarts would be worse than no peer
    evidence, because a student would be told that different people took
    different courses each time they reloaded. The seeding only holds if what it
    draws from is ordered, which is why the codes are sorted rather than merely
    de-duplicated.
    """
    if not program_code:
        return []
    if program_code in _COHORTS:
        return _COHORTS[program_code]

    codes = sorted({row["code"] for row in pool if row.get("code")})
    if not codes:
        _COHORTS[program_code] = []
        return []

    seed = int(hashlib.md5(program_code.encode("utf-8")).hexdigest(), 16) % 10000000
    prng = random.Random(seed)

    tracks = [
        set(prng.sample(codes, min(_TRACK_SIZE, len(codes))))
        for _ in range(_TRACK_COUNT)
    ]

    cohort = []
    for _ in range(_COHORT_SIZE):
        track = prng.choice(tracks)
        student = set(prng.sample(sorted(track), prng.randint(5, len(track))))
        student.update(prng.sample(codes, min(prng.randint(5, 15), len(codes))))
        cohort.append(student)

    _COHORTS[program_code] = cohort
    return cohort


def forget_cohorts() -> None:
    """Drop the memoised cohorts, returning the process to how it started."""
    _COHORTS.clear()


def _score_cohort(plan: PlanContext) -> dict[str, dict[str, Any]]:
    """Weigh each course the cohort took and the student has not."""
    cohort = cohort_for(plan.program_code, plan.pool) if plan.program_code else []
    if not cohort:
        return {}

    accounted_for = plan.already_in_plan
    neighbours = sorted(
        (
            (len(student & accounted_for), student)
            for student in cohort
            if student & accounted_for
        ),
        key=lambda match: match[0],
        reverse=True,
    )[:_NEIGHBOURS]

    if not neighbours:
        return _popularity(cohort, accounted_for)

    total = sum(weight for weight, _ in neighbours)
    if total <= 0:
        return {}

    weighted: dict[str, int] = {}
    for weight, student in neighbours:
        for code in student:
            if code not in accounted_for:
                weighted[code] = weighted.get(code, 0) + weight

    return {
        code: {
            "score": 0.4 + (raw / total) * 0.5,
            "percentage": int((raw / total) * 100),
            "cold_start": False,
        }
        for code, raw in weighted.items()
    }


def _popularity(cohort: list[set[str]], accounted_for: set[str]) -> dict[str, dict[str, Any]]:
    counts: dict[str, int] = {}
    for student in cohort:
        for code in student:
            if code not in accounted_for:
                counts[code] = counts.get(code, 0) + 1
    if not counts:
        return {}

    most = max(counts.values())
    return {
        code: {
            "score": 0.3 + (count / most) * 0.5,
            "percentage": int((count / len(cohort)) * 100),
            "cold_start": True,
        }
        for code, count in counts.items()
    }


class PeerStrategy:
    name = "peer"

    def __init__(self) -> None:
        self._scores: dict[str, dict[str, Any]] | None = None

    def suggest(self, plan: PlanContext, candidate: Course) -> Iterable[Suggestion]:
        if self._scores is None:
            self._scores = _score_cohort(plan)

        match = self._scores.get(candidate.code)
        if match is None:
            return

        percentage = match["percentage"]
        if match["cold_start"]:
            evidence = f"Popular choice: {percentage}% of prior students took this course."
        else:
            evidence = (
                f"Recommended by peers: {percentage}% of students "
                "with a similar plan chose this."
            )
        yield Suggestion(match["score"], evidence)
