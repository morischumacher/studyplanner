import React, { useEffect, useRef, useState } from "react";
import { Handle, Position } from "reactflow";
import { CARD_WIDTH, NODE_HEIGHT, colorForType } from "../utils/constants.js";
import { hexToRgba } from "../utils/examSubjectColors.js";
import {
    combinedCardShadow,
    layeredTypeShadow,
    mapTypeForProgram,
    stateVisualByStatus,
} from "../utils/courseVisuals.js";
import { displayCourseHeader, displayCourseTitle } from "../utils/courseCodeDisplay.js";
import { BACHELOR_PROGRAM_CODE } from "../utils/semesters.js";

/** CourseCard — React Flow node renderer */
export default function CourseCard({ data }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuView, setMenuView] = useState(null);
    const menuRef = useRef(null);
    const rootRef = useRef(null);
    const courseCode = data?.code;
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
            nodeEl.style.zIndex = "1000";
            return () => {
                nodeEl.style.zIndex = "";
            };
        }
        nodeEl.style.zIndex = "";
    }, [isMenuOpen]);

    const handleRemove = (e) => {
        e.stopPropagation();
        data?.onRemove?.(data.nodeId);
    };
    const handleToggleDone = (e) => {
        e.stopPropagation();
        const nextDone = !(data?.status === "done");
        data?.onToggleDone?.(data?.code, nextDone, data?.nodeId);
    };
    const handleEctsChange = (e) => {
        e.stopPropagation();
        data?.onUpdateEcts?.(data?.nodeId, Number(e.target.value));
    };

    const fallback = colorForType(data?.category);
    const subjectColor = data?.subjectColor ?? fallback.border;
    const isDone = data?.status === "done";
    const statusTextColor =
        data?.status === "done"
            ? "#166534"
            : (data?.status === "in_plan" ? "#1d4ed8" : "#4b5563");
    const visualStatus = data?.status;
    const stateMeta = stateVisualByStatus(visualStatus);
    const cardBackground = stateMeta.background;
    const typeMeta = mapTypeForProgram(data?.category, data?.programCode);
    const typeShadow = layeredTypeShadow(subjectColor, typeMeta.layers, stateMeta.background || "transparent");
    const cardBorderColor = isDone ? subjectColor : (stateMeta.borderColor || subjectColor);
    const stateShadow = isDone ? "none" : stateMeta.extraShadow;
    const codeKey = String(data?.code ?? "").trim().toLowerCase();
    const labelKey = String(data?.label ?? "").trim().toLowerCase();
    const isTransferableSkills =
        data?.category === "transferable_skills" ||
        codeKey === "fwts-el" ||
        labelKey.includes("transferable skills");
    const isExtension =
        data?.category === "extension" ||
        codeKey === "extension" ||
        labelKey.includes("extension");
    const isBachelorProgram = String(data?.programCode || "").trim() === BACHELOR_PROGRAM_CODE;
    const ectsOptions = isBachelorProgram
        ? [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
        : [4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];
    const extensionOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const headerCode = displayCourseHeader(data?.code, data?.label, data?.courseType ?? data?.type);

    return (
        <div
            className="card"
            ref={rootRef}
            style={{
                width: CARD_WIDTH,
                position: "relative",
                minHeight: NODE_HEIGHT,
                background: cardBackground,
                border: `1px solid ${cardBorderColor}`,
                borderRadius: 10,
                padding: 16,
                boxShadow: combinedCardShadow(typeShadow, stateShadow),
                opacity: isMenuOpen ? 1 : stateMeta.opacity,
                display: "flex",
                flexDirection: "column",
                gap: 10,
            }}
        >
            {/* four handles with IDs so edges can target specific sides */}
            {!data?.groupId && (
                <>
                    {/* top */}
                    <Handle id="top" type="target" position={Position.Top} />
                    <Handle id="top" type="source" position={Position.Top} />

                    {/* right */}
                    <Handle id="right" type="target" position={Position.Right} />
                    <Handle id="right" type="source" position={Position.Right} />

                    {/* bottom */}
                    <Handle id="bottom" type="target" position={Position.Bottom} />
                    <Handle id="bottom" type="source" position={Position.Bottom} />

                    {/* left */}
                    <Handle id="left" type="target" position={Position.Left} />
                    <Handle id="left" type="source" position={Position.Left} />
                </>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {headerCode}
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
                                aria-label="Details"
                                title="Details"
                                style={{
                                    border: `1px solid ${isDone ? "#9ca3af" : subjectColor}`,
                                    background: "#ffffff",
                                    color: "#111827",
                                    borderRadius: 6,
                                    fontSize: 12,
                                    padding: "2px 6px",
                                    cursor: "pointer",
                                    lineHeight: 1.2,
                                }}
                            >
                                i
                            </button>
                            {data?.status === "todo" && data?.onAddToPlan && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const nextView = "semesters";
                                        setIsMenuOpen((v) => (menuView === nextView ? !v : true));
                                        setMenuView(nextView);
                                    }}
                                    aria-label="Add to plan"
                                    title="Add to plan"
                                    style={{
                                        border: "1px solid #60a5fa",
                                        background: "#eff6ff",
                                        color: "#1d4ed8",
                                        borderRadius: 6,
                                        fontSize: 12,
                                        padding: "2px 6px",
                                        cursor: "pointer",
                                        lineHeight: 1.2,
                                    }}
                                >
                                    +
                                </button>
                            )}
                            {(data.status === "in_plan" || data.status === "done") && data?.onToggleDone && (
                                <button
                                    onClick={handleToggleDone}
                                    aria-label={isDone ? "Mark as in plan" : "Mark as done"}
                                    title={isDone ? "Mark as in plan" : "Mark as done"}
                                    style={{
                                        border: `1px solid ${isDone ? "#9ca3af" : subjectColor}`,
                                        background: isDone ? "#10b981" : "#ffffff",
                                        color: isDone ? "#ffffff" : "#111827",
                                        borderRadius: 6,
                                        fontSize: 12,
                                        padding: "2px 6px",
                                        cursor: "pointer",
                                        lineHeight: 1.2,
                                    }}
                                >
                                    ✓
                                </button>
                            )}
                            {(data.status === "in_plan" || data.status === "done") && data?.onRemove && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (data?.groupId && data?.onRemoveModuleGroup) {
                                            data.onRemoveModuleGroup(data.groupId);
                                        } else {
                                            data?.onRemove?.(data.nodeId);
                                        }
                                    }}
                                    aria-label="Remove from plan"
                                    title="Remove from plan"
                                    style={{
                                        border: "1px solid #fca5a5",
                                        background: "#fef2f2",
                                        color: "#b91c1c",
                                        borderRadius: 6,
                                        fontSize: 12,
                                        padding: "2px 6px",
                                        cursor: "pointer",
                                        lineHeight: 1.2,
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
                                    zIndex: 10,
                                }}
                            >
                                {menuView === "semesters" && (
                                    <>
                                        {(Array.isArray(data?.semesters) ? data.semesters : []).map((semester) => (
                                            <button
                                                key={semester.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    data?.onAddToPlan?.({
                                                        code: data?.code,
                                                        name: data?.label,
                                                        ects: data?.ects ?? null,
                                                        category: data?.category ?? null,
                                                        examSubject: data?.examSubject ?? null,
                                                        subjectColor,
                                                    }, (Number(semester.id) || 1) - 1);
                                                    setIsMenuOpen(false);
                                                    setMenuView(null);
                                                }}
                                                style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                                            >
                                                {semester.title}
                                            </button>
                                        ))}
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
                className="title"
                style={{
                    fontSize: 16,
                    fontWeight: 700,
                    lineHeight: 1.25,
                    color: isDone ? "#6b7280" : "#111827",
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {displayCourseTitle(data?.label)}
            </div>
            {isTransferableSkills && data?.onUpdateEcts && (
                <div style={{ marginTop: 6 }}>
                    <label style={{ fontSize: 11, color: "#6b7280", marginRight: 6 }}>ECTS</label>
                    <select
                        value={Number(data?.ects ?? 9)}
                        onChange={handleEctsChange}
                        style={{
                            border: `1px solid ${isDone ? "#9ca3af" : subjectColor}`,
                            borderRadius: 6,
                            fontSize: 12,
                            padding: "2px 6px",
                            background: "#fff",
                            color: "#111827",
                        }}
                    >
                        {ectsOptions.map((v) => (
                            <option key={v} value={v}>
                                {String(v).replace(".", ",")}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {isExtension && data?.onUpdateEcts && (
                <div style={{ marginTop: 6 }}>
                    <label style={{ fontSize: 11, color: "#6b7280", marginRight: 6 }}>ECTS</label>
                    <select
                        value={Number(data?.ects ?? 6)}
                        onChange={handleEctsChange}
                        style={{
                            border: `1px solid ${isDone ? "#9ca3af" : subjectColor}`,
                            borderRadius: 6,
                            fontSize: 12,
                            padding: "2px 6px",
                            background: "#fff",
                            color: "#111827",
                        }}
                    >
                        {extensionOptions.map((v) => (
                            <option key={v} value={v}>
                                {v}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: "auto" }}>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{data.ects ? `${data.ects} ECTS` : "-"}</div>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>{typeMeta.label}</div>
                <div style={{ fontSize: 11, color: statusTextColor, textTransform: "lowercase", fontWeight: 700 }}>
                    {data.status === "done" ? "done" : (data.status === "in_plan" ? "planned" : "not planned")}
                </div>
            </div>
        </div>
    );
}
