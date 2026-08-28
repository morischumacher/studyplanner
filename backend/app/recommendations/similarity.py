"""
Recommending by curated similarity.

The catalogue records, for some courses, which other courses resemble them and
why. This channel reads those links backwards: it looks through what the student
has already taken or planned for one that names this candidate. The score is
fixed and high, because the link was written by someone who knows the subject
rather than inferred from words.
"""
from __future__ import annotations

from typing import Iterable

from .context import Course, PlanContext
from .strategy import Suggestion

_CURATED_SCORE = 0.85


class SimilarityStrategy:
    name = "similarity"

    def suggest(self, plan: PlanContext, candidate: Course) -> Iterable[Suggestion]:
        for taken in plan.history:
            for link in taken.meta.similar_courses:
                if link["code"] == candidate.code:
                    yield Suggestion(
                        _CURATED_SCORE,
                        f"similar to {taken.name} ({link['evidence']})",
                    )
                    break
