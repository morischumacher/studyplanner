import React, { useEffect, useRef, useState } from "react";
import { Handle, Position } from "reactflow";
import { CARD_WIDTH, NODE_HEIGHT } from "../../utils/constants.js";
import { hexToRgba, MODULE_GROUP_COLOR_ALPHA } from "../../utils/examSubjectColors.js";
import {
    combinedCardShadow,
    layeredTypeShadow,
    mapTypeForProgram,
    stateVisualByStatus,
} from "../../utils/courseVisuals.js";
import { displayCourseTitle } from "../../utils/courseCodeDisplay.js";

export default function GraphModuleNode({ data }) {
    const color = data?.color || "#4b5563";
    const status = data?.status || "todo";
    const visualStatus = status === "done" ? "done" : "todo";
    const isDone = status === "done";
    const isInPlan = status === "in_plan";
    const stateMeta = stateVisualByStatus(visualStatus);
    const typeMeta = mapTypeForProgram(data?.category, data?.programCode);
    const typeShadow = layeredTypeShadow(color, typeMeta.layers, stateMeta.background || "transparent");
    const cardBorderColor = isDone ? color : (stateMeta.borderColor || color);
    const stateShadow = isDone ? "none" : stateMeta.extraShadow;
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuView, setMenuView] = useState(null);
    const menuRef = useRef(null);
    const rootRef = useRef(null);

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
        nodeEl.style.zIndex = "";
    }, [isMenuOpen]);

    const statusStyle = (() => {
        if (status === "done") return { color: "#166534", label: "done" };
        if (status === "in_plan") return { color: "#1d4ed8", label: "planned" };
        return { color: "#4b5563", label: "todo" };
    })();
    const statusLabel = status === "done" ? "done" : (status === "in_plan" ? "planned" : "not planned");

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
                background: visualStatus === "todo" ? hexToRgba(color, MODULE_GROUP_COLOR_ALPHA) : stateMeta.background,
                color: stateMeta.textColor,
                border: `2px solid ${cardBorderColor}`,
                boxShadow: combinedCardShadow(typeShadow, stateShadow),
                fontWeight: 600,
                fontSize: 12,
                opacity: isMenuOpen ? 1 : stateMeta.opacity,
            }}
        >
            <Handle id="left-target" type="target" position={Position.Left} />
            <Handle id="right-source" type="source" position={Position.Right} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {status === "todo" && (
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
                                border: "1px solid #60a5fa",
                                background: "#eff6ff",
                                color: "#1d4ed8",
                                borderRadius: 6,
                                fontSize: 12,
                                padding: "1px 6px",
                                cursor: "pointer",
                            }}
                        >
                            +
                        </button>
                    )}
                    {(isInPlan || isDone) && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                data?.onToggleModuleDone?.(data?.moduleCourseCodes, !isDone);
                            }}
                            title={isDone ? "Mark module as in plan" : "Mark module as done"}
                            aria-label={isDone ? "Mark module as in plan" : "Mark module as done"}
                            style={{
                                border: `1px solid ${isDone ? "#9ca3af" : color}`,
                                background: isDone ? "#10b981" : "#ffffff",
                                color: isDone ? "#ffffff" : "#111827",
                                borderRadius: 6,
                                fontSize: 12,
                                padding: "1px 6px",
                                cursor: "pointer",
                            }}
                        >
                            ✓
                        </button>
                    )}
                    {(isInPlan || isDone) && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                data?.onRemoveModuleFromPlan?.(data?.modulePayload);
                            }}
                            title="Remove from plan"
                            aria-label="Remove from plan"
                            style={{
                                border: "1px solid #fca5a5",
                                background: "#fef2f2",
                                color: "#b91c1c",
                                borderRadius: 6,
                                fontSize: 12,
                                padding: "1px 6px",
                                cursor: "pointer",
                            }}
                        >
                            ×
                        </button>
                    )}
                    <div style={{ position: "relative" }}>
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
                                    zIndex: 100001,
                                }}
                            >
                        {menuView === "semesters" && (
                            <>
                                {(Array.isArray(data?.semestersForModule) ? data.semestersForModule : []).map((semester) => (
                                    <button
                                        key={semester.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            data?.onAddModuleToPlan?.(data?.modulePayload, (Number(semester.id) || 1) - 1);
                                            setIsMenuOpen(false);
                                            setMenuView(null);
                                        }}
                                        style={{
                                            border: "1px solid #e5e7eb",
                                            borderRadius: 6,
                                            padding: "5px 8px",
                                            textAlign: "left",
                                            background: "#ffffff",
                                            cursor: "pointer",
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: "#111827",
                                        }}
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
                                    style={{
                                        border: "1px solid #e5e7eb",
                                        borderRadius: 6,
                                        padding: "5px 8px",
                                        textAlign: "left",
                                        background: "#f9fafb",
                                        cursor: "pointer",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: "#4b5563",
                                    }}
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
                    color: isDone ? "#6b7280" : "#111827",
                }}
            >
                {displayCourseTitle(data?.modulePayload?.name || data?.label)}
            </div>
            <div style={{ color: "#6b7280", fontSize: 12 }}>
                {Number(data?.moduleCourseCount ?? data?.modulePayload?.courses?.length ?? 0)} courses
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginTop: "auto",
                    fontSize: 11,
                }}
            >
                <span style={{ color: "#6b7280", whiteSpace: "nowrap" }}>
                    {data?.moduleEcts ? `${data.moduleEcts} ECTS` : "-"}
                </span>
                <span style={{ color: "#6b7280", fontWeight: 700, flex: 1, minWidth: 0, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {typeMeta.label}
                </span>
                <span style={{ color: statusStyle.color, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {statusLabel}
                </span>
            </div>
        </div>
    );
}
