/**
 * Undoing a change the rule checker refused.
 *
 * A rollback is driven entirely by the diff the change carried, never by
 * comparing plans: the diff names the node ids that were added or moved and the
 * lane each moved node came from, and putting a card back means finding those
 * ids again. The array it searches must therefore be the one the diff was taken
 * from, which is why every rollback reads the canvas through the setter's
 * previous value rather than through a captured copy.
 */

import { useCallback } from "react";

import { centerX } from "../../domain/layout.ts";
import { recomputeGroupFromChildren } from "../../domain/nodes.ts";
import type { PlanNode } from "../../domain/types.ts";

/**
 * A refused change as a rollback reads it. Every field is optional because a
 * rollback re-checks what it was given rather than trusting the caller to have
 * matched the change to the right rollback.
 */
export interface RolledBackChange {
    type?: string | undefined;
    added?: readonly { id?: string | null | undefined }[] | undefined;
    moved?: readonly {
        id?: string | null | undefined;
        code?: string | null | undefined;
        fromLaneIndex?: number | null | undefined;
    }[] | undefined;
    courseCode?: string | undefined;
    courseCodes?: readonly string[] | undefined;
    toStatus?: string | undefined;
}

export interface UseRuleCheckRollbacksInput {
    /** Only ever called with an updater, so that the diff's ids are looked up in the live array. */
    setNodes: (updater: (nodes: PlanNode[]) => PlanNode[]) => void;
    setNeedsPersist: (needsPersist: boolean) => void;
    resolveLaneCollisions: (nodes: PlanNode[]) => PlanNode[];
    /**
     * Un-ticks a course without recording a plan change. Silence is what stops
     * the loop: a recorded rollback would ask for another rule check, whose
     * refusal would roll back again, and so on without end.
     */
    rollbackCourseDone: (courseCode: string, nextDone: boolean) => void;
}

export interface UseRuleCheckRollbacksResult {
    rollbackAddedCourses: (change: RolledBackChange | null | undefined) => void;
    rollbackMovedCourses: (change: RolledBackChange | null | undefined) => void;
    rollbackCourseStatusToggle: (change: RolledBackChange | null | undefined) => void;
}

export function useRuleCheckRollbacks({
    setNodes,
    setNeedsPersist,
    resolveLaneCollisions,
    rollbackCourseDone,
}: UseRuleCheckRollbacksInput): UseRuleCheckRollbacksResult {
    const rollbackAddedCourses = useCallback((change: RolledBackChange | null | undefined) => {
        const addedIds = Array.isArray(change?.added) ? change.added.map((a) => a?.id).filter(Boolean) : [];
        if (!addedIds.length) return;

        setNodes((prev) => {
            let next = prev.filter((n) => !addedIds.includes(n.id));
            const affectedGroupIds = new Set(
                prev
                    .filter((n) => addedIds.includes(n.id) && n.type === "course" && n.data?.groupId)
                    .map((n) => n.data?.groupId)
                    .filter((groupId): groupId is string => Boolean(groupId))
            );

            for (const groupId of affectedGroupIds) {
                next = recomputeGroupFromChildren(next, groupId);
            }
            return next;
        });
        setNeedsPersist(true);
    }, [setNodes]);

    const rollbackMovedCourses = useCallback((change: RolledBackChange | null | undefined) => {
        const movedItems = Array.isArray(change?.moved) ? change.moved : [];
        if (!movedItems.length) return;

        const byId = new Map<string, number>();
        const byCode = new Map<string, number>();
        for (const item of movedItems) {
            const id = String(item?.id || "").trim();
            const code = String(item?.code || "").trim();
            const fromLane = Number(item?.fromLaneIndex);
            if (!Number.isInteger(fromLane) || fromLane < 0) continue;
            if (id) byId.set(id, fromLane);
            if (code && !byCode.has(code)) byCode.set(code, fromLane);
        }
        if (!byId.size && !byCode.size) return;

        setNodes((prev) => {
            const affectedGroupIds = new Set<string>();
            const next = prev.map((node) => {
                if (node?.type !== "course") return node;
                const nodeId = String(node?.id || "").trim();
                const nodeCode = String(node?.data?.code || "").trim();
                const fromLane = byId.has(nodeId)
                    ? byId.get(nodeId)
                    : (nodeCode && byCode.has(nodeCode) ? byCode.get(nodeCode) : null);
                if (fromLane == null || !Number.isInteger(fromLane) || fromLane < 0) return node;
                if (node?.data?.groupId) affectedGroupIds.add(node.data.groupId);
                return {
                    ...node,
                    position: {
                        ...node.position,
                        x: centerX(fromLane),
                    },
                };
            });

            let resolved = next;
            for (const groupId of affectedGroupIds) {
                resolved = recomputeGroupFromChildren(resolved, groupId);
            }
            return resolveLaneCollisions(resolved);
        });
        setNeedsPersist(true);
    }, [resolveLaneCollisions, setNodes]);

    const rollbackCourseStatusToggle = useCallback((change: RolledBackChange | null | undefined) => {
        if (change?.type !== "course_status_toggled") return;
        const courseCodes = change?.courseCodes || (change?.courseCode ? [change.courseCode] : []);
        if (courseCodes.length === 0) return;
        const isRolledBackCourse = (node: PlanNode) => {
            const code = node.data?.code;
            return code != null && courseCodes.includes(code);
        };

        const attemptedDone = change?.toStatus === "done";
        const revertedDone = !attemptedDone;

        for (const courseCode of courseCodes) {
            rollbackCourseDone(courseCode, revertedDone);
        }

        setNodes((prev) => {
            const updated = prev.map((n) => {
                if (n.type === "course" && isRolledBackCourse(n)) {
                    return { ...n, data: { ...n.data, status: revertedDone ? "done" : "in_plan" } };
                }
                return n;
            });
            const groupIds = prev
                .filter((n) => n.type === "course" && isRolledBackCourse(n))
                .map((n) => n.data?.groupId)
                .filter(Boolean);
            if (groupIds.length > 0) {
                let currentNodes = updated;
                for (const groupId of [...new Set(groupIds)]) {
                    const groupCourses = currentNodes.filter((n) => n.type === "course" && n.data?.groupId === groupId);
                    const allDone = groupCourses.length > 0 && groupCourses.every((n) => n.data?.status === "done");
                    currentNodes = currentNodes.map((n) => {
                        if (n.type === "moduleBg" && n.id === groupId) {
                            return { ...n, data: { ...n.data, status: allDone ? "done" : "in_plan" } };
                        }
                        return n;
                    });
                }
                return currentNodes;
            }
            return updated;
        });
    }, [rollbackCourseDone, setNodes]);

    return { rollbackAddedCourses, rollbackMovedCourses, rollbackCourseStatusToggle };
}
