/**
 * The six sections of the planned half of the dashboard.
 *
 * Each one is a flex item of the aside and carries an `order` from the stored
 * section order, so the sequence they are written in here is not the sequence
 * the student sees.
 */

import { FOCUS_INFO_TEXT, STEOP_RULES_TEXT } from "../../domain/programmes.ts";
import type { DashboardMetrics } from "./metrics.ts";
import type { DashboardLaneInsights, DashboardSectionOrdering } from "./types.ts";
import type { DashboardPanels } from "./useDashboardPanels.ts";

export interface PlannedSectionsProps {
    panels: DashboardPanels;
    metrics: DashboardMetrics;
    ordering: DashboardSectionOrdering;
    laneInsights: DashboardLaneInsights;
    selectedFocus: string;
    hasSelectedFocusArea: boolean;
    subjectColors: Record<string, string>;
}

export default function PlannedSections({
    panels,
    metrics,
    ordering,
    laneInsights,
    selectedFocus,
    hasSelectedFocusArea,
    subjectColors,
}: PlannedSectionsProps) {
    const {
        dashboardViewMode,
        isSteopInfoOpen,
        setIsSteopInfoOpen,
        isSteopChecklistOpen,
        setIsSteopChecklistOpen,
        isFocusInfoOpen,
        setIsFocusInfoOpen,
        isFocusChecklistOpen,
        setIsFocusChecklistOpen,
        isPlannedExamSubjectOpen,
        setIsPlannedExamSubjectOpen,
        isPerSemesterEctsOpen,
        setIsPerSemesterEctsOpen,
        isByCategoryOpen,
        setIsByCategoryOpen,
        isPlannedEstimatedHoursOpen,
        setIsPlannedEstimatedHoursOpen,
    } = panels;
    const {
        isBachelorDashboard,
        bachelorFocus,
        bachelorSteopPlannedComplete,
        bachelorSteopPlannedLane,
        bachelorFocusCompletePlanned,
        steopRequiredEcts,
        steopMandatoryRequiredEcts,
        steopPoolRequiredEcts,
        steopPlannedEcts,
        steopPlannedPct,
        steopMandatoryPlannedEcts,
        steopPoolPlannedEcts,
        steopMandatoryChecklistPlanned,
        steopPoolChecklistPlanned,
        focusChecklistPlanned,
        focusChecklistPctPlanned,
        focusChooseGroupRowsPlanned,
        focusChooseItemsPlanned,
        focusChooseSummaryPlanned,
        focusRequiredItemsPlanned,
        focusRequirementDoneCountPlanned,
        focusRequirementTotalCountPlanned,
        plannedEctsByExamSubjectRows,
        plannedEctsByExamSubjectTotal,
        perSemesterRows,
        perSemesterWithinDesiredWorkload,
        workloadTargetPerSemester,
        maxSemesterWorkloadForScale,
        byCategoryRows,
        byCategoryTotalEcts,
        topByCategoryRow,
    } = metrics;
    const {
        handlePlannedSectionDragStart,
        handlePlannedSectionDragOver,
        handlePlannedSectionDrop,
        handlePlannedSectionDragEnd,
        plannedSectionStyle,
    } = ordering;
    const {
        plannedEstimatedHoursPerSemesterRows,
        plannedEstimatedHoursAverage,
        plannedWeekHoursWithinDesiredWorkload,
        recommendedWeekHoursPerSemester,
        maxWeekHoursForScale,
    } = laneInsights;

    return (
        <>
            {isBachelorDashboard && dashboardViewMode === "planning" && (
                <div
                    draggable
                    onDragStart={() => handlePlannedSectionDragStart("steop")}
                    onDragOver={(event) => handlePlannedSectionDragOver(event, "steop")}
                    onDrop={() => handlePlannedSectionDrop("steop")}
                    onDragEnd={handlePlannedSectionDragEnd}
                    style={plannedSectionStyle("steop", { marginBottom: 12 })}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>StEOP</div>
                        <button
                            onClick={() => setIsSteopInfoOpen((v) => !v)}
                            style={{
                                border: "1px solid #d1d5db",
                                background: "#ffffff",
                                borderRadius: 999,
                                padding: "2px 8px",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                            title="Show StEOP rules"
                        >
                            i
                        </button>
                    </div>
                    {isSteopInfoOpen && (
                        <div
                            style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: 8,
                                background: "#f9fafb",
                                padding: 8,
                                marginBottom: 8,
                                fontSize: 11,
                                color: "#374151",
                                whiteSpace: "pre-line",
                            }}
                        >
                            {STEOP_RULES_TEXT}
                        </div>
                    )}
                    <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 12 }}>
                            Status: <strong style={{ color: bachelorSteopPlannedComplete ? "#166534" : "#991b1b" }}>
                                {bachelorSteopPlannedComplete ? "completed" : "not completed"}
                            </strong>
                        </div>
                        <div style={{ fontSize: 12 }}>
                            Complete in semester: <strong>{bachelorSteopPlannedLane == null ? "-" : bachelorSteopPlannedLane + 1}</strong>
                        </div>
                        <div style={{ fontSize: 12 }}>
                            Planned progress: <strong>{steopPlannedEcts.toFixed(1)}</strong> / {steopRequiredEcts.toFixed(1)} ECTS
                            {" "}(
                            mandatory {steopMandatoryPlannedEcts.toFixed(1)}/{steopMandatoryRequiredEcts.toFixed(1)},
                            {" "}pool {steopPoolPlannedEcts.toFixed(1)}/{steopPoolRequiredEcts.toFixed(1)}
                            )
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                            <div style={{ width: `${steopPlannedPct}%`, height: "100%", background: bachelorSteopPlannedComplete ? "#16a34a" : "#2563eb" }} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Required courses</div>
                            <button
                                onClick={() => setIsSteopChecklistOpen((v) => !v)}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    borderRadius: 999,
                                    padding: "2px 8px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                }}
                            >
                                {isSteopChecklistOpen ? "Collapse" : "Expand"}
                            </button>
                        </div>
                        {isSteopChecklistOpen && (
                            <>
                                {steopMandatoryChecklistPlanned
                                    .filter((row) => !bachelorSteopPlannedComplete || row.done)
                                    .map((row, idx) => (
                                        <div key={`steop-man-planned-${idx}`} style={{ fontSize: 12, color: row.done ? "#166534" : "#991b1b" }}>
                                            {row.done ? "✓" : "○"} {row.label}
                                        </div>
                                    ))}
                                <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>
                                    Pool requirement (need at least {steopPoolRequiredEcts.toFixed(1)} ECTS):
                                </div>
                                {steopPoolChecklistPlanned
                                    .filter((row) => !bachelorSteopPlannedComplete || row.done)
                                    .map((row, idx) => (
                                        <div key={`steop-pool-planned-${idx}`} style={{ fontSize: 12, color: row.done ? "#166534" : "#991b1b" }}>
                                            {row.done ? "✓" : "○"} {row.label}
                                        </div>
                                    ))}
                            </>
                        )}
                    </div>
                </div>
            )}

            {isBachelorDashboard && hasSelectedFocusArea && dashboardViewMode === "planning" && (
                <div
                    draggable
                    onDragStart={() => handlePlannedSectionDragStart("focus")}
                    onDragOver={(event) => handlePlannedSectionDragOver(event, "focus")}
                    onDrop={() => handlePlannedSectionDrop("focus")}
                    onDragEnd={handlePlannedSectionDragEnd}
                    style={plannedSectionStyle("focus", { marginBottom: 12 })}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Focus Area</div>
                        <button
                            onClick={() => setIsFocusInfoOpen((v) => !v)}
                            style={{
                                border: "1px solid #d1d5db",
                                background: "#ffffff",
                                borderRadius: 999,
                                padding: "2px 8px",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                            title="Show Focus Area info"
                        >
                            i
                        </button>
                    </div>
                    {isFocusInfoOpen && (
                        <div
                            style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: 8,
                                background: "#f9fafb",
                                padding: 8,
                                marginBottom: 8,
                                fontSize: 11,
                                color: "#374151",
                                whiteSpace: "pre-line",
                            }}
                        >
                            {FOCUS_INFO_TEXT}
                        </div>
                    )}
                    <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 12 }}>Selected: <strong>{bachelorFocus?.selected || selectedFocus || "-"}</strong></div>
                        <div style={{ fontSize: 12 }}>
                            Status: <strong style={{ color: bachelorFocusCompletePlanned ? "#166534" : "#991b1b" }}>
                                {bachelorFocusCompletePlanned ? "completed" : "not completed"}
                            </strong>
                        </div>
                        <div style={{ fontSize: 12 }}>
                            Checklist progress: <strong>{focusRequirementDoneCountPlanned}</strong> / {focusRequirementTotalCountPlanned}
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                            <div style={{ width: `${focusChecklistPctPlanned}%`, height: "100%", background: bachelorFocusCompletePlanned ? "#16a34a" : "#2563eb" }} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Required modules</div>
                            <button
                                onClick={() => setIsFocusChecklistOpen((v) => !v)}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    borderRadius: 999,
                                    padding: "2px 8px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                }}
                            >
                                {isFocusChecklistOpen ? "Collapse" : "Expand"}
                            </button>
                        </div>
                        {isFocusChecklistOpen && (
                            <>
                                {focusChecklistPlanned.length === 0 && (
                                    <div style={{ fontSize: 12, color: "#6b7280" }}>No detailed focus checklist available.</div>
                                )}
                                {focusRequiredItemsPlanned.length > 0 && (
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginTop: 2 }}>Mandatory modules</div>
                                )}
                                {focusRequiredItemsPlanned
                                    .filter((item) => !bachelorFocusCompletePlanned || Boolean(item?.done))
                                    .map((item, idx) => (
                                        <div key={`focus-req-planned-${idx}`} style={{ fontSize: 12, color: item?.done ? "#166534" : "#991b1b" }}>
                                            {item?.done ? "✓" : "○"} {item?.label}
                                        </div>
                                    ))}
                                {focusChooseItemsPlanned.length > 0 && (
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginTop: 4 }}>
                                        Choose {Number(focusChooseSummaryPlanned?.min || 0)} from {focusChooseItemsPlanned.length} modules
                                        {focusChooseSummaryPlanned ? ` (${Number(focusChooseSummaryPlanned?.done || 0)} done)` : ""}
                                    </div>
                                )}
                                {focusChooseItemsPlanned
                                    .filter((item) => !bachelorFocusCompletePlanned || Boolean(item?.done))
                                    .map((item, idx) => (
                                        <div key={`focus-choose-planned-${idx}`} style={{ fontSize: 12, color: item?.done ? "#166534" : "#991b1b" }}>
                                            {item?.done ? "✓" : "○"} {item?.label}
                                        </div>
                                    ))}
                                {focusChooseGroupRowsPlanned.map((group, gIdx) => (
                                    <div key={`focus-group-planned-${gIdx}`} style={{ display: "grid", gap: 4 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginTop: 4 }}>
                                            Choose {Number(group?.summary?.min || 0)} from {group.items.length} modules
                                            {group?.summary ? ` (${Number(group.summary?.done || 0)} done)` : ""}
                                        </div>
                                        {group.items
                                            .filter((item) => !bachelorFocusCompletePlanned || Boolean(item?.done))
                                            .map((item, idx) => (
                                                <div key={`focus-group-item-planned-${gIdx}-${idx}`} style={{ fontSize: 12, color: item?.done ? "#166534" : "#991b1b" }}>
                                                    {item?.done ? "✓" : "○"} {item?.label}
                                                </div>
                                            ))}
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            )}

            {dashboardViewMode === "planning" && (
                <div
                    draggable
                    onDragStart={() => handlePlannedSectionDragStart("planned_exam_subject")}
                    onDragOver={(event) => handlePlannedSectionDragOver(event, "planned_exam_subject")}
                    onDrop={() => handlePlannedSectionDrop("planned_exam_subject")}
                    onDragEnd={handlePlannedSectionDragEnd}
                    style={plannedSectionStyle("planned_exam_subject", { marginBottom: 12 })}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Per Exam Subject (ECTS)</div>
                        <button
                            onClick={() => setIsPlannedExamSubjectOpen((v) => !v)}
                            style={{
                                border: "1px solid #d1d5db",
                                background: "#ffffff",
                                borderRadius: 999,
                                padding: "2px 8px",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            {isPlannedExamSubjectOpen ? "Collapse" : "Expand"}
                        </button>
                    </div>
                    <div style={{ display: "grid", gap: 4, marginBottom: isPlannedExamSubjectOpen ? 6 : 0 }}>
                        <div style={{ fontSize: 12, color: "#374151" }}>
                            Planned <strong>{plannedEctsByExamSubjectTotal.toFixed(1)} ECTS</strong> across <strong>{plannedEctsByExamSubjectRows.length}</strong> exam subject{plannedEctsByExamSubjectRows.length === 1 ? "" : "s"}
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden", display: "flex" }}>
                            {plannedEctsByExamSubjectRows.length === 0 && <div style={{ width: "100%", height: "100%", background: "#d1d5db" }} />}
                            {plannedEctsByExamSubjectRows.map((row, idx) => {
                                const pct = plannedEctsByExamSubjectTotal > 0
                                    ? Math.max(0, Math.min(100, (Number(row?.ects || 0) / plannedEctsByExamSubjectTotal) * 100))
                                    : 0;
                                const color = subjectColors?.[row?.subject] || "#9ca3af";
                                return (
                                    <div
                                        key={`planned-exam-segment-${idx}`}
                                        title={`${row?.subject}: ${Number(row?.ects || 0).toFixed(1)} ECTS`}
                                        style={{ width: `${pct}%`, height: "100%", background: color }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                    {isPlannedExamSubjectOpen && (
                        <div style={{ display: "grid", gap: 6 }}>
                            {plannedEctsByExamSubjectRows.length === 0 && (
                                <div style={{ fontSize: 12, color: "#6b7280" }}>No planned exam-subject ECTS yet.</div>
                            )}
                            {plannedEctsByExamSubjectRows.map((row, idx) => {
                                const pct = plannedEctsByExamSubjectTotal > 0
                                    ? Math.max(0, Math.min(100, (Number(row?.ects || 0) / plannedEctsByExamSubjectTotal) * 100))
                                    : 0;
                                const color = subjectColors?.[row?.subject] || "#9ca3af";
                                return (
                                    <div key={`${row?.subject}-${idx}`} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{row?.subject}</div>
                                        <div style={{ fontSize: 11, color: "#374151", marginBottom: 4 }}>
                                            {Number(row?.ects || 0).toFixed(1)} ECTS planned ({pct.toFixed(1)}%)
                                        </div>
                                        <div style={{ height: 6, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                                            <div style={{ width: `${pct}%`, height: "100%", background: color }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {dashboardViewMode === "planning" && (
                <div
                    draggable
                    onDragStart={() => handlePlannedSectionDragStart("planned_semester")}
                    onDragOver={(event) => handlePlannedSectionDragOver(event, "planned_semester")}
                    onDrop={() => handlePlannedSectionDrop("planned_semester")}
                    onDragEnd={handlePlannedSectionDragEnd}
                    style={plannedSectionStyle("planned_semester", { marginBottom: 12 })}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Per Semester (ECTS)</div>
                        <button
                            onClick={() => setIsPerSemesterEctsOpen((v) => !v)}
                            style={{
                                border: "1px solid #d1d5db",
                                background: "#ffffff",
                                borderRadius: 999,
                                padding: "2px 8px",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            {isPerSemesterEctsOpen ? "Collapse" : "Expand"}
                        </button>
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: isPerSemesterEctsOpen ? 6 : 0 }}>
                        Target ~ {workloadTargetPerSemester.toFixed(1)} ECTS / semester
                    </div>
                    <div style={{ fontSize: 12, color: perSemesterWithinDesiredWorkload ? "#166534" : "#991b1b", marginBottom: isPerSemesterEctsOpen ? 6 : 0 }}>
                        {perSemesterRows.length === 0
                            ? "No semester data yet."
                            : (perSemesterWithinDesiredWorkload
                                ? "You are under your desired workload in every semester."
                                : "At least one semester is above your desired workload.")}
                    </div>
                    {isPerSemesterEctsOpen && (
                        <div style={{ display: "grid", gap: 8 }}>
                            {perSemesterRows.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>No semester data yet.</div>}
                            {perSemesterRows.map((row) => {
                                const rowPct = Math.max(0, Math.min(100, (row.ects / maxSemesterWorkloadForScale) * 100));
                                const targetPct = Math.max(0, Math.min(100, (workloadTargetPerSemester / maxSemesterWorkloadForScale) * 100));
                                const greenPct = Math.max(0, Math.min(rowPct, targetPct));
                                const redPct = Math.max(0, rowPct - targetPct);
                                return (
                                    <div key={row.sem} style={{ display: "grid", gap: 4 }}>
                                        <div style={{ fontSize: 12, color: "#374151", display: "flex", justifyContent: "space-between" }}>
                                            <span>Semester {row.sem}</span>
                                            <strong>{row.ects.toFixed(1)} ECTS</strong>
                                        </div>
                                        <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden", position: "relative" }}>
                                            <div style={{ display: "flex", height: "100%" }}>
                                                <div style={{ width: `${greenPct}%`, height: "100%", background: "#16a34a" }} />
                                                {redPct > 0 && <div style={{ width: `${redPct}%`, height: "100%", background: "#dc2626" }} />}
                                            </div>
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    left: `${targetPct}%`,
                                                    top: 0,
                                                    width: 2,
                                                    height: "100%",
                                                    background: "#1f2937",
                                                    opacity: 0.45,
                                                    transform: "translateX(-1px)",
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {dashboardViewMode === "planning" && (
                <div
                    draggable
                    onDragStart={() => handlePlannedSectionDragStart("planned_category")}
                    onDragOver={(event) => handlePlannedSectionDragOver(event, "planned_category")}
                    onDrop={() => handlePlannedSectionDrop("planned_category")}
                    onDragEnd={handlePlannedSectionDragEnd}
                    style={plannedSectionStyle("planned_category", { marginBottom: 12 })}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Per Category (ECTS)</div>
                        <button
                            onClick={() => setIsByCategoryOpen((v) => !v)}
                            style={{
                                border: "1px solid #d1d5db",
                                background: "#ffffff",
                                borderRadius: 999,
                                padding: "2px 8px",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            {isByCategoryOpen ? "Collapse" : "Expand"}
                        </button>
                    </div>
                    <div style={{ display: "grid", gap: 4, marginBottom: isByCategoryOpen ? 6 : 0 }}>
                        <div style={{ fontSize: 12, color: "#374151" }}>
                            Total categorized: <strong>{byCategoryTotalEcts.toFixed(1)} ECTS</strong> across <strong>{byCategoryRows.length}</strong> categories
                        </div>
                        {topByCategoryRow && (
                            <div style={{ fontSize: 12, color: "#374151" }}>
                                Largest category: <strong>{topByCategoryRow.category}</strong> ({topByCategoryRow.ects.toFixed(1)} ECTS)
                            </div>
                        )}
                    </div>
                    {isByCategoryOpen && (
                        <div style={{ display: "grid", gap: 6 }}>
                            {byCategoryRows.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>No category data yet.</div>}
                            {byCategoryRows.map((row, idx) => {
                                const pct = byCategoryTotalEcts > 0
                                    ? Math.max(0, Math.min(100, (row.ects / byCategoryTotalEcts) * 100))
                                    : 0;
                                return (
                                    <div key={`${row.category}-${idx}`} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                                            #{idx + 1} {row.category}
                                        </div>
                                        <div style={{ fontSize: 11, color: "#374151", display: "flex", justifyContent: "space-between" }}>
                                            <span>{row.ects.toFixed(1)} ECTS</span>
                                            <span>{pct.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {dashboardViewMode === "planning" && (
                <div
                    draggable
                    onDragStart={() => handlePlannedSectionDragStart("planned_hours")}
                    onDragOver={(event) => handlePlannedSectionDragOver(event, "planned_hours")}
                    onDrop={() => handlePlannedSectionDrop("planned_hours")}
                    onDragEnd={handlePlannedSectionDragEnd}
                    style={plannedSectionStyle("planned_hours", { marginBottom: 12 })}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Estimated Week-Hours per Semester</div>
                        <button
                            onClick={() => setIsPlannedEstimatedHoursOpen((v) => !v)}
                            style={{
                                border: "1px solid #d1d5db",
                                background: "#ffffff",
                                borderRadius: 999,
                                padding: "2px 8px",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            {isPlannedEstimatedHoursOpen ? "Collapse" : "Expand"}
                        </button>
                    </div>
                    <div style={{ fontSize: 12, color: "#374151", marginBottom: isPlannedEstimatedHoursOpen ? 6 : 0 }}>
                        {plannedEstimatedHoursPerSemesterRows.length === 0
                            ? "No estimated week-hours data yet."
                            : `Estimated average week-hours ${plannedEstimatedHoursAverage.toFixed(1)} h across ${plannedEstimatedHoursPerSemesterRows.length} semester${plannedEstimatedHoursPerSemesterRows.length === 1 ? "" : "s"}.`}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: isPlannedEstimatedHoursOpen ? 6 : 0 }}>
                        Target ~ {recommendedWeekHoursPerSemester.toFixed(1)} h / week / semester
                    </div>
                    <div style={{ fontSize: 12, color: plannedWeekHoursWithinDesiredWorkload ? "#166534" : "#991b1b", marginBottom: isPlannedEstimatedHoursOpen ? 6 : 0 }}>
                        {plannedEstimatedHoursPerSemesterRows.length === 0
                            ? "No estimated week-hours data yet."
                            : (plannedWeekHoursWithinDesiredWorkload
                                ? "You are under your desired week-hours workload in every semester."
                                : "At least one semester is above your desired week-hours workload.")}
                    </div>
                    {isPlannedEstimatedHoursOpen && (
                        <div style={{ display: "grid", gap: 8 }}>
                            {plannedEstimatedHoursPerSemesterRows.length === 0 && (
                                <div style={{ fontSize: 12, color: "#6b7280" }}>No estimated week-hours data yet.</div>
                            )}
                            {plannedEstimatedHoursPerSemesterRows.map((row) => {
                                const rowPct = Math.max(0, Math.min(100, (Number(row?.hours || 0) / maxWeekHoursForScale) * 100));
                                const targetPct = Math.max(0, Math.min(100, (recommendedWeekHoursPerSemester / maxWeekHoursForScale) * 100));
                                const greenPct = Math.max(0, Math.min(rowPct, targetPct));
                                const redPct = Math.max(0, rowPct - targetPct);
                                return (
                                    <div key={`planned-hours-semester-${row.sem}`} style={{ display: "grid", gap: 4 }}>
                                        <div style={{ fontSize: 12, color: "#374151", display: "flex", justifyContent: "space-between" }}>
                                            <span>Semester {row.sem}</span>
                                            <strong>{Number(row.hours).toFixed(1)} h</strong>
                                        </div>
                                        <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden", position: "relative" }}>
                                            <div style={{ display: "flex", height: "100%" }}>
                                                <div style={{ width: `${greenPct}%`, height: "100%", background: "#16a34a" }} />
                                                {redPct > 0 && <div style={{ width: `${redPct}%`, height: "100%", background: "#dc2626" }} />}
                                            </div>
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    left: `${targetPct}%`,
                                                    top: 0,
                                                    width: 2,
                                                    height: "100%",
                                                    background: "#1f2937",
                                                    opacity: 0.45,
                                                    transform: "translateX(-1px)",
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
