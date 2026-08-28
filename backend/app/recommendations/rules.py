"""
Discarding recommendations the curriculum would refuse.

A recommendation the planner would immediately reject is worse than no
recommendation, so each one is tried against the rule checker as if the student
had added it. What counts as a refusal is measured against the plan as it already
stands: a plan that is already over its credit ceiling would otherwise reject
everything, so only violations the candidate itself introduces count.

A course can appear in the catalogue more than once, under different modules. It
survives if any one of those placements is acceptable.

A checker that raises has said nothing, and silence is not consent: a candidate
whose trial the checker could not answer is dropped, because the premise above
only holds for candidates that were actually checked. A checker that cannot
answer for the plan itself is a different case, and is handled where it arises.
"""
from __future__ import annotations

import logging
from typing import Any

from .context import PlanContext

logger = logging.getLogger(__name__)

RESULT_LIMIT = 15

# Rule checking is the expensive part, so only the strongest recommendations are
# put through it. Anything past this point could not reach the result anyway.
_CHECK_LIMIT = 100

# The candidate is offered to the checker in a semester of its own, past any the
# student is actually using, so that it is judged on its own merits rather than
# on whichever semester it happened to land in.
_TRIAL_LANE = 99


def _payload(plan: PlanContext, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    planned = plan.planned_courses + [extra] if extra else plan.planned_courses
    return {"plannedCourses": planned, "doneCourses": plan.done_courses}


def _trial_course(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "code": row.get("code"),
        "name": row.get("title") or row.get("name"),
        "ects": row.get("ects"),
        "category": row.get("category") or row.get("type"),
        "examSubject": row.get("exam_subject") or row.get("examSubject") or "",
        "laneIndex": _TRIAL_LANE,
    }


def filter_by_rules(
    plan: PlanContext, recommendations: list[dict[str, Any]], rule_checker: Any
) -> list[dict[str, Any]]:
    """Keep the recommendations that introduce no new complaint, best first."""
    try:
        base = rule_checker.evaluate(_payload(plan))
    except Exception:
        # Without a baseline there is nothing to measure a candidate against, and
        # an empty one would count every complaint the plan already has as one the
        # candidate introduced. The filter stands down instead, leaving the list
        # the engine shows when no checker is configured at all.
        logger.exception("rule checker could not evaluate the plan; recommendations are unfiltered")
        return recommendations[:RESULT_LIMIT]

    base_errors = base.errors or []
    base_warnings = base.stats.get("warnings", [])

    variants: dict[str, list[dict[str, Any]]] = {}
    for candidate in plan.candidates:
        variants.setdefault(candidate.code, []).append(candidate.row)

    kept: list[dict[str, Any]] = []
    for recommendation in recommendations[:_CHECK_LIMIT]:
        rows = variants.get(recommendation["courseCode"], [])
        if not rows:
            # Nothing to place, so nothing to object to. This does not count
            # towards the limit, which only bounds the checking.
            kept.append(recommendation)
            continue
        if any(
            _is_acceptable(plan, row, rule_checker, base_errors, base_warnings)
            for row in rows
        ):
            kept.append(recommendation)
        if len(kept) >= RESULT_LIMIT:
            break
    return kept


def _is_acceptable(
    plan: PlanContext,
    row: dict[str, Any],
    rule_checker: Any,
    base_errors: list[str],
    base_warnings: list[str],
) -> bool:
    try:
        result = rule_checker.evaluate(_payload(plan, _trial_course(row)))
    except Exception:
        logger.exception("rule checker could not judge candidate %r", row.get("code"))
        return False

    if result.ok:
        return True
    new_errors = [e for e in (result.errors or []) if e not in base_errors]
    new_warnings = [w for w in (result.stats.get("warnings", []) or []) if w not in base_warnings]
    return not new_errors and not new_warnings
