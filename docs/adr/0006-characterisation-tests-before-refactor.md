# 0006. Characterisation tests come before the refactor

**Status:** Accepted · 2026-08-28

## Context

The application was evaluated with eleven students before this refactor began.
The results of that study are only meaningful if the system the thesis describes
and the system that was evaluated behave identically. The refactor is therefore
constrained in an unusual way: the structure may change completely, but the
behaviour may not change at all, except where a change fixes a defect the study
itself recorded.

The codebase had no tests when the refactor started.

## Decision

Record the existing behaviour before changing anything, and treat the recording
as the specification. Three layers of it:

- **A golden master for the rule engine.** 36 scenarios covering both
  programmes, their verdicts recorded exactly and compared field by field. The
  corpus is guarded against degeneracy: if fewer than half the scenarios produce
  distinct answers, the build fails, because a corpus where every case returns
  the same rejection proves nothing.
- **A contract test for the HTTP surface.** Every endpoint's status code and
  response *shape* is recorded. Volatile values such as identifiers and
  timestamps are replaced by markers before comparison, so the assertion is
  about what a client depends on rather than about a particular run.
- **End-to-end tests over the observed flows.** The loop the study watched
  students perform, driven through a real browser against a real API and
  database.

The commit that introduced these tests is tagged `v1.0-evaluated`. That tag is
the version the evaluation chapter describes.

## Consequences

Every subsequent refactoring commit has something to be wrong against. A change
that alters a verdict, a response shape or a flow fails immediately and names
what it broke, rather than surfacing weeks later as a discrepancy between the
thesis and the software.

The cost was several days spent writing tests for code that was not going to
survive. That is the correct order regardless: the tests describe behaviour, and
the behaviour is what survives.
