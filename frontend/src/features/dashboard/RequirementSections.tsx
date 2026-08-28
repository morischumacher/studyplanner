/**
 * The two sections that report what the rule check found: the requirements
 * still missing, and the warnings.
 *
 * Their Expand buttons are disabled while there is nothing to show, and the
 * sections close themselves once the last entry goes away, so neither can be
 * left standing open over an empty list.
 */

import type { DashboardMetrics } from "./metrics.ts";
import type { DashboardSectionOrdering } from "./types.ts";
import type { DashboardPanels } from "./useDashboardPanels.ts";

export interface RequirementSectionsProps {
    panels: DashboardPanels;
    metrics: DashboardMetrics;
    ordering: DashboardSectionOrdering;
}

export default function RequirementSections({ panels, metrics, ordering }: RequirementSectionsProps) {
    const {
        dashboardViewMode,
        isMissingRequirementsOpen,
        setIsMissingRequirementsOpen,
        isWarningsOpen,
        setIsWarningsOpen,
    } = panels;
    const {
        hasMissingRequirements,
        hasWarnings,
        missingItems,
        warnings,
    } = metrics;
    const {
        handlePlannedSectionDragStart,
        handlePlannedSectionDragOver,
        handlePlannedSectionDrop,
        handlePlannedSectionDragEnd,
        plannedSectionStyle,
    } = ordering;

    return (
        <>
            {dashboardViewMode === "planning" && (
                <>
                    <div
                        draggable
                        onDragStart={() => handlePlannedSectionDragStart("missing")}
                        onDragOver={(event) => handlePlannedSectionDragOver(event, "missing")}
                        onDrop={() => handlePlannedSectionDrop("missing")}
                        onDragEnd={handlePlannedSectionDragEnd}
                        style={plannedSectionStyle("missing", { marginBottom: 12 })}
                    >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>Missing Requirements</div>
                            <button
                                onClick={() => {
                                    if (!hasMissingRequirements) return;
                                    setIsMissingRequirementsOpen((v) => !v);
                                }}
                                disabled={!hasMissingRequirements}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    borderRadius: 999,
                                    padding: "2px 8px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: hasMissingRequirements ? "pointer" : "not-allowed",
                                    opacity: hasMissingRequirements ? 1 : 0.45,
                                }}
                            >
                                {isMissingRequirementsOpen ? "Collapse" : "Expand"}
                            </button>
                        </div>
                        <div style={{ fontSize: 12, color: missingItems.length === 0 ? "#166534" : "#991b1b", marginBottom: isMissingRequirementsOpen ? 6 : 0 }}>
                            {missingItems.length === 0
                                ? "No missing requirements."
                                : `${missingItems.length} missing requirement${missingItems.length === 1 ? "" : "s"}.`}
                        </div>
                        {isMissingRequirementsOpen && (
                            <div style={{ display: "grid", gap: 6 }}>
                                {missingItems.length === 0 && (
                                    <div style={{ fontSize: 12, color: "#166534" }}>No missing requirements reported.</div>
                                )}
                                {missingItems.map((m, idx) => (
                                    <div
                                        key={`${m}-${idx}`}
                                        style={{
                                            fontSize: 12,
                                            color: "#991b1b",
                                            border: "1px solid #fecaca",
                                            borderLeft: "4px solid #dc2626",
                                            borderRadius: 8,
                                            background: "#fef2f2",
                                            padding: "6px 8px",
                                        }}
                                    >
                                        {m}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div
                        draggable
                        onDragStart={() => handlePlannedSectionDragStart("warnings")}
                        onDragOver={(event) => handlePlannedSectionDragOver(event, "warnings")}
                        onDrop={() => handlePlannedSectionDrop("warnings")}
                        onDragEnd={handlePlannedSectionDragEnd}
                        style={plannedSectionStyle("warnings", { marginBottom: 12 })}
                    >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>Warnings</div>
                            <button
                                onClick={() => {
                                    if (!hasWarnings) return;
                                    setIsWarningsOpen((v) => !v);
                                }}
                                disabled={!hasWarnings}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    borderRadius: 999,
                                    padding: "2px 8px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: hasWarnings ? "pointer" : "not-allowed",
                                    opacity: hasWarnings ? 1 : 0.45,
                                }}
                            >
                                {isWarningsOpen ? "Collapse" : "Expand"}
                            </button>
                        </div>
                        <div style={{ fontSize: 12, color: warnings.length === 0 ? "#6b7280" : "#92400e", marginBottom: isWarningsOpen ? 6 : 0 }}>
                            {warnings.length === 0
                                ? "No warnings."
                                : `${warnings.length} warning${warnings.length === 1 ? "" : "s"}.`}
                        </div>
                        {isWarningsOpen && (
                            <div style={{ display: "grid", gap: 6 }}>
                                {warnings.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>No warnings.</div>}
                                {warnings.map((w, idx) => (
                                    <div
                                        key={`${w}-${idx}`}
                                        style={{
                                            fontSize: 12,
                                            color: "#92400e",
                                            border: "1px solid #fde68a",
                                            borderLeft: "4px solid #f59e0b",
                                            borderRadius: 8,
                                            background: "#fffbeb",
                                            padding: "6px 8px",
                                        }}
                                    >
                                        {w}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </>
    );
}
