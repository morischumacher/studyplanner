/**
 * Dragging: from the sidebar onto the canvas, and from one lane to another.
 *
 * A drag never writes the plan itself. It raises `needsPersist` and lets the
 * effect below read the finished canvas back on the next commit, which is the
 * one commit point that sees a card where it actually came to rest rather than
 * where the updater thought it would. Everything that places a card without a
 * drag writes the plan through directly instead, and the difference is what the
 * rule check and the rollbacks are timed against.
 *
 * A card dropped left of the first lane is parked rather than placed, since
 * there is no semester there to place it in.
 */

import { useCallback, useEffect, useRef } from "react";
import type { DragEvent, MutableRefObject } from "react";

import { getCourseTypeForCode } from "../../domain/catalogue.ts";
import {
    GRID_SIZE,
    LANE_GAP,
    LANE_WIDTH,
    centerX,
    laneIndexFromX,
    laneX,
    projectToLaneAndSnap,
} from "../../domain/layout.ts";
import { resolveModuleVariantCourses } from "../../domain/prefill/index.ts";
import type { Catalogue } from "../../domain/types.ts";
import type { StickyViolation } from "../rule-check/index.ts";
import { recomputeGroupFromChildren, resolveGroupCourseOverlaps } from "./node-layout.ts";
import type { BoardFlowInstance } from "./useBoardNodes.ts";
import type { ParkRequest } from "./useCoursePlacement.ts";
import type {
    AddCourseToPlan,
    AddModuleToPlan,
    BoardNode,
    DragPayload,
} from "./types.ts";

/** How long a refusal stays on screen after a drop the plan cannot take. */
const TERM_VIOLATION_MS = 3500;

const TERM_VIOLATION_MESSAGE = "This course is not offered in that semester.";

/** Where a drag started, so that a refused drop can be put back. */
interface DragOrigin {
    x: number;
    y: number;
}

export interface UseBoardDragHandlersInput {
    nodes: BoardNode[];
    setNodes: (update: (nodes: BoardNode[]) => BoardNode[]) => void;
    needsPersist: boolean;
    setNeedsPersist: (needsPersist: boolean) => void;
    setCoursesFromNodes: (nodes: BoardNode[]) => void;
    wrapperRef: MutableRefObject<HTMLDivElement | null>;
    rfRef: MutableRefObject<BoardFlowInstance | null>;
    catalog: Catalogue;
    /** The topmost row a card inside a module panel may occupy. */
    minGroupChildY: number;
    /** The topmost row a module panel may occupy, below the lane headers. */
    minModuleGroupTopY: number;
    maxSemesterCount: number;
    activeSemesterCount: number;
    setDragPreviewSemesterCount: (count: number | null) => void;
    isCourseAllowedInLane: (courseCode: string | null | undefined, laneIndex: number) => boolean;
    firstAllowedLaneForCourse: (courseCode: string | null | undefined, preferredLane: number) => number | null;
    clampPlacementLane: (requestedLaneIndex: number) => number;
    resolveLaneCollisions: (nodes: BoardNode[]) => BoardNode[];
    setCourseDone: (courseCode: string, nextDone: boolean) => void;
    setStickyViolation: (violation: StickyViolation) => void;
    parkCourseCodes: (courseCodes: ParkRequest[] | ParkRequest) => boolean;
    addGraphCourseToPlan: AddCourseToPlan;
    addGraphModuleToPlan: AddModuleToPlan;
    removeModuleGroup: (groupId: string) => void;
    toggleModuleDoneCodes: (courseCodes: string[], nextDone: boolean, groupId?: string) => void;
}

export interface UseBoardDragHandlersResult {
    handleDragStart: (event: DragEvent, payload: DragPayload) => void;
    onDragOver: (event: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (event: DragEvent) => void;
    onNodeDragStart: (event: unknown, node: BoardNode) => void;
    onNodeDrag: (event: unknown, node: BoardNode) => void;
    onNodeDragStopMerged: (event: unknown, node: BoardNode) => void;
    onSelectionDragStopMerged: (event: unknown, draggedNodes: BoardNode[]) => void;
    /** Marks that the canvas should be written to the plan after the next commit. */
    schedulePersist: () => void;
    /** True for as long as a node is under the pointer. */
    nodeDragInProgressRef: MutableRefObject<boolean>;
}

export function useBoardDragHandlers({
    nodes,
    setNodes,
    needsPersist,
    setNeedsPersist,
    setCoursesFromNodes,
    wrapperRef,
    rfRef,
    catalog,
    minGroupChildY,
    minModuleGroupTopY,
    maxSemesterCount,
    activeSemesterCount,
    setDragPreviewSemesterCount,
    isCourseAllowedInLane,
    firstAllowedLaneForCourse,
    clampPlacementLane,
    resolveLaneCollisions,
    setCourseDone,
    setStickyViolation,
    parkCourseCodes,
    addGraphCourseToPlan,
    addGraphModuleToPlan,
    removeModuleGroup,
    toggleModuleDoneCodes,
}: UseBoardDragHandlersInput): UseBoardDragHandlersResult {
    const groupDragRef = useRef(new Map<string, { lastX: number; lastY: number }>());
    const nodeDragStartPosRef = useRef(new Map<string, DragOrigin>());
    const nodeDragInProgressRef = useRef(false);
    const pendingDragPayloadRef = useRef<DragPayload | null>(null);

    const handleDragStart = useCallback((e: DragEvent, payload: DragPayload) => {
        pendingDragPayloadRef.current = payload ?? null;
        const dt = e?.dataTransfer || e?.nativeEvent?.dataTransfer || null;
        if (!dt) return;
        try {
            dt.setData("application/x-course", JSON.stringify(payload));
            dt.effectAllowed = "move";
        } catch {
            // Some environments block setData for custom MIME types; fallback ref handles drop.
        }
    }, []);

    const laneIndexFromClientPosition = useCallback((clientX: number | undefined) => {
        const bounds = wrapperRef.current?.getBoundingClientRect?.();
        const viewport = typeof rfRef.current?.getViewport === "function"
            ? rfRef.current.getViewport()
            : { x: 0, y: 0, zoom: 1 };
        const zoom = Number.isFinite(viewport?.zoom) && viewport.zoom > 0 ? viewport.zoom : 1;
        const vx = Number.isFinite(viewport?.x) ? viewport.x : 0;
        const left = Number.isFinite(bounds?.left) ? Number(bounds?.left) : 0;
        const flowX = (Number(clientX) - left - vx) / zoom;
        const span = LANE_WIDTH + LANE_GAP;
        return Math.max(0, Math.floor((flowX + LANE_GAP * 0.5) / span));
    }, []);

    const onDragOver = useCallback((event: DragEvent) => {
        event.preventDefault();
        const dt = event?.dataTransfer || event?.nativeEvent?.dataTransfer || null;
        if (dt) dt.dropEffect = "move";
        // The lane after the last used one is drawn while a drag hovers over it,
        // which is the whole of the "one more semester" affordance.
        const previewLane = laneIndexFromClientPosition(event?.clientX);
        const nextAllowedLane = activeSemesterCount;
        if (previewLane === nextAllowedLane && activeSemesterCount < maxSemesterCount) {
            setDragPreviewSemesterCount(nextAllowedLane + 1);
        } else {
            setDragPreviewSemesterCount(null);
        }
    }, [activeSemesterCount, laneIndexFromClientPosition, maxSemesterCount]);

    const onDragLeave = useCallback(() => {
        setDragPreviewSemesterCount(null);
    }, []);

    const onNodeDragStart = useCallback((_: unknown, node: BoardNode) => {
        nodeDragInProgressRef.current = true;
        nodeDragStartPosRef.current.set(node?.id, {
            x: Number(node?.position?.x ?? 0),
            y: Number(node?.position?.y ?? 0),
        });
        if (node?.type !== "moduleBg") return;
        groupDragRef.current.set(node.id, { lastX: node.position.x, lastY: node.position.y });
    }, []);

    const onNodeDrag = useCallback((_: unknown, node: BoardNode) => {
        const rawLane = laneIndexFromX(node?.position?.x ?? 0, maxSemesterCount - 1);
        if (rawLane === activeSemesterCount && activeSemesterCount < maxSemesterCount) {
            setDragPreviewSemesterCount(activeSemesterCount + 1);
        } else {
            setDragPreviewSemesterCount(null);
        }

        // Dragging a module background: move all children by the same live delta.
        if (node?.type === "moduleBg") {
            const st = groupDragRef.current.get(node.id) || { lastX: node.position.x, lastY: node.position.y };
            const dx = node.position.x - st.lastX;
            const dy = node.position.y - st.lastY;
            if (dx === 0 && dy === 0) return;
            groupDragRef.current.set(node.id, { lastX: node.position.x, lastY: node.position.y });
            setNodes((prev) =>
                prev.map((n) => (n.type === "course" && n.data?.groupId === node.id
                    ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
                    : n))
            );
            return;
        }

        // Dragging a child course inside a module: keep the module background synced live.
        if (node?.type === "course" && node?.data?.groupId) {
            const groupId = node.data.groupId;
            setNodes((prev) => {
                const withDraggedCourse = prev.map((n) => (
                    n.id === node.id ? { ...n, position: { x: node.position.x, y: node.position.y } } : n
                ));
                return recomputeGroupFromChildren(withDraggedCourse, groupId);
            });
        }
    }, [activeSemesterCount, maxSemesterCount, setNodes]);

    const schedulePersist = useCallback(() => setNeedsPersist(true), []);

    // The one commit point that reads the canvas rather than predicting it.
    useEffect(() => {
        if (!needsPersist) return;
        const latestNodes = (rfRef.current?.getNodes?.() || nodes).filter((n) => n.type !== "lane");
        setCoursesFromNodes(latestNodes);
        setNeedsPersist(false);
    }, [needsPersist, nodes, setCoursesFromNodes]);

    const onNodeDragStop = useCallback((_: unknown, node: BoardNode) => {
        nodeDragInProgressRef.current = false;
        setDragPreviewSemesterCount(null);
        const snappedYRaw = Math.round(node.position.y / GRID_SIZE) * GRID_SIZE;
        const snappedY = Math.max(0, snappedYRaw);
        let invalidPlacementAttempted = false;

        // If a whole module group was dragged: shift children by the snap delta, snap the group,
        // then recompute the group bbox, and resolve collisions.
        if (node?.type === "moduleBg") {
            const span = LANE_WIDTH + LANE_GAP;
            const rawLane = Math.floor((Number(node?.position?.x || 0) + LANE_GAP * 0.5) / span);
            if (rawLane < 0) {
                const source = rfRef.current?.getNodes?.() || [];
                const codes = source
                    .filter((n) => n.type === "course" && n?.data?.groupId === node.id)
                    .map((n) => n?.data?.code)
                    .filter((code): code is string => Boolean(code));
                parkCourseCodes(codes);
                groupDragRef.current.delete(node.id);
                nodeDragStartPosRef.current.delete(node?.id);
                return;
            }
            setNodes((prev) => {
                const clampedGroupY = Math.max(minModuleGroupTopY, snappedY);
                const dySnap = clampedGroupY - node.position.y;
                const moved = prev.map((n) => {
                    if (n.type === "course" && n.data?.groupId === node.id) {
                        const preferredLane = clampPlacementLane(laneIndexFromX(n.position.x, maxSemesterCount - 1));
                        const targetLane = firstAllowedLaneForCourse(n?.data?.code, preferredLane) ?? preferredLane;
                        if (!isCourseAllowedInLane(n?.data?.code, preferredLane) && targetLane !== preferredLane) {
                            invalidPlacementAttempted = true;
                        }
                        return {
                            ...n,
                            data: {
                                ...n.data,
                                status: "in_plan",
                            },
                            position: {
                                x: centerX(targetLane),
                                y: n.position.y + dySnap,
                            },
                        };
                    }
                    if (n.type === "moduleBg" && n.id === node.id) {
                        return {
                            ...n,
                            data: {
                                ...n.data,
                                status: "in_plan",
                                onToggleModuleDone: toggleModuleDoneCodes,
                                onRemoveGroup: removeModuleGroup,
                                onRemove: () => removeModuleGroup(node.id),
                            },
                        };
                    }
                    return n;
                });
                const sized = recomputeGroupFromChildren(moved, node.id);
                return resolveLaneCollisions(sized);
            });
            groupDragRef.current.delete(node.id);
            nodeDragStartPosRef.current.delete(node?.id);
            return;
        }

        // Course inside a group → snap only the course, then recompute the group bbox
        if (node?.type === "course" && node?.data?.groupId) {
            const span = LANE_WIDTH + LANE_GAP;
            const rawLane = Math.floor((Number(node?.position?.x || 0) + LANE_GAP * 0.5) / span);
            if (rawLane < 0) {
                parkCourseCodes([node?.data?.code]);
                nodeDragStartPosRef.current.delete(node?.id);
                return;
            }
            const groupId = node.data.groupId;
            const startPos = nodeDragStartPosRef.current.get(node?.id);
            const preferredLane = clampPlacementLane(laneIndexFromX(node.position.x, maxSemesterCount - 1));
            const invalidDrop = !isCourseAllowedInLane(node?.data?.code, preferredLane);
            if (invalidDrop && startPos) {
                setNodes((prev) => {
                    const reverted = prev.map((n) =>
                        n.id === node.id ? { ...n, position: { x: startPos.x, y: startPos.y } } : n
                    );
                    const stacked = resolveGroupCourseOverlaps(reverted, groupId);
                    return resolveLaneCollisions(recomputeGroupFromChildren(stacked, groupId));
                });
                setStickyViolation({
                    message: TERM_VIOLATION_MESSAGE,
                    until: Date.now() + TERM_VIOLATION_MS,
                    tone: "error",
                });
                nodeDragStartPosRef.current.delete(node?.id);
                return;
            }
            setNodes((prev) => {
                const targetLane = firstAllowedLaneForCourse(node?.data?.code, preferredLane) ?? preferredLane;
                if (!isCourseAllowedInLane(node?.data?.code, preferredLane) && targetLane !== preferredLane) {
                    invalidPlacementAttempted = true;
                }
                const targetLaneX = centerX(targetLane);
                const snappedGroupChildY = Math.max(minGroupChildY, snappedY);
                const updated = prev.map((n) =>
                    n.id === node.id ? { ...n, position: { x: targetLaneX, y: snappedGroupChildY } } : n
                );
                const stacked = resolveGroupCourseOverlaps(updated, groupId);
                return resolveLaneCollisions(recomputeGroupFromChildren(stacked, groupId));
            });
            nodeDragStartPosRef.current.delete(node?.id);
            return;
        }

        // All other nodes: normal snapping + collision resolution
        const span = LANE_WIDTH + LANE_GAP;
        const rawLane = Math.floor((Number(node?.position?.x || 0) + LANE_GAP * 0.5) / span);
        if (node?.type === "course" && rawLane < 0) {
            parkCourseCodes([node?.data?.code]);
            nodeDragStartPosRef.current.delete(node?.id);
            return;
        }
        const preferredLane = clampPlacementLane(laneIndexFromX(node.position.x, maxSemesterCount - 1));
        const startPos = nodeDragStartPosRef.current.get(node?.id);
        if (node?.type === "course" && !isCourseAllowedInLane(node?.data?.code, preferredLane) && startPos) {
            setNodes((prev) => {
                const next = prev.map((n) => (
                    n.id === node.id ? { ...n, position: { x: startPos.x, y: startPos.y } } : n
                ));
                return resolveLaneCollisions(next);
            });
            setStickyViolation({
                message: TERM_VIOLATION_MESSAGE,
                until: Date.now() + TERM_VIOLATION_MS,
                tone: "error",
            });
            nodeDragStartPosRef.current.delete(node?.id);
            return;
        }
        const li = node?.type === "course"
            ? (firstAllowedLaneForCourse(node?.data?.code, preferredLane) ?? preferredLane)
            : preferredLane;
        if (node?.type === "course" && !isCourseAllowedInLane(node?.data?.code, preferredLane) && li !== preferredLane) {
            invalidPlacementAttempted = true;
        }
        const snappedX = centerX(li);
        setNodes((prev) => {
            const next = prev.map((n) => {
                if (n.id !== node.id) return n;
                if (n?.type === "course" && String(n?.data?.status || "") === "parked") {
                    setCourseDone(String(n?.data?.code || ""), false);
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            status: "in_plan",
                            groupId: null,
                            moduleMeta: null,
                        },
                        position: { x: snappedX, y: snappedY },
                    };
                }
                return { ...n, position: { x: snappedX, y: snappedY } };
            });
            return resolveLaneCollisions(next);
        });
        if (invalidPlacementAttempted) {
            setStickyViolation({
                message: TERM_VIOLATION_MESSAGE,
                until: Date.now() + TERM_VIOLATION_MS,
                tone: "error",
            });
        }
        nodeDragStartPosRef.current.delete(node?.id);
    }, [minGroupChildY, minModuleGroupTopY, clampPlacementLane, firstAllowedLaneForCourse, isCourseAllowedInLane, maxSemesterCount, parkCourseCodes, removeModuleGroup, setCourseDone, setNodes, setStickyViolation, toggleModuleDoneCodes]);

    const onNodeDragStopMerged = useCallback((evt: unknown, node: BoardNode) => {
        onNodeDragStop(evt, node);
        schedulePersist();
    }, [onNodeDragStop, schedulePersist]);

    // Dragging a multi-selection moves cards without telling their module panels,
    // so the panels are settled around their children once the drag has ended.
    const onSelectionDragStopMerged = useCallback((_: unknown, draggedNodes: BoardNode[]) => {
        const draggedIds = new Set(
            (Array.isArray(draggedNodes) ? draggedNodes : [])
                .map((n) => n?.id)
                .filter(Boolean)
        );
        setNodes((prev) => {
            const affectedGroupIds = new Set<string>();
            for (const n of prev) {
                const isDragged = draggedIds.has(n.id) || Boolean(n?.selected);
                if (!isDragged) continue;
                if (n?.type !== "course" || !n?.data?.groupId) continue;
                affectedGroupIds.add(n.data.groupId);
            }
            if (!affectedGroupIds.size) return prev;
            let next = prev;
            for (const groupId of affectedGroupIds) {
                next = recomputeGroupFromChildren(next, groupId);
            }
            return resolveLaneCollisions(next);
        });
        schedulePersist();
    }, [schedulePersist, setNodes, resolveLaneCollisions]);

    const onDrop = useCallback(
        (evt: DragEvent) => {
            evt.preventDefault();
            const dt = evt?.dataTransfer || evt?.nativeEvent?.dataTransfer || null;
            let payload: DragPayload | null = null;
            const raw = dt ? dt.getData("application/x-course") : "";
            if (raw) {
                try {
                    payload = JSON.parse(raw) as DragPayload;
                } catch {
                    payload = null;
                }
            }
            if (!payload && pendingDragPayloadRef.current) {
                payload = pendingDragPayloadRef.current;
            }
            if (!payload) return;
            pendingDragPayloadRef.current = null;
            setDragPreviewSemesterCount(null);

            const { x } = projectToLaneAndSnap({
                evt,
                wrapperEl: wrapperRef.current,
                rfInstance: rfRef.current,
                maxLaneIndex: Math.min(maxSemesterCount - 1, activeSemesterCount),
            });
            const bounds = wrapperRef.current?.getBoundingClientRect?.();
            const viewport = rfRef.current?.getViewport?.() || { x: 0, y: 0, zoom: 1 };
            const flowX = (Number(evt?.clientX || 0) - Number(bounds?.left || 0) - Number(viewport?.x || 0)) / (Number(viewport?.zoom || 1) || 1);
            const dropInParking = flowX < laneX(0);
            const dropLaneIndex = Math.max(0, Math.min(laneIndexFromX(x, maxSemesterCount - 1), maxSemesterCount - 1));

            // A) Module with >= 2 courses
            if (payload?.kind === "module" && Array.isArray(payload.courses) && payload.courses.length >= 2) {
                const variantResolution = resolveModuleVariantCourses(
                    payload as Parameters<typeof resolveModuleVariantCourses>[0],
                    payload?.variantId ?? null
                );
                const moduleCourses = Array.isArray(variantResolution?.selectedCourses) ? variantResolution.selectedCourses : payload.courses;
                if (!moduleCourses.length) return;
                if (dropInParking) {
                    parkCourseCodes(moduleCourses.map((course) => course?.code).filter(Boolean));
                    schedulePersist();
                    return;
                }
                const added = addGraphModuleToPlan(payload, dropLaneIndex, {
                    allowDirectLaneSelection: true,
                    variantId: payload?.variantId ?? null,
                });
                if (!added) {
                    setStickyViolation({
                        message: "At least one module course could not be placed in a valid semester.",
                        until: Date.now() + TERM_VIOLATION_MS,
                        tone: "error",
                    });
                }
                schedulePersist();
                return;
            }

            // B) Single course card (or module with a single course treated as course)
            if (dropInParking) {
                parkCourseCodes([payload.code]);
                schedulePersist();
                return;
            }
            const added = addGraphCourseToPlan({
                code: payload.code,
                name: payload.name,
                type: payload?.type ?? getCourseTypeForCode(catalog, payload?.code),
                ects: payload.ects ?? null,
                moduleMeta: payload?.moduleMeta ?? null,
                category: payload.category ?? "unknown",
                subjectColor: payload.subjectColor ?? null,
            }, dropLaneIndex, { allowDirectLaneSelection: true });
            if (!added) {
                setStickyViolation({
                    message: TERM_VIOLATION_MESSAGE,
                    until: Date.now() + TERM_VIOLATION_MS,
                    tone: "error",
                });
            }
            schedulePersist();
        },
        [activeSemesterCount, addGraphCourseToPlan, addGraphModuleToPlan, catalog, maxSemesterCount, parkCourseCodes, schedulePersist, setStickyViolation]
    );

    return {
        handleDragStart,
        onDragOver,
        onDragLeave,
        onDrop,
        onNodeDragStart,
        onNodeDrag,
        onNodeDragStopMerged,
        onSelectionDragStopMerged,
        schedulePersist,
        nodeDragInProgressRef,
    };
}
