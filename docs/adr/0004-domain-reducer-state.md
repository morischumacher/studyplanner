# 0004. Planner state is a pure reducer behind a React adapter

**Status:** Accepted · 2026-08-28

## Context

`App.jsx` holds 207 hooks. Domain logic, view state, server communication and
rendering share one scope, and the only way to test a placement rule is to
render the whole application. Breaking the component up does not by itself fix
this: state scattered across twelve components is harder to reason about than
state scattered across one.

The planner is a state machine. A course is placed, rejected, parked, marked
done; a plan moves between well-defined configurations. The evaluation study
modelled it as exactly that, and the transitions reported in the thesis are the
transitions the application implements.

## Decision

The plan state machine lives in the domain layer as a pure reducer:
`(state, action) -> state`, no React, no network, no side effects. React sees it
through a thin context provider that holds the current state and exposes
`dispatch`. Components read what they render and dispatch what the user did;
they decide nothing.

Effects that must reach the server, such as persisting the plan or asking the
API to check a rule, sit in the adapter rather than the reducer, so the reducer
stays a function of its inputs.

Zustand and Redux Toolkit were both considered. Neither was rejected on
technical grounds; both were rejected because a plain reducer needs no
dependency, is testable by calling it, and maps directly onto the state model
described in the evaluation chapter. A reducer that can be printed in a thesis
is worth more here than one that saves a few lines of boilerplate.

## Consequences

Every transition becomes testable without a browser, which is where most of the
new test coverage will go. The reducer also becomes the single place where
"what can happen to a plan" is written down.

The cost is that context re-renders have to be managed deliberately: state is
split into several contexts rather than one, so that dragging a course does not
re-render the catalogue.
