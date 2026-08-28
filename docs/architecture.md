# Architecture

This describes how the pieces fit and, more usefully, the three places where the
system is stranger than the file tree suggests. The decisions behind the shape
are recorded separately in [`adr/`](adr/); this is the map, not the argument.

## The whole thing at a glance

```mermaid
flowchart TB
    subgraph browser["Browser"]
        features["features/<br/>profile · dashboard · catalogue<br/>recommendations · tour<br/>rule-check · prefill · planner-board"]
        domain["domain/<br/>plan reducer · term rules<br/>layout · filters · prefill"]
        features --> domain
    end

    subgraph api["FastAPI"]
        handlers["api/<br/>handlers and schemas"]
        services["services/<br/>use cases"]
        repos["repositories/<br/>SQL, behind a unit of work"]
        rules["rules/ + curriculum/<br/>compliance checking"]
        recs["recommendations/<br/>six channels"]
        handlers --> services
        services --> repos
        services --> rules
        services --> recs
    end

    db[("PostgreSQL")]

    features -- "REST" --> handlers
    repos --> db
```

## The backend, layer by layer

A handler validates its input, calls exactly one service, and shapes the reply.
It holds no business rules and no SQL. A service holds one use case, decides
whether that use case needs a transaction, and reaches storage through a unit of
work that hands it every repository already bound to one connection. A repository
holds SQL and nothing else.

Services raise errors named for what went wrong: `ProgrammeLocked`,
`StartTermLocked`, `SetupIncomplete`, `UnsupportedProgramme`. One table, in
`app/api/errors.py`, turns those into status codes, and it is the only place in
the application that knows what a status code is.

### Compliance checking

`app/curriculum/bachelor.json` and `master.json` hold the regulations: which
modules exist, what each is worth, which course code belongs to which module,
which courses the bachelor's introductory phase gates. `app/rules/` holds the
checking.

The two programmes have separate rule sets, and that is deliberate rather than
unfinished. Measured line by line the two checkers share four per cent of their
text: the bachelor curriculum has an introductory-phase gate with no counterpart
in the master programme, the master programme has a focus-area dependency
structure with no counterpart in the bachelor, and even normalising a title
differs because the bachelor's titles are German and have to be accent-folded
before they can be matched. What they share is the wire format, the result shape,
the entry point, the shape of a rule set, and the reading of the credit limits.
Both files are organised the same way and read as siblings, which is the property
that actually helps a reader.

### Recommendations

Six channels: interest, similarity, sequence, completed, internship and peer.
Each is an object with a name and one method, composed by an engine. The engine
iterates candidates outer and channels inner, because a course is recommended
once and the first channel to claim it supplies the reason the student is shown.

Two things about it are worth knowing before you trust its output. The knowledge
graph in `knowledge.py` is a prototype fixture whose course codes do not exist in
either catalogue, so against real data the `sequence` and `completed` channels
never fire. And the recommender used to give different answers after every server
restart, because it iterated sets of strings under Python's per-process hash
randomisation; that is fixed, and the golden master would now catch it coming
back.

## The frontend

`src/domain/` is framework-free. It can be imported and exercised without React,
a browser or a network, and it holds the plan reducer, the term and lane rules,
the lane geometry, the graph filters and the three prefill builders. `features/`
holds React: one directory per feature, each a hook or two owning that feature's
state and effects plus the components that render it. `App.jsx` assembles them.

### The plan is a reducer

```
(state, action) -> state
```

No clock, no randomness, no I/O, so a transition can be tested by calling it. A
recorded change carries a monotonic counter rather than a timestamp, because
consumers compare identifiers to tell a stale answer from a current one and a
counter says that better than `Date.now` does.

### The three things that are stranger than they look

**A course's horizontal position is its semester.** The plan and the React Flow
node array are two representations of the same data, kept in sync in both
directions: `nodes-to-plan.ts` derives which semester a course is in from its
`position.x` and its order within that semester from `position.y`, while a
rebuild reconstructs the node graph from the plan on programme switch and first
load. Between them sit four effects that patch node data in place.

**The commit points are inconsistent on purpose.** Some mutations write the plan
immediately and clear a flag; the drag handlers only raise the flag and let an
effect commit a render later. The recorded change is what triggers the rule
check, the recommendations request and the rollback machinery, so changing *when*
it fires produces duplicate checks or spurious rollbacks. This is the single most
delicate thing in the codebase.

**Rollback has to be silent.** When the rule engine refuses a change, the planner
undoes it. Recording that undo as a plan change would ask the rule engine to
check again, whose refusal would roll back again, for ever. The reducer therefore
takes `meta.silent` on the ordinary action, handled in one place. Two further
invariants hold the rest of it together: a per-programme change identifier tells
a stale answer from a current one, and the rollbacks find their nodes by the ids
recorded in the diff, so they must run against the array that diff was taken from
(the hook's `setNodes` input is typed updater-only, so the shape that would let
it capture a stale array does not compile).

## Data

The plan is stored as one JSON document per user rather than as rows per placed
course. The frontend owns the plan's shape and rewrites it whole on every change,
and a normalised schema would buy nothing until something other than the planner
needs to query inside it. The catalogue, by contrast, is fully normalised, and is
served to the frontend from a materialised view that already holds the nested
JSON the interface wants.

Migrations are `YYYYMMDDHHMM_slug.sql`, applied in lexical order, recorded with a
checksum, and forward-only. Sequential numbers were abandoned because two
branches both add the next one and whichever merges second is silently
renumbered. `sql/_ledger.psql` creates the ledger and remaps the old names; it is
not a migration, and it is named `.psql` precisely so the migration scan does not
pick it up.

## What holds it together

The refactor that produced this structure happened after the system had been
evaluated with eleven students, so behaviour had to be preserved exactly. Three
layers of test make that checkable: a golden master over the rule engine and the
recommender, a contract test over every endpoint's status and response shape, and
end-to-end flows over what the study actually observed. See
[`adr/0006`](adr/0006-characterisation-tests-before-refactor.md) for why they
were written before anything was moved.
