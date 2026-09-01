# 0005. Migrations are timestamped and checksummed

**Status:** Accepted · 2026-08-28

## Context

Schema changes are plain SQL files applied in lexical order and recorded in a
`migration_history` table keyed by filename. The files are numbered `001` to
`011`.

Two problems follow from that scheme. Sequential numbers collide: two branches
both add `012`, and whichever merges second is silently renumbered or silently
skipped. And the ledger records only that a filename ran, not what it contained,
so a migration edited after it was applied leaves no trace anywhere.

## Decision

Identify a migration by the time it was written: `YYYYMMDDHHMM_slug.sql`. Two
people cannot produce the same identifier by accident, and lexical order remains
chronological order.

Record a checksum with each applied migration. On startup the ledger is verified
against the files on disk, and a mismatch is reported rather than ignored: an
already-applied migration whose content has changed means the database and the
repository disagree about the schema.

Migrations remain forward-only. There are no down-migrations, because a
down-migration that is never exercised is not a rollback path, it is an
untested claim.

Alembic was the alternative. It was rejected because the application uses
asyncpg directly rather than an ORM, and Alembic's value is largely in
autogenerating migrations from ORM models that do not exist here.

## Consequences

The existing eleven files are renamed, and a one-time remap rewrites the
matching `migration_history` rows so that databases already carrying data,
including the one holding the evaluation study's records, are not re-migrated.
That remap is itself a migration and runs before the ledger check.
