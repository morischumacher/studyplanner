"""
Compliance checking.

The curriculum a programme follows is data, in `app/curriculum`. What lives here
is the checking: how a plan is read, which questions are asked of it, and in what
order. Each programme composes its own set of questions, because the two
curricula are not variants of one another. The bachelor programme has an
introductory-phase gate with no counterpart in the master programme, and the
master programme has a focus-area dependency structure with no counterpart in the
bachelor. Sharing one pipeline would mean writing each programme's exceptions as
conditionals inside the other's rules.

`checker_for` is the only entry point anything outside this package should need.
"""
from __future__ import annotations

from ..curriculum import BACHELOR, MASTER
from ..domain.errors import UnsupportedProgramme
from .bachelor import RuleChecker as BachelorRuleChecker
from .master import RuleChecker as MasterRuleChecker
from .result import RuleCheckResult

# Programme codes reach us in whatever spacing the caller used.
_BY_CODE = {
    BACHELOR.replace(" ", ""): BachelorRuleChecker,
    MASTER.replace(" ", ""): MasterRuleChecker,
}


def normalise_programme_code(value: str | None) -> str:
    return (value or "").strip().replace(" ", "")


def checker_for(program_code: str | None, *, strict: bool = True):
    """
    The rule checker a programme code selects.

    A missing code selects the master checker, which is what the frontend relied
    on before it sent one. `strict=False` extends that tolerance to unrecognised
    codes: the recommender would rather filter with the wrong rule set than fail
    the request outright.
    """
    normalised = normalise_programme_code(program_code)
    checker = _BY_CODE.get(normalised)
    if checker is not None:
        return checker()
    if not normalised or not strict:
        return MasterRuleChecker()
    raise UnsupportedProgramme(
        f"Unsupported programCode '{program_code}'. "
        f"Expected '{MASTER}' (master) or '{BACHELOR}' (bachelor)."
    )


__all__ = [
    "BachelorRuleChecker",
    "MasterRuleChecker",
    "RuleCheckResult",
    "checker_for",
    "normalise_programme_code",
]
