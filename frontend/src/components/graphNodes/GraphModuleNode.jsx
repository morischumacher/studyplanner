import React, { useEffect, useRef, useState } from "react";
import { Handle, Position } from "reactflow";
import { CARD_WIDTH, NODE_HEIGHT } from "../../utils/constants.js";
import { hexToRgba, MODULE_GROUP_COLOR_ALPHA } from "../../utils/examSubjectColors.js";

export default function GraphModuleNode({ data }) {
    const color = data?.color || "#4b5563";
    const status = data?.status || "todo";
    const isDone = status === "done";
    const isInPlan = status === "in_plan";
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
        if (status === "done") return { bg: "#dcfce7", color: "#166534", border: "#86efac", label: "done" };
        if (status === "in_plan") return { bg: "#dbeafe", color: "#1d4ed8", border: "#93c5fd", label: "in plan" };
        return { bg: "#f3f4f6", color: "#4b5563", border: "#d1d5db", label: "todo" };
    })();

    return (
        <div
            style={{
                width: CARD_WIDTH,
                height: NODE_HEIGHT,
                borderRadius: 10,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "8px 12px",
                position: "relative",
                overflow: "visible",
                background: isDone ? "#f3f4f6" : hexToRgba(color, MODULE_GROUP_COLOR_ALPHA),
                color: isDone ? "#6b7280" : "#111827",
                border: `2px solid ${isDone ? "#9ca3af" : color}`,
                fontWeight: 600,
                fontSize: 12,
                opacity: isDone ? 0.8 : 1,
            }}
        >
            <Handle id="left-target" type="target" position={Position.Left} />
            <Handle id="right-source" type="source" position={Position.Right} />

            <div style={{ position: "absolute", top: 6, right: 6, zIndex: 10 }}>
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
                        }}
                    >
                        {menuView === "root" && status === "todo" && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuView("semesters");
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
                                Add to plan
                            </button>
                        )}
                        {menuView === "root" && (isInPlan || isDone) && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    data?.onRemoveModuleFromPlan?.(data?.modulePayload);
                                    setIsMenuOpen(false);
                                    setMenuView("root");
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
                                Remove from plan
                            </button>
                        )}
                        {menuView === "semesters" && (
                            <>
                                {(Array.isArray(data?.semestersForModule) ? data.semestersForModule : []).map((semester) => (
                                    <button
                                        key={semester.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            data?.onAddModuleToPlan?.(data?.modulePayload, (Number(semester.id) || 1) - 1);
                                            setIsMenuOpen(false);
                                            setMenuView("root");
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
                                        setMenuView("root");
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

            {(isInPlan || isDone) && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        data?.onToggleModuleDone?.(data?.moduleCourseCodes, !isDone);
                    }}
                    title={isDone ? "Mark module as in plan" : "Mark module as done"}
                    aria-label={isDone ? "Mark module as in plan" : "Mark module as done"}
                    style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
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

            <div
                style={{
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    paddingRight: 44,
                    lineHeight: 1.25,
                }}
            >
                {data?.label}
            </div>

            <div
                style={{
                    width: "fit-content",
                    borderRadius: 999,
                    border: `1px solid ${statusStyle.border}`,
                    background: statusStyle.bg,
                    color: statusStyle.color,
                    padding: "1px 8px",
                    fontSize: 10,
                    fontWeight: 700,
                }}
            >
                {statusStyle.label}
            </div>
        </div>
    );
}
