/**
 * What the buttons on a card and on a module panel do to the canvas.
 *
 * Ticking a course off writes to the plan first and patches the node second,
 * while removing one or editing its credits only raises the pending-save flag
 * and lets the canvas be read back later. The difference is deliberate: a tick
 * is a change the rule checker has to see as its own event, and a removal is
 * one the next read of the canvas will describe on its own.
 */

import { useCallback } from "react";

import { recomputeGroupFromChildren } from "./node-layout.ts";
import type { BoardFlowInstance } from "./useBoardNodes.ts";
import type { BoardNode } from "./types.ts";
import type { MutableRefObject } from "react";

export interface UseCourseCardActionsInput {
    nodes: BoardNode[];
    setNodes: (update: (nodes: BoardNode[]) => BoardNode[]) => void;
    setNeedsPersist: (needsPersist: boolean) => void;
    rfRef: MutableRefObject<BoardFlowInstance | null>;
    setCourseDone: (courseCode: string, nextDone: boolean) => void;
    setMultipleCoursesDone: (courseCodes: string[], nextDone: boolean) => void;
}

export interface UseCourseCardActionsResult {
    removeCourseNode: (nodeId: string) => void;
    removeModuleGroup: (groupId: string) => void;
    toggleCourseDone: (courseCode: string, nextDone: boolean, nodeId?: string) => void;
    updateCourseEcts: (nodeId: string, nextEcts: number) => void;
    toggleModuleDoneCodes: (courseCodes: string[], nextDone: boolean, groupId?: string) => void;
}

export function useCourseCardActions({
    nodes,
    setNodes,
    setNeedsPersist,
    rfRef,
    setCourseDone,
    setMultipleCoursesDone,
}: UseCourseCardActionsInput): UseCourseCardActionsResult {
    const removeCourseNode = useCallback((id: string) => {
        setNodes((prev) => {
            const victim = prev.find((n) => n.id === id);
            const groupId = victim?.data?.groupId;
            let next = prev.filter((n) => n.id !== id);
            if (groupId) next = recomputeGroupFromChildren(next, groupId);
            return next;
        });
        setNeedsPersist(true);
    }, [setNodes]);

    const removeModuleGroup = useCallback((groupId: string) => {
        setNodes((prev) => prev.filter((n) => n.id !== groupId && n.data?.groupId !== groupId));
        setNeedsPersist(true);
    }, [setNodes]);

    const toggleCourseDone = useCallback((courseCode: string, nextDone: boolean) => {
        setCourseDone(courseCode, nextDone);
        setNodes((prev) => {
            const updated = prev.map((n) => {
                if (n.type === "course" && n.data?.code === courseCode) {
                    return { ...n, data: { ...n.data, status: nextDone ? "done" : "in_plan" } };
                }
                return n;
            });
            const groupIds = prev
                .filter((n) => n.type === "course" && n.data?.code === courseCode)
                .map((n) => n.data?.groupId)
                .filter((groupId): groupId is string => Boolean(groupId));
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
    }, [setCourseDone, setNodes]);

    const updateCourseEcts = useCallback((nodeId: string, nextEcts: number) => {
        const parsed = Number(nextEcts);
        if (!nodeId || !Number.isFinite(parsed) || parsed <= 0) return;
        setNodes((prev) => prev.map((n) => {
            if (n.id !== nodeId || n.type !== "course") return n;
            const current = Number(n?.data?.ects ?? 0);
            if (Number.isFinite(current) && current === parsed) return n;
            return { ...n, data: { ...n.data, ects: parsed } };
        }));
        setNeedsPersist(true);
    }, [setNodes]);

    const toggleModuleDoneCodes = useCallback((
        courseCodes: string[],
        nextDone: boolean,
        groupId?: string
    ) => {
        // The panel knows its own courses better than the payload does, since a
        // course can have been dragged out of the module since the card was drawn.
        const source = (rfRef.current?.getNodes?.() || nodes);
        const codesFromGroup = groupId
            ? source
                .filter((n) => n.type === "course" && n.data?.groupId === groupId)
                .map((n) => n?.data?.code)
                .filter((code): code is string => Boolean(code))
            : [];
        const codesFromPayload = Array.isArray(courseCodes) ? courseCodes.filter(Boolean) : [];
        const codes = codesFromGroup.length ? codesFromGroup : codesFromPayload;
        const uniqueCodes = [...new Set(codes)];
        if (!uniqueCodes.length) return;
        setMultipleCoursesDone(uniqueCodes, Boolean(nextDone));
        setNodes((prev) => {
            const patched = prev.map((n) => {
                if (n.type !== "course" || !uniqueCodes.includes(n?.data?.code ?? "")) return n;
                return { ...n, data: { ...n.data, status: nextDone ? "done" : "in_plan" } };
            });
            if (groupId) {
                return patched.map((n) => (
                    n.type === "moduleBg" && n.id === groupId
                        ? {
                            ...n,
                            data: {
                                ...n.data,
                                status: nextDone ? "done" : "in_plan",
                                moduleCourseCodes: uniqueCodes,
                            },
                        }
                        : n
                ));
            }
            return patched;
        });
    }, [nodes, setMultipleCoursesDone, setNodes]);

    return {
        removeCourseNode,
        removeModuleGroup,
        toggleCourseDone,
        updateCourseEcts,
        toggleModuleDoneCodes,
    };
}
