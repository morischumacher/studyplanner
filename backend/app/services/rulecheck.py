"""
Choosing a rule set and running it.

Programme codes reach the API in whichever spacing the caller happens to use, so
the code is normalised before it is matched but passed on untouched: the rule
sets compare against the spaced form printed in the curriculum regulations.
"""
from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Any

from ..domain.errors import RuleEvaluationFailed, UnsupportedProgramme
from .rule_checker_bachelor import RuleChecker as BachelorRuleChecker
from .rule_checker_master import RuleChecker as MasterRuleChecker

MASTER = "066937"
BACHELOR = "033521"


def normalise_programme_code(value: str | None) -> str:
    return (value or "").strip().replace(" ", "")


def rule_checker_for(program_code: str | None, *, strict: bool = True):
    """
    The checker a programme code selects.

    A missing code selects the master checker, which is what the frontend
    relied on before it sent one. `strict=False` extends that tolerance to
    unrecognised codes, which is what the recommender does: a recommendation
    filtered by the wrong rule set is a worse answer, not a failed request.
    """
    normalised = normalise_programme_code(program_code)
    if normalised == BACHELOR:
        return BachelorRuleChecker()
    if normalised == MASTER or not normalised or not strict:
        return MasterRuleChecker()
    raise UnsupportedProgramme(
        f"Unsupported programCode '{program_code}'. "
        f"Expected '066 937' (master) or '033 521' (bachelor)."
    )


class RuleCheckService:
    def evaluate(self, payload: dict[str, Any]) -> dict[str, Any]:
        checker = rule_checker_for(payload.get("programCode"))
        try:
            result = checker.evaluate(payload)
        except Exception as error:  # noqa: BLE001 - reported to the caller
            raise RuleEvaluationFailed(f"Rulecheck evaluation failed: {error}") from error

        if is_dataclass(result):
            return asdict(result)
        if isinstance(result, dict):
            return result
        if hasattr(result, "model_dump"):
            return result.model_dump()
        return {"ok": True, "message": str(result)}
