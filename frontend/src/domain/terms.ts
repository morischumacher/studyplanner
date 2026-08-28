/**
 * Semesters, seasons, and which courses may go in which.
 *
 * A degree plan is a row of lanes, and the lanes alternate between winter and
 * summer starting from whichever season the student began in. A course offered
 * only in winter can therefore go in some lanes and not others, and that single
 * rule is behind the friction the evaluation study recorded most often: students
 * guess a lane, the drop is refused, and they place again.
 *
 * Every function here is total. An unrecognised term means "offered in both",
 * never "offered in neither", because a course nobody can place is a worse
 * failure than a course placed too freely.
 */

export const BACHELOR_PROGRAM_CODE = "033 521";

export const TERM_WINTER = "winter";
export const TERM_SUMMER = "summer";
export const TERM_BOTH = "both";

/** When a course is offered. */
export type TermAvailability = typeof TERM_WINTER | typeof TERM_SUMMER | typeof TERM_BOTH;

/** A season a lane can be in. Lanes are never "both". */
export type Season = typeof TERM_WINTER | typeof TERM_SUMMER;

export interface SemesterBounds {
    /** Semesters the programme is designed to take. */
    min: number;
    /** Semesters the planner will show before it stops adding lanes. */
    max: number;
}

export interface Semester {
    /** One-based, as the student sees it. */
    id: number;
    title: string;
}

export function semesterBoundsForProgram(programCode: string | null | undefined): SemesterBounds {
    // The spaced form is what the curriculum regulations print, and what the
    // backend rule checkers compare against.
    if (String(programCode ?? "").trim() === BACHELOR_PROGRAM_CODE) {
        return { min: 6, max: 10 };
    }
    return { min: 4, max: 8 };
}

export function buildSemesterList(count: unknown): Semester[] {
    const safe = Math.max(1, Number(count) || 1);
    return Array.from({ length: safe }, (_, index) => ({
        id: index + 1,
        title: `Semester ${index + 1}`,
    }));
}

export function clampLaneIndex(laneIndex: unknown, maxLaneIndex?: number | null): number {
    const raw = Math.max(0, Math.floor(Number(laneIndex) || 0));
    if (!Number.isFinite(maxLaneIndex)) return raw;
    return Math.max(0, Math.min(raw, Number(maxLaneIndex)));
}

export function normalizeTermAvailability(value: unknown): TermAvailability {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === TERM_WINTER || normalized === TERM_SUMMER || normalized === TERM_BOTH) {
        return normalized;
    }
    return TERM_BOTH;
}

export function normalizeStartSeason(value: unknown): Season {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === TERM_WINTER || normalized === TERM_SUMMER) return normalized;
    return TERM_WINTER;
}

/** The season of a lane, counting from the season the plan starts in. */
export function laneSeason(startSeason: unknown, laneIndex: unknown): Season {
    const season = normalizeStartSeason(startSeason);
    // Lane zero is the first semester, so the index is used directly rather
    // than tested for truth: zero is falsy, and that has caused this bug before.
    const index = Math.max(0, Math.floor(Number(laneIndex) || 0));
    if (index % 2 === 0) return season;
    return season === TERM_WINTER ? TERM_SUMMER : TERM_WINTER;
}

export function isLaneAllowedForTerm(
    termAvailability: unknown,
    startSeason: unknown,
    laneIndex: unknown
): boolean {
    const term = normalizeTermAvailability(termAvailability);
    if (term === TERM_BOTH) return true;
    return laneSeason(startSeason, laneIndex) === term;
}

/**
 * The first lane at or after `laneIndex` that can hold this course, or null.
 *
 * Null is a real answer: a summer course with only a winter lane left has
 * nowhere to go, and the caller has to say so rather than place it wrongly.
 */
export function firstAllowedLaneAtOrAfter(
    termAvailability: unknown,
    startSeason: unknown,
    laneIndex: unknown,
    maxLaneIndex?: number | null
): number | null {
    const start = Math.max(0, Math.floor(Number(laneIndex) || 0));
    // Without a stated maximum the search is still bounded, because a term rule
    // repeats every two lanes: twenty is far past the point of proving it.
    const max = Number.isFinite(maxLaneIndex)
        ? Math.max(0, Math.floor(Number(maxLaneIndex)))
        : start + 20;

    for (let index = start; index <= max; index += 1) {
        if (isLaneAllowedForTerm(termAvailability, startSeason, index)) return index;
    }
    return null;
}
