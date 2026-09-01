"""The curriculum's prerequisite relations, for the client to draw."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..services.prerequisites import (
    BACHELOR_PROGRAM_CODE,
    MASTER_PROGRAM_CODE,
    normalise_program_code,
    prerequisite_relations,
)
from .dependencies import require_user

router = APIRouter(tags=["curriculum"])


@router.get("/curriculum/prerequisites")
async def get_prerequisites(
    program_code: str | None = Query(default=None, alias="program_code"),
    _user: dict[str, Any] = Depends(require_user),
):
    """The prerequisite relations of one programme, for the client to draw.

    The compliance engine already enforces these relations; this endpoint exists
    so the graph view can render the same list rather than hold a second copy of
    it. A programme that encodes none returns an empty list.
    """
    code = normalise_program_code(program_code)
    if code and code not in (BACHELOR_PROGRAM_CODE, MASTER_PROGRAM_CODE):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported program_code '{program_code}'. "
                "Expected '033 521' (bachelor) or '066 937' (master)."
            ),
        )
    return {"programCode": code, "relations": prerequisite_relations(code)}
