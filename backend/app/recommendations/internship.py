"""
Recommending by career direction.

The student's stated direction is broken into words and matched against what each
course teaches. A word the course lists as a topic counts double against a word
that merely appears in its description, and the total is spread over how many
words the direction was written with, so a long description does not outscore a
short one by length alone.
"""
from __future__ import annotations

import re
from typing import Iterable

from .context import Course, PlanContext
from .strategy import Suggestion

_ANY_WORD = re.compile(r"\b\w+\b")

_MAX_SCORE = 0.9
_MIN_SCORE = 0.4


class InternshipStrategy:
    name = "internship"

    def suggest(self, plan: PlanContext, candidate: Course) -> Iterable[Suggestion]:
        if not plan.career_direction:
            return

        words = {w for w in _ANY_WORD.findall(plan.career_direction.lower()) if len(w) > 2}
        meta = candidate.meta
        skill_overlap = meta.skills & words
        desc_overlap = meta.desc_words & words

        if not (skill_overlap or desc_overlap):
            return

        score = min(_MAX_SCORE, (len(skill_overlap) * 2 + len(desc_overlap)) / max(1, len(words)))
        score = max(_MIN_SCORE, score)

        # Sorted for the same reason as the interest channel: these sets iterate
        # in an order that varies per process, and this one reaches the student.
        if skill_overlap:
            matched = ", ".join(sorted(skill_overlap))
        else:
            matched = ", ".join(sorted(desc_overlap))

        yield Suggestion(
            score, f"develops skills for {plan.career_direction} ({matched})"
        )
