import React, { useEffect, useRef, useState } from "react";
import { Handle, Position } from "reactflow";
import { CARD_WIDTH, NODE_HEIGHT } from "../../utils/constants.js";
import {
    combinedCardShadow,
    layeredTypeShadow,
    mapTypeForProgram,
    stateVisualByStatus,
} from "../../utils/courseVisuals.js";

export default function GraphCourseNode({ data }) {
    const color = data?.color || "#4b5563";
    const status = data?.status || "todo";
    const isModuleChild = Boolean(data?.parentModulePayload);
    const visualStatus = status;
    const isDone = status === "done";
    const isInPlan = status === "in_plan";
    const stateMeta = stateVisualByStatus(visualStatus);
    const cardBackground = status === "todo" ? "#ffffff" : stateMeta.background;
    const typeMeta = mapTypeForProgram(data?.category, data?.programCode);
    const typeShadow = layeredTypeShadow(color, typeMeta.layers, cardBackground || "transparent");
    const cardBorderColor = isDone ? color : (stateMeta.borderColor || color);
    const stateShadow = isDone ? "none" : stateMeta.extraShadow;
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

    const statusStyle = (() => {
        if (status === "done") return { color: "#166534", label: "done" };
        if (status === "in_plan") return { color: "#1d4ed8", label: "in plan" };
        return { color: "#4b5563", label: "todo" };
    })();

    return (
        <div
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
                opacity: stateMeta.opacity,
            }}
        >
            <Handle id="left-target" type="target" position={Position.Left} />
            <Handle id="right-source" type="source" position={Position.Right} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {data?.courseCode}
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {(isInPlan || isDone) && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                data?.onToggleDone?.(data?.courseCode, !isDone);
                            }}
                            title={isDone ? "Mark as in plan" : "Mark as done"}
                            aria-label={isDone ? "Mark as in plan" : "Mark as done"}
                            style={{
                                border: `1px solid ${isDone ? "#9ca3af" : color}`,
                                background: isDone ? "#10b981" : "#d1fae5",
                                color: isDone ? "#ffffff" : "#065f46",
                                borderRadius: 6,
                                fontSize: 12,
                                padding: "1px 6px",
                                cursor: "pointer",
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
                            title="Options"
                            aria-label="Options"
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
                                    zIndex: 20,
                                }}
                            >
                                {menuView === "root" && status === "todo" && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMenuView("semesters");
                                        }}
                                        style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#ffffff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                                    >
                                        Add to plan
                                    </button>
                                )}
                                {menuView === "root" && (isInPlan || isDone) && (
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
                                            setIsMenuOpen(false);
                                            setMenuView("root");
                                        }}
                                        style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#ffffff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
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
                                                    const laneIndex = (Number(semester.id) || 1) - 1;
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
                                                    setMenuView("root");
                                                }}
                                                style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#ffffff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
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
                {data?.label}
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
                    {status === "done" ? "done" : (status === "in_plan" ? "planned" : "not planned")}
                </div>
            </div>
        </div>
    );
}
