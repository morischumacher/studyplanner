export const BACHELOR_PROGRAM_CODE = "033 521";
export const TERM_WINTER = "winter";
export const TERM_SUMMER = "summer";
export const TERM_BOTH = "both";

export function semesterBoundsForProgram(programCode) {
    if (String(programCode || "").trim() === BACHELOR_PROGRAM_CODE) {
        return { min: 6, max: 10 };
    }
    return { min: 4, max: 8 };
}

export function buildSemesterList(count) {
    const safe = Math.max(1, Number(count) || 1);
    return Array.from({ length: safe }, (_, idx) => ({
        id: idx + 1,
        title: `Semester ${idx + 1}`,
    }));
}

export function clampLaneIndex(laneIndex, maxLaneIndex) {
    const raw = Math.max(0, Math.floor(Number(laneIndex) || 0));
    if (!Number.isFinite(maxLaneIndex)) return raw;
    return Math.max(0, Math.min(raw, Number(maxLaneIndex)));
}

export function normalizeTermAvailability(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === TERM_WINTER || normalized === TERM_SUMMER || normalized === TERM_BOTH) return normalized;
    return TERM_BOTH;
}

export function normalizeStartSeason(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === TERM_WINTER || normalized === TERM_SUMMER) return normalized;
    return TERM_WINTER;
}

export function laneSeason(startSeason, laneIndex) {
    const season = normalizeStartSeason(startSeason);
    const idx = Math.max(0, Math.floor(Number(laneIndex) || 0));
    if (idx % 2 === 0) return season;
    return season === TERM_WINTER ? TERM_SUMMER : TERM_WINTER;
}

export function isLaneAllowedForTerm(termAvailability, startSeason, laneIndex) {
    const term = normalizeTermAvailability(termAvailability);
    if (term === TERM_BOTH) return true;
    return laneSeason(startSeason, laneIndex) === term;
}

export function firstAllowedLaneAtOrAfter(termAvailability, startSeason, laneIndex, maxLaneIndex) {
    const start = Math.max(0, Math.floor(Number(laneIndex) || 0));
    const max = Number.isFinite(maxLaneIndex) ? Math.max(0, Math.floor(Number(maxLaneIndex))) : start + 20;
    for (let idx = start; idx <= max; idx += 1) {
        if (isLaneAllowedForTerm(termAvailability, startSeason, idx)) return idx;
    }
    return null;
}
