"""
Recommending by what others did next.

Of the prior students who finished a course, some share also took each other
course. That share is both the score and the evidence, so a course two thirds of
them went on to take outranks one a third of them did.

The prior students are the synthetic cohort the peer channel draws its
neighbours from, so both channels answer from one invented enrolment history and
differ only in what they ask of it: this one asks about a course the student has
finished, the peer channel about the plan as a whole.
"""
from __future__ import annotations

from typing import Iterable

from .context import Course, PlanContext
from .peer import cohort_for
from .strategy import Suggestion

# Below a majority, a share is not evidence that one course leads to another, and
# without a floor the channel would claim nearly every candidate before the
# channels behind it are asked.
_MINIMUM_SHARE = 0.5


def _shares(plan: PlanContext) -> dict[str, dict[str, int]]:
    """For each finished course, what percentage of its takers took each other course."""
    cohort = cohort_for(plan.program_code, plan.pool) if plan.program_code else []
    if not cohort:
        return {}

    shares: dict[str, dict[str, int]] = {}
    for done in sorted(plan.done_codes):
        takers = [student for student in cohort if done in student]
        if not takers:
            continue

        counts: dict[str, int] = {}
        for student in takers:
            for code in student:
                counts[code] = counts.get(code, 0) + 1

        shares[done] = {
            code: int(count * 100 / len(takers))
            for code, count in counts.items()
            if code != done and count >= len(takers) * _MINIMUM_SHARE
        }
    return shares


class CompletedStrategy:
    name = "completed"

    def __init__(self) -> None:
        self._shares: dict[str, dict[str, int]] | None = None

    def suggest(self, plan: PlanContext, candidate: Course) -> Iterable[Suggestion]:
        if self._shares is None:
            self._shares = _shares(plan)

        found = [
            (percentages[candidate.code], done)
            for done, percentages in self._shares.items()
            if candidate.code in percentages
        ]
        if not found:
            return

        # The strongest claim, and where two are equally strong the earlier code,
        # so the student is not told about a different one of their finished
        # courses on each reload.
        percentage, done = sorted(found, key=lambda claim: (-claim[0], claim[1]))[0]
        yield Suggestion(
            percentage / 100.0,
            f"{percentage}% of students who completed {done} also took this",
        )
