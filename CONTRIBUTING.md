# Working on this

## What has to stay green

```bash
cd backend  && pytest                 # 169
cd frontend && npm test               #  97
cd frontend && npm run typecheck
cd frontend && npm run test:e2e       #  16
```

CI runs all four on every push. The end-to-end suite starts its own database and
both servers, so it needs no setup beyond a checkout.

## The one rule that is not obvious

**Behaviour does not change unless a commit says it is changing it.** This
system was evaluated with eleven students, and the thesis reports what they
experienced. A restructuring that quietly alters an answer makes the thesis
wrong, which is a worse failure than a bug.

That is what the golden masters are for. `backend/tests/golden/` holds 36
recorded rule-engine scenarios and 85 recorded recommender scenarios, compared
field by field. If one fails, the change is wrong until proven otherwise. Do not
regenerate a snapshot to make a test pass. Regenerating is a deliberate act with
its own commit, and the commit message has to say which behaviour changed and
why.

## Adding a migration

Name it `YYYYMMDDHHMM_slug.sql`, using the time you write it. Put it in
`backend/sql/`. Do not renumber anything, and do not edit a migration that has
already run: the ledger records a checksum and startup will refuse to continue.
Migrations are forward-only; there are no down-migrations, because one that is
never exercised is not a rollback path.

`backend/sql/_ledger.psql` is not a migration. It creates the ledger and remaps
the old sequential filenames, and it runs before the scan.

## Adding or changing a compliance rule

The curriculum is data, in `backend/app/curriculum/*.json`: modules, credit
weights, course-to-module mappings, thresholds. If the university publishes a new
regulation, that file is usually the only thing that changes.

The checking is code, in `backend/app/rules/`. Each programme has its own rule
set and they are deliberately not shared; see
[`docs/adr/0002`](docs/adr/0002-rule-engine-as-data.md). A new check is a new
private method called from `evaluate` in the programme it applies to, in the
position where its verdict belongs, because the order in which checks run is
observable in the message the student reads.

Then run the golden master. If it fails and the change is intended, add the new
scenario to `build_fixtures.py`, regenerate, and say so in the commit.

## Adding a recommendation channel

Write a module in `backend/app/recommendations/` exporting a class that satisfies
the `Strategy` protocol in `strategy.py`: a `name` that is also its toggle key,
and a `suggest(plan, candidate)` returning the reasons it has. Add it to
`CHANNELS` in `engine.py`, in the position where it should get to claim a course:
a course is recommended once, and the first channel to claim it supplies the
reason the student is shown.

Anything that needs a pass over the whole plan before it can answer does that
work in its constructor; `peer.py` is the example.

## Frontend conventions

New code is TypeScript. The JavaScript that remains is compiled but not
type-checked, so that the migration can proceed file by file without a report
nobody can act on.

`src/domain/` is framework-free and stays that way: no React import, no DOM, no
network. If something needs to know which tab is showing, it is not a domain
module.

A feature under `src/features/` owns its own state and effects in a hook, and
renders through presentational components that take props and call back.
`src/features/profile/` is the smallest complete example.

**Effect order is behaviour.** React runs effects in hook-call order, and several
of this application's effects depend on running before or after others: the three
network fetches have a fixed order, and the planner board's effects are
interleaved with other features' on purpose. Moving a hook call moves an effect.

## Style

Comments explain why, not what. A comment restating the code is worse than none.
British spelling. Prefer a named function to a comment describing a block.

Commit messages say what changed and why, in prose. If a commit preserves
something that looks wrong, the message says so, and so does a comment at the
site.
