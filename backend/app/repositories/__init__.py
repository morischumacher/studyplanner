"""
Data access.

Every SQL statement in the application lives in this package. A repository is a
thin object bound to one connection; it maps rows to plain dictionaries and does
nothing else. Services decide when to open a connection and whether it needs a
transaction, and reach the repositories through a unit of work.
"""
from .unit_of_work import PostgresUnitOfWork, UnitOfWork, UnitOfWorkFactory

__all__ = ["PostgresUnitOfWork", "UnitOfWork", "UnitOfWorkFactory"]
