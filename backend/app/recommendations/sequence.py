"""
Recommending by position in a sequence.

Two questions, asked in this order and scored differently. A course the student
has already planned may require this candidate first, which is the stronger
claim: leaving it out would block something they have committed to. A course they
have finished may commonly lead to this candidate, which is only a suggestion
about what tends to come next.

The plan's codes are held as sets, so where several planned courses would each
justify the same candidate, which one the evidence names is not fixed.
"""
from __future__ import annotations

from typing import Iterable

from .context import Course, PlanContext
from .knowledge import DEPENDENCIES, SEQUENCES
from .strategy import Suggestion

_PREREQUISITE_SCORE = 0.9
_SUCCESSOR_SCORE = 0.8


class SequenceStrategy:
    name = "sequence"

    def suggest(self, plan: PlanContext, candidate: Course) -> Iterable[Suggestion]:
        for planned in plan.planned_codes:
            if candidate.code in DEPENDENCIES.get(planned, ()):
                yield Suggestion(
                    _PREREQUISITE_SCORE, f"prerequisite of planned course {planned}"
                )

        for done in plan.done_codes:
            if candidate.code in SEQUENCES.get(done, ()):
                yield Suggestion(
                    _SUCCESSOR_SCORE, f"commonly taken after completed course {done}"
                )
