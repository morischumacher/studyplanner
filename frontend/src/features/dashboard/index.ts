/**
 * The planner dashboard: the panel state that is persisted with the plan, the
 * figures the panel displays, and the panel itself.
 *
 * The hook and the metrics are meant to be called in that order. Which figures
 * are worked out depends on which half of the dashboard is showing, and that is
 * panel state, so the panels have to be settled first.
 */

export { default as PlannerDashboard } from "./PlannerDashboard.tsx";
export type { PlannerDashboardProps } from "./PlannerDashboard.tsx";
export { computeDashboardMetrics } from "./metrics.ts";
export type {
    DashboardCourse,
    DashboardMetrics,
    DashboardMetricsInput,
    DashboardStickyViolation,
    FocusChecklistItem,
    FocusChooseSummary,
    ModuleProgressRow,
} from "./metrics.ts";
export { useDashboardPanels, useEmptySectionAutoClose } from "./useDashboardPanels.ts";
export type {
    DashboardPanels,
    DashboardUiGlobalSnapshot,
    DashboardUiSnapshot,
    DashboardViewMode,
    UseDashboardPanelsInput,
} from "./useDashboardPanels.ts";
export type {
    DashboardLaneInsights,
    DashboardSectionOrdering,
    MissingGradeRow,
    SemesterGradeRow,
    SemesterHoursRow,
} from "./types.ts";
