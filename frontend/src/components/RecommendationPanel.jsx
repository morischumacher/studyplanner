import React, { useState } from "react";
import {
    combinedCardShadow,
    layeredTypeShadow,
    stateVisualByStatus,
    REC_TYPE_META,
    renderRecommendationPatch,
} from "../utils/courseVisuals.js";
import { displayCourseHeader, displayCourseTitle } from "../utils/courseCodeDisplay.js";
import { mapTypeForProgram } from "../utils/courseVisuals.js";

// ── RecommendationPanel ───────────────────────────────────────────────────────
/**
 * Props:
 *   recommendations  – array of recommendations
 *   onDismiss(id)    – remove recommendation
 *   onPark(payload)  – park course
 *   onAddToPlan(payload, laneIndex) – add to plan
 *   onRemoveCourseFromPlan(code) – remove from plan
 *   onToggleCourseDone(code, isDone) – toggle done
 *   semesterOptions  – available semesters
 *   getValidSemestersForCourse(code) – filter semesters
 *   toggles          – recommendation type toggles
 *   onToggleChange(key, val) – change toggle state
 *   getCourseStatus(code) – get current course status
 *   programCode      – current program code
 *   subjectColors    – colors for subjects
 *   onDragStart      – drag handler
 */
export default function RecommendationPanel({
    recommendations = [],
    onDismiss,
    onPark,
    onAddToPlan,
    onRemoveCourseFromPlan,
    onToggleCourseDone,
    semesterOptions = [],
    getValidSemestersForCourse,
    toggles = {},
    onToggleChange,
    width = 330,
    leftOffset = 338,
    topOffset = 10,
    bottomOffset = 40,
    getCourseStatus,
    programCode,
    subjectColors = {},
    onDragStart,
}) {
    // Track which card has its menu expanded
    const [menuState, setMenuState] = useState({ id: null, view: "root" }); // view: 'root', 'semesters', or 'details'
    const [plusRevealCount, setPlusRevealCount] = useState(0);
    const [expandedIds, setExpandedIds] = useState(new Set());

    const toggleExpand = (id, e) => {
        if (e) e.stopPropagation();
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleMenuView = (id, view) => {
        setPlusRevealCount(0);
        if (menuState.id === id && menuState.view === view) {
            setMenuState({ id: null, view: "root" });
        } else {
            setMenuState({ id, view });
        }
    };

    const closeMenu = () => {
        setPlusRevealCount(0);
        setMenuState({ id: null, view: "root" });
    };

    const semesterButtonLabel = (semester) => (semester?.isPlus ? `+ ${semester.title}` : semester?.title);

    // ── Toggles UI ────────────────────────────────────────────────────────
    const renderToggles = () => {
        const toggleItems = [
            { key: "interest", label: "Interests" },
            { key: "similarity", label: "Similarity" },
            { key: "internship", label: "Internships" },
            { key: "peer", label: "Other students" },
        ];
        return (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {toggleItems.map(({ key, label }) => {
                    const isActive = toggles[key] !== false;
                    return (
                        <button
                            key={key}
                            onClick={() => onToggleChange?.(key, !isActive)}
                            style={{
                                borderRadius: 16,
                                padding: "4px 10px",
                                fontSize: 11,
                                fontWeight: 600,
                                border: `1px solid ${isActive ? "#1e40af" : "#d1d5db"}`,
                                background: isActive ? "#eff6ff" : "#ffffff",
                                color: isActive ? "#1e40af" : "#6b7280",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                            }}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        );
    };

    const visibleRecommendations = (recommendations || []).filter(
        (rec) => toggles[rec.type] !== false
    );

    // ── Main Card List & Empty State Unified ─────────────────────────────
    return (
        <aside
            id="recommendation-panel-container"
            onScroll={() => closeMenu()}
            style={{
                width,
                marginTop: topOffset,
                marginBottom: bottomOffset,
                marginLeft: leftOffset,
                height: `calc(100vh - ${topOffset + bottomOffset}px)`,
                alignSelf: "flex-start",
                background: "#ffffff",
                borderRight: "1px solid #e5e7eb",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                position: "fixed",
                left: 0,
                top: 0,
                zIndex: 1000,
                boxSizing: "border-box",
            }}
        >
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Recommendations</div>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>Smart suggestions based on your plan.</p>
            {renderToggles()}

            {visibleRecommendations.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 32, color: "#9ca3af" }}>
                    <div>
                        <div style={{ fontSize: 28, marginBottom: 10 }}>🎯</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {Object.values(toggles).every((v) => v === false) ? "All disabled" : "No recommendations"}
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ display: "grid", gap: 14, alignContent: "start", overflowY: "auto", flex: 1, padding: "10px 4px 10px 2px" }}>
                    {visibleRecommendations.map((rec) => {
                        const courseCode = rec.courseCode;
                        const courseName = rec.courseName;
                        const courseStatus = getCourseStatus?.(courseCode) ?? "todo";
                        const subjectColor = subjectColors[rec.examSubject] || rec.color || "#4b5563";

                        const typeInfo = mapTypeForProgram(rec.category, programCode);
                        const stateMeta = stateVisualByStatus(courseStatus);
                        const typeShadow = layeredTypeShadow(subjectColor, typeInfo.layers, stateMeta.background || "transparent");
                        const combinedShadow = combinedCardShadow(typeShadow, stateMeta.extraShadow);

                        const coursePayload = {
                            code: courseCode,
                            name: courseName,
                            ects: rec.ects ?? null,
                            category: rec.category ?? null,
                            examSubject: rec.examSubject ?? null,
                            subjectColor,
                        };

                        const isAddableStatus = (status) => status === "todo" || status === "parked";

                        return (
                            <div
                                key={rec.id}
                                draggable={true}
                                onClick={(e) => { e.stopPropagation(); toggleMenuView(rec.id, "root"); }}
                                onDragStart={(e) => {
                                    if (!isAddableStatus(courseStatus)) { e.preventDefault(); return; }
                                    onDragStart?.(e, { kind: "course", ...coursePayload, type: rec.courseType || null });
                                }}
                                style={{
                                    textAlign: "left",
                                    border: `1px solid ${stateMeta.borderColor || subjectColor}`,
                                    borderRadius: 12,
                                    background: stateMeta.background,
                                    boxShadow: combinedShadow,
                                    padding: "12px",
                                    cursor: isAddableStatus(courseStatus) ? "grab" : "pointer",
                                    opacity: menuState.id === rec.id ? 1 : stateMeta.opacity,
                                    display: "grid",
                                    gap: 8,
                                    position: "relative",
                                    zIndex: menuState.id === rec.id ? 3000 : 1,
                                    width: "100%",
                                    boxSizing: "border-box",
                                }}
                            >
                                {renderRecommendationPatch(rec.type)}

                                {/* Row 1: Code + Actions */}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                    <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {displayCourseHeader(courseCode, courseName, rec.courseType)}
                                    </div>
                                    <div style={{ display: "inline-flex", gap: 6 }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleMenuView(rec.id, "details"); }}
                                            style={{ border: `1px solid ${subjectColor}`, background: "#fff", borderRadius: 6, fontSize: 12, height: "22px", minWidth: "24px", cursor: "pointer" }}
                                        >i</button>
                                        {isAddableStatus(courseStatus) && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleMenuView(rec.id, "semesters"); }}
                                                style={{ border: `1px solid ${subjectColor}`, background: "#fff", borderRadius: 6, fontSize: 12, height: "22px", minWidth: "24px", cursor: "pointer" }}
                                            >+</button>
                                        )}
                                        {(courseStatus === "in_plan" || courseStatus === "done") && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onToggleCourseDone?.(courseCode, courseStatus !== "done"); }}
                                                style={{ border: `1px solid ${courseStatus === "done" ? "#9ca3af" : subjectColor}`, background: courseStatus === "done" ? "#10b981" : "#fff", color: courseStatus === "done" ? "#fff" : "#111827", borderRadius: 6, fontSize: 12, height: "22px", minWidth: "24px", cursor: "pointer" }}
                                            >✓</button>
                                        )}
                                        {(courseStatus === "in_plan" || courseStatus === "done" || courseStatus === "parked") && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onRemoveCourseFromPlan?.(courseCode); }}
                                                style={{ border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 12, height: "22px", minWidth: "24px", cursor: "pointer" }}
                                            >×</button>
                                        )}
                                    </div>
                                </div>

                                {/* Row 2: Title */}
                                <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.25, color: courseStatus === "done" ? "#6b7280" : "#111827" }}>
                                    {displayCourseTitle(courseName)}
                                </div>

                                {/* Recommendation Explanation (Restored as requested) */}
                                {rec.evidence && (
                                    <div style={{ fontSize: 12, color: "#64748b", fontStyle: "italic", lineHeight: 1.4 }}>
                                        {rec.evidence.length > 120 && !expandedIds.has(rec.id) ? (
                                            <>
                                                {rec.evidence.slice(0, 115)}...{" "}
                                                <button
                                                    onClick={(e) => toggleExpand(rec.id, e)}
                                                    style={{ border: "none", background: "none", color: "#3b82f6", cursor: "pointer", padding: 0, fontStyle: "normal", fontWeight: 700, fontSize: 10, textTransform: "uppercase" }}
                                                >
                                                    Show all
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {rec.evidence}
                                                {rec.evidence.length > 120 && (
                                                    <button
                                                        onClick={(e) => toggleExpand(rec.id, e)}
                                                        style={{ border: "none", background: "none", color: "#3b82f6", cursor: "pointer", padding: "0 0 0 4px", fontStyle: "normal", fontWeight: 700, fontSize: 10, textTransform: "uppercase" }}
                                                    >
                                                        Show less
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Row 3: ECTS + Type Label */}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
                                    <span style={{ color: "#6b7280" }}>{rec.ects ? `${rec.ects} ECTS` : "-"}</span>
                                    <span style={{ color: "#6b7280", fontWeight: 700 }}>{typeInfo.label}</span>
                                    <span style={{ color: courseStatus === "done" ? "#166534" : (courseStatus === "in_plan" ? "#1d4ed8" : "#6b7280"), fontWeight: 700 }}>
                                        {courseStatus === "done" ? "done" : (courseStatus === "in_plan" ? "planned" : (courseStatus === "parked" ? "parked" : "not planned"))}
                                    </span>
                                </div>

                                {/* Popover Menus */}
                                {menuState.id === rec.id && (
                                    <div style={{ position: "absolute", top: 34, right: -8, width: menuState.view === "details" ? 240 : 190, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", padding: 6, zIndex: 4000, display: "grid", gap: 4 }}>
                                        {menuState.view === "root" && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); toggleMenuView(rec.id, "details"); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View reasoning</button>
                                                {!isAddableStatus(courseStatus) ? (
                                                    <button onClick={(e) => { e.stopPropagation(); onRemoveCourseFromPlan?.(courseCode); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Remove from plan</button>
                                                ) : (
                                                    <button onClick={(e) => { e.stopPropagation(); toggleMenuView(rec.id, "semesters"); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add to plan</button>
                                                )}
                                            </>
                                        )}
                                        {menuState.view === "semesters" && (
                                            <>
                                                {(typeof getValidSemestersForCourse === "function" ? getValidSemestersForCourse(courseCode) : semesterOptions).filter(Boolean).map((sem) => (
                                                    <button key={sem.id} onClick={(e) => { e.stopPropagation(); onAddToPlan?.(coursePayload, sem.id - 1); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{semesterButtonLabel(sem)}</button>
                                                ))}
                                                <button onClick={(e) => { e.stopPropagation(); toggleMenuView(null, "root"); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "center", background: "#f9fafb", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Back</button>
                                            </>
                                        )}
                                        {menuState.view === "details" && (
                                            <div style={{ display: "grid", gap: 8, padding: 4 }}>
                                                {rec.evidence && (
                                                    <div style={{ padding: "10px", background: "#f8fafc", borderRadius: 8, fontSize: 12, color: "#334155", borderLeft: "4px solid #f59e0b", lineHeight: 1.5 }}>
                                                        <strong>Why this suggestion?</strong><br />{rec.evidence}
                                                    </div>
                                                )}
                                                {rec.content && rec.content.length > 0 && (
                                                    <div style={{ padding: "8px 10px", background: "#eff6ff", borderRadius: 8, fontSize: 12, color: "#1e40af", borderLeft: "4px solid #3b82f6" }}>
                                                        <strong>Focus Area:</strong><br />
                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                                                            {rec.content.map((item, idx) => (
                                                                <span key={idx} style={{ background: "#dbeafe", padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>{item}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <button onClick={(e) => { e.stopPropagation(); toggleMenuView(null, "root"); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "center", background: "#f9fafb", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Back</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </aside>
    );
}
