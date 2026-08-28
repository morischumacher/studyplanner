# Deploying

The tool runs as three hosted pieces: the client on Vercel, the API on Render,
and the database on Neon. They can be updated independently, which is what makes
a careful deployment possible and a careless one confusing.

## What is actually at risk

Most of a deployment is boring. Two things are not.

**The database is the only piece that cannot be rolled back by redeploying.**
The API applies outstanding migrations on start-up, and the first start-up of a
newer API also renames the ledger rows that record which migrations have run,
because migrations are now identified by the time they were written rather than
by a sequence number. That rename is idempotent and it re-runs nothing, but it
writes to the database, and the database holds the evaluation study's data.
Everything else here follows from that.

**The client and the API must agree about the plan document.** The document is
stored whole, per user, and both sides read it. A client newer than its API is
usually fine, because the document's shape has not changed; the risk is not the
shape but the assumption, so it is checked by a test
(`frontend/tests/unit/legacy-document.test.ts`) that reads a document in exactly
the form already stored for every participant.

## The order that keeps both safe

### 1. Take a backup you have restored from

Neon's point-in-time restore covers this, but a backup nobody has restored is a
belief rather than a plan. Create a branch of the production database, and use
that branch for step 2. If step 2 goes well, the branch has cost nothing; if it
does not, the branch is the evidence of what went wrong and production was never
touched.

### 2. Run the new API locally against a branch of the real database

This is the step that matters, and it is worth doing even though the test suite
is green. The tests run against a database built from the migrations. Your
production database has been through a year of development and holds real plans,
real accounts, and the study's records. Only it can tell you whether the ledger
rename lands cleanly on your data.

```bash
export DATABASE_URL="<the Neon branch connection string>"
cd backend && uvicorn app.main:app
```

Watch the start-up output. What you want to see is the eleven migrations
reported as already applied and nothing re-run. What would tell you to stop is a
migration being applied, which would mean the rename did not match, or a report
that a migration has been edited since it ran.

Then point a local client at it and open a plan that already exists:

```bash
cd frontend && VITE_API_BASE=http://127.0.0.1:8000 npm run dev
```

The question this answers is the only one the automated tests cannot: does *your*
saved plan, with its parked courses, its notes and its marks, come back the way
you left it.

### 3. Deploy the API before the client

The client is the more visible piece and the more tempting one to deploy first,
which is the wrong order. A new client against an old API can ask for behaviour
the API does not have. An old client against a new API asks for what it always
did, and gets it, because the wire format is pinned by a contract test.

Deploy the API to Render, watch the same start-up output as in step 2, and check
that the tool still works from the currently deployed client before going on.
That interval, new API and old client, is a valid state you can sit in.

### 4. Deploy the client

Vercel builds a preview for every branch. Open the preview against the
production API and walk the planning loop once by hand before promoting it. The
end-to-end tests do this too, but they do it against a database with nothing in
it, and the interesting failures involve data that has been accumulating.

## Rolling back

The client rolls back by promoting the previous Vercel deployment, which is
immediate.

The API rolls back by redeploying the previous commit. An older API against a
renamed ledger will not re-run anything, because it looks up migrations by
filename and finds no file matching the old names; it simply applies nothing.
That is safe, though it means an older API cannot apply a migration until the
rename is undone, which is a `UPDATE migration_history SET filename = ...` away
and recorded in `backend/sql/_ledger.psql`.

The database does not roll back by redeploying anything, which is why step 1
exists.

## What a deployment does not need

No new environment variables. `DATABASE_URL` and `CORS_ORIGIN` are what they
were. The migrations directory is now resolved relative to the backend package
rather than the working directory, which makes the API start correctly wherever
it is launched from, so `MIGRATIONS_DIR` can stay unset.

The client is TypeScript now, and the production build does not type-check; that
happens in CI, which is the right place for it. A Vercel build behaves as it did.
