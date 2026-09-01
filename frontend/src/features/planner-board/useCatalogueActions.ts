/**
 * What the sidebar and the curriculum graph do to a plan they are not drawing.
 *
 * Both list courses that may already be on the canvas, so every action here has
 * to reach the canvas as well as the plan. Ticking a course off leaves the
 * canvas to be read back later, whereas dropping one writes the plan through at
 * once: a removal has to be described while the removed cards can still be
 * found, and a tick is already a change of its own.
 */

import { useCallback } from "react";
import type { MutableRefObject } from "react";

import { recomputeGroupFromChildren } from "./node-layout.ts";
import type { BoardFlowInstance } from "./useBoardNodes.ts";
import type { BoardNode, CourseMetaPatch, ModulePayload } from "./types.ts";

export interface UseCatalogueActionsInput {
    nodes: BoardNode[];
    setNodes: (update: (nodes: BoardNode[]) => BoardNode[]) => void;
    setNeedsPersist: (needsPersist: boolean) => void;
    setCoursesFromNodes: (nodes: BoardNode[]) => void;
    rfRef: MutableRefObject<BoardFlowInstance | null>;
    getCourseStatus: (courseCode: string | null | undefined) => string;
    setCourseDone: (courseCode: string, nextDone: boolean) => void;
    setMultipleCoursesDone: (courseCodes: string[], nextDone: boolean) => void;
    setCourseMeta: (courseCode: string, patch: CourseMetaPatch) => void;
}

export interface UseCatalogueActionsResult {
    toggleGraphCourseDone: (courseCode: string | null | undefined, nextDone: boolean) => void;
    toggleGraphModuleDone: (
        courseCodes: string[] | null | undefined,
        nextDone: boolean,
        groupId?: string
    ) => void;
    updateCourseMeta: (courseCode: string | null | undefined, patch: CourseMetaPatch) => void;
    /** True when at least one card was found and taken off the canvas. */
    removeGraphCoursesFromPlan: (courseCodes: readonly (string | null | undefined)[]) => boolean;
    removeGraphCourseFromPlan: (courseCode: string | null | undefined) => boolean;
    removeGraphModuleFromPlan: (modulePayload: ModulePayload | null | undefined) => boolean;
}

export function useCatalogueActions({
    nodes,
    setNodes,
    setNeedsPersist,
    setCoursesFromNodes,
    rfRef,
    getCourseStatus,
    setCourseDone,
    setMultipleCoursesDone,
    setCourseMeta,
}: UseCatalogueActionsInput): UseCatalogueActionsResult {
    const toggleGraphCourseDone = useCallback((courseCode: string | null | undefined, nextDone: boolean) => {
        if (!courseCode) return;
        // A course that is not in the plan has no state to tick, and a parked
        // one is not being taken, so neither can be marked as passed from here.
        const currentStatus = getCourseStatus(courseCode);
        if (currentStatus !== "in_plan" && currentStatus !== "done") return;

        setCourseDone(courseCode, Boolean(nextDone));
        setNodes((prev) => prev.map((n) => {
            if (n.type !== "course" || n?.data?.code !== courseCode) return n;
            return { ...n, data: { ...n.data, status: nextDone ? "done" : "in_plan" } };
        }));
    }, [getCourseStatus, setCourseDone, setNodes]);

    const toggleGraphModuleDone = useCallback((
        courseCodes: string[] | null | undefined,
        nextDone: boolean,
        groupId?: string
    ) => {
        const source = (rfRef.current?.getNodes?.() || nodes);
        const codesFromGroup = groupId
            ? source
                .filter((n) => n.type === "course" && n.data?.groupId === groupId)
                .map((n) => n?.data?.code)
                .filter((code): code is string => Boolean(code))
            : [];
        const codesFromPayload = Array.isArray(courseCodes) ? courseCodes.filter(Boolean) : [];
        const codes = codesFromGroup.length ? codesFromGroup : codesFromPayload;
        if (!codes.length) return;
        const uniqueCodes = [...new Set(codes)];
        setMultipleCoursesDone(uniqueCodes, Boolean(nextDone));
        setNodes((prev) => prev.map((n) => {
            if (n.type !== "course" || !uniqueCodes.includes(n?.data?.code ?? "")) return n;
            return { ...n, data: { ...n.data, status: nextDone ? "done" : "in_plan" } };
        }));
    }, [nodes, setMultipleCoursesDone, setNodes]);

    const updateCourseMeta = useCallback((courseCode: string | null | undefined, patch: CourseMetaPatch) => {
        const code = String(courseCode || "").trim();
        if (!code) return;
        setCourseMeta(code, patch);
    }, [setCourseMeta]);

    const removeGraphCoursesFromPlan = useCallback((courseCodes: readonly (string | null | undefined)[]) => {
        const codes = Array.isArray(courseCodes)
            ? courseCodes.filter((code): code is string => Boolean(code))
            : [];
        if (!codes.length) return false;
        const removeSet = new Set(codes);

        let persistedNodes: BoardNode[] | null = null;
        let changed = false;
        setNodes((prev) => {
            const affectedGroupIds = new Set(
                prev
                    .filter((n) => n.type === "course" && removeSet.has(n?.data?.code ?? "") && n?.data?.groupId)
                    .map((n) => n.data?.groupId)
                    .filter((groupId): groupId is string => Boolean(groupId))
            );
            let next = prev.filter((n) => !(n.type === "course" && removeSet.has(n?.data?.code ?? "")));
            for (const groupId of affectedGroupIds) {
                next = recomputeGroupFromChildren(next, groupId);
            }
            if (next.length === prev.length) return prev;
            changed = true;
            persistedNodes = next.filter((n) => n.type !== "lane");
            return next;
        });

        if (!changed) return false;
        if (Array.isArray(persistedNodes)) {
            setCoursesFromNodes(persistedNodes);
            setNeedsPersist(false);
        } else {
            setNeedsPersist(true);
        }
        return true;
    }, [setCoursesFromNodes, setNodes]);

    const removeGraphCourseFromPlan = useCallback((courseCode: string | null | undefined) => {
        if (!courseCode) return false;
        return removeGraphCoursesFromPlan([courseCode]);
    }, [removeGraphCoursesFromPlan]);

    const removeGraphModuleFromPlan = useCallback((modulePayload: ModulePayload | null | undefined) => {
        const codes = Array.isArray(modulePayload?.courses)
            ? modulePayload.courses.map((c) => c?.code).filter((code): code is string => Boolean(code))
            : [];
        if (!codes.length) return false;
        return removeGraphCoursesFromPlan(codes);
    }, [removeGraphCoursesFromPlan]);

    return {
        toggleGraphCourseDone,
        toggleGraphModuleDone,
        updateCourseMeta,
        removeGraphCoursesFromPlan,
        removeGraphCourseFromPlan,
        removeGraphModuleFromPlan,
    };
}
