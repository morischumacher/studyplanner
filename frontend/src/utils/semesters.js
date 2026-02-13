export const BACHELOR_PROGRAM_CODE = "033 521";

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
