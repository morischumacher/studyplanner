# 0001. A layered backend: router, service, repository

**Status:** Accepted · 2026-08-28

## Context

The API is a FastAPI application of roughly 3,700 lines. Route handlers hold
their own SQL: twenty-four statements are written inline across five route
modules, so an HTTP handler is simultaneously the transport layer, the use case
and the data access layer. Nothing in the backend can be exercised without a
database, and nothing about storage can change without editing HTTP handlers.

## Decision

Three layers, each allowed to depend only on the one below it.

- **`app/api/`** — routers and the request and response models. A handler
  validates input, calls one service, and shapes the reply. It contains no
  business rules and no SQL.
- **`app/services/`** — one module per use case. Services orchestrate the domain
  and the repositories. They know nothing about HTTP.
- **`app/repositories/`** — every SQL statement in the application. Each
  repository is declared as a `typing.Protocol` and implemented against asyncpg,
  so a service can be tested against a stub without a database.

A fourth package, **`app/domain/`**, holds the model itself: courses, plans,
semesters, violations. It is pure Python with no framework and no I/O, and every
other layer may depend on it.

Ports and adapters with a dependency-injection container was the alternative.
It was rejected as disproportionate: for an application this size the container
would be more code than the wiring it replaces, and the testability argument is
already satisfied by the repository protocols.

## Consequences

Services become the unit of testing, and most of them become testable without
Postgres. The cost is indirection: reading one endpoint now means opening three
files rather than one. That trade is worth making here because the endpoints are
few and the rules behind them are not.
