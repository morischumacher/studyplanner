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

**Every planner save drops every other programme's dashboard state.** Fixed.
The state of the programmes not on screen already existed in the dashboard hook;
it was simply never handed to the save. The stored document's shape is unchanged,
so a plan saved before the fix still loads.

**A course object with no code is parked under the literal string "undefined".**
Fixed. The ternary now sits inside the parentheses, so the empty-string default
applies to both branches and the guard catches it.

**A refused move can reposition the wrong copy of a course.** Fixed. The
fallback from node id to course code is gone: every entry the diff emits carries
the id the canvas gave it, ids survive every placement and rebuild the board
does, and the rollback searches the array those ids came from.

**The master prefill can place an unrelated course.** Fixed. A score of zero is
now skipped, as the bachelor matcher already did, so an unmatched alias is
reported rather than filled.

**Accepting the master prefill after changing the start season can lay it out for
the previous season.** Fixed. The start season is in the applier's dependencies,
as it already was in the bachelor one.

**A missing or unparseable credit value raises out of the bachelor rule engine
rather than being reported.** Fixed. The totals pass already reported such a
course and then skipped it, so it now also records which courses survived
parsing, and every later pass reads that list instead of the payload. A course
the checker could not read plays no further part, which is what its own
docstring already promised.

### Recommendations

**Two of the six channels can never fire against real data.** Fixed, and worth
reading twice, because it changes how the evaluation should be read: **four
channels were live during the study, not six.** The hand-written knowledge graph
named courses that exist in neither catalogue. The sequence channel now reads the
curriculum's own ordering, which is also what the compliance engine checks, and
the completed channel derives its co-occurrence from the same deterministic
synthetic cohort the peer channel builds, so both match on real codes. The
knowledge graph is gone.

**The candidate query has no `ORDER BY`.** The recommender's output depends on
candidate order, so results can shift with whatever row order PostgreSQL happens
to return. Distinct from the hash-ordering non-determinism, which is fixed.
`backend/app/repositories/catalog.py`.

**Set iteration still reaches an evidence string.** Where several finished
courses would each justify the same candidate, which share the evidence quotes
was not fixed. Resolved for `sequence.py`, which now iterates the curriculum's
ordering rather than the plan's sets, and settled in `completed.py` by ranking on
the share. Latent elsewhere in the same class.

**A rule-check failure is read as "this recommendation is fine".** Bare
`except BaseException` around the filter, which also swallows `KeyboardInterrupt`
and `SystemExit`. `backend/app/recommendations/rules.py`.

**The synthetic peer cohort is unbounded module-level mutable state**, keyed by
programme code, never evicted, shared across requests.
`backend/app/recommendations/peer.py`.

### Found while fixing the above

**A candidate is offered to the rule checker in a semester past every one the
student uses.** A course recommended *because a planned course needs it first* is
therefore judged as arriving after the course that needs it. The master's
prerequisites are hard, so the filter refuses it and the student sees nothing;
the bachelor's ordering is advisory and survives only because the check returns
early when the plan is acceptable and never compares warnings in that case. Both
outcomes are now recorded in the corpus. `backend/app/recommendations/rules.py`.

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
