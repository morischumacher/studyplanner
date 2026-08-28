/**
 * What changed between two versions of a plan.
 *
 * The rule checker and the recommender are told what the student just did, not
 * only what the plan now looks like, because the advice they give is about the
 * move: a course dropped into a full semester is worth a warning, the same
 * course sitting there since last week is not.
 *
 * Courses are matched by node id rather than by course code, so that the same
 * course placed twice stays two entries and a rename is not read as a move.
 */

import { flattenBySemester } from "./semesters.ts";
import type { PlanCourseInSemester } from "./state.ts";

export interface AddedCourse {
    id: string;
    code: string | null;
    toSemester: number;
    toLaneIndex: number | null;
    toSemesterNumber: number | null;
}

export interface RemovedCourse {
    id: string;
    code: string | null;
    fromSemester: number;
    fromLaneIndex: number | null;
    fromSemesterNumber: number | null;
}

export interface MovedCourse {
    id: string;
    code: string | null;
    fromSemester: number;
    toSemester: number;
    fromLaneIndex: number | null;
    toLaneIndex: number | null;
    fromSemesterNumber: number | null;
    toSemesterNumber: number | null;
}

export interface UpdatedCourse {
    id: string;
    code: string | null;
    fromEcts: number;
    toEcts: number;
    laneIndex: number | null;
    semesterId: number;
    semesterNumber: number | null;
}

export interface PlanDiff {
    type: "plan_updated";
    added: AddedCourse[];
    removed: RemovedCourse[];
    moved: MovedCourse[];
    updated: UpdatedCourse[];
}

/**
 * A lane index only if it really is a number. Plans read back from storage are
 * trusted for their identifiers and re-checked for everything else.
 */
export function laneIndexOrNull(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapByCourseId(list: PlanCourseInSemester[]): Map<string, PlanCourseInSemester> {
    const byId = new Map<string, PlanCourseInSemester>();
    for (const c of list || []) {
        if (c?.id) byId.set(c.id, c);
    }
    return byId;
}

/** The difference between two plans, or null when there is none. */
export function diffPlannedCourses(
    prevBySemester: unknown,
    nextBySemester: unknown,
    minCount: unknown,
    maxCount: unknown
): PlanDiff | null {
    const prevFlat = flattenBySemester(prevBySemester, minCount, maxCount);
    const nextFlat = flattenBySemester(nextBySemester, minCount, maxCount);
    const prevById = mapByCourseId(prevFlat);
    const nextById = mapByCourseId(nextFlat);
    const added: AddedCourse[] = [];
    const removed: RemovedCourse[] = [];
    const moved: MovedCourse[] = [];
    const updated: UpdatedCourse[] = [];

    for (const [id, course] of nextById.entries()) {
        const before = prevById.get(id);
        if (!before) {
            const toLaneIndex = laneIndexOrNull(course?.laneIndex);
            added.push({
                id,
                code: course.code ?? null,
                toSemester: course.semesterId,
                toLaneIndex,
                toSemesterNumber: toLaneIndex != null ? toLaneIndex + 1 : null,
            });
            continue;
        }
        if (before.semesterId !== course.semesterId) {
            const fromLaneIndex = laneIndexOrNull(before?.laneIndex);
            const toLaneIndex = laneIndexOrNull(course?.laneIndex);
            moved.push({
                id,
                code: course.code ?? null,
                fromSemester: before.semesterId,
                toSemester: course.semesterId,
                fromLaneIndex,
                toLaneIndex,
                fromSemesterNumber: fromLaneIndex != null ? fromLaneIndex + 1 : null,
                toSemesterNumber: toLaneIndex != null ? toLaneIndex + 1 : null,
            });
            continue;
        }
        // A course that stayed where it was is still worth reporting when its
        // ECTS changed, because the semester load rules are counted in ECTS.
        const beforeEcts = Number(before?.ects ?? 0);
        const nextEcts = Number(course?.ects ?? 0);
        if (Number.isFinite(beforeEcts) && Number.isFinite(nextEcts) && beforeEcts !== nextEcts) {
            const laneIndex = laneIndexOrNull(course?.laneIndex);
            updated.push({
                id,
                code: course.code ?? null,
                fromEcts: beforeEcts,
                toEcts: nextEcts,
                laneIndex,
                semesterId: course.semesterId,
                semesterNumber: laneIndex != null ? laneIndex + 1 : null,
            });
        }
    }

    for (const [id, course] of prevById.entries()) {
        if (!nextById.has(id)) {
            const fromLaneIndex = laneIndexOrNull(course?.laneIndex);
            removed.push({
                id,
                code: course.code ?? null,
                fromSemester: course.semesterId,
                fromLaneIndex,
                fromSemesterNumber: fromLaneIndex != null ? fromLaneIndex + 1 : null,
            });
        }
    }

    if (!added.length && !removed.length && !moved.length && !updated.length) return null;
    return { type: "plan_updated", added, removed, moved, updated };
}
