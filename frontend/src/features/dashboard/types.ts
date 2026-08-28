/**
 * The shapes the dashboard's own modules pass between themselves.
 *
 * `DashboardLaneInsights` is the one bundle that is not derived from the rule
 * check. Those figures come from the notes the student keeps on each course,
 * which the planner already gathers per semester, so the dashboard is handed
 * them rather than working them out a second time.
 */

import type { CSSProperties, DragEvent } from "react";

/** The drag-to-reorder wiring, as `useDashboardSectionOrdering` hands it over. */
export interface DashboardSectionOrdering {
    handlePlannedSectionDragStart: (key: string) => void;
    handlePlannedSectionDragOver: (event: DragEvent<HTMLElement>, key: string) => void;
    handlePlannedSectionDrop: (key: string) => void;
    handlePlannedSectionDragEnd: () => void;
    handleDoneSectionDragStart: (key: string) => void;
    handleDoneSectionDragOver: (event: DragEvent<HTMLElement>, key: string) => void;
    handleDoneSectionDrop: (key: string) => void;
    handleDoneSectionDragEnd: () => void;
    plannedSectionStyle: (key: string, base?: CSSProperties) => CSSProperties;
    doneSectionStyle: (key: string, base?: CSSProperties) => CSSProperties;
}

/** One semester's estimated weekly hours. Semesters with none are left out. */
export interface SemesterHoursRow {
    sem: number;
    hours: number;
}

/** One semester's ECTS-weighted mark. */
export interface SemesterGradeRow {
    sem: number;
    grade: number;
}

/** The done courses of one semester that carry no mark yet. */
export interface MissingGradeRow {
    sem: number;
    missingCourses: readonly { code: string; name: string }[];
}

export interface DashboardLaneInsights {
    plannedEstimatedHoursPerSemesterRows: readonly SemesterHoursRow[];
    plannedEstimatedHoursAverage: number;
    plannedWeekHoursWithinDesiredWorkload: boolean;
    recommendedWeekHoursPerSemester: number;
    maxWeekHoursForScale: number;
    doneGradePerSemesterRows: readonly SemesterGradeRow[];
    doneGradeOverall: number | null;
    missingDoneGradesBySemester: readonly MissingGradeRow[];
    missingDoneGradesCount: number;
}
