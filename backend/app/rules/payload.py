"""
Reading the parts of a rule-check payload that mean the same thing to every
programme.

There is very little of this, and that is the finding rather than a shortcoming.
The two curricula share the wire format and almost nothing else: even
normalising a title differs, because the bachelor programme's titles are German
and have to be accent-folded before they can be matched, while the master
programme's are not. What genuinely is common lives here; what looks common but
is not stays with the programme that owns it.
"""
from __future__ import annotations

from typing import Any, Tuple


def resolve_semester_load_limits(
    payload: dict[str, Any], default_max: float, default_recommended: float
) -> Tuple[float, float]:
    """
    The per-semester credit ceiling and the recommended load for this request.

    A student may raise or lower both in their profile, so the payload wins over
    the curriculum's defaults. Anything unusable falls back rather than failing:
    a malformed limit must not make a plan uncheckable. The recommended load is
    capped at the ceiling, since a warning that fires on every plan is noise.
    """
    try:
        max_ects = float(payload.get("maxEctsPerSemester"))
    except (TypeError, ValueError):
        max_ects = default_max
    try:
        recommended_ects = float(payload.get("recommendedEctsPerSemester"))
    except (TypeError, ValueError):
        recommended_ects = default_recommended

    if max_ects <= 0:
        max_ects = default_max
    if recommended_ects <= 0:
        recommended_ects = default_recommended
    if recommended_ects > max_ects:
        recommended_ects = max_ects
    return max_ects, recommended_ects
