"""
What a recommendation channel is.

A channel is asked about one candidate at a time and answers with the reasons it
has for putting that candidate forward, or with nothing. It never decides whether
the candidate is actually recommended: a course is only ever recommended once, so
which channel gets to claim it is settled by the engine, in the order the
channels are composed.

A channel is built fresh for each evaluation, so one that needs a pass over the
whole plan before it can answer may do that work in its constructor.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Protocol, runtime_checkable

from .context import Course, PlanContext


@dataclass(frozen=True)
class Suggestion:
    """One channel's reason for putting one candidate forward."""

    score: float
    evidence: str


@runtime_checkable
class Strategy(Protocol):
    """A recommendation channel."""

    name: str

    def suggest(self, plan: PlanContext, candidate: Course) -> Iterable[Suggestion]:
        """The reasons this channel has for recommending `candidate`."""
        ...
