"""
The missing-requirement lines name courses the checker can recognise.

A student reads "StEOP Pflicht-LV fehlt: X" and goes looking for X. If the title
in that line is not the title the matcher accepts, the student adds the course
the line named and the line stays. The two are written down separately, in the
message and in the recognition table, and nothing kept them in step.
"""
from __future__ import annotations

import re

import pytest

from app.curriculum import BACHELOR, load
from app.rules import BachelorRuleChecker

TAGS = load(BACHELOR).steop_mandatory_tags

MESSAGE = re.compile(r"^StEOP Pflicht-LV fehlt: (?P<title>.+) \((?P<ects>[\d.]+) ECTS\)$")


def title_and_ects(tag: str) -> tuple[str, float]:
    line = BachelorRuleChecker._STEOP_MANDATORY_MISSING[tag]
    match = MESSAGE.match(line)
    assert match, f"the line for '{tag}' no longer has a title to read: {line}"
    return match["title"], float(match["ects"])


@pytest.mark.parametrize("tag", TAGS)
def test_the_course_the_line_names_is_the_course_that_clears_it(tag: str) -> None:
    title, ects = title_and_ects(tag)
    line = BachelorRuleChecker._STEOP_MANDATORY_MISSING[tag]

    result = BachelorRuleChecker().evaluate(
        {
            "programCode": BACHELOR,
            "plannedCourses": [{"code": title, "name": title, "ects": ects, "laneIndex": 0}],
            "doneCourses": [],
        }
    )

    assert line not in result.missing
    assert tag in result.stats["steop"]["planned"]["mandatoryPresent"]
