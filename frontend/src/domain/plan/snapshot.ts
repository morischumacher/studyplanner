/**
 * The document the plan is stored as, and the way back into planner state.
 *
 * The stored document is keyed the other way round from the state: one map per
 * kind of thing, each keyed by programme. That is the shape already on the
 * server for every user of the study, so it is read and written as it stands
 * rather than migrated.
 *
 * A programme is present in the state if any of those maps mentions it, since
 * a student who has only ticked courses off in a programme still has a plan
 * there worth keeping.
 */

import { semesterBoundsForProgram } from "../terms.ts";
import type { Point } from "../types.ts";
import { asRecord, sanitizeCourseMetaEntry, sanitizeGraphFilters, sanitizeSemesterLoadLimits } from "./sanitizers.ts";
import { normalizeBySemesterMap } from "./semesters.ts";
import {
    emptyProgrammePlan,
    type CourseMeta,
    type CoursesBySemester,
    type GraphViewState,
    type PlannerState,
    type ProgrammePlan,
    type SemesterLoadLimits,
} from "./state.ts";

export interface PlannerStateSnapshot {
    version: number;
    programCode: string;
    coursesByProgram: Record<string, CoursesBySemester>;
    doneByProgram: Record<string, string[]>;
    parkedByProgram: Record<string, string[]>;
    courseMetaByProgram: Record<string, Record<string, CourseMeta>>;
    semesterNotesByProgram: Record<string, Record<number, string>>;
    selectedFocusByProgram: Record<string, string>;
    graphViewByProgram: Record<string, GraphViewState>;
    semesterLoadLimitsByProgram: Record<string, SemesterLoadLimits>;
}

export function sanitizeCourseMetaByProgram(value: unknown): Record<string, Record<string, CourseMeta>> {
    const source = asRecord(value);
    const normalized: Record<string, Record<string, CourseMeta>> = {};
    for (const [program, byCourse] of Object.entries(source)) {
        if (!byCourse || typeof byCourse !== "object") continue;
        const normalizedByCourse: Record<string, CourseMeta> = {};
        for (const [courseCode, meta] of Object.entries(byCourse)) {
            const code = String(courseCode || "").trim();
            if (!code) continue;
            normalizedByCourse[code] = sanitizeCourseMetaEntry(meta);
        }
        normalized[program] = normalizedByCourse;
    }
    return normalized;
}

export function sanitizeSemesterNotesByProgram(value: unknown): Record<string, Record<number, string>> {
    const source = asRecord(value);
    const normalized: Record<string, Record<number, string>> = {};
    for (const [program, bySemester] of Object.entries(source)) {
        if (!bySemester || typeof bySemester !== "object") continue;
        const normalizedBySemester: Record<number, string> = {};
        for (const [semesterId, note] of Object.entries(bySemester)) {
            const sem = Number(semesterId);
            if (!Number.isInteger(sem) || sem < 1) continue;
            normalizedBySemester[sem] = typeof note === "string" ? note : "";
        }
        normalized[program] = normalizedBySemester;
    }
    return normalized;
}

export function sanitizeParkedByProgram(value: unknown): Record<string, string[]> {
    const source = asRecord(value);
    const normalized: Record<string, string[]> = {};
    for (const [program, codes] of Object.entries(source)) {
        const safeCodes = Array.isArray(codes) ? (codes as unknown[]) : [];
        normalized[program] = [...new Set(
            safeCodes
                .map((code) => String(code || "").trim())
                .filter(Boolean)
        )];
    }
    return normalized;
}

/**
 * A stored graph view. Card positions were once kept as an x coordinate alone;
 * those are lifted into full positions here so that the rest of the planner
 * only ever sees one of the two shapes.
 */
export function normalizeStoredGraphView(value: unknown): GraphViewState {
    const source = asRecord(value);
    const collapsedIds = Array.isArray(source.collapsedIds) ? (source.collapsedIds as string[]) : null;
    const nodePosById = (source.nodePosById && typeof source.nodePosById === "object"
        ? source.nodePosById
        : {}) as Record<string, Point>;
    const legacyNodeXById = (source.nodeXById && typeof source.nodeXById === "object"
        ? source.nodeXById
        : {}) as Record<string, number>;
    const mergedNodePosById: Record<string, Point> = {
        ...Object.fromEntries(
            Object.entries(legacyNodeXById)
                .filter(([, x]) => Number.isFinite(x))
                .map(([id, x]) => [id, { x, y: 0 }])
        ),
        ...nodePosById,
    };
    return {
        ...(source as Partial<GraphViewState>),
        collapsedIds,
        nodePosById: mergedNodePosById,
        filters: sanitizeGraphFilters(source.filters),
        filtersConfigured: Boolean(source.filtersConfigured),
    };
}

export function snapshotFromPlannerState(state: PlannerState): PlannerStateSnapshot {
    const coursesByProgram: Record<string, CoursesBySemester> = {};
    const doneByProgram: Record<string, string[]> = {};
    const parkedByProgram: Record<string, string[]> = {};
    const courseMetaByProgram: Record<string, Record<string, CourseMeta>> = {};
    const semesterNotesByProgram: Record<string, Record<number, string>> = {};
    const selectedFocusByProgram: Record<string, string> = {};
    const graphViewByProgram: Record<string, GraphViewState> = {};
    const semesterLoadLimitsByProgram: Record<string, SemesterLoadLimits> = {};

    for (const [programmeCode, plan] of Object.entries(state.byProgramme)) {
        coursesByProgram[programmeCode] = plan.coursesBySemester;
        doneByProgram[programmeCode] = plan.doneCourseCodes;
        parkedByProgram[programmeCode] = plan.parkedCourseCodes;
        courseMetaByProgram[programmeCode] = plan.courseMetaByCode;
        semesterNotesByProgram[programmeCode] = plan.semesterNotes;
        selectedFocusByProgram[programmeCode] = plan.selectedFocus;
        graphViewByProgram[programmeCode] = plan.graphView;
        semesterLoadLimitsByProgram[programmeCode] = plan.loadLimits;
    }

    return {
        version: 1,
        programCode: state.programCode,
        coursesByProgram,
        doneByProgram,
        parkedByProgram,
        courseMetaByProgram,
        semesterNotesByProgram,
        selectedFocusByProgram,
        graphViewByProgram,
        semesterLoadLimitsByProgram,
    };
}

/**
 * The state a stored document describes. The change counter and the last change
 * are carried over from the current state rather than reset, so that a load
 * cannot hand out an identifier a consumer has already seen.
 */
export function plannerStateFromSnapshot(state: PlannerState, snapshot: unknown): PlannerState {
    const source = asRecord(snapshot);

    const storedCourses = asRecord(source.coursesByProgram);
    const coursesByProgram: Record<string, CoursesBySemester> = {};
    for (const [programmeCode, bySem] of Object.entries(storedCourses)) {
        const bounds = semesterBoundsForProgram(programmeCode);
        coursesByProgram[programmeCode] = normalizeBySemesterMap(bySem, bounds.min, bounds.max);
    }

    // Done codes and the chosen focus are stored as this application wrote
    // them, and are read back the same way.
    const doneByProgram = asRecord(source.doneByProgram) as Record<string, string[]>;
    const selectedFocusByProgram = asRecord(source.selectedFocusByProgram) as Record<string, string>;
    const parkedByProgram = sanitizeParkedByProgram(source.parkedByProgram);
    const courseMetaByProgram = sanitizeCourseMetaByProgram(source.courseMetaByProgram);
    const semesterNotesByProgram = sanitizeSemesterNotesByProgram(source.semesterNotesByProgram);

    const graphViewByProgram: Record<string, GraphViewState> = {};
    for (const [programmeCode, storedView] of Object.entries(asRecord(source.graphViewByProgram))) {
        graphViewByProgram[programmeCode] = normalizeStoredGraphView(storedView);
    }

    const semesterLoadLimitsByProgram: Record<string, SemesterLoadLimits> = {};
    for (const [programmeCode, limits] of Object.entries(asRecord(source.semesterLoadLimitsByProgram))) {
        semesterLoadLimitsByProgram[programmeCode] = sanitizeSemesterLoadLimits(limits);
    }

    const programmeCodes = new Set([
        ...Object.keys(coursesByProgram),
        ...Object.keys(doneByProgram),
        ...Object.keys(parkedByProgram),
        ...Object.keys(courseMetaByProgram),
        ...Object.keys(semesterNotesByProgram),
        ...Object.keys(selectedFocusByProgram),
        ...Object.keys(graphViewByProgram),
        ...Object.keys(semesterLoadLimitsByProgram),
    ]);

    const byProgramme: Record<string, ProgrammePlan> = {};
    for (const programmeCode of programmeCodes) {
        const empty = emptyProgrammePlan(programmeCode);
        byProgramme[programmeCode] = {
            coursesBySemester: coursesByProgram[programmeCode] ?? empty.coursesBySemester,
            doneCourseCodes: doneByProgram[programmeCode] ?? empty.doneCourseCodes,
            parkedCourseCodes: parkedByProgram[programmeCode] ?? empty.parkedCourseCodes,
            courseMetaByCode: courseMetaByProgram[programmeCode] ?? empty.courseMetaByCode,
            semesterNotes: semesterNotesByProgram[programmeCode] ?? empty.semesterNotes,
            selectedFocus: selectedFocusByProgram[programmeCode] ?? empty.selectedFocus,
            loadLimits: semesterLoadLimitsByProgram[programmeCode] ?? empty.loadLimits,
            graphView: graphViewByProgram[programmeCode] ?? empty.graphView,
        };
    }

    const storedProgramCode = source.programCode;
    const programCode = typeof storedProgramCode === "string" && storedProgramCode.trim()
        ? storedProgramCode
        : state.programCode;

    return {
        programCode,
        byProgramme,
        lastChange: state.lastChange,
        changeCounter: state.changeCounter,
    };
}
