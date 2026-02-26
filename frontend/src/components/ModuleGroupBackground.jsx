import React, { useEffect, useRef, useState } from "react";
import { Handle, Position } from "reactflow";
import {
    CARD_WIDTH,
    COURSE_LAYOUT_HEIGHT,
    GROUP_EXTRA_RIGHT,
    GROUP_PADDING_X,
    GROUP_PADDING_Y,
    LANE_GAP,
    LANE_WIDTH,
    MODULE_BOTTOM_PADDING,
    MODULE_HEADER_HEIGHT,
} from "../utils/constants.js";
import { colorForType } from "../utils/constants.js";
import { hexToRgba, MODULE_GROUP_COLOR_ALPHA } from "../utils/examSubjectColors.js";
import { mapTypeForProgram, stateVisualByStatus } from "../utils/courseVisuals.js";
import { displayCourseTitle } from "../utils/courseCodeDisplay.js";

// ---------------------------------------------------------------------------
// Geometry helpers for the smart SVG shape
// ---------------------------------------------------------------------------

const RIBBON_HALF = 6;           // half-width of ribbon  → 12 px total width
const ROUTE_GAP = 20;            // clearance from panel edge to routing line
const PANEL_RADIUS = 10;         // corner radius for cluster panels
const ELBOW_R = 5;               // corner radius at ribbon bends

/**
 * Build per-lane clusters from childPositions (absolute canvas coords).
 * Returns clusters sorted left-to-right, each with local bounding rect
 * relative to the group node's own position (gx, gy).
 */
function buildClusters(childPositions, gx, gy, isFirstClusterHeader) {
    if (!childPositions || childPositions.length === 0) return [];

    // Group by lane
    const byLane = new Map();
    for (const c of childPositions) {
        const li = c.laneIndex;
        if (!byLane.has(li)) byLane.set(li, []);
        byLane.get(li).push({ lx: c.x - gx, ly: c.y - gy });
    }

    // Sort lanes left-to-right
    const sortedLanes = [...byLane.keys()].sort((a, b) => a - b);

    const extraLeft = GROUP_EXTRA_RIGHT * 0.35;

    return sortedLanes.map((laneIndex, clusterIdx) => {
        const cards = byLane.get(laneIndex);
        const minLx = Math.min(...cards.map((c) => c.lx));
        const maxLx = Math.max(...cards.map((c) => c.lx));
        const minLy = Math.min(...cards.map((c) => c.ly));
        const maxLy = Math.max(...cards.map((c) => c.ly));

        // Panel rect in local coords
        // All clusters get MODULE_HEADER_HEIGHT space so every panel is tall enough
        // to show its own title + buttons above the course cards.
        const panelLeft = minLx - GROUP_PADDING_X - extraLeft;
        const panelRight = maxLx + CARD_WIDTH + GROUP_PADDING_X + GROUP_EXTRA_RIGHT * 0.65;
        const topPad = GROUP_PADDING_Y + MODULE_HEADER_HEIGHT;
        const panelTop = minLy - topPad;
        const panelBottom = maxLy + COURSE_LAYOUT_HEIGHT + GROUP_PADDING_Y + MODULE_BOTTOM_PADDING;

        return {
            laneIndex,
            clusterIdx,
            panelLeft,
            panelRight,
            panelTop,
            panelBottom,
            centerX: (panelLeft + panelRight) / 2,
            centerY: (panelTop + panelBottom) / 2,
        };
    });
}

/**
 * Build an SVG path string for a single rounded rectangle.
 */
function roundedRectPath(x, y, w, h, r) {
    const rx = Math.min(r, w / 2, h / 2);
    return [
        `M ${x + rx} ${y}`,
        `L ${x + w - rx} ${y}`,
        `Q ${x + w} ${y} ${x + w} ${y + rx}`,
        `L ${x + w} ${y + h - rx}`,
        `Q ${x + w} ${y + h} ${x + w - rx} ${y + h}`,
        `L ${x + rx} ${y + h}`,
        `Q ${x} ${y + h} ${x} ${y + h - rx}`,
        `L ${x} ${y + rx}`,
        `Q ${x} ${y} ${x + rx} ${y}`,
        `Z`,
    ].join(" ");
}

/**
 * Merge consecutive same-level adjacent clusters into one wider cluster so they
 * render as a single seamless rectangle instead of two panels with a bridge.
 * Two clusters are eligible when they are in immediately neighbouring lanes
 * and their panelBottom values match (courses on the same row).
 */
function mergeSameLevelClusters(clusters) {
    if (clusters.length <= 1) return clusters;
    const out = [];
    let cur = { ...clusters[0] };
    for (let i = 1; i < clusters.length; i++) {
        const B = clusters[i];
        const adjacent = B.laneIndex === cur.laneIndex + 1;
        const sameLevel = adjacent && Math.abs(B.panelBottom - cur.panelBottom) < COURSE_LAYOUT_HEIGHT;
        if (sameLevel) {
            // Extend cur to include B
            cur = {
                ...cur,
                panelRight: B.panelRight,
                laneIndex: B.laneIndex,
                centerX: (cur.panelLeft + B.panelRight) / 2,
            };
        } else {
            out.push(cur);
            cur = { ...B };
        }
    }
    out.push(cur);
    return out;
}

/**
 * Build bridge geometry between cluster A (left) and cluster B (right).
 *
 * @param {object}  A          - left cluster (local coords)
 * @param {object}  B          - right cluster (local coords)
 * @param {number}  turnX      - X of the 90-degree turn, in local coords.
 *                               Should be the center of the actual lane-gap strip.
 * @param {boolean} isAdjacent - true when A and B are in immediately neighbouring lanes
 *
 * Same-level + adjacent  →  full-height rectangle fill (no ribbon)
 * Everything else        →  L/Z ribbon with rounded elbows at the turnX point
 */
function buildBridge(A, B, turnX, isAdjacent) {
    const R = RIBBON_HALF;
    const cr = ELBOW_R;

    // Route via TOP corner of the side edges when B is at the same level or above A
    const routeViaTop = B.centerY <= A.centerY;

    // Exit/entry Y bounds on the panel side edges
    let outY_A, inY_A, outY_B, inY_B;
    if (routeViaTop) {
        outY_A = A.panelTop; inY_A = A.panelTop + 2 * R;
        outY_B = B.panelTop; inY_B = B.panelTop + 2 * R;
    } else {
        outY_A = A.panelBottom - 2 * R; inY_A = A.panelBottom;
        outY_B = B.panelBottom - 2 * R; inY_B = B.panelBottom;
    }

    // Same level = courses on same row → panelBottom values match.
    // (panelTop differs when A carries the module header, so we compare bottom.)
    const sameLevel = isAdjacent && Math.abs(A.panelBottom - B.panelBottom) < 4;

    // ── Same-level adjacent: full-height rectangle bridge in the lane gap ─────
    if (sameLevel) {
        const top = Math.max(A.panelTop, B.panelTop);
        const bottom = Math.min(A.panelBottom, B.panelBottom);
        const fillPath = [
            `M ${A.panelRight} ${top}`,
            `L ${B.panelLeft} ${top}`,
            `L ${B.panelLeft} ${bottom}`,
            `L ${A.panelRight} ${bottom}`,
            `Z`,
        ].join(' ');
        // No extra stroke — panel borders already form the full perimeter
        const masks = [
            { x: A.panelRight - 2, y: top, w: 4, h: bottom - top },
            { x: B.panelLeft - 2, y: top, w: 4, h: bottom - top },
        ];
        return { fillPath, strokePath: '', masks };
    }

    // vDiff/vSign describe the vertical movement of the ribbon middle segment
    const vDiff = outY_B - outY_A;
    const vSign = vDiff < 0 ? -1 : (vDiff > 0 ? 1 : 0);

    // ── Fill polygon (L or Z shaped ribbon) ───────────────────────────────────
    const fillPath = [
        `M ${A.panelRight} ${outY_A}`,   // top of exit slot on A's right edge
        `L ${turnX} ${outY_A}`,           // → right to turn-point (in lane gap)
        `L ${turnX} ${outY_B}`,           // ↑/↓/0 to B's Y level
        `L ${B.panelLeft} ${outY_B}`,     // → right to B's left edge (top of slot)
        `L ${B.panelLeft} ${inY_B}`,      // ↓ one ribbon-width on B's edge
        `L ${turnX} ${inY_B}`,            // ← left to turn-point
        `L ${turnX} ${inY_A}`,            // ↑/↓/0 back to A's level
        `L ${A.panelRight} ${inY_A}`,     // ← left back to A's edge (bottom of slot)
        `Z`,
    ].join(' ');

    // ── Stroke with rounded elbows (no stroke at the panel junction ends) ─────
    let strokePath;
    if (sameLevel) {
        // Straight horizontal ribbon
        strokePath = [
            `M ${A.panelRight} ${outY_A} L ${B.panelLeft} ${outY_A}`,
            `M ${B.panelLeft} ${inY_B} L ${A.panelRight} ${inY_A}`,
        ].join(' ');
    } else {
        const outerPath = [
            `M ${A.panelRight} ${outY_A}`,
            `L ${turnX - cr} ${outY_A}`,
            `Q ${turnX} ${outY_A} ${turnX} ${outY_A + vSign * cr}`,   // right→up/down
            `L ${turnX} ${outY_B - vSign * cr}`,
            `Q ${turnX} ${outY_B} ${turnX + cr} ${outY_B}`,            // up/down→right
            `L ${B.panelLeft} ${outY_B}`,
        ].join(' ');

        const innerPath = [
            `M ${B.panelLeft} ${inY_B}`,
            `L ${turnX + cr} ${inY_B}`,
            `Q ${turnX} ${inY_B} ${turnX} ${inY_B - vSign * cr}`,     // left→down/up
            `L ${turnX} ${inY_A + vSign * cr}`,
            `Q ${turnX} ${inY_A} ${turnX - cr} ${inY_A}`,              // down/up→left
            `L ${A.panelRight} ${inY_A}`,
        ].join(' ');

        strokePath = outerPath + ' ' + innerPath;
    }

    // ── Junction masks ────────────────────────────────────────────────────────
    const masks = [
        { x: A.panelRight - 2, y: outY_A, w: 4, h: 2 * R },   // A's right-side border
        { x: B.panelLeft - 2, y: outY_B, w: 4, h: 2 * R },   // B's left-side border
    ];

    return { fillPath, strokePath, masks };
}


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
        childPositions,
    } = data || {};

    // Retrieve the group node's own canvas position from the React Flow DOM.
    // We need it to convert absolute childPositions → local coords.
    // We read it lazily from the closest .react-flow__node transform; this is
    // safe because position is always set before render.
    const groupPosRef = useRef({ x: 0, y: 0 });
    useEffect(() => {
        const nodeEl = rootRef.current?.closest?.(".react-flow__node");
        if (!nodeEl) return;
        // React Flow sets style="... translate(Xpx, Ypx) ..."
        const match = nodeEl.style?.transform?.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
        if (match) {
            groupPosRef.current = {
                x: parseFloat(match[1]),
                y: parseFloat(match[2]),
            };
        }
    });

    const fallback = colorForType(category);
    const baseColor = subjectColor ?? fallback.border;
    const moduleColor = hexToRgba(baseColor, MODULE_GROUP_COLOR_ALPHA);
    const visualStatus = status === "done" ? "done" : "todo";
    const stateMeta = stateVisualByStatus(visualStatus);
    const typeMeta = mapTypeForProgram(category, programCode);
    const borderColor = stateMeta.borderColor || baseColor;
    const statusLabel = status === "done" ? "done" : (status === "in_plan" ? "planned" : (status === "parked" ? "parked" : "not planned"));
    const statusTextColor = status === "done" ? "#166534" : (status === "in_plan" ? "#1d4ed8" : "#4b5563");
    const panelFill = visualStatus === "todo" ? moduleColor : stateMeta.background;
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
        if (isMenuOpen) {
            nodeEl.style.zIndex = "100000";
            return () => {
                nodeEl.style.zIndex = "";
            };
        }
        nodeEl.style.zIndex = "";
        return undefined;
    }, [isMenuOpen]);

    // -------------------------------------------------------------------------
    // Determine if we should use the smart SVG shape (multi-lane) or a plain rect
    // -------------------------------------------------------------------------
    const hasChildPositions = Array.isArray(childPositions) && childPositions.length > 0;
    const distinctLanes = hasChildPositions
        ? new Set(childPositions.map((c) => c.laneIndex)).size
        : 1;
    const useSmartShape = hasChildPositions && distinctLanes > 1;

    // Build clusters (local coords relative to this node's top-left).
    // groupPosRef holds the canvas position of this node.
    // However, since React Flow positions the node and the inner div has (0,0) origin
    // matching the node's position, we use the stored position from the group data
    // which we can reconstruct: group.position = (minChildX - padding, minChildY - header)
    // We can derive gx/gy from childPositions themselves the same way recomputeGroupFromChildren does.
    let clusters = [];
    let gxForBridges = 0;
    if (useSmartShape) {
        const extraLeft = GROUP_EXTRA_RIGHT * 0.35;
        const minX = Math.min(...childPositions.map((c) => c.x));
        const minY = Math.min(...childPositions.map((c) => c.y));
        gxForBridges = minX - GROUP_PADDING_X - extraLeft;
        const gy = minY - GROUP_PADDING_Y - MODULE_HEADER_HEIGHT;
        clusters = mergeSameLevelClusters(buildClusters(childPositions, gxForBridges, gy, true));
    }

    const smartPath = null; // unused

    // Build bridge geometry for each adjacent cluster pair
    const bridges = useSmartShape
        ? clusters.slice(0, -1).map((A, i) => {
            const B = clusters[i + 1];
            // Place the 90-degree turn in the actual lane-gap strip between A's lane and the next lane.
            // laneX(n) = n * (LANE_WIDTH + LANE_GAP).  Gap strip: laneX(A.laneIndex+1) - LANE_GAP … laneX(A.laneIndex+1).
            // Center of that gap in absolute coords, converted to local (group) coords:
            const absGapCenter = (A.laneIndex + 1) * (LANE_WIDTH + LANE_GAP) - LANE_GAP / 2;
            const turnX = absGapCenter - gxForBridges;
            return buildBridge(A, B, turnX);
        })
        : [];

    // Header position: always top of leftmost cluster (clusters[0])
    const headerCluster = clusters[0];

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------
    return (
        <div
            ref={rootRef}
            style={{
                pointerEvents: "all",
                width,
                height,
                overflow: "visible",
                // In smart shape mode the SVG handles all background/border.
                background: useSmartShape ? "transparent" : panelFill,
                border: useSmartShape ? "none" : `2px solid ${borderColor}`,
                borderRadius: useSmartShape ? 0 : 12,
                position: "relative",
                padding: useSmartShape ? 0 : GROUP_PADDING_Y,
                paddingTop: useSmartShape ? 0 : GROUP_PADDING_Y,
                boxSizing: "border-box",
            }}
        >
            {/* Handles */}
            <Handle id="top" type="target" position={Position.Top} />
            <Handle id="top" type="source" position={Position.Top} />
            <Handle id="right" type="target" position={Position.Right} />
            <Handle id="right" type="source" position={Position.Right} />
            <Handle id="bottom" type="target" position={Position.Bottom} />
            <Handle id="bottom" type="source" position={Position.Bottom} />
            <Handle id="left" type="target" position={Position.Left} />
            <Handle id="left" type="source" position={Position.Left} />

            {/* Smart SVG background — orthogonal routing */}
            {useSmartShape && (
                <svg
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        overflow: "visible",
                        pointerEvents: "none",
                        zIndex: 0,
                    }}
                    xmlns="http://www.w3.org/2000/svg"
                >
                    {/* 1. Panel fills + borders */}
                    {clusters.map((cl, i) => (
                        <path
                            key={`panel-${i}`}
                            d={roundedRectPath(
                                cl.panelLeft, cl.panelTop,
                                cl.panelRight - cl.panelLeft,
                                cl.panelBottom - cl.panelTop,
                                PANEL_RADIUS
                            )}
                            fill={panelFill}
                            stroke={borderColor}
                            strokeWidth={2}
                        />
                    ))}

                    {/* 2. Bridge ribbon fills — semi-transparent so crossing bridges from
                         different module groups remain visible through each other */}
                    {bridges.map((b, i) => (
                        <path
                            key={`bridge-fill-${i}`}
                            d={b.fillPath}
                            fill={panelFill}
                            stroke="none"
                            opacity={0.82}
                        />
                    ))}

                    {/* 3. Junction masks — opaque fill coverage at the exact exit slot */}
                    {bridges.flatMap((b, bi) =>
                        b.masks.map((m, mi) => (
                            <rect
                                key={`mask-${bi}-${mi}`}
                                x={m.x} y={m.y} width={m.w} height={m.h}
                                fill={panelFill}
                                stroke="none"
                            />
                        ))
                    )}

                    {/* 4. Bridge ribbon strokes — outer+inner edges with rounded elbows, no junction ends */}
                    {bridges.map((b, i) => (
                        <path
                            key={`bridge-stroke-${i}`}
                            d={b.strokePath}
                            fill="none"
                            stroke={borderColor}
                            strokeWidth={2}
                            strokeLinecap="round"
                            opacity={0.82}
                        />
                    ))}
                </svg>
            )}


            {/* Header bars — one per cluster (first cluster gets full header, others compact) */}
            {useSmartShape
                ? clusters.map((cl, clIdx) => {
                    const isFirst = clIdx === 0;
                    return (
                        <div
                            key={`header-${clIdx}`}
                            className="module-bg-drag-handle"
                            style={{
                                position: "absolute",
                                top: cl.panelTop + 6,
                                left: cl.panelLeft + 10,
                                right: width - cl.panelRight + 10,
                                height: MODULE_HEADER_HEIGHT - 10,
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                gap: 2,
                                color: "#111827",
                                fontWeight: 700,
                                fontSize: 13,
                                background: "transparent",
                                borderRadius: 6,
                                padding: "6px 8px",
                                cursor: "grab",
                                zIndex: 1,
                                pointerEvents: "all",
                            }}
                        >
                            {/* Action buttons row — shown on every cluster */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                    {isAddable && onAddModuleToPlan && isFirst && (
                                        <button
                                            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                            onClick={(e) => { e.stopPropagation(); setIsMenuOpen((v) => !v); }}
                                            title="Add to plan" aria-label="Add to plan"
                                            style={{ border: `1px solid ${borderColor}`, background: "#ffffff", color: "#111827", borderRadius: 6, fontSize: 12, width: 24, height: 20, lineHeight: 1, cursor: "pointer" }}
                                        >+</button>
                                    )}
                                    {onToggleModuleDone && (status === "in_plan" || status === "done") && (
                                        <button
                                            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                            onClick={(e) => { e.stopPropagation(); onToggleModuleDone?.(moduleCourseCodes, !isDone, groupId); }}
                                            title={isDone ? "Mark module as in plan" : "Mark module as done"}
                                            aria-label={isDone ? "Mark module as in plan" : "Mark module as done"}
                                            style={{ border: `1px solid ${isDone ? "#9ca3af" : baseColor}`, background: isDone ? "#10b981" : "#ffffff", color: isDone ? "#ffffff" : "#111827", borderRadius: 6, fontSize: 12, width: 24, height: 20, lineHeight: 1, cursor: "pointer" }}
                                        >✓</button>
                                    )}
                                    {onRemove && (status === "in_plan" || status === "done" || isParked) && (
                                        <button
                                            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                            onClick={(e) => { e.stopPropagation(); onRemove(); }}
                                            title="Remove from plan" aria-label="Remove from plan"
                                            style={{ border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 12, width: 24, height: 20, lineHeight: 1, cursor: "pointer" }}
                                        >×</button>
                                    )}
                                    {isMenuOpen && isAddable && onAddModuleToPlan && isFirst && (
                                        <div ref={menuRef} style={{ position: "absolute", top: 24, right: 0, width: 220, border: "1px solid #d1d5db", borderRadius: 8, background: "#ffffff", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", padding: 6, display: "grid", gap: 4, zIndex: 30 }}>
                                            {visibleSemesterOptions.map((semester) => {
                                                const isParkingChoice = Boolean(semester?.isParking) || Number(semester?.id) === 0;
                                                const disableChoice = isParked && isParkingChoice;
                                                return (
                                                    <button
                                                        key={semester.id}
                                                        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
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
                                                    >{semester.title}</button>
                                                );
                                            })}
                                            {canRevealMoreSemesters && (
                                                <button
                                                    onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                    onClick={(e) => { e.stopPropagation(); setPlusRevealCount((count) => Math.min(count + 1, plusSemesterOptions.length)); }}
                                                    style={{ border: "1px dashed #9ca3af", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                                >+ Add next semester</button>
                                            )}
                                            <button
                                                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); }}
                                                style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                            >Back</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Title + ECTS info — only on the first (leftmost) cluster */}
                            {(
                                <>
                                    <div style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 1, overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.25, fontSize: 13, fontWeight: 700, color: isDone ? "#6b7280" : "#111827" }}>
                                        {displayCourseTitle(title ?? "Module")}
                                    </div>
                                    <div style={{ color: isDone ? "#9ca3af" : "#6b7280", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {Number(moduleCourseCount ?? 0)} courses • {moduleEcts ? `${moduleEcts} ECTS` : "-"} • {typeMeta.label} •{" "}
                                        <span style={{ color: statusTextColor, fontWeight: 700 }}>{statusLabel}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })
                : (
                    // Single-lane: render original full header
                    <div
                        className="module-bg-drag-handle"
                        style={{ position: "absolute", top: 6, left: 10, right: 10, height: MODULE_HEADER_HEIGHT - 10, display: "grid", alignContent: "space-between", gap: 2, color: "#111827", fontWeight: 700, fontSize: 13, background: "transparent", borderRadius: 6, padding: "6px 8px", cursor: "grab", zIndex: 1 }}
                    >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                {isAddable && onAddModuleToPlan && (
                                    <button
                                        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onClick={(e) => { e.stopPropagation(); setIsMenuOpen((v) => !v); }}
                                        title="Add to plan" aria-label="Add to plan"
                                        style={{ border: `1px solid ${borderColor}`, background: "#ffffff", color: "#111827", borderRadius: 6, fontSize: 12, width: 24, height: 20, lineHeight: 1, cursor: "pointer" }}
                                    >+</button>
                                )}
                                {onToggleModuleDone && (status === "in_plan" || status === "done") && (
                                    <button
                                        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onClick={(e) => { e.stopPropagation(); onToggleModuleDone?.(moduleCourseCodes, !isDone, groupId); }}
                                        title={isDone ? "Mark module as in plan" : "Mark module as done"}
                                        aria-label={isDone ? "Mark module as in plan" : "Mark module as done"}
                                        style={{ border: `1px solid ${isDone ? "#9ca3af" : baseColor}`, background: isDone ? "#10b981" : "#ffffff", color: isDone ? "#ffffff" : "#111827", borderRadius: 6, fontSize: 12, width: 24, height: 20, lineHeight: 1, cursor: "pointer" }}
                                    >✓</button>
                                )}
                                {onRemove && (status === "in_plan" || status === "done" || isParked) && (
                                    <button
                                        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                                        title="Remove from plan" aria-label="Remove from plan"
                                        style={{ border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 12, width: 24, height: 20, lineHeight: 1, cursor: "pointer" }}
                                    >×</button>
                                )}
                                {isMenuOpen && isAddable && onAddModuleToPlan && (
                                    <div ref={menuRef} style={{ position: "absolute", top: 24, right: 0, width: 220, border: "1px solid #d1d5db", borderRadius: 8, background: "#ffffff", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", padding: 6, display: "grid", gap: 4, zIndex: 30 }}>
                                        {visibleSemesterOptions.map((semester) => {
                                            const isParkingChoice = Boolean(semester?.isParking) || Number(semester?.id) === 0;
                                            const disableChoice = isParked && isParkingChoice;
                                            return (
                                                <button
                                                    key={semester.id}
                                                    onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
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
                                                >{semester.title}</button>
                                            );
                                        })}
                                        {canRevealMoreSemesters && (
                                            <button
                                                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                onClick={(e) => { e.stopPropagation(); setPlusRevealCount((count) => Math.min(count + 1, plusSemesterOptions.length)); }}
                                                style={{ border: "1px dashed #9ca3af", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                            >+ Add next semester</button>
                                        )}
                                        <button
                                            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                            onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); }}
                                            style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                        >Back</button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 1, overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.25, fontSize: 13, fontWeight: 700, color: isDone ? "#6b7280" : "#111827" }}>
                            {displayCourseTitle(title ?? "Module")}
                        </div>
                        <div style={{ color: isDone ? "#9ca3af" : "#6b7280", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {Number(moduleCourseCount ?? 0)} courses • {moduleEcts ? `${moduleEcts} ECTS` : "-"} • {typeMeta.label} •{" "}
                            <span style={{ color: statusTextColor, fontWeight: 700 }}>{statusLabel}</span>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
