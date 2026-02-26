import React, { useEffect, useRef, useState } from "react";
import { Handle, Position } from "reactflow";
import {
    GROUP_PADDING_Y,
    MODULE_HEADER_HEIGHT,
} from "../utils/constants.js";
import { colorForType } from "../utils/constants.js";
import { hexToRgba, MODULE_GROUP_COLOR_ALPHA } from "../utils/examSubjectColors.js";
import { mapTypeForProgram, stateVisualByStatus } from "../utils/courseVisuals.js";
import { displayCourseTitle } from "../utils/courseCodeDisplay.js";

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
        moduleCourseCount,
        moduleEcts,
        moduleCourseCodes,
        onToggleModuleDone,
        groupId,
        onAddModuleToPlan,
        semestersForModule,
        modulePayload,
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
                    gap: 2,
                    color: "#111827",
                    fontWeight: 700,
                    fontSize: 13,
                    background: "transparent",
                    borderRadius: 6,
                    padding: "6px 8px",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {status === "todo" && onAddModuleToPlan && (
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
                                title="Add to plan"
                                aria-label="Add to plan"
                                style={{
                                    border: "1px solid #60a5fa",
                                    background: "#eff6ff",
                                    color: "#1d4ed8",
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
                        {onRemove && (status === "in_plan" || status === "done") && (
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
                        {isMenuOpen && status === "todo" && onAddModuleToPlan && (
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
                                {(Array.isArray(semestersForModule) ? semestersForModule : []).map((semester) => (
                                    <button
                                        key={semester.id}
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
                                            onAddModuleToPlan(modulePayload, (Number(semester.id) || 1) - 1);
                                            setIsMenuOpen(false);
                                        }}
                                        style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                                    >
                                        {semester.title}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div
                    style={{
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        lineHeight: 1.25,
                        fontSize: 13,
                        fontWeight: 700,
                        color: isDone ? "#6b7280" : "#111827",
                    }}
                >
                    {displayCourseTitle(title ?? "Module")}
                </div>
                <div
                    style={{
                        color: isDone ? "#9ca3af" : "#6b7280",
                        fontSize: 10,
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
