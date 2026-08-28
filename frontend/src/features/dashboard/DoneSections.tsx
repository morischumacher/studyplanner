/**
 * The six sections of the done half of the dashboard.
 *
 * They mirror the planned half, and the StEOP and focus-area sections share
 * their expanded state with it: a checklist left open on one tab is open on
 * the other, which is why both halves read the same panel flags.
 */

import { FOCUS_INFO_TEXT, STEOP_RULES_TEXT } from "../../domain/programmes.ts";
import type { DashboardMetrics } from "./metrics.ts";
import type { DashboardLaneInsights, DashboardSectionOrdering } from "./types.ts";
import type { DashboardPanels } from "./useDashboardPanels.ts";

export interface DoneSectionsProps {
    panels: DashboardPanels;
    metrics: DashboardMetrics;
    ordering: DashboardSectionOrdering;
    laneInsights: DashboardLaneInsights;
    selectedFocus: string;
    hasSelectedFocusArea: boolean;
}

export default function DoneSections({
    panels,
    metrics,
    ordering,
    laneInsights,
    selectedFocus,
    hasSelectedFocusArea,
}: DoneSectionsProps) {
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
        isExamSubjectProgressOpen,
        setIsExamSubjectProgressOpen,
        isDonePerSemesterEctsOpen,
        setIsDonePerSemesterEctsOpen,
        isDoneByCategoryOpen,
        setIsDoneByCategoryOpen,
        isDoneGradePerSemesterOpen,
        setIsDoneGradePerSemesterOpen,
    } = panels;
    const {
        isBachelorDashboard,
        bachelorFocus,
        bachelorSteopComplete,
        bachelorSteopLane,
        bachelorFocusComplete,
        steopRequiredEcts,
        steopMandatoryRequiredEcts,
        steopPoolRequiredEcts,
        steopDoneEcts,
        steopDonePct,
        steopMandatoryDoneEcts,
        steopPoolDoneEcts,
        steopMandatoryChecklist,
        steopPoolChecklist,
        focusChecklist,
        focusChecklistPct,
        focusChooseGroupRows,
        focusChooseItems,
        focusChooseSummary,
        focusRequiredItems,
        focusRequirementDoneCount,
        focusRequirementTotalCount,
        examSubjectProgress,
        examSubjectAggregatePct,
        examSubjectDoneEctsTotal,
        examSubjectTotalEctsTotal,
        examSubjectTotalDoneCount,
        examSubjectTotalCourseCount,
        donePerSemesterRows,
        donePerSemesterTotal,
        donePerSemesterWithinDesiredWorkload,
        workloadTargetPerSemester,
        maxDoneSemesterWorkloadForScale,
        donePerCategoryProgressRows,
        donePerCategoryDoneTotalEcts,
        donePerCategoryPlannedTotalEcts,
        donePerCategoryCompleteCount,
    } = metrics;
    const {
        handleDoneSectionDragStart,
        handleDoneSectionDragOver,
        handleDoneSectionDrop,
        handleDoneSectionDragEnd,
        doneSectionStyle,
    } = ordering;
    const {
        doneGradePerSemesterRows,
        doneGradeOverall,
        missingDoneGradesBySemester,
        missingDoneGradesCount,
    } = laneInsights;

    return (
        <>
            {isBachelorDashboard && dashboardViewMode === "progress" && (
                <div
                    draggable
                    onDragStart={() => handleDoneSectionDragStart("steop")}
                    onDragOver={(event) => handleDoneSectionDragOver(event, "steop")}
                    onDrop={() => handleDoneSectionDrop("steop")}
                    onDragEnd={handleDoneSectionDragEnd}
                    style={doneSectionStyle("steop", { marginBottom: 12 })}
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
                            Status: <strong style={{ color: bachelorSteopComplete ? "#166534" : "#991b1b" }}>
                                {bachelorSteopComplete ? "completed" : "not completed"}
                            </strong>
                        </div>
                        <div style={{ fontSize: 12 }}>
                            Complete in semester: <strong>{bachelorSteopLane == null ? "-" : bachelorSteopLane + 1}</strong>
                        </div>
                        <div style={{ fontSize: 12 }}>
                            Done progress: <strong>{steopDoneEcts.toFixed(1)}</strong> / {steopRequiredEcts.toFixed(1)} ECTS
                            {" "}(
                            mandatory {steopMandatoryDoneEcts.toFixed(1)}/{steopMandatoryRequiredEcts.toFixed(1)},
                            {" "}pool {steopPoolDoneEcts.toFixed(1)}/{steopPoolRequiredEcts.toFixed(1)}
                            )
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                            <div style={{ width: `${steopDonePct}%`, height: "100%", background: bachelorSteopComplete ? "#16a34a" : "#2563eb" }} />
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
                                {steopMandatoryChecklist
                                    .filter((row) => !bachelorSteopComplete || row.done)
                                    .map((row, idx) => (
                                        <div key={`steop-man-${idx}`} style={{ fontSize: 12, color: row.done ? "#166534" : "#991b1b" }}>
                                            {row.done ? "✓" : "○"} {row.label}
                                        </div>
                                    ))}
                                <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>
                                    Pool requirement (need at least {steopPoolRequiredEcts.toFixed(1)} ECTS):
                                </div>
                                {steopPoolChecklist
                                    .filter((row) => !bachelorSteopComplete || row.done)
                                    .map((row, idx) => (
                                        <div key={`steop-pool-${idx}`} style={{ fontSize: 12, color: row.done ? "#166534" : "#991b1b" }}>
                                            {row.done ? "✓" : "○"} {row.label}
                                        </div>
                                    ))}
                            </>
                        )}
                    </div>
                </div>
            )}

            {isBachelorDashboard && hasSelectedFocusArea && dashboardViewMode === "progress" && (
                <div
                    draggable
                    onDragStart={() => handleDoneSectionDragStart("focus")}
                    onDragOver={(event) => handleDoneSectionDragOver(event, "focus")}
                    onDrop={() => handleDoneSectionDrop("focus")}
                    onDragEnd={handleDoneSectionDragEnd}
                    style={doneSectionStyle("focus", { marginBottom: 12 })}
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
                            Status: <strong style={{ color: bachelorFocusComplete ? "#166534" : "#991b1b" }}>
                                {bachelorFocusComplete ? "completed" : "not completed"}
                            </strong>
                        </div>
                        <div style={{ fontSize: 12 }}>
                            Checklist progress: <strong>{focusRequirementDoneCount}</strong> / {focusRequirementTotalCount}
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                            <div style={{ width: `${focusChecklistPct}%`, height: "100%", background: bachelorFocusComplete ? "#16a34a" : "#2563eb" }} />
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
                                {focusChecklist.length === 0 && (
                                    <div style={{ fontSize: 12, color: "#6b7280" }}>No detailed focus checklist available.</div>
                                )}
                                {focusRequiredItems.length > 0 && (
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginTop: 2 }}>Mandatory modules</div>
                                )}
                                {focusRequiredItems
                                    .filter((item) => !bachelorFocusComplete || Boolean(item?.done))
                                    .map((item, idx) => (
                                        <div key={`focus-req-${idx}`} style={{ fontSize: 12, color: item?.done ? "#166534" : "#991b1b" }}>
                                            {item?.done ? "✓" : "○"} {item?.label}
                                        </div>
                                    ))}
                                {focusChooseItems.length > 0 && (
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginTop: 4 }}>
                                        Choose {Number(focusChooseSummary?.min || 0)} from {focusChooseItems.length} modules
                                        {focusChooseSummary ? ` (${Number(focusChooseSummary?.done || 0)} done)` : ""}
                                    </div>
                                )}
                                {focusChooseItems
                                    .filter((item) => !bachelorFocusComplete || Boolean(item?.done))
                                    .map((item, idx) => (
                                        <div key={`focus-choose-${idx}`} style={{ fontSize: 12, color: item?.done ? "#166534" : "#991b1b" }}>
                                            {item?.done ? "✓" : "○"} {item?.label}
                                        </div>
                                    ))}
                                {focusChooseGroupRows.map((group, gIdx) => (
                                    <div key={`focus-group-${gIdx}`} style={{ display: "grid", gap: 4 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginTop: 4 }}>
                                            Choose {Number(group?.summary?.min || 0)} from {group.items.length} modules
                                            {group?.summary ? ` (${Number(group.summary?.done || 0)} done)` : ""}
                                        </div>
                                        {group.items
                                            .filter((item) => !bachelorFocusComplete || Boolean(item?.done))
                                            .map((item, idx) => (
                                                <div key={`focus-group-item-${gIdx}-${idx}`} style={{ fontSize: 12, color: item?.done ? "#166534" : "#991b1b" }}>
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

            {dashboardViewMode === "progress" && (
                <div
                    draggable
                    onDragStart={() => handleDoneSectionDragStart("exam_subject")}
                    onDragOver={(event) => handleDoneSectionDragOver(event, "exam_subject")}
                    onDrop={() => handleDoneSectionDrop("exam_subject")}
                    onDragEnd={handleDoneSectionDragEnd}
                    style={doneSectionStyle("exam_subject", { marginBottom: 12 })}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Per Exam Subject (ECTS)</div>
                        <button
                            onClick={() => setIsExamSubjectProgressOpen((v) => !v)}
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
                            {isExamSubjectProgressOpen ? "Collapse" : "Expand"}
                        </button>
                    </div>
                    <div style={{ display: "grid", gap: 4, marginBottom: isExamSubjectProgressOpen ? 6 : 0 }}>
                        <div style={{ fontSize: 12, color: "#374151" }}>
                            Done <strong>{examSubjectTotalDoneCount}/{examSubjectTotalCourseCount}</strong> courses •{" "}
                            <strong>{examSubjectDoneEctsTotal.toFixed(1)}/{examSubjectTotalEctsTotal.toFixed(1)} ECTS</strong>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                            <div style={{ width: `${examSubjectAggregatePct}%`, height: "100%", background: examSubjectAggregatePct >= 100 - 1e-6 ? "#16a34a" : "#2563eb" }} />
                        </div>
                    </div>
                    {isExamSubjectProgressOpen && (
                        <div style={{ display: "grid", gap: 6 }}>
                            {examSubjectProgress.length === 0 && (
                                <div style={{ fontSize: 12, color: "#6b7280" }}>No exam-subject progress available yet.</div>
                            )}
                            {examSubjectProgress.map((row, idx) => {
                                const totalEcts = Number(row?.totalEcts || 0);
                                const doneEcts = Number(row?.doneEcts || 0);
                                const donePct = totalEcts > 0 ? Math.max(0, Math.min(100, (doneEcts / totalEcts) * 100)) : 0;
                                return (
                                    <div key={`${row?.subject}-${idx}`} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{row?.subject}</div>
                                        <div style={{ fontSize: 11, color: "#374151", marginBottom: 4 }}>
                                            Done {row.doneCount}/{row.totalCount} courses • {doneEcts.toFixed(1)}/{totalEcts.toFixed(1)} ECTS
                                        </div>
                                        <div style={{ height: 6, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                                            <div style={{ width: `${donePct}%`, height: "100%", background: donePct >= 100 - 1e-6 ? "#16a34a" : "#2563eb" }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {dashboardViewMode === "progress" && (
                <div
                    draggable
                    onDragStart={() => handleDoneSectionDragStart("done_semester")}
                    onDragOver={(event) => handleDoneSectionDragOver(event, "done_semester")}
                    onDrop={() => handleDoneSectionDrop("done_semester")}
                    onDragEnd={handleDoneSectionDragEnd}
                    style={doneSectionStyle("done_semester", { marginBottom: 12 })}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Per Semester (ECTS)</div>
                        <button
                            onClick={() => setIsDonePerSemesterEctsOpen((v) => !v)}
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
                            {isDonePerSemesterEctsOpen ? "Collapse" : "Expand"}
                        </button>
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: isDonePerSemesterEctsOpen ? 6 : 0 }}>
                        Target ~ {workloadTargetPerSemester.toFixed(1)} ECTS / semester
                    </div>
                    <div style={{ fontSize: 12, color: donePerSemesterWithinDesiredWorkload ? "#166534" : "#991b1b", marginBottom: isDonePerSemesterEctsOpen ? 6 : 0 }}>
                        {donePerSemesterRows.length === 0
                            ? "No done semester data yet."
                            : (donePerSemesterWithinDesiredWorkload
                                ? `Done total ${donePerSemesterTotal.toFixed(1)} ECTS and under desired workload in every semester.`
                                : `Done total ${donePerSemesterTotal.toFixed(1)} ECTS; at least one semester is above desired workload.`)}
                    </div>
                    {isDonePerSemesterEctsOpen && (
                        <div style={{ display: "grid", gap: 8 }}>
                            {donePerSemesterRows.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>No done semester data yet.</div>}
                            {donePerSemesterRows.map((row) => {
                                const rowPct = Math.max(0, Math.min(100, (row.ects / maxDoneSemesterWorkloadForScale) * 100));
                                const targetPct = Math.max(0, Math.min(100, (workloadTargetPerSemester / maxDoneSemesterWorkloadForScale) * 100));
                                const greenPct = Math.max(0, Math.min(rowPct, targetPct));
                                const redPct = Math.max(0, rowPct - targetPct);
                                return (
                                    <div key={`done-semester-row-${row.sem}`} style={{ display: "grid", gap: 4 }}>
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

            {dashboardViewMode === "progress" && (
                <div
                    draggable
                    onDragStart={() => handleDoneSectionDragStart("category")}
                    onDragOver={(event) => handleDoneSectionDragOver(event, "category")}
                    onDrop={() => handleDoneSectionDrop("category")}
                    onDragEnd={handleDoneSectionDragEnd}
                    style={doneSectionStyle("category", { marginBottom: 12 })}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Per Category (ECTS)</div>
                        <button
                            onClick={() => setIsDoneByCategoryOpen((v) => !v)}
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
                            {isDoneByCategoryOpen ? "Collapse" : "Expand"}
                        </button>
                    </div>
                    <div style={{ display: "grid", gap: 4, marginBottom: isDoneByCategoryOpen ? 6 : 0 }}>
                        <div style={{ fontSize: 12, color: "#374151" }}>
                            Done <strong>{donePerCategoryDoneTotalEcts.toFixed(1)} / {donePerCategoryPlannedTotalEcts.toFixed(1)} ECTS</strong> across <strong>{donePerCategoryProgressRows.length}</strong> categories
                        </div>
                        {donePerCategoryProgressRows.length > 0 && (
                            <div style={{ fontSize: 12, color: "#374151" }}>
                                Fully done categories: <strong>{donePerCategoryCompleteCount}</strong> / {donePerCategoryProgressRows.length}
                            </div>
                        )}
                    </div>
                    {isDoneByCategoryOpen && (
                        <div style={{ display: "grid", gap: 6 }}>
                            {donePerCategoryProgressRows.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>No done category data yet.</div>}
                            {donePerCategoryProgressRows.map((row, idx) => {
                                return (
                                    <div key={`done-by-category-row-${idx}`} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                                            #{idx + 1} {row.category}
                                        </div>
                                        <div style={{ fontSize: 11, color: "#374151", marginBottom: 4 }}>
                                            {row.doneEcts.toFixed(1)} / {row.plannedEcts.toFixed(1)} ECTS done ({row.pct.toFixed(1)}%)
                                        </div>
                                        <div style={{ height: 6, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                                            <div style={{ width: `${row.pct}%`, height: "100%", background: row.pct >= 100 - 1e-6 ? "#16a34a" : "#2563eb" }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {dashboardViewMode === "progress" && (
                <div
                    draggable
                    onDragStart={() => handleDoneSectionDragStart("done_grade")}
                    onDragOver={(event) => handleDoneSectionDragOver(event, "done_grade")}
                    onDrop={() => handleDoneSectionDrop("done_grade")}
                    onDragEnd={handleDoneSectionDragEnd}
                    style={doneSectionStyle("done_grade", { marginBottom: 12 })}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Grade per Semester</div>
                        <button
                            onClick={() => setIsDoneGradePerSemesterOpen((v) => !v)}
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
                            {isDoneGradePerSemesterOpen ? "Collapse" : "Expand"}
                        </button>
                    </div>
                    <div style={{ fontSize: 12, color: "#374151", marginBottom: isDoneGradePerSemesterOpen ? 6 : 0 }}>
                        {doneGradeOverall == null
                            ? "No done grades with ECTS weighting yet."
                            : (
                                <>
                                    Overall ECTS-weighted grade: <strong>{doneGradeOverall.toFixed(2)}</strong> across {doneGradePerSemesterRows.length} semester{doneGradePerSemesterRows.length === 1 ? "" : "s"}.
                                </>
                            )}
                    </div>
                    <div style={{ fontSize: 12, color: missingDoneGradesCount === 0 ? "#166534" : "#991b1b", marginBottom: isDoneGradePerSemesterOpen ? 6 : 0 }}>
                        {missingDoneGradesCount === 0
                            ? "All done courses have a grade."
                            : `Missing grades for ${missingDoneGradesCount} done course${missingDoneGradesCount === 1 ? "" : "s"}.`}
                    </div>
                    {isDoneGradePerSemesterOpen && (
                        <div style={{ display: "grid", gap: 8 }}>
                            {doneGradePerSemesterRows.length === 0 && (
                                <div style={{ fontSize: 12, color: "#6b7280" }}>No done grades with ECTS weighting yet.</div>
                            )}
                            {doneGradePerSemesterRows.map((row) => {
                                const normalized = Math.max(0, Math.min(100, ((5 - Number(row.grade || 0)) / 4) * 100));
                                return (
                                    <div key={`done-grade-semester-${row.sem}`} style={{ display: "grid", gap: 4 }}>
                                        <div style={{ fontSize: 12, color: "#374151", display: "flex", justifyContent: "space-between" }}>
                                            <span>Semester {row.sem}</span>
                                            <strong>{Number(row.grade).toFixed(2)}</strong>
                                        </div>
                                        <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                                            <div style={{ width: `${normalized}%`, height: "100%", background: "#16a34a" }} />
                                        </div>
                                    </div>
                                );
                            })}
                            {missingDoneGradesCount > 0 && (
                                <div style={{ display: "grid", gap: 6, marginTop: 2 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#991b1b" }}>Missing grade entries</div>
                                    {missingDoneGradesBySemester.map((row) => (
                                        <div key={`missing-grade-sem-${row.sem}`} style={{ border: "1px solid #fecaca", borderRadius: 8, padding: 8, background: "#fef2f2" }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: "#7f1d1d", marginBottom: 4 }}>
                                                Semester {row.sem}
                                            </div>
                                            <div style={{ display: "grid", gap: 3 }}>
                                                {row.missingCourses.map((course, idx) => (
                                                    <div key={`missing-grade-course-${row.sem}-${idx}`} style={{ fontSize: 12, color: "#991b1b" }}>
                                                        {course?.code || "-"}{course?.name ? ` · ${course.name}` : ""}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
