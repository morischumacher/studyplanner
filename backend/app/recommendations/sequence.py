"""
Recommending by position in a sequence.

Two questions, asked in this order and scored differently. A course the student
has already planned may need this candidate first, which is the stronger claim:
leaving it out would hold up something they have committed to. A course they have
finished may be one this candidate is meant to follow, which is only a suggestion
about what tends to come next.

The ordering is the curriculum's own, so the channel says nothing the rule engine
would contradict. The curricula state it in course names, and a channel matches
on catalogue codes, so the relation has to be resolved against the candidate pool
before it can be used.
"""
from __future__ import annotations

import unicodedata
from typing import Any, Iterable

from ..curriculum import load
from .context import Course, PlanContext
from .strategy import Suggestion

_PREREQUISITE_SCORE = 0.9
_SUCCESSOR_SCORE = 0.8


def _key(text: Any) -> str:
    """Fold a course name or code the way the rule engine folds it."""
    folded = unicodedata.normalize("NFKD", str(text or ""))
    folded = "".join(ch for ch in folded if not unicodedata.combining(ch)).lower()
    return " ".join(
        "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in folded).split()
    )


def _codes_by_key(pool: list[dict[str, Any]]) -> dict[str, str]:
    """What each course is called, folded, against the code the channels match on."""
    by_key: dict[str, str] = {}
    # Sorted because the catalogue query promises no row order, and a name two
    # courses share would otherwise resolve to whichever came back first.
    for row in sorted(pool, key=lambda row: str(row.get("code"))):
        code = row.get("code")
        if not code:
            continue
        for text in (code, row.get("title") or row.get("name")):
            key = _key(text)
            if key:
                by_key.setdefault(key, code)
    return by_key


def _curriculum_relations(program_code: str | None) -> list[tuple[Any, Any]]:
    """
    The ordering both curricula state, as pairs of the earlier course and the later.

    The bachelor document writes them as ordered pairs and the master one as a
    course keyed to what it requires, and the master's are written twice over,
    once by full title and once by short code.
    """
    if not program_code:
        return []
    try:
        curriculum = load(program_code)
    except KeyError:
        return []

    relations: list[tuple[Any, Any]] = list(getattr(curriculum, "soft_prereqs", ()))
    for later, required in getattr(curriculum, "prerequisites", {}).items():
        relations.extend((earlier, later) for earlier in required)
    return relations


def ordered_pairs(program_code: str | None, pool: list[dict[str, Any]]) -> list[tuple[str, str]]:
    """The curriculum's ordering as pairs of catalogue codes, earlier first."""
    by_key = _codes_by_key(pool)
    resolved = set()
    for earlier, later in _curriculum_relations(program_code):
        first = by_key.get(_key(earlier))
        second = by_key.get(_key(later))
        if first and second and first != second:
            resolved.add((first, second))
    return sorted(resolved)


class SequenceStrategy:
    name = "sequence"

    def __init__(self) -> None:
        self._needed_by: dict[str, list[str]] = {}
        self._follows: dict[str, list[str]] = {}
        self._indexed = False

    def _index(self, plan: PlanContext) -> None:
        self._indexed = True
        for earlier, later in ordered_pairs(plan.program_code, plan.pool):
            self._needed_by.setdefault(earlier, []).append(later)
            self._follows.setdefault(later, []).append(earlier)

    def suggest(self, plan: PlanContext, candidate: Course) -> Iterable[Suggestion]:
        if not self._indexed:
            self._index(plan)

        for later in self._needed_by.get(candidate.code, ()):
            if later in plan.planned_codes:
                yield Suggestion(
                    _PREREQUISITE_SCORE,
                    f"the curriculum expects this before planned course {later}",
                )

        for earlier in self._follows.get(candidate.code, ()):
            if earlier in plan.done_codes:
                yield Suggestion(
                    _SUCCESSOR_SCORE,
                    f"the curriculum places this after completed course {earlier}",
                )
