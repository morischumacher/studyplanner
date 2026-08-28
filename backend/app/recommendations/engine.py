"""
Composing the channels into one list of recommendations.

Every enabled channel is asked about every candidate, candidate by candidate
rather than channel by channel. That order is what decides ties: a course is only
ever recommended once, so the first channel to claim it is the one whose reason
the student is shown, and the channels are asked in the order they are listed
here.

Two courses that differ only by their teaching format are the same course as far
as a recommendation is concerned, so a course is also suppressed when something
sharing its base name is already recommended or already in the plan.
"""
from __future__ import annotations

from typing import Any, Iterable

from .completed import CompletedStrategy
from .context import Course, PlanContext
from .interest import InterestStrategy
from .internship import InternshipStrategy
from .peer import PeerStrategy
from .rules import RESULT_LIMIT, filter_by_rules
from .sequence import SequenceStrategy
from .similarity import SimilarityStrategy
from .strategy import Strategy, Suggestion

CHANNELS: tuple[type, ...] = (
    InterestStrategy,
    SimilarityStrategy,
    SequenceStrategy,
    CompletedStrategy,
    InternshipStrategy,
    PeerStrategy,
)


def base_name(title: Any, fallback: Any = "") -> str:
    """
    A course title with its format and subtitle stripped.

    "Analysis (VO)" and "Analysis (UE)" are the lecture and the exercise of one
    course, and recommending both is recommending the same thing twice.
    """
    stripped = str(title).split("(")[0].split(" -")[0].strip().lower()
    return stripped or str(fallback).lower()


class Assembly:
    """Collects what the channels offer, keeping at most one entry per course."""

    def __init__(self, plan: PlanContext) -> None:
        self._seen: set[str] = set()
        self._names: set[str] = set()
        self._in_plan = {
            base_name(course.get("title") or course.get("name") or course.get("code") or "")
            for course in plan.planned_courses + plan.done_courses
        }
        self.records: list[dict[str, Any]] = []

    def add(self, candidate: Course, channel: str, suggestion: Suggestion) -> None:
        if candidate.code in self._seen:
            return
        name = base_name(candidate.name, candidate.code)
        if name in self._names or name in self._in_plan:
            return

        self._seen.add(candidate.code)
        self._names.add(name)
        row = candidate.row
        self.records.append(
            {
                "id": f"rec_{candidate.code}_{channel}",
                "courseCode": candidate.code,
                "courseName": candidate.name,
                "type": channel,
                "score": suggestion.score,
                "evidence": suggestion.evidence,
                "ects": row.get("ects"),
                "category": row.get("category"),
                "examSubject": row.get("exam_subject"),
                "courseType": row.get("type"),
            }
        )


def enabled_channels(toggles: dict[str, Any]) -> list[Strategy]:
    """The channels the student has switched on. A channel not mentioned is on."""
    return [channel() for channel in CHANNELS if toggles.get(channel.name, True)]


def recommend(
    plan: PlanContext, strategies: Iterable[Strategy], rule_checker: Any = None
) -> list[dict[str, Any]]:
    """Run the channels over the plan and assemble what they offer."""
    if not plan.candidates:
        return []

    assembly = Assembly(plan)
    for candidate in plan.candidates:
        for strategy in strategies:
            for suggestion in strategy.suggest(plan, candidate):
                assembly.add(candidate, strategy.name, suggestion)

    records = assembly.records
    records.sort(key=lambda record: record["score"], reverse=True)

    if rule_checker and records:
        return filter_by_rules(plan, records, rule_checker)
    return records[:RESULT_LIMIT]
