# 0002. The curriculum is data; the rule engine is code

**Status:** Accepted · 2026-08-28

## Context

Compliance checking lives in two classes, `rule_checker_bachelor` and
`rule_checker_master`, together 2,220 lines. They are not duplicates of each
other: measured line by line they share four per cent of their text and four
method names. They are two independent implementations of the same idea, and
they have drifted into different shapes.

The master checker is the better of the two. Its `evaluate` is sixty lines that
dispatch to named checks: duplicates, semester load, module consistency,
prerequisites, sequencing, core dependencies. The bachelor checker has no such
decomposition. Its constructor is roughly 390 lines of curriculum written as
Python statements, and its `evaluate` is a single 550-line method built from
nested closures.

Two properties are tangled together in both files: *what the curriculum says*
(which modules exist, how many credits each needs, what depends on what) and
*what a rule does* (compare planned credits against a ceiling, look for a
prerequisite in an earlier semester). The first is data that changes when the
university publishes new regulations. The second is code that almost never
changes.

## Decision

Separate them.

- **`app/curriculum/`** holds each programme's regulations as data, loaded and
  validated at startup. Adding a programme, or tracking a curriculum revision,
  becomes an editing task rather than a programming task.
- **`app/rules/`** holds the engine. A rule is a small object with one method,
  taking a plan and the curriculum and returning verdicts. The engine runs a
  rule set and assembles the result.

The two programmes keep their own rule sets, and this is deliberate. The
bachelor curriculum has an introductory-phase gate with no counterpart in the
master programme, and the master programme has a focus-area dependency structure
with no counterpart in the bachelor. Forcing both through one pipeline would
mean encoding each programme's exceptions as conditionals inside shared rules,
which is how the current bachelor checker came to look the way it does. The
engine and the rule vocabulary are shared; the composition is per programme.

## Consequences

The largest and least structured part of the backend becomes the part with the
clearest shape. Each rule becomes independently testable, and a violation can be
traced to one named rule rather than to a position inside a 550-line method.

The risk is that the rewritten engine answers differently from the old checkers.
That is what the golden master in `backend/tests/golden/` exists to prevent: 36
recorded scenarios, compared exactly, that must produce byte-identical verdicts
before and after. Any difference is a defect unless it is a defect being fixed
deliberately, in which case the snapshot is regenerated in its own commit.
