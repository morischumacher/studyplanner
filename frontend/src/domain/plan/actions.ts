/**
 * Everything that can happen to a plan.
 *
 * An action names the transition the student made, not the field it lands in,
 * so that the reducer reads as the state machine the evaluation described.
 *
 * A payload may be a function of the current value, as React's own setters
 * accept. That is not a convenience: an update queued in a batch is applied to
 * the value the update before it produced, and a caller that read the current
 * value itself would overwrite everything queued alongside it.
 */

import type { PlanNode } from "../types.ts";
import type { CourseMeta, GraphViewState, SemesterLoadLimits } from "./state.ts";

/** A next value, or a function from the current one to it. */
export type Update<T, R = T> = R | ((current: T) => R);

export interface ActionMeta {
    /** Applies the transition without recording it as a change. */
    silent?: boolean | undefined;
}

interface ActionBase {
    meta?: ActionMeta | undefined;
}

export interface ProgrammeSelected extends ActionBase {
    type: "programme/selected";
    programCode: string;
}

/** The canvas was edited, and the plan is read back off it whole. */
export interface PlanReplacedFromNodes extends ActionBase {
    type: "plan/replacedFromNodes";
    nodes: readonly PlanNode[] | null | undefined;
}

export interface CourseDoneChanged extends ActionBase {
    type: "course/doneChanged";
    courseCode: string;
    done: boolean;
}

export interface CoursesDoneChanged extends ActionBase {
    type: "courses/doneChanged";
    courseCodes: readonly string[] | null | undefined;
    done: boolean;
}

export interface CourseMetaChanged extends ActionBase {
    type: "course/metaChanged";
    courseCode: string;
    patch: Update<CourseMeta, Partial<CourseMeta> | null | undefined>;
}

export interface SemesterNoteChanged extends ActionBase {
    type: "semester/noteChanged";
    semesterId: number;
    note: string;
}

export interface FocusSelected extends ActionBase {
    type: "focus/selected";
    focus: string;
}

/** A focus chosen for a programme other than the one on screen. */
export interface FocusSelectedForProgramme extends ActionBase {
    type: "focus/selectedForProgramme";
    programmeCode: string;
    focus: string;
}

export interface LoadLimitsChanged extends ActionBase {
    type: "loadLimits/changed";
    patch: Update<SemesterLoadLimits, Partial<SemesterLoadLimits> | null | undefined>;
}

export interface GraphViewChanged extends ActionBase {
    type: "graphView/changed";
    patch: Update<GraphViewState, Partial<GraphViewState> | null | undefined>;
}

export interface PlanImported extends ActionBase {
    type: "plan/imported";
    snapshot: unknown;
}

export interface PlanCleared extends ActionBase {
    type: "plan/cleared";
}

export type PlanAction =
    | ProgrammeSelected
    | PlanReplacedFromNodes
    | CourseDoneChanged
    | CoursesDoneChanged
    | CourseMetaChanged
    | SemesterNoteChanged
    | FocusSelected
    | FocusSelectedForProgramme
    | LoadLimitsChanged
    | GraphViewChanged
    | PlanImported
    | PlanCleared;
