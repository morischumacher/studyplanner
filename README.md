# Study Planner

A degree planning tool for TU Wien Informatics students. A student drags courses
from the catalogue into semester lanes, and the planner tells them, as they go,
whether the plan they are building satisfies the curriculum: what is missing,
what is overloaded, what cannot be taken yet.

It supports two programmes, the bachelor in Informatics (033 521) and the master
in Software Engineering (066 937), and it exists because planning a degree at TU
Wien currently means assembling the answer from a PDF curriculum, a course
catalogue, a spreadsheet and a calendar.

This is the software artefact of a diploma thesis. It was evaluated with eleven
students in a within-subjects study; the version they used is tagged
`v1.0-evaluated`.

## Running it

You need Node 20 or newer, Python 3.11 or newer, and PostgreSQL 16. Docker is
optional.

Running the unit tests needs Node 22, which the application itself does not:
jsdom, which the tests that render a hook use, does not run below it. The test
command says so if you are on an older Node.

```bash
# a database, migrated and seeded with both curricula
./scripts/dev-db.sh up
export DATABASE_URL="$(./scripts/dev-db.sh url)"

# the API, on :8000
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload

# the interface, on :5173
cd frontend && npm install && npm run dev
```

The virtual environment is worth the two extra lines. Installing into the
system Python works, but pip will report conflicts with whatever else is
installed there, and those reports are about the other packages rather than
about this one.

`scripts/dev-db.sh` is idempotent: it starts a cluster if one is not already
running, applies whatever migrations are outstanding, and does nothing else. It
uses Docker when the daemon is available and a native PostgreSQL install
otherwise. It also takes `down`, `reset`, `psql` and `url`.

`backend/docker-compose.yml` brings up the database and the API together if you
prefer that.

## The shape of it

```
backend/
  app/
    api/              HTTP: one service call per handler, one error-to-status table
    services/         the use cases
    repositories/     every SQL statement, behind a unit of work
    domain/           the model, and the failures named for what they are
    rules/            compliance checking, one rule set per programme
    curriculum/       the regulations, as data
    recommendations/  six channels behind a strategy protocol
    infrastructure/   the connection pool and the migration ledger
  sql/                migrations, YYYYMMDDHHMM_slug.sql
  tests/              golden masters, contract tests, curriculum and migration tests

frontend/
  src/
    domain/           the plan reducer, term rules, layout, filters. No React.
    features/         profile, dashboard, catalogue, recommendations,
                      tour, rule-check, prefill, planner-board
    components/       the shared presentational pieces
    app/persistence/  loading and saving the plan
  tests/unit/         the domain layer
  tests/e2e/          the flows the evaluation study observed
```

Five documents explain the parts that are not obvious from the tree:

- [`docs/architecture.md`](docs/architecture.md): how a request travels, where
  the plan actually lives, and the three pieces of the frontend that are
  stranger than they look.
- [`docs/thesis-map.md`](docs/thesis-map.md), each of the thirteen features
  derived in the thesis, and the code that implements it.
- [`docs/adr/`](docs/adr/), six records of what was decided and what it was
  decided over.
- [`docs/known-defects.md`](docs/known-defects.md), what the evaluation study
  found and what reading the code found afterwards, and which of them have since
  been fixed.
- [`docs/deploying.md`](docs/deploying.md), the order to deploy the three pieces
  in, and the one of them that cannot be rolled back by redeploying.

## Tests

Three layers, because they catch different things.

```bash
cd backend  && pytest                 # 235
cd frontend && npm test               # 112
cd frontend && npm run test:e2e       #  17
cd frontend && npm run typecheck
```

The backend suite includes a **golden master** for the rule engine: 38 recorded
scenarios whose verdicts are compared field by field, and 85 more for the
recommender. A change that alters an answer fails against the recording rather
than being noticed later, and regenerating a recording is a deliberate act with
its own commit. The **contract tests** pin every endpoint's status code and
response shape on the same principle.

The end-to-end suite drives a real browser against a real API and database, and
covers the loop the study actually watched students perform: read the catalogue,
drop a course into a semester, get told whether it is allowed, park what does not
fit yet.

The Playwright suite starts both servers itself. If you have a Chromium already
installed rather than Playwright's own, point `E2E_CHROMIUM_PATH` at it.

## Contributing

[`CONTRIBUTING.md`](CONTRIBUTING.md) covers the conventions: how to add a
migration, how to add a compliance rule, how to add a recommendation channel,
and what has to stay green.
