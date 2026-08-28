"""
The course knowledge graph, as data.

Four relations stand in for what a real deployment would query: what a course is
about, what commonly follows what, what a course requires, and what students who
took one course went on to take. All of it is illustrative, written for the
thesis prototype, and none of it is behaviour.

It is written as Python literals rather than as a JSON document like the
curriculum, because `COURSE_TAGS` holds sets and the reading code treats them as
unordered. JSON has no sets, and the tagged form the curriculum uses to work
around that would commit these values to a written order that the engine does
not currently promise.
"""
from __future__ import annotations

# What each course is about, consulted only when the catalogue has no content of
# its own for that course.
COURSE_TAGS: dict[str, set[str]] = {
    "188.995": {"software engineering", "architecture", "web"},
    "188.923": {"web", "frontend", "react"},
    "193.052": {"machine learning", "data science", "ai"},
    "193.111": {"ai", "neural networks", "deep learning"},
    "184.735": {"security", "cryptography", "systems"},
    "183.131": {"data science", "statistics", "data engineering"},
    "184.739": {"security", "web security", "testing"},
}

# Having completed the key, these commonly follow.
SEQUENCES: dict[str, list[str]] = {
    "188.995": ["188.923"],
    "193.052": ["193.111"],
    "184.735": ["184.739"],
}

# To take the key, these are required first.
DEPENDENCIES: dict[str, list[str]] = {
    "193.111": ["193.052"],
    "184.739": ["184.735"],
}

# Of the students who completed the key, this percentage also took each value.
CO_OCCURRENCES: dict[str, dict[str, int]] = {
    "188.995": {"188.923": 73, "184.735": 45},
    "193.052": {"183.131": 82, "193.111": 65},
}
