"""
Recommending by stated interest.

An interest matches a course three ways, and the three are not worth the same: a
topic word the course lists outright counts for most, the interest appearing
anywhere in the course description counts for less, and a partial word overlap
counts for least. The score is that weighted count spread over how many interests
the student named, so naming ten interests and matching one is not the same as
naming one and matching it.
"""
from __future__ import annotations

import re
from typing import Iterable

from .context import Course, PlanContext
from .strategy import Suggestion

_ANY_WORD = re.compile(r"\b\w+\b")

# How much of a multi-word interest has to appear before the course counts as
# covering it.
_PARTIAL_MATCH_SHARE = 0.5


class InterestStrategy:
    name = "interest"

    def suggest(self, plan: PlanContext, candidate: Course) -> Iterable[Suggestion]:
        if not plan.interests:
            return

        meta = candidate.meta
        matched_skills = meta.skills & plan.interests
        matched_desc = {i for i in plan.interests if i in meta.raw_desc}

        partial: set[str] = set()
        for interest in plan.interests:
            words = {w for w in _ANY_WORD.findall(interest) if len(w) > 3}
            if words and len(words & meta.keywords) >= len(words) * _PARTIAL_MATCH_SHARE:
                partial.add(interest)

        if not (matched_skills or matched_desc or partial):
            return

        score = (
            len(matched_skills) * 1.5 + len(matched_desc) * 0.8 + len(partial) * 0.4
        ) / max(1, len(plan.interests))
        score = min(1.0, max(0.4, score))

        # Sorted before slicing: these sets iterate in an order that varies per
        # process, so without it the student is shown a different three of their
        # matched interests on every restart.
        parts = []
        if matched_skills:
            parts.append(f"focuses on {', '.join(sorted(matched_skills)[:3])}")
        elif matched_desc or partial:
            everything = matched_skills | matched_desc | partial
            parts.append(f"covers topics related to {', '.join(sorted(everything)[:2])}")

        yield Suggestion(score, "Matches your interests: " + " and ".join(parts))
