"""
What a rule check returns.

One shape for both programmes, and the shape the API sends on the wire:

- `ok` and `message` answer the question the planner asked, which is whether the
  change the student just made is allowed.
- `stats` carries the numbers the dashboard prints.
- `missing` lists what the degree still needs, and `errors` what is wrong with
  the plan as it stands. Neither blocks the change; both are shown as standing
  feedback.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class RuleCheckResult:
    ok: bool = True
    message: str = "accepted"
    stats: Dict[str, Any] = field(default_factory=dict)
    missing: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
