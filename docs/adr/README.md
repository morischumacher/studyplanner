# Architecture decisions

Each file here records one decision: what was chosen, what it was chosen over,
and what it costs. They are written at the moment the decision is made and are
not revised afterwards; if a decision is reversed, a later record supersedes it
and says so.

The format is deliberately short. A record that takes twenty minutes to write is
a record that does not get written.

| # | Decision | Status |
|---|----------|--------|
| [0001](0001-layered-backend.md) | A layered backend: router, service, repository | Accepted |
| [0002](0002-rule-engine-as-data.md) | The curriculum is data; the rule engine is code | Accepted |
| [0003](0003-typescript-frontend.md) | The frontend moves to TypeScript in full | Accepted |
| [0004](0004-domain-reducer-state.md) | Planner state is a pure reducer behind a React adapter | Accepted |
| [0005](0005-migration-identifiers.md) | Migrations are timestamped and checksummed | Accepted |
| [0006](0006-characterisation-tests-before-refactor.md) | Characterisation tests come before the refactor | Accepted |
