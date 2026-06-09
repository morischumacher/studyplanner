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
    if (data?.collapsedGhost) {
        return (
            <div
                style={{
                    pointerEvents: "none",
                    width: Number(data?.width) || 0,
                    height: Number(data?.height) || 0,
                    border: "2px dashed rgba(107,114,128,0.7)",
                    borderRadius: 12,
                    background: "transparent",
                    boxSizing: "border-box",
                }}
            />
        );
    }

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [plusRevealCount, setPlusRevealCount] = useState(0);
    const menuRef = useRef(null);
    const rootRef = useRef(null);
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
    const statusLabel = status === "done" ? "done" : (status === "in_plan" ? "planned" : (status === "parked" ? "parked" : "not planned"));
    const statusTextColor = status === "done" ? "#166534" : (status === "in_plan" ? "#1d4ed8" : "#4b5563");
    const panelFill = visualStatus === "todo" ? moduleColor : hexToRgba(stateMeta.background || "#f3f4f6", MODULE_GROUP_COLOR_ALPHA);
    const isDone = status === "done";
    const isParked = status === "parked";
    const isAddable = status === "todo" || isParked;
    const fallbackModulePayload = {
        kind: "module",
        code: data?.moduleCode ?? null,
        name: title ?? "Module",
        ects: moduleEcts ?? null,
        category: category ?? "unknown",
        subjectColor: subjectColor ?? null,
        courses: (Array.isArray(moduleCourseCodes) ? moduleCourseCodes : [])
            .map((code) => String(code || "").trim())
            .filter(Boolean)
            .map((code) => ({ code })),
    };
    const resolvedModulePayload = modulePayload && Array.isArray(modulePayload?.courses) && modulePayload.courses.length > 0
        ? modulePayload
        : fallbackModulePayload;
    const rawSemesterOptions = Array.isArray(semestersForModule) ? semestersForModule : [];
    const parkingOptions = rawSemesterOptions.filter((semester) => Boolean(semester?.isParking) || Number(semester?.id) === 0);
    const regularSemesterOptions = rawSemesterOptions.filter((semester) => !(Boolean(semester?.isParking) || Number(semester?.id) === 0));
    const baseSemesterOptions = regularSemesterOptions.filter((semester) => !Boolean(semester?.isPlus));
    const plusSemesterOptions = regularSemesterOptions.filter((semester) => Boolean(semester?.isPlus));
    const visibleSemesterOptions = [
        ...parkingOptions,
        ...baseSemesterOptions,
        ...plusSemesterOptions.slice(0, plusRevealCount),
    ];
    const canRevealMoreSemesters = plusRevealCount < plusSemesterOptions.length;

    const [isHoveredFromCard, setIsHoveredFromCard] = useState(false);
    const [isSelfHovered, setIsSelfHovered] = useState(false);

    useEffect(() => {
        const handleCardHover = (e) => {
            if (e.detail?.groupId === groupId) {
                setIsHoveredFromCard(e.detail.hovered);
            }
        };
        window.addEventListener("module-card-hover", handleCardHover);
        return () => {
            window.removeEventListener("module-card-hover", handleCardHover);
        };
    }, [groupId]);

    const isVisible = isSelfHovered || isHoveredFromCard;

    useEffect(() => {
        window.dispatchEvent(
            new CustomEvent("module-group-hover", {
                detail: { groupId, hovered: isVisible },
            })
        );
    }, [groupId, isVisible]);

    useEffect(() => {
        if (!isMenuOpen) return;
        const handlePointerDown = (event) => {
            if (!menuRef.current?.contains(event.target)) setIsMenuOpen(false);
        };
        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [isMenuOpen]);

    useEffect(() => {
        if (!isMenuOpen) setPlusRevealCount(0);
    }, [isMenuOpen]);

    useEffect(() => {
        const nodeEl = rootRef.current?.closest?.(".react-flow__node");
        if (!nodeEl) return;
        const baseZ = isVisible ? "10" : "0";
        if (isMenuOpen) {
            nodeEl.style.zIndex = "100000";
            return () => {
                nodeEl.style.zIndex = baseZ;
            };
        }
        nodeEl.style.zIndex = baseZ;
        return undefined;
    }, [isMenuOpen, isVisible]);

    return (
        <div
            ref={rootRef}
            onMouseEnter={() => setIsSelfHovered(true)}
            onMouseLeave={() => setIsSelfHovered(false)}
            style={{
                pointerEvents: isVisible ? "all" : "none",
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
                opacity: isVisible ? 1 : 0,
                transition: "opacity 0.2s ease-in-out",
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
                className="module-bg-drag-handle"
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
                    cursor: "grab",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {isAddable && onAddModuleToPlan && (
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
                                    border: `1px solid ${borderColor}`,
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
                        {onRemove && (status === "in_plan" || status === "done" || isParked) && (
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
                        {isMenuOpen && isAddable && onAddModuleToPlan && (
                            <div
                                ref={menuRef}
                                style={{
                                    position: "absolute",
                                    top: 24,
                                    right: 0,
                                    width: 220,
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
                                {visibleSemesterOptions.map((semester) => {
                                    const isParkingChoice = Boolean(semester?.isParking) || Number(semester?.id) === 0;
                                    const disableChoice = isParked && isParkingChoice;
                                    return (
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
                                            if (disableChoice) return;
                                            const laneIndex = Number.isFinite(Number(semester?.laneIndex))
                                                ? Number(semester.laneIndex)
                                                : (Number.isFinite(Number(semester?.id)) ? (Number(semester.id) - 1) : 0);
                                            onAddModuleToPlan(resolvedModulePayload, laneIndex);
                                            setIsMenuOpen(false);
                                        }}
                                        disabled={disableChoice}
                                        style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: disableChoice ? "#f3f4f6" : "#fff", cursor: disableChoice ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, color: disableChoice ? "#9ca3af" : "#111827" }}
                                    >
                                        {semester.title}
                                    </button>
                                    );
                                })}
                                {canRevealMoreSemesters && (
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
                                            setPlusRevealCount((count) => Math.min(count + 1, plusSemesterOptions.length));
                                        }}
                                        style={{ border: "1px dashed #9ca3af", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                    >
                                        + Add next semester
                                    </button>
                                )}
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
                                        setIsMenuOpen(false);
                                    }}
                                    style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                >
                                    Back
                                </button>
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
