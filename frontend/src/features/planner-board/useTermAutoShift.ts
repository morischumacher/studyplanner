/**
 * Moving courses that a change of term has stranded.
 *
 * The plan is kept term-valid at all times rather than being allowed to hold a
 * course in a semester it is not taught in, so changing the start season or a
 * course's availability relocates whatever no longer fits. That makes this the
 * one plan mutation nobody asks for: it runs off a change to the profile, and
 * it writes the plan through in the same pass so that the rule check sees one
 * change rather than a shift followed by a save.
 *
 * A course is moved to the first lane at or after the one it is in, and only
 * backwards when the plan has nothing left in front of it.
 */

import { useEffect } from "react";
import type { MutableRefObject } from "react";

import { centerX, laneIndexFromX } from "../../domain/layout.ts";
import { isLaneAllowedForTerm } from "../../domain/terms.ts";
import type { TermAvailability } from "../../domain/terms.ts";
import type { StickyViolation } from "../rule-check/index.ts";
import { recomputeGroupFromChildren } from "./node-layout.ts";
import type { BoardNode } from "./types.ts";

/** What one pass of the shift did, before anything is written anywhere. */
interface TermShiftResult {
    resolved: BoardNode[];
    shiftedCount: number;
    changed: boolean;
}

interface TermShiftInput {
    maxSemesterCount: number;
    startTermSeason: string;
    termAvailabilityForCode: (courseCode: string) => TermAvailability;
    isCourseAllowedInLane: (courseCode: string | null | undefined, laneIndex: number) => boolean;
    firstAllowedLaneForCourse: (courseCode: string | null | undefined, preferredLane: number) => number | null;
    resolveLaneCollisions: (nodes: BoardNode[]) => BoardNode[];
}

/**
 * Works out where every term-invalid course has to go, and settles the canvas
 * around the moves. Parked courses are left alone, since the parking stage is
 * not a semester and nothing there is being taken.
 */
function shiftTermInvalidCourses(nodes: BoardNode[], {
    maxSemesterCount,
    startTermSeason,
    termAvailabilityForCode,
    isCourseAllowedInLane,
    firstAllowedLaneForCourse,
    resolveLaneCollisions,
}: TermShiftInput): TermShiftResult {
    let shiftedCount = 0;
    const maxLane = Math.max(0, maxSemesterCount - 1);
    const next = nodes.map((node) => ({ ...node, position: { ...(node?.position || { x: 0, y: 0 }) } }));
    const byId = new Map(next.map((node) => [node.id, node]));

    const findAnyAllowedLane = (code: string | null | undefined, preferredLane: number) => {
        const forward = firstAllowedLaneForCourse(code, preferredLane);
        if (forward != null) return forward;
        const term = termAvailabilityForCode(code ?? "");
        const preferred = Math.max(0, Math.min(Number(preferredLane) || 0, maxLane));
        for (let idx = preferred - 1; idx >= 0; idx -= 1) {
            if (isLaneAllowedForTerm(term, startTermSeason, idx)) return idx;
        }
        return null;
    };

    const groupIds = [...new Set(
        next
            .filter((node) => node?.type === "course" && node?.data?.groupId)
            .map((node) => node.data?.groupId)
            .filter((groupId): groupId is string => Boolean(groupId))
    )];
    const movedGroups = new Set<string>();

    for (const groupId of groupIds) {
        const children = next.filter((node) => node?.type === "course" && node?.data?.groupId === groupId);
        if (!children.length) continue;
        let movedAnyChildInGroup = false;
        for (const child of children) {
            if (String(child?.data?.status || "") === "parked") continue;
            const code = child?.data?.code;
            if (!code) continue;
            const currentLane = Math.max(0, Math.min(laneIndexFromX(child?.position?.x ?? 0, maxLane), maxLane));
            if (isCourseAllowedInLane(code, currentLane)) continue;
            const targetLane = findAnyAllowedLane(code, currentLane);
            if (targetLane == null || targetLane === currentLane) continue;
            const target = byId.get(child.id);
            if (!target) continue;
            target.position.x = centerX(targetLane);
            shiftedCount += 1;
            movedAnyChildInGroup = true;
        }
        if (movedAnyChildInGroup) movedGroups.add(groupId);
    }

    for (const node of next) {
        if (node?.type !== "course") continue;
        if (String(node?.data?.status || "") === "parked") continue;
        if (node?.data?.groupId) continue;
        const code = node?.data?.code;
        if (!code) continue;
        const currentLane = Math.max(0, Math.min(laneIndexFromX(node?.position?.x ?? 0, maxLane), maxLane));
        if (isCourseAllowedInLane(code, currentLane)) continue;
        const targetLane = findAnyAllowedLane(code, currentLane);
        if (targetLane == null || targetLane === currentLane) continue;
        node.position.x = centerX(targetLane);
        shiftedCount += 1;
    }

    let resolved = next;
    for (const groupId of movedGroups) {
        resolved = recomputeGroupFromChildren(resolved, groupId);
    }
    resolved = resolveLaneCollisions(resolved);

    // Only horizontal movement counts as a change worth writing: settling the
    // lanes can nudge a card downwards without any course changing semester.
    const changed = resolved.some((node, idx) => {
        const before = nodes[idx];
        if (!before) return true;
        return Number(before?.position?.x ?? 0) !== Number(node?.position?.x ?? 0);
    });

    return { resolved, shiftedCount, changed };
}

export interface UseTermAutoShiftInput {
    plannerHydrated: boolean;
    nodes: BoardNode[];
    setNodes: (nodes: BoardNode[]) => void;
    setNeedsPersist: (needsPersist: boolean) => void;
    setCoursesFromNodes: (nodes: BoardNode[]) => void;
    setStickyViolation: (violation: StickyViolation) => void;
    nodeDragInProgressRef: MutableRefObject<boolean>;
    maxSemesterCount: number;
    startTermSeason: string;
    /** In the dependencies because a changed override is what starts a shift. */
    effectiveCourseTermByCode: Record<string, TermAvailability>;
    termAvailabilityForCode: (courseCode: string) => TermAvailability;
    isCourseAllowedInLane: (courseCode: string | null | undefined, laneIndex: number) => boolean;
    firstAllowedLaneForCourse: (courseCode: string | null | undefined, preferredLane: number) => number | null;
    resolveLaneCollisions: (nodes: BoardNode[]) => BoardNode[];
}

export function useTermAutoShift({
    plannerHydrated,
    nodes,
    setNodes,
    setNeedsPersist,
    setCoursesFromNodes,
    setStickyViolation,
    nodeDragInProgressRef,
    maxSemesterCount,
    startTermSeason,
    effectiveCourseTermByCode,
    termAvailabilityForCode,
    isCourseAllowedInLane,
    firstAllowedLaneForCourse,
    resolveLaneCollisions,
}: UseTermAutoShiftInput): void {
    useEffect(() => {
        if (!plannerHydrated) return;
        // Relocating a card mid-drag would take it out from under the pointer.
        if (nodeDragInProgressRef.current) return;
        if (!Array.isArray(nodes) || nodes.length === 0) return;

        const { resolved, shiftedCount, changed } = shiftTermInvalidCourses(nodes, {
            maxSemesterCount,
            startTermSeason,
            termAvailabilityForCode,
            isCourseAllowedInLane,
            firstAllowedLaneForCourse,
            resolveLaneCollisions,
        });
        if (!changed) return;

        setNodes(resolved);
        setCoursesFromNodes(resolved.filter((node) => node.type !== "lane"));
        setNeedsPersist(false);
        if (shiftedCount > 0) {
            setStickyViolation({
                message: `Auto-shifted ${shiftedCount} course${shiftedCount === 1 ? "" : "s"} to valid semesters.`,
                until: Date.now() + 3200,
                tone: "success",
            });
        }
    }, [
        nodes,
        plannerHydrated,
        startTermSeason,
        effectiveCourseTermByCode,
        firstAllowedLaneForCourse,
        isCourseAllowedInLane,
        maxSemesterCount,
        resolveLaneCollisions,
        setCoursesFromNodes,
        setNeedsPersist,
        setNodes,
        setStickyViolation,
        termAvailabilityForCode,
    ]);
}
