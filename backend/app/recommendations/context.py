"""
What a channel is allowed to look at.

`PlanContext` is the plan as the channels see it: the student's profile, the
codes already accounted for, and the candidates still open to them. Building it
is the only place a course dictionary is read for its topics, so every channel
compares against the same reading of the catalogue.

The student's own history is derived lazily. A plan that already contains every
course leaves no candidates, and answering that case must not cost a second pass
over the catalogue.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import cached_property
from typing import Any

from .knowledge import COURSE_TAGS

_WORDS = re.compile(r"\b[A-Za-zÄÖÜäöüß]{2,}\b")
_ANY_WORD = re.compile(r"\b\w+\b")


@dataclass(frozen=True)
class CourseMetadata:
    """One course reduced to the words a channel can match against."""

    skills: set[str]
    desc_words: set[str]
    raw_desc: str
    keywords: set[str]
    similar_courses: list[dict[str, Any]]


def course_metadata(row: dict[str, Any]) -> CourseMetadata:
    """Read a catalogue row's topics, falling back to its title when it has none."""
    code = row.get("code")
    name = row.get("title") or row.get("name") or code or ""

    content = row.get("content") or []
    if not content and code in COURSE_TAGS:
        content = list(COURSE_TAGS[code])

    phrases = {str(item).lower().strip() for item in content if str(item).strip()}
    content_keywords: set[str] = set()
    for phrase in phrases:
        content_keywords.update(_WORDS.findall(phrase.lower()))

    if not content_keywords:
        content_keywords = {w for w in _ANY_WORD.findall(name.lower()) if len(w) > 3}

    title_words = {w.lower() for w in _WORDS.findall(name)}

    return CourseMetadata(
        # The topic words serve as both the skills a course teaches and the words
        # its description is made of. The two channels that read them ask
        # different questions of the same set.
        skills=content_keywords,
        desc_words=content_keywords,
        raw_desc=(name + " " + " ".join(content)).lower(),
        keywords=content_keywords | title_words,
        similar_courses=row.get("similar_courses") or [],
    )


@dataclass(frozen=True)
class Course:
    """A catalogue row together with the reading of it the channels share."""

    row: dict[str, Any]
    code: str
    name: str
    meta: CourseMetadata

    @classmethod
    def of(cls, row: dict[str, Any]) -> "Course":
        code = row["code"]
        return cls(
            row=row,
            code=code,
            name=row.get("title") or row.get("name") or code,
            meta=course_metadata(row),
        )


@dataclass
class PlanContext:
    interests: set[str]
    career_direction: str
    program_code: str | None
    toggles: dict[str, Any]
    planned_courses: list[dict[str, Any]]
    done_courses: list[dict[str, Any]]
    pool: list[dict[str, Any]]
    planned_codes: set[str] = field(default_factory=set)
    done_codes: set[str] = field(default_factory=set)
    parked_codes: set[str] = field(default_factory=set)

    @property
    def already_in_plan(self) -> set[str]:
        return self.planned_codes | self.done_codes | self.parked_codes

    @cached_property
    def candidates(self) -> list[Course]:
        """Everything the student could still add, in the order the pool gave us."""
        accounted_for = self.already_in_plan
        return [
            Course.of(row)
            for row in self.pool
            if row.get("code") and row["code"] not in accounted_for
        ]

    @cached_property
    def history(self) -> list[Course]:
        """The catalogue rows for the courses the student has already accounted for."""
        accounted_for = self.already_in_plan
        return [Course.of(row) for row in self.pool if row.get("code") in accounted_for]


def build_context(
    *,
    interests: set[str],
    career_direction: str,
    program_code: str | None,
    toggles: dict[str, Any],
    planned_courses: list[dict[str, Any]],
    done_courses: list[dict[str, Any]],
    pool: list[dict[str, Any]],
    parked_courses: list[str] | None,
) -> PlanContext:
    return PlanContext(
        interests=interests,
        career_direction=career_direction,
        program_code=program_code,
        toggles=toggles,
        planned_courses=planned_courses,
        done_courses=done_courses,
        pool=pool,
        planned_codes={str(c.get("code")) for c in planned_courses if c.get("code")},
        done_codes={str(c.get("code")) for c in done_courses if c.get("code")},
        parked_codes={str(c) for c in (parked_courses or []) if c},
    )
