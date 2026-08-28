/**
 * The planner dashboard: the panel on the right of the planner, its two
 * headline figures, and the sections underneath them.
 *
 * The aside is a column flex container and every section carries an `order`,
 * so the sections are written here in a fixed sequence and shown in the one
 * the student dragged them into.
 */

import DoneSections from "./DoneSections.tsx";
import KpiProgressBar from "./KpiProgressBar.tsx";
import PlannedSections from "./PlannedSections.tsx";
import RequirementSections from "./RequirementSections.tsx";
import type { DashboardMetrics } from "./metrics.ts";
import type { DashboardLaneInsights, DashboardSectionOrdering } from "./types.ts";
import type { DashboardPanels } from "./useDashboardPanels.ts";
import { BACHELOR_PROGRAM_CODE } from "../../domain/programmes.ts";

export interface PlannerDashboardProps {
    panels: DashboardPanels;
    metrics: DashboardMetrics;
    ordering: DashboardSectionOrdering;
    laneInsights: DashboardLaneInsights;
    programCode: string;
    selectedFocus: string;
    subjectColors: Record<string, string>;
    ruleCheckLastUpdatedAt: number | null;
    topMargin: number;
    bottomMargin: number;
}

export default function PlannerDashboard({
    panels,
    metrics,
    ordering,
    laneInsights,
    programCode,
    selectedFocus,
    subjectColors,
    ruleCheckLastUpdatedAt,
    topMargin,
    bottomMargin,
}: PlannerDashboardProps) {
    const {
        setIsRuleDashboardOpen,
        setDashboardViewMode,
    } = panels;
    const {
        getDashboardModeButtonStyle,
        targetEctsKpi,
        totalEctsKpi,
        totalPctKpi,
        doneEctsKpi,
        donePctKpi,
        plannedChecklistComplete,
        bachelorFocus,
    } = metrics;
    const hasSelectedFocusArea = Boolean(String(selectedFocus || bachelorFocus?.selected || "").trim());

    return (
        <aside
            id="planner-dashboard-container"
            style={{
                width: 420,
                borderLeft: "1px solid #e5e7eb",
                background: "#ffffff",
                marginTop: topMargin,
                marginBottom: bottomMargin,
                height: `calc(100vh - ${topMargin + bottomMargin}px)`,
                padding: 12,
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
                alignSelf: "flex-start",
            }}
        >
            {/* ── Right-panel tab bar ───────────────────────────────────── */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                    gap: 8,
                }}
            >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", padding: "5px 0" }}>
                    Planner Dashboard
                </div>
                <button
                    onClick={() => setIsRuleDashboardOpen(false)}
                    style={{
                        border: "1px solid #d1d5db",
                        background: "#ffffff",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontSize: 12,
                    }}
                >
                    Close
                </button>
            </div>


            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
                <div>Program: {programCode}</div>
                {programCode === BACHELOR_PROGRAM_CODE && <div>Focus: {selectedFocus || "-"}</div>}
            </div>
            <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", minWidth: 118 }}>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>Target ECTS</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{targetEctsKpi.toFixed(1)}</div>
                    </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>Planned ECTS</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: plannedChecklistComplete ? "#166534" : "#111827" }}>{totalEctsKpi.toFixed(1)}</div>
                        <KpiProgressBar pct={totalPctKpi} color={plannedChecklistComplete ? "#16a34a" : "#2563eb"} />
                    </div>
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>Done ECTS</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: donePctKpi >= 100 - 1e-6 ? "#166534" : "#111827" }}>{doneEctsKpi.toFixed(1)}</div>
                        <KpiProgressBar pct={donePctKpi} color={donePctKpi >= 100 - 1e-6 ? "#16a34a" : "#2563eb"} />
                    </div>
                </div>
            </div>

            <div style={{ display: "inline-flex", gap: 6, marginBottom: 12 }}>
                <button
                    id="dashboard-planned-tab"
                    onClick={() => setDashboardViewMode("planning")}
                    style={getDashboardModeButtonStyle("planning")}
                >
                    Planned
                </button>
                <button
                    id="dashboard-done-tab"
                    onClick={() => setDashboardViewMode("progress")}
                    style={getDashboardModeButtonStyle("progress")}
                >
                    Done
                </button>
            </div>

            <PlannedSections
                panels={panels}
                metrics={metrics}
                ordering={ordering}
                laneInsights={laneInsights}
                selectedFocus={selectedFocus}
                hasSelectedFocusArea={hasSelectedFocusArea}
                subjectColors={subjectColors}
            />

            <DoneSections
                panels={panels}
                metrics={metrics}
                ordering={ordering}
                laneInsights={laneInsights}
                selectedFocus={selectedFocus}
                hasSelectedFocusArea={hasSelectedFocusArea}
            />

            <RequirementSections
                panels={panels}
                metrics={metrics}
                ordering={ordering}
            />

            <div style={{ fontSize: 12, color: "#6b7280", order: 9999, marginTop: 4 }}>
                Last update: {ruleCheckLastUpdatedAt ? new Date(ruleCheckLastUpdatedAt).toLocaleTimeString() : "-"}
            </div>
        </aside>
    );
}
