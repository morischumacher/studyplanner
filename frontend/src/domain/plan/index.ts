/**
 * The plan state machine and the values it is made of.
 *
 * The reducer is the whole of it: everything else here either builds a value it
 * is given or reads one it produced. Nothing in this folder touches React, a
 * clock, or the network, so a transition is tested by calling it.
 */

export { plannerReducer } from "./reducer.ts";

export type {
    ActionMeta,
    PlanAction,
    Update,
} from "./actions.ts";

export {
    DEFAULT_GRAPH_FILTERS,
    DEFAULT_PROGRAM_CODE,
    DEFAULT_SEMESTER_LOAD_LIMITS,
    EMPTY_COURSE_META,
    EMPTY_COURSE_META_BY_CODE,
    EMPTY_DONE_CODES,
    EMPTY_GRAPH_VIEW_STATE,
    EMPTY_PARKED_CODES,
    EMPTY_SEMESTER_NOTES,
    emptyProgrammePlan,
    initialPlannerState,
    programmePlan,
    sharedEmptyCoursesBySemester,
} from "./state.ts";
export type {
    CourseMeta,
    CoursesBySemester,
    GraphViewState,
    PlanChange,
    PlanChangeBody,
    PlanCourse,
    PlanCourseInSemester,
    PlannerState,
    ProgrammePlan,
    SemesterLoadLimits,
} from "./state.ts";

export { diffPlannedCourses, laneIndexOrNull } from "./diff.ts";
export type { AddedCourse, MovedCourse, PlanDiff, RemovedCourse, UpdatedCourse } from "./diff.ts";

export { buildCoursesOnlyFromNodes } from "./nodes-to-plan.ts";
export type { PlanFromNodes } from "./nodes-to-plan.ts";

export {
    asRecord,
    sanitizeCourseMetaEntry,
    sanitizeGraphFilters,
    sanitizeSemesterLoadLimits,
} from "./sanitizers.ts";

export {
    emptyCoursesOnlyPlan,
    flattenBySemester,
    normalizeBySemesterMap,
    numericSemesterIds,
} from "./semesters.ts";

export {
    normalizeStoredGraphView,
    plannerStateFromSnapshot,
    sanitizeCourseMetaByProgram,
    sanitizeParkedByProgram,
    sanitizeSemesterNotesByProgram,
    snapshotFromPlannerState,
} from "./snapshot.ts";
export type { PlannerStateSnapshot } from "./snapshot.ts";
