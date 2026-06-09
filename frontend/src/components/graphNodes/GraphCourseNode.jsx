import React, { useEffect, useRef, useState } from "react";
import { Handle, Position } from "reactflow";
import { CARD_WIDTH, NODE_HEIGHT } from "../../utils/constants.js";
import { hexToRgba } from "../../utils/examSubjectColors.js";
import {
    combinedCardShadow,
    layeredTypeShadow,
    mapTypeForProgram,
    stateVisualByStatus,
} from "../../utils/courseVisuals.js";
import { displayCourseHeader, displayCourseTitle } from "../../utils/courseCodeDisplay.js";



export default function GraphCourseNode({ data }) {
    const color = data?.color || "#4b5563";
    const status = data?.status || "todo";
    const visualStatus = status;
    const isDone = status === "done";
    const isInPlan = status === "in_plan";
    const stateMeta = stateVisualByStatus(visualStatus);
    const cardBackground = stateMeta.background;
    const typeMeta = mapTypeForProgram(data?.category, data?.programCode);
    const typeShadow = layeredTypeShadow(color, typeMeta.layers, stateMeta.background || "transparent");
    const cardBorderColor = isDone ? color : (stateMeta.borderColor || color);
    const stateShadow = isDone ? "none" : stateMeta.extraShadow;
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuView, setMenuView] = useState(null);
    const menuRef = useRef(null);
    const rootRef = useRef(null);
    const courseCode = data?.courseCode;
    const isChildCourse = Boolean(data?.parentModulePayload || data?.groupId);
    const notes = String(data?.notes ?? "");
    const estimatedHours = String(data?.estimatedHours ?? "");
    const grade = String(data?.grade ?? "");

    useEffect(() => {
        if (!isMenuOpen) return;
        const handlePointerDown = (event) => {
            if (!menuRef.current?.contains(event.target)) setIsMenuOpen(false);
        };
        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [isMenuOpen]);

    useEffect(() => {
        const nodeEl = rootRef.current?.closest?.(".react-flow__node");
        if (!nodeEl) return;
        if (isMenuOpen) {
            nodeEl.style.zIndex = "100000";
            return () => {
                nodeEl.style.zIndex = "";
            };
        }
        return undefined;
    }, [isMenuOpen]);

    const statusStyle = (() => {
        if (status === "done") return { color: "#166534", label: "done" };
        if (status === "in_plan") return { color: "#1d4ed8", label: "in plan" };
        return { color: "#4b5563", label: "todo" };
    })();
    const headerCode = displayCourseHeader(data?.courseCode, data?.courseName ?? data?.label, data?.courseType);

    return (
        <div
            ref={rootRef}
            style={{
                width: CARD_WIDTH,
                minHeight: NODE_HEIGHT,
                borderRadius: 10,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: 16,
                position: "relative",
                overflow: "visible",
                background: cardBackground,
                color: stateMeta.textColor,
                border: `1px solid ${cardBorderColor}`,
                boxShadow: combinedCardShadow(typeShadow, stateShadow),
                fontWeight: 600,
                fontSize: 12,
                opacity: isMenuOpen ? 1 : stateMeta.opacity,
            }}
        >
            <Handle id="left-target" type="target" position={Position.Left} />
            <Handle id="right-source" type="source" position={Position.Right} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span>{headerCode}</span>
                    {data?.termAvailability && (
                        <>
                            <span>|</span>
                            <span 
                                style={{ 
                                    display: "inline-flex", 
                                    alignItems: "center", 
                                    filter: "grayscale(100%) brightness(0.4) opacity(0.7)", 
                                    fontSize: 10,
                                    lineHeight: 1,
                                    transform: "translateY(-0.5px)"
                                }} 
                                title={`Available in ${data.termAvailability}`}
                            >
                                {data.termAvailability === "summer" ? "☀️" : data.termAvailability === "winter" ? "❄️" : "☀️❄️"}
                            </span>
                        </>
                    )}
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <div style={{ position: "relative" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const nextView = "details";
                                    setIsMenuOpen((v) => (menuView === nextView ? !v : true));
                                    setMenuView(nextView);
                                }}
                                translate="no"
                                className="notranslate"
                                title="Details"
                                aria-label="Details"
                                style={{
                                    border: `1px solid ${isDone ? "#9ca3af" : color}`,
                                    background: "#ffffff",
                                    borderRadius: 6,
                                    fontSize: 12,
                                    width: 24,
                                    height: 20,
                                    lineHeight: 1,
                                    cursor: "pointer",
                                }}
                            >
                                i
                            </button>
                            {((status === "todo" || status === "parked") || isChildCourse) && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const nextView = "semesters";
                                        setIsMenuOpen((v) => (menuView === nextView ? !v : true));
                                        setMenuView(nextView);
                                    }}
                                    title="Add to plan"
                                    aria-label="Add to plan"
                                    style={{
                                        border: `1px solid ${cardBorderColor}`,
                                        background: "#ffffff",
                                        color: "#111827",
                                        borderRadius: 6,
                                        fontSize: 12,
                                        width: 24,
                                        height: 20,
                                        lineHeight: 1,
                                        cursor: "pointer",
                                    }}
                                >
                                    +
                                </button>
                            )}
                            {(isInPlan || isDone) && !isChildCourse && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        data?.onToggleDone?.(data?.courseCode, !isDone);
                                    }}
                                    title={isDone ? "Mark as in plan" : "Mark as done"}
                                    aria-label={isDone ? "Mark as in plan" : "Mark as done"}
                                    style={{
                                        border: `1px solid ${isDone ? "#9ca3af" : color}`,
                                        background: isDone ? "#10b981" : "#ffffff",
                                        color: isDone ? "#ffffff" : "#111827",
                                        borderRadius: 6,
                                        fontSize: 12,
                                        width: 24,
                                        height: 20,
                                        lineHeight: 1,
                                        cursor: "pointer",
                                    }}
                                >
                                    ✓
                                </button>
                            )}
                            {(isInPlan || isDone || status === "parked") && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (data?.parentModulePayload && data?.onRemoveModuleFromPlan) {
                                            const moduleName = data?.parentModulePayload?.name || "this module";
                                            const confirmed = window.confirm(
                                                `${data?.courseCode || "This course"} belongs to ${moduleName}. Removing it will remove all module courses from your plan. Continue?`
                                            );
                                            if (!confirmed) return;
                                            data.onRemoveModuleFromPlan(data.parentModulePayload);
                                        } else {
                                            data?.onRemoveFromPlan?.(data?.courseCode);
                                        }
                                    }}
                                    title="Remove from plan"
                                    aria-label="Remove from plan"
                                    style={{
                                        border: "1px solid #fca5a5",
                                        background: "#fef2f2",
                                        color: "#b91c1c",
                                        borderRadius: 6,
                                        fontSize: 12,
                                        width: 24,
                                        height: 20,
                                        lineHeight: 1,
                                        cursor: "pointer",
                                    }}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                        {isMenuOpen && (
                            <div
                                ref={menuRef}
                                style={{
                                    position: "absolute",
                                    top: 24,
                                    right: 0,
                                    width: menuView === "details" ? 240 : 180,
                                    border: "1px solid #d1d5db",
                                    borderRadius: 8,
                                    background: "#ffffff",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                                    padding: 6,
                                    display: "grid",
                                    gap: 4,
                                    zIndex: 100001,
                                }}
                            >
                                {menuView === "semesters" && (
                                    <>
                                        {(Array.isArray(data?.semesters) ? data.semesters : []).map((semester) => {
                                            const isParkingChoice = Boolean(semester?.isParking) || Number(semester?.id) === 0;
                                            const disableChoice = status === "parked" && isParkingChoice;
                                            return (
                                            <button
                                                key={semester.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (disableChoice) return;
                                                    const laneIndex = Number.isFinite(Number(semester?.laneIndex))
                                                        ? Number(semester.laneIndex)
                                                        : (Number.isFinite(Number(semester?.id)) ? (Number(semester.id) - 1) : 0);
                                                    if (data?.parentModulePayload && data?.onAddModuleToPlan) {
                                                        const confirmed = window.confirm(
                                                            `${data?.courseCode || "This course"} belongs to a module. Adding it will automatically add all module courses. Continue?`
                                                        );
                                                        if (!confirmed) return;
                                                        data.onAddModuleToPlan(data.parentModulePayload, laneIndex);
                                                    } else {
                                                        data?.onAddToPlan?.({
                                                            code: data?.courseCode,
                                                            name: data?.courseName,
                                                            ects: data?.ects ?? null,
                                                            category: data?.category ?? null,
                                                            examSubject: data?.examSubject ?? null,
                                                            subjectColor: color,
                                                        }, laneIndex);
                                                    }
                                                    setIsMenuOpen(false);
                                                    setMenuView(null);
                                                }}
                                                disabled={disableChoice}
                                                style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: disableChoice ? "#f3f4f6" : "#ffffff", cursor: disableChoice ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, color: disableChoice ? "#9ca3af" : "#111827" }}
                                            >
                                                {semester.title}
                                            </button>
                                            );
                                        })}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMenuView(null);
                                                setIsMenuOpen(false);
                                            }}
                                            style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                                        >
                                            Back
                                        </button>
                                    </>
                                )}
                                {menuView === "details" && (
                                    <>
                                        <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#6b7280" }}>
                                            Notes
                                            <textarea
                                                className="nodrag nopan"
                                                draggable={false}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                value={notes}
                                                onChange={(e) => data?.onUpdateCourseMeta?.(courseCode, { notes: e.target.value })}
                                                rows={3}
                                                placeholder="Add notes"
                                                style={{ resize: "vertical", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 8px", fontSize: 12 }}
                                            />
                                        </label>
                                        <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#6b7280" }}>
                                            Estimated hours per week
                                            <input
                                                className="nodrag nopan"
                                                draggable={false}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={estimatedHours}
                                                onChange={(e) => data?.onUpdateCourseMeta?.(courseCode, { estimatedHours: e.target.value })}
                                                onWheel={(e) => e.currentTarget.blur()}
                                                placeholder="0"
                                                style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 8px", fontSize: 12 }}
                                            />
                                        </label>
                                        <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#6b7280" }}>
                                            Grade
                                            <input
                                                className="nodrag nopan"
                                                draggable={false}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                type="text"
                                                value={grade}
                                                onChange={(e) => data?.onUpdateCourseMeta?.(courseCode, { grade: e.target.value })}
                                                placeholder={isDone ? "e.g. 1.7" : "Only when done"}
                                                disabled={!isDone}
                                                style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 8px", fontSize: 12, background: isDone ? "#ffffff" : "#f3f4f6" }}
                                            />
                                        </label>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMenuView(null);
                                                setIsMenuOpen(false);
                                            }}
                                            style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                                        >
                                            Back
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div
                style={{
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.25,
                    fontSize: 16,
                    fontWeight: 700,
                }}
            >
                {displayCourseTitle(data?.courseName ?? data?.label)}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: "auto" }}>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{data?.ects ? `${data.ects} ECTS` : "-"}</div>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>{typeMeta.label}</div>
                <div
                    style={{
                        color: statusStyle.color,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "lowercase",
                    }}
                >
                    {status === "done" ? "done" : (status === "in_plan" ? "planned" : (status === "parked" ? "parked" : "not planned"))}
                </div>
            </div>
        </div>
    );
}
