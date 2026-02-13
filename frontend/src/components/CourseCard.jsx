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

/** CourseCard — React Flow node renderer */
export default function CourseCard({ data }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuView, setMenuView] = useState("root");
    const menuRef = useRef(null);

    useEffect(() => {
        if (!isMenuOpen) return;
        const handlePointerDown = (event) => {
            if (!menuRef.current?.contains(event.target)) setIsMenuOpen(false);
        };
        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
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
    const ectsOptions = [4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];
    const extensionOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    return (
        <div
            className="card"
            style={{
                width: CARD_WIDTH,
                position: "relative",
                minHeight: NODE_HEIGHT,
                background: cardBackground,
                border: `1px solid ${cardBorderColor}`,
                borderRadius: 10,
                padding: 16,
                boxShadow: combinedCardShadow(typeShadow, stateShadow),
                opacity: stateMeta.opacity,
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
                    {data.code}
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {data.onToggleDone && (data.status === "in_plan" || data.status === "done") && (
                        <button
                            onClick={handleToggleDone}
                            aria-label={isDone ? "Mark as in plan" : "Mark as done"}
                            title={isDone ? "Mark as in plan" : "Mark as done"}
                            style={{
                                border: `1px solid ${isDone ? "#9ca3af" : subjectColor}`,
                                background: isDone ? "#10b981" : hexToRgba(subjectColor, 0.08),
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
                    <div style={{ position: "relative" }}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMenuOpen((v) => {
                                    const next = !v;
                                    if (next) setMenuView("root");
                                    return next;
                                });
                            }}
                            aria-label="Options"
                            title="Options"
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
                            ...
                        </button>
                        {isMenuOpen && (
                            <div
                                ref={menuRef}
                                style={{
                                    position: "absolute",
                                    top: 24,
                                    right: 0,
                                    width: 180,
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
                                {menuView === "root" && data.status === "todo" && data?.onAddToPlan && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMenuView("semesters");
                                        }}
                                        style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                                    >
                                        Add to plan
                                    </button>
                                )}
                                {menuView === "root" && (data.status === "in_plan" || data.status === "done") && data?.onRemove && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (data?.groupId && data?.onRemoveModuleGroup) {
                                                data.onRemoveModuleGroup(data.groupId);
                                            } else {
                                                data?.onRemove?.(data.nodeId);
                                            }
                                            setIsMenuOpen(false);
                                        }}
                                        style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                                    >
                                        Remove from plan
                                    </button>
                                )}
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
                                                    setMenuView("root");
                                                }}
                                                style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                                            >
                                                {semester.title}
                                            </button>
                                        ))}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMenuView("root");
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
                {data.label}
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
