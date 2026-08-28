"""
Checking a plan against its curriculum.

The rule sets live in `app/rules`; this is the use case around them. It exists
so that the HTTP layer never touches a checker directly, and so that the one
place a rule set can raise is wrapped in something the API knows how to answer.
"""
from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Any

from ..domain.errors import RuleEvaluationFailed
from ..rules import checker_for


class RuleCheckService:
    def evaluate(self, payload: dict[str, Any]) -> dict[str, Any]:
        checker = checker_for(payload.get("programCode"))
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
