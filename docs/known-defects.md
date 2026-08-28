# Known defects

Two lists, kept apart because they were found in different ways and answer
different questions.

The first came out of the evaluation study: eleven students planning a degree,
their sessions coded against a usability codebook, severity rated on Nielsen's
scale. Those are defects in what the tool does for a student.

The second came out of reading the code during the architectural refactor. Most
of them are invisible to a user until the day they are not. None of them was
fixed while restructuring, because a restructuring that quietly changes an answer
makes the thesis wrong; they are recorded here to be fixed deliberately, on their
own branch, each with a regression test.

## From the evaluation study

Severity is 0 to 4 in the usual scale; frequency is the participants for whom the
problem could be decided. Full definitions and the per-participant matrix are in
the thesis appendix.

| Code | Problem | Sev. | Freq. |
|------|---------|:----:|:-----:|
| E-P04 | Table and catalogue lack the graph's filters | 3 | 11/11 |
| E-P05 | Placement feedback arrives only after the drop | 2 | 11/11 |
| E-P10 | Requirement status behind collapsible panels | 2 | 11/11 |
| E-P29 | Winter and summer offering not glanceable | 2-3 | 11/11 |
| E-P09 | Setup defaults to the wrong programme | 2 | 11/11 |
| E-P32 | Workload warning driven by the profile, not the task band | 2 | 11/11 |
| E-P25 | Reduced-load semester has no affordance | 2 | 11/11 |
| E-P26 | Workload band not enforced | 3 | 11/11 |
| E-P34 | Completion signalled over an incomplete constraint set | 3 | 11/11 |
| E-P53 | Placement menus omit and invent semesters | 2 | 11/11 |
| E-P57 | Workload target ignores the task band | 3 | 11/11 |
| E-P38 | Parking silently removed from totals and counts | 2 | 10/11 |
| E-P35 | Lower workload bound only advisory | 3 | 10/11 |
| E-P27 | Study wording leaks into the profile UI | 1 | 10/11 |
| E-P47 | Graph carries no semester dimension | 3 | 10/10 |
| E-P48 | Module ECTS selector rewrites the plan total | 3 | 10/10 |
| E-P17 | Adding a semester not discoverable | 2 | 9/11 |
| E-P14 | Onboarding tour drives the early session | 1 | 9/11 |
| E-P37 | Parking stage not visible inside the graph | 2 | 9/11 |
| E-P50 | Toast semantics unreliable | 2 | 9/9 |
| E-P02 | Totals and remaining ECTS not glanceable | 2 | 8/11 |
| E-P49 | Dashboard contradicts itself | 3 | 8/8 |
| E-P03 | Requirement status stated only in prose | 2 | 7/11 |
| E-P16 | Retuning the cap destabilises the plan | 3 | 7/11 |
| E-P01 | Curriculum and elective terminology unclear | 3 | 4/11 |
| E-P44 | Prerequisites validated but never shown | 2 | 4/11 |

Two of these cut across the whole loop rather than sitting at one stage. The
account setup defaulted to the wrong degree programme for every participant
(E-P09), and rejection and confirmation banners share one visual style, so their
meaning was not recoverable from their appearance (E-P50 and E-P54; the code
recording banners as unambiguous stands at 0/11).

## Found by reading the code

Ordered by what they cost, not by where they live.

### Data loss and wrong answers

**Every planner save drops every other programme's dashboard state.**
`buildPersistSnapshot` spreads `snapshot.dashboardUiByProgram`, but the plan
snapshot has no such field, so the spread is always over nothing. Invisible
within a session, because the other programmes are still held in memory; visible
after a reload. `frontend/src/App.jsx`.

**A course object with no code is parked under the literal string "undefined".**
`String(isObject ? item?.code : item || "").trim()` parses as
`isObject ? item?.code : (item || "")`, so the empty-string default never applies
to the object branch, and the `if (!code) continue` guard passes.
`frontend/src/features/planner-board/useCoursePlacement.ts`.

**A refused move can reposition the wrong copy of a course.**
`rollbackMovedCourses` falls back from node id to course code, which undoes the
diff's deliberate matching by id, and a plan holding the same course twice has
the wrong instance moved back.
`frontend/src/features/rule-check/useRuleCheckRollbacks.ts`.

**The master prefill can place an unrelated course.** `findBestCourse` starts its
best score at `-1` and has no "score must be positive" guard, unlike the bachelor
version, so a score of zero wins and an unmatched alias silently takes the first
unused catalogue entry. `missingAliases` therefore never fills for the master
programme. `frontend/src/domain/prefill/master-plan.ts`.

**Accepting the master prefill after changing the start season can lay it out for
the previous season.** The applier passes `startTermSeason` to the builder but
omits it from its dependency array; the bachelor applier lists it.
`frontend/src/features/prefill/usePrefilledPlans.ts`.

**A missing or unparseable credit value raises out of the bachelor rule engine
rather than being reported.** The introductory-phase checks run over the raw
payload rather than the validated courses, so `_to_float` throws and the request
becomes a 500 instead of `rejected: invalid ects`.
`backend/app/rules/bachelor.py`.

### Recommendations

**Two of the six channels can never fire against real data.** None of the course
codes in the knowledge graph exists in either catalogue, so `sequence` and
`completed` have no input. Four channels were live during the evaluation, not
six. `backend/app/recommendations/knowledge.py`.

**The candidate query has no `ORDER BY`.** The recommender's output depends on
candidate order, so results can shift with whatever row order PostgreSQL happens
to return. Distinct from the hash-ordering non-determinism, which is fixed.
`backend/app/repositories/catalog.py`.

**Set iteration still reaches two evidence strings.** Where several planned or
finished courses would each justify the same candidate, which one the evidence
names is not fixed. Latent: the current corpus never has a candidate claimed
twice. `backend/app/recommendations/sequence.py`, `completed.py`.

**A rule-check failure is read as "this recommendation is fine".** Bare
`except BaseException` around the filter, which also swallows `KeyboardInterrupt`
and `SystemExit`. `backend/app/recommendations/rules.py`.

**The synthetic peer cohort is unbounded module-level mutable state**, keyed by
programme code, never evicted, shared across requests.
`backend/app/recommendations/knowledge.py`.

### Curriculum data

**Six bachelor courses map to a module that was never defined**, so their module
kind falls back to a default: AM, AVP, CMUS, CMP, FP, LPC. Pinned by
`backend/tests/curriculum/test_curriculum_documents.py` rather than fixed.

**Four curriculum numbers are still literals in the checker** rather than in the
curriculum document: the introductory-phase pool minimum, the pre-phase
allowance, and the phase tags. `backend/app/rules/bachelor.py`.

**A wording mismatch between two references to the same course**, "Mathematisches
Arbeiten 1" where the matcher uses "Mathematisches Arbeiten". Cosmetic but
observable in a missing-requirement message.

### Display

**`displayModuleHeader`'s last fallback returns a module code where it means to
return a module name.** It passed a second argument to a one-parameter function,
so the name was silently discarded. `frontend/src/domain/course-names.ts`.

**An explicit teaching format on a drag payload is ignored.** The drop handler
writes `type`; the placement function reads `courseType`. The format is always
re-derived from the catalogue instead.
`frontend/src/features/planner-board/`.

**The introductory-phase and focus checklists share one expanded flag across both
dashboard tabs**, so a checklist opened on the planned tab is open on the done
tab. `frontend/src/features/dashboard/`.

### Duplicated and stale feedback

**The same category warning can appear twice**, because the pre-phase check
re-derives the canonical category for courses the totals pass already processed.
It is in the recorded snapshots, so it is pinned behaviour.
`backend/app/rules/bachelor.py`.

**Checks skip inconsistently after an error.** The semester-load check returns
early when an error already exists; everything after it runs regardless, so a
plan with a missing course code silently loses its overload report.
`backend/app/rules/bachelor.py`.

**A refused recommendation toggle stays switched.** The write is optimistic and
the mirror is never put back on failure, so the switch is wrong until the profile
is fetched again. `frontend/src/features/recommendations/`.

### Latent and dead

- The graph filter engine's ancestor walk keeps no visited set and would loop for
  ever on a cycle. Unreachable from the current graph builder.
  `frontend/src/domain/filters.ts`.
- Two profile save functions are called from nowhere.
- `rightPanelTab` is declared, never read, never persisted.
- The onboarding tour writes an unsuffixed `localStorage` key that nothing reads.
- Per-module done and planned totals are computed, adjusted for the transferable
  skills cap, and then discarded; `per_course_module_title` is written and never
  read. `backend/app/rules/bachelor.py`.
- `compactPrefillLayout` takes a maximum semester count and has never used it.
- Several dependency arrays are incomplete: the placement and module-placement
  callbacks, the canvas rebuild, and the planner-state load. All are harmless
  today only because of what happens to be stable.

## Fixed during the refactor

Two, both because leaving them would have made the work unverifiable.

**The recommender gave different answers after every server restart.** It
iterated sets of strings under Python's per-process hash randomisation in four
places, including the synthetic peer cohort, whose seeding comment promised the
opposite. Without determinism there was nothing stable to record, so the
recommender could not be characterised at all.

**A `Decimal` was serialised as a string on the recommendations endpoint.**
Introduced during the layering, by annotating a handler's return type: FastAPI
builds a response model from the annotation. Caught by the contract test in the
same commit.
