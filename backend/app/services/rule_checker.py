from dataclasses import dataclass
from typing import Any


@dataclass
class RuleCheckResult:
    ok: bool = True
    message: str = "accepted"


class RuleChecker:
    """
    Placeholder implementation.
    The next step is to evaluate program-specific bachelor/master rules.
    """

    def evaluate(self, payload: dict[str, Any]) -> RuleCheckResult:
        _ = payload
        return RuleCheckResult(ok=True, message="accepted")
