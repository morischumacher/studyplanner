/**
 * The planner's state: one plan per programme, and the last change it made.
 *
 * A plan is kept for every programme the student has opened rather than being
 * swapped out when they switch, so a master plan survives a detour into the
 * bachelor curriculum and back.
 *
 * The empty values below are shared rather than built on demand. An absent plan
 * is read on every render, and handing out a fresh empty object each time would
 * look like a change to everything downstream that compares by identity.
 */

import type { GraphFilters } from "../filters.ts";
import { semesterBoundsForProgram } from "../terms.ts";
import type { CourseModuleMeta, Point } from "../types.ts";
import type { PlanDiff } from "./diff.ts";
import { emptyCoursesOnlyPlan } from "./semesters.ts";

/** The programme a fresh planner starts on, and the one it returns to. */
export const DEFAULT_PROGRAM_CODE = "066 937";

/**
 * A course as a plan stores it.
 *
 * This is not `PlannedCourse` from `../types.ts`. That one is what a prefill
 * template produces and carries its semester with it, while a plan course is
 * found by the semester it is filed under and remembers where its card sits.
 */
export interface PlanCourse {
    id: string;
    code: string | null;
    name: string | null;
    /** Teaching format such as "VU". */
    type: string | null;
    ects: number | null;
    category: string;
    examSubject: string | null;
    position: Point;
    laneIndex: number;
    subjectColor: string | null;
    module: CourseModuleMeta | null;
}

/** A plan course together with the semester it was filed under. */
export interface PlanCourseInSemester extends PlanCourse {
    semesterId: number;
}

/** A plan: one-based semester numbers to the courses placed in them. */
export type CoursesBySemester = Record<number, PlanCourse[]>;

/** What the student records about a course beyond where they put it. */
export interface CourseMeta {
    notes: string;
    /** Kept as typed, so that a half-written number survives a re-render. */
    estimatedHours: string;
    /** Austrian marks run from 1 to 5; anything above 5 is stored as "5". */
    grade: string;
}

export interface SemesterLoadLimits {
    maxEctsPerSemester: number;
    recommendedEctsPerSemester: number;
    maxWeekHoursPerSemester: number;
    recommendedWeekHoursPerSemester: number;
}

/** What the curriculum graph remembers between visits. */
export interface GraphViewState {
    collapsedIds: string[] | null;
    nodePosById: Record<string, Point>;
    filters: GraphFilters;
    /**
     * Whether the student has touched the filters. Until they have, the graph
     * is free to pick defaults that suit the programme.
     */
    filtersConfigured: boolean;
    /** Superseded by `nodePosById`, and still found in stored plans. */
    nodeXById?: Record<string, number> | undefined;
}

/** Everything the planner holds for one programme. */
export interface ProgrammePlan {
    coursesBySemester: CoursesBySemester;
    doneCourseCodes: string[];
    parkedCourseCodes: string[];
    courseMetaByCode: Record<string, CourseMeta>;
    semesterNotes: Record<number, string>;
    selectedFocus: string;
    loadLimits: SemesterLoadLimits;
    graphView: GraphViewState;
}

export type PlanUpdatedChange = PlanDiff;

export interface CourseStatusChange {
    type: "course_status_toggled";
    courseCode: string;
    toStatus: "done" | "in_plan";
    laneIndex: number | null;
    semesterId: number | null;
    semesterNumber: number | null;
}

export interface CoursesStatusChange {
    type: "course_status_toggled";
    courseCodes: string[];
    toStatus: "done" | "in_plan";
}

export interface FocusChange {
    type: "focus_updated";
    selectedFocus: string | null;
}

export interface LoadLimitsChange extends SemesterLoadLimits {
    type: "semester_load_limits_updated";
}

/** A transition worth telling the rule checker and the recommender about. */
export type PlanChangeBody =
    | PlanUpdatedChange
    | CourseStatusChange
    | CoursesStatusChange
    | FocusChange
    | LoadLimitsChange;

/**
 * A change, with the identifier its consumers compare. They use it for identity
 * and for staleness only, never as a time.
 */
export type PlanChange = PlanChangeBody & { id: number };

export interface PlannerState {
    programCode: string;
    byProgramme: Record<string, ProgrammePlan>;
    lastChange: PlanChange | null;
    /** Monotonic, and the source of every `lastChange.id`. */
    changeCounter: number;
}

export const EMPTY_DONE_CODES: string[] = [];
export const EMPTY_PARKED_CODES: string[] = [];
export const EMPTY_COURSE_META_BY_CODE: Record<string, CourseMeta> = {};
export const EMPTY_SEMESTER_NOTES: Record<number, string> = {};

export const DEFAULT_GRAPH_FILTERS: GraphFilters = {
    obligationTypes: [],
    ectsRange: null,
    courseTypes: [],
    examSubjects: [],
    progressStates: ["todo", "in_plan", "done"],
    termAvailabilities: ["summer", "winter", "both"],
};

export const EMPTY_GRAPH_VIEW_STATE: GraphViewState = {
    collapsedIds: null,
    nodePosById: {},
    filters: DEFAULT_GRAPH_FILTERS,
    filtersConfigured: false,
};

export const DEFAULT_SEMESTER_LOAD_LIMITS: SemesterLoadLimits = {
    maxEctsPerSemester: 42,
    recommendedEctsPerSemester: 30,
    maxWeekHoursPerSemester: 50,
    recommendedWeekHoursPerSemester: 40,
};

export const EMPTY_COURSE_META: CourseMeta = Object.freeze({
    notes: "",
    estimatedHours: "",
    grade: "",
});

const emptyPlansByMinCount = new Map<number, CoursesBySemester>();

/**
 * The plan a programme with nothing in it reads as. One instance per semester
 * count, because this is what the adapter hands to the view when no plan has
 * been made yet, and its identity has to survive re-renders. Anything that
 * fills a plan in builds its own with `emptyCoursesOnlyPlan`.
 */
export function sharedEmptyCoursesBySemester(minCount: number): CoursesBySemester {
    const existing = emptyPlansByMinCount.get(minCount);
    if (existing) return existing;
    const created = emptyCoursesOnlyPlan(minCount);
    emptyPlansByMinCount.set(minCount, created);
    return created;
}

/** A programme with nothing recorded for it yet. */
export function emptyProgrammePlan(programmeCode: string): ProgrammePlan {
    const bounds = semesterBoundsForProgram(programmeCode);
    return {
        coursesBySemester: sharedEmptyCoursesBySemester(bounds.min),
        doneCourseCodes: EMPTY_DONE_CODES,
        parkedCourseCodes: EMPTY_PARKED_CODES,
        courseMetaByCode: EMPTY_COURSE_META_BY_CODE,
        semesterNotes: EMPTY_SEMESTER_NOTES,
        selectedFocus: "",
        loadLimits: DEFAULT_SEMESTER_LOAD_LIMITS,
        graphView: EMPTY_GRAPH_VIEW_STATE,
    };
}

/** The plan held for a programme, or the empty one it would start from. */
export function programmePlan(state: PlannerState, programmeCode: string): ProgrammePlan {
    return state.byProgramme[programmeCode] ?? emptyProgrammePlan(programmeCode);
}

export function initialPlannerState(initialProgramCode?: string | null): PlannerState {
    const trimmed = String(initialProgramCode ?? "").trim();
    return {
        programCode: trimmed || DEFAULT_PROGRAM_CODE,
        byProgramme: {},
        lastChange: null,
        changeCounter: 0,
    };
}
