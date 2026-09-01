"""
What can go wrong, named for what it is rather than for its status code.

Services raise these. The HTTP layer owns the single table that turns them into
responses, which is the only place in the application that knows about status
codes at all.
"""
from __future__ import annotations


class DomainError(Exception):
    """Base class, so one handler can catch everything the services raise."""


class InvalidRequest(DomainError):
    """The caller asked for something that cannot be asked for."""


class NotAuthenticated(DomainError):
    """No valid session, or credentials that do not match an account."""


class UsernameTaken(DomainError):
    pass


class ProgrammeNotFound(DomainError):
    pass


class UnsupportedProgramme(DomainError):
    """A programme code that no rule set knows how to check."""


class ProgrammeLocked(DomainError):
    """A student picks a programme once; this was a second, different pick."""


class StartTermLocked(DomainError):
    """The start term fixes the parity of every lane, so it cannot be moved."""


class SetupIncomplete(DomainError):
    """A profile was saved before the start term it has to hang from exists."""


class StorageFailure(DomainError):
    """The request was valid and the database would not do it."""


class RuleEvaluationFailed(DomainError):
    """A rule set raised while checking a plan, which is always a defect."""
