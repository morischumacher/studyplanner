# 0003. The frontend moves to TypeScript in full

**Status:** Accepted · 2026-08-28

## Context

The frontend is about 13,000 lines of JavaScript, 6,664 of them in a single
component. Its central data structure is a plan: semesters holding courses,
each with a status, a term availability, a credit weight and a category. That
structure is passed through dozens of functions, and nothing anywhere states its
shape. The end-to-end suite found this the hard way: the first attempt at unit
tests for the filter engine failed six times over because the node shape had to
be inferred from reading the implementation.

## Decision

Migrate everything to TypeScript, not only the new code.

The migration runs incrementally with `allowJs` enabled, so the build stays
green while files move one at a time. The domain layer is typed first, because
that is where the types carry the most information, and the components follow.

A partial migration was the alternative: types for the domain layer, JSDoc for
the rest. It was rejected because the seam would be visible in the repository
and would invite exactly the question it was meant to avoid.

## Consequences

The plan structure becomes stated rather than implied, and the compiler catches
the class of error that made the refactor risky in the first place: a field
renamed in one place and read under the old name somewhere else.

The cost is time, and it is the largest single cost in the refactor. It is
affordable only because the characterisation tests came first: the migration is
mechanical, and a mechanical change is safe exactly when there is something to
verify it against.
