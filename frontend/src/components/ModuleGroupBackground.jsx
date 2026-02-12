import React, { useEffect, useRef, useState } from "react";
import { Handle, Position } from "reactflow";
import {
    GROUP_PADDING_Y,
    MODULE_HEADER_HEIGHT,
} from "../utils/constants.js";
import { colorForType } from "../utils/constants.js";
import { hexToRgba, MODULE_GROUP_COLOR_ALPHA } from "../utils/examSubjectColors.js";
import { mapTypeForProgram, stateVisualByStatus } from "../utils/courseVisuals.js";

/** ModuleGroupBackground — soft panel wrapping a set of course nodes. */
export default function ModuleGroupBackground({ data }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const {
        title,
        width,
        height,
        onRemove,
        category,
        subjectColor,
        programCode,
        status = "in_plan",
        moduleCode,
        moduleCourseCount,
        moduleEcts,
        moduleCourseCodes,
        onToggleModuleDone,
        groupId,
    } = data || {};
    const fallback = colorForType(category);
    const baseColor = subjectColor ?? fallback.border;
    const moduleColor = hexToRgba(baseColor, MODULE_GROUP_COLOR_ALPHA);
    const visualStatus = status === "done" ? "done" : "todo";
    const stateMeta = stateVisualByStatus(visualStatus);
    const typeMeta = mapTypeForProgram(category, programCode);
    const borderColor = stateMeta.borderColor || baseColor;
    const statusLabel = status === "done" ? "done" : (status === "in_plan" ? "planned" : "not planned");
    const statusTextColor = status === "done" ? "#166534" : (status === "in_plan" ? "#1d4ed8" : "#4b5563");
    const panelFill = visualStatus === "todo" ? moduleColor : stateMeta.background;
    const isDone = status === "done";

    useEffect(() => {
        if (!isMenuOpen) return;
        const handlePointerDown = (event) => {
            if (!menuRef.current?.contains(event.target)) setIsMenuOpen(false);
        };
        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [isMenuOpen]);

    return (
        <div
            style={{
                pointerEvents: "all",
                width,
                height,
                overflow: "hidden",
                background: panelFill,
                border: `2px solid ${borderColor}`,
                borderRadius: 12,
                position: "relative",
                padding: GROUP_PADDING_Y,
                paddingTop: GROUP_PADDING_Y,
                boxSizing: "border-box",
            }}
        >
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

            {/* Header bar */}
            <div
                style={{
                    position: "absolute",
                    top: 6,
                    left: 10,
                    right: 10,
                    height: MODULE_HEADER_HEIGHT - 10,
                    display: "grid",
                    alignContent: "space-between",
                    gap: 4,
                    color: "#111827",
                    fontWeight: 700,
                    fontSize: 13,
                    background: "transparent",
                    borderRadius: 6,
                    padding: "6px 8px",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 11, color: isDone ? "#9ca3af" : "#6b7280", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                        {moduleCode || ""}
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {onToggleModuleDone && (status === "in_plan" || status === "done") && (
                            <button
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleModuleDone?.(moduleCourseCodes, !isDone, groupId);
                                }}
                                title={isDone ? "Mark module as in plan" : "Mark module as done"}
                                aria-label={isDone ? "Mark module as in plan" : "Mark module as done"}
                                style={{
                                    border: `1px solid ${isDone ? "#9ca3af" : baseColor}`,
                                    background: isDone ? "#10b981" : hexToRgba(baseColor, 0.08),
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
                        {onRemove && (
                            <div style={{ position: "relative" }}>
                            <button
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMenuOpen((v) => !v);
                                }}
                                title="Options"
                                aria-label="Options"
                                style={{
                                    border: `1px solid ${isDone ? "#9ca3af" : borderColor}`,
                                    background: "#ffffff",
                                    color: isDone ? "#6b7280" : "#111827",
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
                                        width: 170,
                                        border: "1px solid #d1d5db",
                                        borderRadius: 8,
                                        background: "#ffffff",
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                                        padding: 6,
                                        display: "grid",
                                        gap: 4,
                                        zIndex: 30,
                                    }}
                                >
                                    <button
                                        onPointerDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemove();
                                            setIsMenuOpen(false);
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
                                        }}
                                    >
                                        Remove from plan
                                    </button>
                                </div>
                            )}
                            </div>
                        )}
                    </div>
                </div>

                <div
                    style={{
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        lineHeight: 1.25,
                        fontSize: 14,
                        fontWeight: 700,
                        color: isDone ? "#6b7280" : "#111827",
                    }}
                >
                    {title ?? "Module"}
                </div>
                <div
                    style={{
                        color: isDone ? "#9ca3af" : "#6b7280",
                        fontSize: 11,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    {Number(moduleCourseCount ?? 0)} courses • {moduleEcts ? `${moduleEcts} ECTS` : "-"} • {typeMeta.label} •{" "}
                    <span style={{ color: statusTextColor, fontWeight: 700 }}>{statusLabel}</span>
                </div>
            </div>
        </div>
    );
}
