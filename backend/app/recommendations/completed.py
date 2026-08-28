"""
Recommending by what others did next.

For a course the student has finished, the knowledge graph records what share of
students who finished it also took each other course. That share is both the
score and the evidence, so a course two thirds of the cohort went on to take
outranks one a third of them did.

The plan's completed codes are held as a set, so where several finished courses
would each justify the same candidate, which share the evidence quotes is not
fixed.
"""
from __future__ import annotations

from typing import Iterable

from .context import Course, PlanContext
from .knowledge import CO_OCCURRENCES
from .strategy import Suggestion


class CompletedStrategy:
    name = "completed"

    def suggest(self, plan: PlanContext, candidate: Course) -> Iterable[Suggestion]:
        for done in plan.done_codes:
            share = CO_OCCURRENCES.get(done, {}).get(candidate.code)
            if share is not None:
                yield Suggestion(
                    share / 100.0,
                    f"{share}% of students who completed {done} also took this",
                )
