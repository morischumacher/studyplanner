/**
 * Filling an empty planner with the prebuilt plan for a curriculum.
 *
 * Both appliers throw the canvas away and lay the whole degree out again rather
 * than adding to what is there, and both write the result through in the same
 * breath: the nodes go to React Flow and to the plan in one pass, with the
 * pending-save flag cleared, so the prefill is never seen as a stream of
 * separate additions by anything watching the plan.
 */

import { useCallback } from "react";

import { getCourseTypeForCode, getExamSubjectForCode } from "../../domain/catalogue.ts";
import {
    COLLISION_GAP,
    COURSE_LAYOUT_HEIGHT,
    COURSE_VERTICAL_GAP,
    centerX,
} from "../../domain/layout.ts";
import { buildBachelorPrefillPlan, buildMasterPrefillPlan } from "../../domain/prefill/index.ts";
import { BACHELOR_PROGRAM_CODE, MASTER_PROGRAM_CODE } from "../../domain/programmes.ts";
import type {
    BachelorPlannedCourse,
    Catalogue,
    PlannedCourse,
    PlannedModule,
    Point,
} from "../../domain/types.ts";
import type { StickyViolation } from "../rule-check/index.ts";

/**
 * What a card built here carries. Only the two fields this module reads back
 * are named; the rest are the handlers and flags the card components expect,
 * and naming them would fix a shape that belongs to those components.
 */
export interface PrefillNodeData {
    code?: string | null | undefined;
    groupId?: string | null | undefined;
    [key: string]: unknown;
}

/** A node on the canvas, open for the same reason its data is. */
export interface PrefillNode {
    id: string;
    type?: string | undefined;
    position: Point;
    data?: PrefillNodeData | undefined;
    [key: string]: unknown;
}

/** The module panel a run of the bachelor applier decided to draw. */
interface PrefillGroupMeta {
    groupId: string;
    module: PlannedModule | null;
    examSubject: string | null;
    subjectColor: string;
    category: string;
}

/** The default card colour, used where the exam subject has none of its own. */
const FALLBACK_SUBJECT_COLOR = "#2563eb";

export interface UsePrefilledPlansInput {
    programCode: string;
    catalog: Catalogue | null | undefined;
    startTermSeason: string;
    doneCourseCodes: readonly string[] | null | undefined;
    maxSemesterCount: number;
    subjectColors: Record<string, string> | null | undefined;
    /** The lane backgrounds the rebuilt canvas starts from. */
    laneNodes: PrefillNode[];
    /** The topmost row a card inside a module panel may occupy. */
    minGroupChildY: number;
    firstAllowedLaneForCourse: (
        courseCode: string | null | undefined,
        preferredLane: number
    ) => number | null;
    termAvailabilityForCode: (courseCode: string | null | undefined) => string;
    resolveLaneCollisions: (nodes: PrefillNode[]) => PrefillNode[];
    compactPrefillLayout: (nodes: PrefillNode[]) => PrefillNode[];
    recomputeGroupFromChildren: (nodes: PrefillNode[], groupId: string) => PrefillNode[];
    setNodes: (nodes: PrefillNode[]) => void;
    setCoursesFromNodes: (nodes: PrefillNode[]) => void;
    setNeedsPersist: (needsPersist: boolean) => void;
    setDragPreviewSemesterCount: (count: number | null) => void;
    setStickyViolation: (violation: StickyViolation) => void;
    removeCourseNode: (nodeId: string) => void;
    removeModuleGroup: (groupId: string) => void;
    toggleCourseDone: (courseCode: string, nextDone: boolean, nodeId: string) => void;
    toggleModuleDoneCodes: (courseCodes: string[], nextDone: boolean, groupId: string) => void;
    updateCourseEcts: (nodeId: string, nextEcts: number) => void;
}

export interface UsePrefilledPlansResult {
    /** False when the programme on screen is not the bachelor, or nothing matched. */
    applyBachelorPrefilledPlan: (focusName: string | null | undefined) => boolean;
    applyMasterPrefilledPlan: () => boolean;
}

export function usePrefilledPlans({
    programCode,
    catalog,
    startTermSeason,
    doneCourseCodes,
    maxSemesterCount,
    subjectColors,
    laneNodes,
    minGroupChildY,
    firstAllowedLaneForCourse,
    termAvailabilityForCode,
    resolveLaneCollisions,
    compactPrefillLayout,
    recomputeGroupFromChildren,
    setNodes,
    setCoursesFromNodes,
    setNeedsPersist,
    setDragPreviewSemesterCount,
    setStickyViolation,
    removeCourseNode,
    removeModuleGroup,
    toggleCourseDone,
    toggleModuleDoneCodes,
    updateCourseEcts,
}: UsePrefilledPlansInput): UsePrefilledPlansResult {
    const applyBachelorPrefilledPlan = useCallback((focusName: string | null | undefined) => {
        if (programCode !== BACHELOR_PROGRAM_CODE) return false;
        const { plannedCourses, missingAliases } = buildBachelorPrefillPlan(catalog, focusName, {
            startSeason: startTermSeason,
        });
        if (!plannedCourses.length) {
            setStickyViolation({
                message: "Prebuilt bachelor plan could not be applied (no matching catalog courses found).",
                until: Date.now() + 5000,
                tone: "error",
            });
            return false;
        }

        const doneSet = new Set(doneCourseCodes || []);
        const groupedByModule = new Map<string, BachelorPlannedCourse[]>();
        for (const course of plannedCourses) {
            const moduleKey = course?.module?.key || "";
            if (!moduleKey) continue;
            if (!groupedByModule.has(moduleKey)) groupedByModule.set(moduleKey, []);
            groupedByModule.get(moduleKey)?.push(course);
        }
        const groupedModuleKeys = new Set(
            [...groupedByModule.entries()]
                .filter(([, list]) => Array.isArray(list) && list.length >= 2)
                .map(([key]) => key)
        );
        const groupedModuleEntries = [...groupedByModule.entries()]
            .filter(([key]) => groupedModuleKeys.has(key))
            .sort((a, b) => {
                const aFirstSem = Math.min(...(a[1] || []).map((c) => Number(c?.semester) || 99));
                const bFirstSem = Math.min(...(b[1] || []).map((c) => Number(c?.semester) || 99));
                if (aFirstSem !== bFirstSem) return aFirstSem - bFirstSem;
                const aTitle = String(a?.[1]?.[0]?.module?.title || "").toLowerCase();
                const bTitle = String(b?.[1]?.[0]?.module?.title || "").toLowerCase();
                return aTitle.localeCompare(bTitle);
            });
        const moduleRowYByKey = new Map<string, number>();
        groupedModuleEntries.forEach(([moduleKey], rowIdx) => {
            moduleRowYByKey.set(moduleKey, minGroupChildY + rowIdx * (COURSE_LAYOUT_HEIGHT + 32));
        });

        const bySemester = new Map<number, BachelorPlannedCourse[]>();
        for (const item of plannedCourses) {
            const semester = Number(item?.semester);
            if (!Number.isInteger(semester) || semester < 1 || semester > maxSemesterCount) continue;
            const preferredLane = semester - 1;
            const targetLane = item?.prefillFixedSemester
                ? preferredLane
                : firstAllowedLaneForCourse(item?.code, preferredLane);
            if (targetLane == null) continue;
            const targetSemester = targetLane + 1;
            if (!bySemester.has(targetSemester)) bySemester.set(targetSemester, []);
            bySemester.get(targetSemester)?.push(item);
        }

        const now = Date.now();
        const rebuilt: PrefillNode[] = [...laneNodes];
        const groupNodeMetaByModuleKey = new Map<string, PrefillGroupMeta>();
        const groupedModuleSemesterOffset = new Map<string, number>();
        let sequence = 0;
        for (let semesterId = 1; semesterId <= maxSemesterCount; semesterId += 1) {
            const laneIndex = semesterId - 1;
            const list = bySemester.get(semesterId) || [];
            list.forEach((course, idx) => {
                const examSubject = course?.examSubject ?? getExamSubjectForCode(catalog, course?.code);
                const subjectColor =
                    (examSubject ? subjectColors?.[examSubject] : null) ||
                    FALLBACK_SUBJECT_COLOR;
                const moduleKey = course?.module?.key || "";
                const isGroupedModuleCourse = groupedModuleKeys.has(moduleKey);
                const moduleRowY = moduleRowYByKey.get(moduleKey);
                let groupId: string | null = null;
                if (isGroupedModuleCourse) {
                    const existing = groupNodeMetaByModuleKey.get(moduleKey);
                    if (existing?.groupId) {
                        groupId = existing.groupId;
                    } else {
                        groupId = `mod-prefill-${now}-${groupNodeMetaByModuleKey.size}`;
                        groupNodeMetaByModuleKey.set(moduleKey, {
                            groupId,
                            module: course?.module ?? null,
                            examSubject,
                            subjectColor,
                            category: course?.module?.category ?? course?.category ?? "unknown",
                        });
                    }
                }
                let targetY = 96 + idx * (COURSE_LAYOUT_HEIGHT + COLLISION_GAP);
                if (isGroupedModuleCourse && moduleRowY != null && Number.isFinite(moduleRowY)) {
                    const semesterOffsetKey = `${moduleKey}::${semesterId}`;
                    const duplicateOffset = groupedModuleSemesterOffset.get(semesterOffsetKey) || 0;
                    groupedModuleSemesterOffset.set(semesterOffsetKey, duplicateOffset + 1);
                    targetY = moduleRowY + duplicateOffset * (COURSE_LAYOUT_HEIGHT + COURSE_VERTICAL_GAP);
                }
                const id = `${course?.code || "course"}-prefill-${now}-${sequence}`;
                sequence += 1;
                rebuilt.push({
                    id,
                    type: "course",
                    data: {
                        label: course?.name || course?.code || "Course",
                        code: course?.code ?? null,
                        // A prefill template records no teaching format, so the card
                        // takes it from the catalogue.
                        type: getCourseTypeForCode(catalog, course?.code),
                        ects: course?.ects ?? null,
                        moduleMeta: null,
                        groupId,
                        baseY: targetY,
                        onRemove: removeCourseNode,
                        onRemoveModuleGroup: removeModuleGroup,
                        onToggleDone: toggleCourseDone,
                        onUpdateEcts: updateCourseEcts,
                        nodeId: id,
                        examSubject,
                        category: course?.category ?? "unknown",
                        programCode,
                        subjectColor,
                        status: doneSet.has(course?.code) ? "done" : "in_plan",
                        termAvailability: termAvailabilityForCode(course?.code),
                    },
                    position: {
                        x: centerX(laneIndex),
                        y: targetY,
                    },
                    sourcePosition: "right",
                    targetPosition: "left",
                    zIndex: 1,
                });
            });
        }

        for (const [, groupMeta] of groupNodeMetaByModuleKey.entries()) {
            const groupId = groupMeta?.groupId;
            if (!groupId) continue;
            const children = rebuilt.filter((n) => n.type === "course" && n?.data?.groupId === groupId);
            const firstChild = children[0];
            if (children.length < 2 || !firstChild) continue;
            const moduleTitle = groupMeta?.module?.title || "Module";
            const moduleCode = groupMeta?.module?.code ?? null;
            const moduleEcts = groupMeta?.module?.ects ?? null;
            const moduleCourseCodes = children.map((n) => n?.data?.code).filter(Boolean);
            rebuilt.push({
                id: groupId,
                type: "moduleBg",
                data: {
                    title: moduleTitle,
                    code: null,
                    moduleCode,
                    moduleEcts,
                    moduleCourseCount: children.length,
                    moduleCourseCodes,
                    status: "in_plan",
                    groupId,
                    onRemoveGroup: removeModuleGroup,
                    onRemove: () => removeModuleGroup(groupId),
                    onToggleModuleDone: toggleModuleDoneCodes,
                    examSubject: groupMeta?.examSubject ?? null,
                    category: groupMeta?.category ?? "unknown",
                    programCode,
                    subjectColor: groupMeta?.subjectColor ?? FALLBACK_SUBJECT_COLOR,
                },
                position: { x: firstChild.position.x, y: firstChild.position.y },
                draggable: true,
                dragHandle: ".module-bg-drag-handle",
                selectable: false,
                zIndex: 0,
            });
        }

        let withGroups = rebuilt;
        for (const [, groupMeta] of groupNodeMetaByModuleKey.entries()) {
            if (!groupMeta?.groupId) continue;
            withGroups = recomputeGroupFromChildren(withGroups, groupMeta.groupId);
        }
        const resolved = resolveLaneCollisions(withGroups);
        const compacted = resolveLaneCollisions(compactPrefillLayout(resolved));
        setNodes(compacted);
        setCoursesFromNodes(compacted.filter((n) => n.type !== "lane"));
        setNeedsPersist(false);
        setDragPreviewSemesterCount(null);

        if (missingAliases.length > 0) {
            setStickyViolation({
                message: `Prebuilt plan applied with missing courses: ${missingAliases.join(", ")}`,
                until: Date.now() + 7000,
                tone: "success",
            });
        } else {
            setStickyViolation({
                message: "Prebuilt bachelor plan applied.",
                until: Date.now() + 3500,
                tone: "success",
            });
        }
        return true;
    }, [
        minGroupChildY,
        catalog,
        doneCourseCodes,
        firstAllowedLaneForCourse,
        laneNodes,
        maxSemesterCount,
        programCode,
        removeModuleGroup,
        removeCourseNode,
        setCoursesFromNodes,
        setNodes,
        startTermSeason,
        toggleCourseDone,
        toggleModuleDoneCodes,
        updateCourseEcts,
        termAvailabilityForCode,
    ]);

    const applyMasterPrefilledPlan = useCallback(() => {
        if (programCode !== MASTER_PROGRAM_CODE) return false;
        const { plannedCourses, missingAliases } = buildMasterPrefillPlan(catalog, {
            startSeason: startTermSeason,
        });
        if (!plannedCourses.length) {
            setStickyViolation({
                message: "Prebuilt master plan could not be applied (no matching catalog courses found).",
                until: Date.now() + 5000,
                tone: "error",
            });
            return false;
        }

        const doneSet = new Set(doneCourseCodes || []);
        const bySemester = new Map<number, PlannedCourse[]>();
        for (const item of plannedCourses) {
            const semester = Number(item?.semester);
            if (!Number.isInteger(semester) || semester < 1 || semester > maxSemesterCount) continue;
            const preferredLane = semester - 1;
            const targetLane = firstAllowedLaneForCourse(item?.code, preferredLane);
            if (targetLane == null) continue;
            const targetSemester = targetLane + 1;
            if (!bySemester.has(targetSemester)) bySemester.set(targetSemester, []);
            bySemester.get(targetSemester)?.push(item);
        }

        const now = Date.now();
        const rebuilt: PrefillNode[] = [...laneNodes];
        let sequence = 0;
        for (let semesterId = 1; semesterId <= maxSemesterCount; semesterId += 1) {
            const laneIndex = semesterId - 1;
            const list = bySemester.get(semesterId) || [];
            list.forEach((course, idx) => {
                const examSubject = course?.examSubject ?? getExamSubjectForCode(catalog, course?.code);
                const subjectColor =
                    (examSubject ? subjectColors?.[examSubject] : null) ||
                    FALLBACK_SUBJECT_COLOR;
                const id = `${course?.code || "course"}-prefill-master-${now}-${sequence}`;
                sequence += 1;
                rebuilt.push({
                    id,
                    type: "course",
                    data: {
                        label: course?.name || course?.code || "Course",
                        code: course?.code ?? null,
                        // A prefill template records no teaching format, so the card
                        // takes it from the catalogue.
                        type: getCourseTypeForCode(catalog, course?.code),
                        ects: course?.ects ?? null,
                        moduleMeta: null,
                        onRemove: removeCourseNode,
                        onToggleDone: toggleCourseDone,
                        onUpdateEcts: updateCourseEcts,
                        nodeId: id,
                        examSubject,
                        category: course?.category ?? "unknown",
                        programCode,
                        subjectColor,
                        status: doneSet.has(course?.code) ? "done" : "in_plan",
                        termAvailability: termAvailabilityForCode(course?.code),
                    },
                    position: {
                        x: centerX(laneIndex),
                        y: 96 + idx * (COURSE_LAYOUT_HEIGHT + COLLISION_GAP),
                    },
                    sourcePosition: "right",
                    targetPosition: "left",
                    zIndex: 1,
                });
            });
        }

        const resolved = resolveLaneCollisions(rebuilt);
        const compacted = resolveLaneCollisions(compactPrefillLayout(resolved));
        setNodes(compacted);
        setCoursesFromNodes(compacted.filter((n) => n.type !== "lane"));
        setNeedsPersist(false);
        setDragPreviewSemesterCount(null);

        if (missingAliases.length > 0) {
            setStickyViolation({
                message: `Prebuilt master plan applied with missing courses: ${missingAliases.join(", ")}`,
                until: Date.now() + 7000,
                tone: "success",
            });
        } else {
            setStickyViolation({
                message: "Prebuilt master plan applied.",
                until: Date.now() + 3500,
                tone: "success",
            });
        }
        return true;
    }, [
        catalog,
        doneCourseCodes,
        firstAllowedLaneForCourse,
        laneNodes,
        maxSemesterCount,
        programCode,
        removeCourseNode,
        setCoursesFromNodes,
        setNodes,
        toggleCourseDone,
        updateCourseEcts,
        termAvailabilityForCode,
    ]);

    return { applyBachelorPrefilledPlan, applyMasterPrefilledPlan };
}
