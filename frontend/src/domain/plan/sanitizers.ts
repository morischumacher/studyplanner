/**
 * Making stored or half-typed values safe to put in the state.
 *
 * Everything here is total: a value that cannot be understood becomes the
 * default rather than an error, because these run on plans read back from the
 * server and on fields the student is still typing into. A plan that will not
 * load is worse than a plan that loads with one note missing.
 */

import type { GraphFilters } from "../filters.ts";
import {
    DEFAULT_GRAPH_FILTERS,
    DEFAULT_SEMESTER_LOAD_LIMITS,
    type CourseMeta,
    type SemesterLoadLimits,
} from "./state.ts";

/** Anything that is not an object is read as an empty one. */
export function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function sanitizeCourseMetaEntry(value: unknown): CourseMeta {
    const source = asRecord(value);
    const notes = typeof source.notes === "string" ? source.notes : "";
    const estimatedHoursRaw = source.estimatedHours;
    const estimatedHours = estimatedHoursRaw == null ? "" : String(estimatedHoursRaw);
    const gradeRaw = source.grade;
    let grade = gradeRaw == null ? "" : String(gradeRaw);
    // Marks are entered by hand and with a comma as often as a point. Anything
    // worse than a five is not a mark a student can hold, so it is capped
    // rather than rejected.
    const normalizedGrade = grade.trim().replace(",", ".");
    const parsedGrade = Number(normalizedGrade);
    if (normalizedGrade && Number.isFinite(parsedGrade) && parsedGrade > 5) {
        grade = "5";
    }
    return { notes, estimatedHours, grade };
}

/**
 * Load limits, with the recommendation held at or below the maximum. A
 * recommendation above the maximum would mark every semester that follows it
 * as both fine and too full.
 */
export function sanitizeSemesterLoadLimits(value: unknown): SemesterLoadLimits {
    const source = asRecord(value);
    const parsedMax = Number(source.maxEctsPerSemester);
    const parsedRecommended = Number(source.recommendedEctsPerSemester);
    const parsedMaxWeekHours = Number(source.maxWeekHoursPerSemester);
    const parsedRecommendedWeekHours = Number(source.recommendedWeekHoursPerSemester);
    const maxEctsPerSemester = Number.isFinite(parsedMax) && parsedMax > 0
        ? parsedMax
        : DEFAULT_SEMESTER_LOAD_LIMITS.maxEctsPerSemester;
    const recommendedRaw = Number.isFinite(parsedRecommended) && parsedRecommended > 0
        ? parsedRecommended
        : DEFAULT_SEMESTER_LOAD_LIMITS.recommendedEctsPerSemester;
    const recommendedEctsPerSemester = Math.min(recommendedRaw, maxEctsPerSemester);
    const maxWeekHoursPerSemester = Number.isFinite(parsedMaxWeekHours) && parsedMaxWeekHours > 0
        ? parsedMaxWeekHours
        : DEFAULT_SEMESTER_LOAD_LIMITS.maxWeekHoursPerSemester;
    const recommendedWeekHoursRaw = Number.isFinite(parsedRecommendedWeekHours) && parsedRecommendedWeekHours > 0
        ? parsedRecommendedWeekHours
        : DEFAULT_SEMESTER_LOAD_LIMITS.recommendedWeekHoursPerSemester;
    const recommendedWeekHoursPerSemester = Math.min(recommendedWeekHoursRaw, maxWeekHoursPerSemester);
    return {
        maxEctsPerSemester,
        recommendedEctsPerSemester,
        maxWeekHoursPerSemester,
        recommendedWeekHoursPerSemester,
    };
}

/**
 * Graph filters, keeping the six lists the filter engine reads. An empty list
 * means "no constraint" there, so a missing one falls back to the default
 * rather than to nothing.
 */
export function sanitizeGraphFilters(filters: unknown): GraphFilters {
    const source = asRecord(filters);
    const ectsRange = asRecord(source.ectsRange);
    return {
        obligationTypes: Array.isArray(source.obligationTypes)
            ? (source.obligationTypes as GraphFilters["obligationTypes"])
            : DEFAULT_GRAPH_FILTERS.obligationTypes,
        ectsRange: source.ectsRange && typeof source.ectsRange === "object"
            ? {
                min: Number(ectsRange.min),
                max: Number(ectsRange.max),
            }
            : null,
        courseTypes: Array.isArray(source.courseTypes)
            ? (source.courseTypes as string[])
            : DEFAULT_GRAPH_FILTERS.courseTypes,
        examSubjects: Array.isArray(source.examSubjects)
            ? (source.examSubjects as string[])
            : DEFAULT_GRAPH_FILTERS.examSubjects,
        progressStates: Array.isArray(source.progressStates)
            ? (source.progressStates as string[])
            : DEFAULT_GRAPH_FILTERS.progressStates,
        termAvailabilities: Array.isArray(source.termAvailabilities)
            ? (source.termAvailabilities as string[])
            : DEFAULT_GRAPH_FILTERS.termAvailabilities,
    };
}
