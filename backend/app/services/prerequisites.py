"""The curriculum's prerequisite relations, held in one place.

Both rule checkers already enforced these relations; each held its own copy of
them, inline, so nothing else could read them. They are lifted here unchanged so
that the checkers and the graph view answer from the same list.

Two things are worth stating plainly, because the numbers are small and the
smallness is the point. The Bachelor programme encodes two soft prerequisite
pairs across its 101 courses, and the Master programme encodes the thesis before
its defence and its seminar. What the curricula otherwise encode are eligibility
gates, the introductory phase (StEOP) and the core-before-elective condition
inside a focus area, which are conditions on a plan rather than edges between two
courses, and which the compliance engine reports separately.

`kind` distinguishes the two relations the curricula do carry:

    "soft"  the relation is advisory. Planning the target first is permitted and
            produces a warning, not a rejection.
    "hard"  the relation is enforced. Planning the target first is rejected.
"""

from typing import Dict, List, Tuple

BACHELOR_PROGRAM_CODE = "033521"
MASTER_PROGRAM_CODE = "066937"

# Bachelor Informatics: advisory ordering between two course pairs.
BACHELOR_SOFT_PREREQS: Tuple[Tuple[str, str], ...] = (
    ("Einführung in die Programmierung 1", "Einführung in die Programmierung 2"),
    ("Software Engineering", "Software Engineering Projekt"),
)

# Master Software Engineering & Internet Computing: the thesis before the two
# items that depend on it. Keys are targets, values the courses required first;
# both the written-out names and the catalogue's abbreviations are accepted,
# because a plan may carry either.
MASTER_PREREQUISITES: Dict[str, List[str]] = {
    "Final Oral Exam / Defense": ["Master Thesis"],
    "Seminar for Diploma Students": ["Master Thesis"],
    "FOE": ["MTH"],
    "SDS": ["MTH"],
}

# The abbreviations above name the same two relations as the written-out entries,
# so they are not repeated as separate edges when the relations are drawn.
_MASTER_EDGE_ALIASES = {"FOE", "SDS"}


def normalise_program_code(value: str | None) -> str:
    return (value or "").strip().replace(" ", "")


def prerequisite_relations(program_code: str | None) -> List[Dict[str, str]]:
    """Every prerequisite relation of one programme, as source -> target pairs.

    The source is the course that is expected first. Returns an empty list for a
    programme that encodes none, which is a real answer rather than a missing one.
    """
    code = normalise_program_code(program_code)

    if code == BACHELOR_PROGRAM_CODE:
        return [
            {"source": source, "target": target, "kind": "soft"}
            for source, target in BACHELOR_SOFT_PREREQS
        ]

    if code == MASTER_PROGRAM_CODE:
        relations: List[Dict[str, str]] = []
        for target, sources in MASTER_PREREQUISITES.items():
            if target in _MASTER_EDGE_ALIASES:
                continue
            for source in sources:
                relations.append({"source": source, "target": target, "kind": "hard"})
        return relations

    return []
