"""
The one place that maps a domain failure to an HTTP status.

Services raise errors named for what went wrong. Which number that becomes is a
property of the transport, so it is decided here and nowhere else.
"""
from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse

from ..domain.errors import (
    DomainError,
    InvalidRequest,
    NotAuthenticated,
    ProgrammeLocked,
    ProgrammeNotFound,
    RuleEvaluationFailed,
    SetupIncomplete,
    StartTermLocked,
    StorageFailure,
    UnsupportedProgramme,
    UsernameTaken,
)

STATUS_BY_ERROR: dict[type[DomainError], int] = {
    InvalidRequest: 400,
    SetupIncomplete: 400,
    UnsupportedProgramme: 400,
    NotAuthenticated: 401,
    ProgrammeNotFound: 404,
    UsernameTaken: 409,
    ProgrammeLocked: 409,
    StartTermLocked: 409,
    StorageFailure: 500,
    RuleEvaluationFailed: 500,
}


def status_for(error: DomainError) -> int:
    for error_type in type(error).__mro__:
        if error_type in STATUS_BY_ERROR:
            return STATUS_BY_ERROR[error_type]
    return 400


async def handle_domain_error(_request: Request, error: DomainError) -> JSONResponse:
    return JSONResponse(
        status_code=status_for(error), content={"detail": str(error)}
    )
