/**
 * Putting a course or a module onto the canvas, and taking one off it into the
 * parking stage.
 *
 * These are the mutations that decide a lane, so they are also the ones that
 * decide when the plan hears about the change. A placement that could work out
 * the finished canvas inside its own updater writes the plan through at once
 * and clears the pending-save flag; a placement that could not merely raises
 * the flag and lets the canvas be read back on the next commit. Which of the
 * two happens is what the rule check, the recommendations request and the
 * rollbacks all key off, so the split is kept exactly as it is.
 *
 * `addGraphModuleToPlanRef` exists because parking a course and adding a module
 * call each other: a parked module panel carries an "add to plan" handler built
 * while its courses are being parked, and that handler is this file's own
 * `addGraphModuleToPlan`, which is not defined yet at that point. The ref
 * breaks the cycle without making either of them depend on the other's identity.
 */

import { useCallback, useEffect, useRef } from "react";
import type { MutableRefObject } from "react";

import { getCourseTypeForCode, getExamSubjectForCode } from "../../domain/catalogue.ts";
import {
    COLLISION_GAP,
    COURSE_LAYOUT_HEIGHT,
    COURSE_VERTICAL_GAP,
    centerX,
} from "../../domain/layout.ts";
import { resolveModuleVariantCourses } from "../../domain/prefill/index.ts";
import type { Catalogue } from "../../domain/types.ts";
import type { TermAvailability } from "../../domain/terms.ts";
import type { CatalogueCourseEntry } from "../catalogue/index.ts";
import {
    recomputeGroupFromChildren,
    resolveGroupCourseOverlaps,
    laneIdx,
} from "./node-layout.ts";
import type { BoardFlowInstance } from "./useBoardNodes.ts";
import type {
    AddCourseToPlan,
    AddModuleToPlan,
    BoardModuleMeta,
    BoardNode,
    CourseLike,
    ModulePayload,
    PlacementOptions,
    SemesterOption,
} from "./types.ts";

/** The default card colour, used where the exam subject has none of its own. */
const FALLBACK_SUBJECT_COLOR = "#2563eb";

/** The topmost row a card may occupy in a lane, below the lane header. */
const FIRST_COURSE_Y = 96;

/** A course to park, named either by its code or by the whole card. */
export type ParkRequest = string | CourseLike | null | undefined;

/** Turns a module's identity into an id a parked panel can be found again by. */
function parkedGroupIdFor(moduleMeta: BoardModuleMeta | null | undefined): string {
    const key = String(moduleMeta?.id || moduleMeta?.code || moduleMeta?.title || "module");
    return `parked-group-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export interface UseCoursePlacementInput {
    programCode: string;
    catalog: Catalogue;
    catalogCourseByCode: Map<string, CatalogueCourseEntry>;
    subjectColors: Record<string, string> | null | undefined;
    nodes: BoardNode[];
    setNodes: (update: (nodes: BoardNode[]) => BoardNode[]) => void;
    setNeedsPersist: (needsPersist: boolean) => void;
    setCoursesFromNodes: (nodes: BoardNode[]) => void;
    rfRef: MutableRefObject<BoardFlowInstance | null>;
    /** The topmost row a card inside a module panel may occupy. */
    minGroupChildY: number;
    maxSemesterCount: number;
    getCourseStatus: (courseCode: string | null | undefined) => string;
    setCourseDone: (courseCode: string, nextDone: boolean) => void;
    termAvailabilityForCode: (courseCode: string) => TermAvailability;
    isCourseAllowedInLane: (courseCode: string | null | undefined, laneIndex: number) => boolean;
    firstAllowedLaneForCourse: (courseCode: string | null | undefined, preferredLane: number) => number | null;
    clampPlacementLane: (requestedLaneIndex: number) => number;
    validSemestersForModule: (courses: readonly CourseLike[] | null | undefined) => SemesterOption[];
    resolveLaneCollisions: (nodes: BoardNode[]) => BoardNode[];
    removeCourseNode: (nodeId: string) => void;
    removeModuleGroup: (groupId: string) => void;
    toggleCourseDone: (courseCode: string, nextDone: boolean, nodeId?: string) => void;
    toggleModuleDoneCodes: (courseCodes: string[], nextDone: boolean, groupId?: string) => void;
    updateCourseEcts: (nodeId: string, nextEcts: number) => void;
}

export interface UseCoursePlacementResult {
    /** True when at least one card moved to the parking stage. */
    parkCourseCodes: (courseCodes: ParkRequest[] | ParkRequest) => boolean;
    addGraphCourseToPlan: AddCourseToPlan;
    addGraphModuleToPlan: AddModuleToPlan;
}

export function useCoursePlacement({
    programCode,
    catalog,
    catalogCourseByCode,
    subjectColors,
    nodes,
    setNodes,
    setNeedsPersist,
    setCoursesFromNodes,
    rfRef,
    minGroupChildY,
    maxSemesterCount,
    getCourseStatus,
    setCourseDone,
    termAvailabilityForCode,
    isCourseAllowedInLane,
    firstAllowedLaneForCourse,
    clampPlacementLane,
    validSemestersForModule,
    resolveLaneCollisions,
    removeCourseNode,
    removeModuleGroup,
    toggleCourseDone,
    toggleModuleDoneCodes,
    updateCourseEcts,
}: UseCoursePlacementInput): UseCoursePlacementResult {
    const addGraphModuleToPlanRef = useRef<AddModuleToPlan | null>(null);

    const parkCourseCodes = useCallback((courseCodes: ParkRequest[] | ParkRequest) => {
        const input = Array.isArray(courseCodes) ? courseCodes : [courseCodes];
        const requestedByCode = new Map<string, CourseLike | null>();
        for (const item of input) {
            const isObject = item && typeof item === "object";
            const code = String((isObject ? item?.code : item) || "").trim();
            if (!code) continue;
            if (!requestedByCode.has(code)) {
                requestedByCode.set(code, isObject ? item : null);
            }
        }
        const requestedCodes = [...requestedByCode.keys()];
        if (!requestedCodes.length) return false;

        // Parking one course of a module parks the whole module, since a panel
        // with some of its courses left behind labels a group that is no longer
        // being taken together.
        const source = rfRef.current?.getNodes?.() || nodes;
        const groupedCodes = new Set<string>();
        for (const code of requestedCodes) {
            const node = source.find((n) => n?.type === "course" && String(n?.data?.code || "").trim() === code);
            const groupId = String(node?.data?.groupId || "").trim();
            if (!groupId) continue;
            source
                .filter((n) => n?.type === "course" && String(n?.data?.groupId || "").trim() === groupId)
                .forEach((n) => {
                    const groupedCode = String(n?.data?.code || "").trim();
                    if (groupedCode) groupedCodes.add(groupedCode);
                });
        }
        const allCodes = [...new Set([...requestedCodes, ...groupedCodes])];
        if (!allCodes.length) return false;

        allCodes.forEach((code) => setCourseDone(code, false));
        const targetSet = new Set(allCodes);
        const now = Date.now();
        const x = centerX(-1);
        let persistedNodes: BoardNode[] | null = null;
        let changed = false;
        setNodes((prev) => {
            const parkedByCode = new Map<string, BoardNode>();
            const removeGroupIds = new Set<string>();
            const removedCourseByCode = new Map<string, BoardNode>();
            const next: BoardNode[] = [];
            for (const node of prev) {
                if (node?.type === "course") {
                    const code = String(node?.data?.code || "").trim();
                    if (node?.data?.status === "parked" && code && !parkedByCode.has(code)) {
                        parkedByCode.set(code, node);
                    }
                    if (code && targetSet.has(code)) {
                        const groupId = String(node?.data?.groupId || "").trim();
                        if (groupId) removeGroupIds.add(groupId);
                        if (!removedCourseByCode.has(code)) removedCourseByCode.set(code, node);
                        continue;
                    }
                }
                next.push(node);
            }
            const survivors = next.filter((node) => !(node?.type === "moduleBg" && removeGroupIds.has(String(node?.id || ""))));

            let parkingIndex = survivors.filter((n) => n?.type === "course" && String(n?.data?.status || "") === "parked").length;
            const appended: BoardNode[] = [];
            for (const code of allCodes) {
                const parked = parkedByCode.get(code);
                if (parked) {
                    appended.push({
                        ...parked,
                        data: {
                            ...parked.data,
                            status: "parked",
                            groupId: null,
                            moduleMeta: null,
                        },
                        position: {
                            ...parked.position,
                            x,
                        },
                    });
                    continue;
                }
                const removed = removedCourseByCode.get(code);
                const requestedMeta: CourseLike = requestedByCode.get(code) || {};
                const fromCatalog: Partial<CatalogueCourseEntry> = catalogCourseByCode.get(code) || {};
                const resolvedModuleMeta =
                    removed?.data?.moduleMeta ||
                    requestedMeta?.moduleMeta ||
                    fromCatalog?.moduleMeta ||
                    null;
                const examSubject =
                    removed?.data?.examSubject ||
                    requestedMeta?.examSubject ||
                    fromCatalog?.examSubject ||
                    getExamSubjectForCode(catalog, code) ||
                    null;
                const subjectColor =
                    removed?.data?.subjectColor ||
                    requestedMeta?.subjectColor ||
                    (examSubject ? subjectColors?.[examSubject] : null) ||
                    FALLBACK_SUBJECT_COLOR;
                appended.push({
                    id: removed?.id || `${code}-parked-${now}-${parkingIndex}`,
                    type: "course",
                    data: {
                        label: removed?.data?.label || requestedMeta?.name || requestedMeta?.label || fromCatalog?.name || code,
                        code,
                        type: removed?.data?.type ?? requestedMeta?.type ?? fromCatalog?.type ?? getCourseTypeForCode(catalog, code),
                        ects: removed?.data?.ects ?? requestedMeta?.ects ?? fromCatalog?.ects ?? null,
                        moduleMeta: resolvedModuleMeta,
                        onRemove: removeCourseNode,
                        onRemoveModuleGroup: removeModuleGroup,
                        onToggleDone: toggleCourseDone,
                        onUpdateEcts: updateCourseEcts,
                        nodeId: removed?.id || `${code}-parked-${now}-${parkingIndex}`,
                        examSubject,
                        category: removed?.data?.category ?? requestedMeta?.category ?? fromCatalog?.category ?? "unknown",
                        programCode,
                        subjectColor,
                        status: "parked",
                        termAvailability: termAvailabilityForCode(code),
                    },
                    position: {
                        x,
                        y: FIRST_COURSE_Y + parkingIndex * (COURSE_LAYOUT_HEIGHT + COLLISION_GAP),
                    },
                    sourcePosition: "right",
                    targetPosition: "left",
                    zIndex: 1,
                });
                parkingIndex += 1;
                changed = true;
            }
            if (!appended.length && survivors.length === prev.length) return prev;
            changed = true;
            const withParkedCandidates = survivors.concat(appended);
            const parkedCourses = withParkedCandidates.filter((n) => n?.type === "course" && String(n?.data?.status || "") === "parked");
            const parkedCodeSet = new Set(
                parkedCourses
                    .map((n) => String(n?.data?.code || "").trim())
                    .filter(Boolean)
            );
            // A module is drawn again in the parking stage only once every one
            // of its courses is parked, so that a half-parked module shows as
            // loose cards rather than as a panel that misrepresents the plan.
            const eligibleGroups = new Map<string, { groupId: string; moduleMeta: BoardModuleMeta }>();
            for (const parkedCourse of parkedCourses) {
                const code = String(parkedCourse?.data?.code || "").trim();
                if (!code) continue;
                const courseCatalog: Partial<CatalogueCourseEntry> = catalogCourseByCode.get(code) || {};
                const modMeta: BoardModuleMeta | null = parkedCourse?.data?.moduleMeta || courseCatalog?.moduleMeta || null;
                if (!modMeta || !Array.isArray(modMeta?.courseCodes) || modMeta.courseCodes.length < 2) continue;
                const allParked = modMeta.courseCodes.every((courseCode: string) => parkedCodeSet.has(String(courseCode || "").trim()));
                if (!allParked) continue;
                const groupKey = parkedGroupIdFor(modMeta);
                if (!eligibleGroups.has(groupKey)) {
                    eligibleGroups.set(groupKey, {
                        groupId: groupKey,
                        moduleMeta: modMeta,
                    });
                }
            }

            const withoutOldParkingGroups = withParkedCandidates.filter(
                (n) => !(n?.type === "moduleBg" && String(n?.id || "").startsWith("parked-group-"))
            );
            const groupedCourses = withoutOldParkingGroups.map((node) => {
                if (node?.type !== "course" || String(node?.data?.status || "") !== "parked") return node;
                const code = String(node?.data?.code || "").trim();
                const courseCatalog: Partial<CatalogueCourseEntry> = catalogCourseByCode.get(code) || {};
                const modMeta: BoardModuleMeta | null = node?.data?.moduleMeta || courseCatalog?.moduleMeta || null;
                const groupId = modMeta ? parkedGroupIdFor(modMeta) : null;
                if (!groupId || !eligibleGroups.has(groupId)) {
                    if (!node?.data?.groupId) return node;
                    return {
                        ...node,
                        data: { ...node.data, groupId: null },
                    };
                }
                if (node?.data?.groupId === groupId) return node;
                return {
                    ...node,
                    data: {
                        ...node.data,
                        groupId,
                        moduleMeta: modMeta || null,
                    },
                };
            });

            const parkingGroupNodes = [...eligibleGroups.values()].map(({ groupId, moduleMeta }): BoardNode => {
                const moduleCourses = (Array.isArray(moduleMeta?.courseCodes) ? moduleMeta.courseCodes : [])
                    .map((courseCode) => {
                        const normalizedCode = String(courseCode || "").trim();
                        const fromCatalog: Partial<CatalogueCourseEntry> = catalogCourseByCode.get(normalizedCode) || {};
                        return {
                            code: normalizedCode,
                            name: fromCatalog?.name || normalizedCode,
                            ects: fromCatalog?.ects ?? null,
                            type: fromCatalog?.type ?? null,
                        };
                    })
                    .filter((course) => Boolean(course?.code));
                const modulePayload: ModulePayload = {
                    kind: "module",
                    code: moduleMeta?.code ?? null,
                    name: moduleMeta?.title || "Module",
                    category: moduleMeta?.category ?? "unknown",
                    subjectColor: (moduleMeta?.examSubject ? subjectColors?.[moduleMeta.examSubject] : null) || FALLBACK_SUBJECT_COLOR,
                    courses: moduleCourses,
                };
                return {
                    id: groupId,
                    type: "moduleBg",
                    data: {
                        title: moduleMeta?.title || "Module",
                        code: null,
                        moduleCode: moduleMeta?.code ?? null,
                        moduleEcts: moduleMeta?.ects ?? null,
                        moduleCourseCount: Array.isArray(moduleMeta?.courseCodes) ? moduleMeta.courseCodes.length : 0,
                        moduleCourseCodes: Array.isArray(moduleMeta?.courseCodes) ? moduleMeta.courseCodes : [],
                        status: "parked",
                        groupId,
                        onRemoveGroup: removeModuleGroup,
                        onRemove: () => removeModuleGroup(groupId),
                        onToggleModuleDone: toggleModuleDoneCodes,
                        onAddModuleToPlan: (...args) => addGraphModuleToPlanRef.current?.(...args) ?? false,
                        semestersForModule: validSemestersForModule(moduleCourses).map((semester) => ({
                            ...semester,
                            title: semester?.title ?? `Semester ${semester?.id}`,
                        })),
                        modulePayload,
                        examSubject: moduleMeta?.examSubject ?? null,
                        category: moduleMeta?.category ?? "unknown",
                        programCode,
                        subjectColor: (moduleMeta?.examSubject ? subjectColors?.[moduleMeta.examSubject] : null) || FALLBACK_SUBJECT_COLOR,
                    },
                    position: { x, y: minGroupChildY },
                    draggable: true,
                    dragHandle: ".module-bg-drag-handle",
                    selectable: false,
                    zIndex: 0,
                };
            });

            let groupedResolved = groupedCourses.concat(parkingGroupNodes);
            for (const { groupId } of eligibleGroups.values()) {
                groupedResolved = resolveGroupCourseOverlaps(groupedResolved, groupId);
                groupedResolved = recomputeGroupFromChildren(groupedResolved, groupId);
            }
            const resolved = resolveLaneCollisions(groupedResolved);
            persistedNodes = resolved.filter((n) => n.type !== "lane");
            return resolved;
        });

        if (!changed) return false;
        if (Array.isArray(persistedNodes)) {
            setCoursesFromNodes(persistedNodes);
            setNeedsPersist(false);
        } else {
            setNeedsPersist(true);
        }
        return true;
    }, [
        minGroupChildY,
        catalog,
        catalogCourseByCode,
        nodes,
        programCode,
        removeCourseNode,
        removeModuleGroup,
        resolveLaneCollisions,
        setCourseDone,
        setCoursesFromNodes,
        setNodes,
        subjectColors,
        toggleCourseDone,
        updateCourseEcts,
        toggleModuleDoneCodes,
        validSemestersForModule,
    ]);

    const addGraphCourseToPlan = useCallback<AddCourseToPlan>((course, requestedLaneIndex, options = null) => {
        const courseCode = course?.code;
        const currentStatus = getCourseStatus(courseCode);
        if (!courseCode || (currentStatus !== "todo" && currentStatus !== "parked")) return false;
        if (Number(requestedLaneIndex) < 0) {
            return parkCourseCodes([course]);
        }

        const allowDirect = Boolean(options?.allowDirectLaneSelection);
        const rawLaneIndex = allowDirect
            ? Math.max(0, Math.min(Number(requestedLaneIndex) || 0, maxSemesterCount - 1))
            : clampPlacementLane(requestedLaneIndex);
        const laneIndex = allowDirect
            ? rawLaneIndex
            : firstAllowedLaneForCourse(courseCode, rawLaneIndex);
        if (laneIndex == null) return false;
        if (allowDirect && !isCourseAllowedInLane(courseCode, laneIndex)) return false;
        const x = centerX(laneIndex);
        const now = Date.now();
        const id = `${courseCode}-${now}-graph`;
        const examSubject = course?.examSubject || getExamSubjectForCode(catalog, courseCode);
        const courseType = course?.courseType ?? getCourseTypeForCode(catalog, courseCode);
        const resolvedSubjectColor =
            course?.subjectColor ||
            (examSubject ? subjectColors?.[examSubject] : null) ||
            FALLBACK_SUBJECT_COLOR;

        let persistedNodes: BoardNode[] | null = null;
        let added = false;
        setNodes((prev) => {
            const existing = prev.find((n) => n.type === "course" && n?.data?.code === courseCode);
            if (existing && existing?.data?.status !== "parked") return prev;
            if (existing && existing?.data?.status === "parked") {
                const laneCourses = prev
                    .filter((n) => n.type === "course" && laneIdx(n) === laneIndex && n.id !== existing.id)
                    .sort((a, b) => (a?.position?.y ?? 0) - (b?.position?.y ?? 0));
                const last = laneCourses[laneCourses.length - 1];
                const y = last ? (last.position.y + COURSE_LAYOUT_HEIGHT + COLLISION_GAP) : FIRST_COURSE_Y;
                const next = prev.map((n) => (
                    n.id === existing.id
                        ? {
                            ...n,
                            data: { ...n.data, status: "in_plan", groupId: null, moduleMeta: null },
                            position: { ...n.position, x, y },
                        }
                        : n
                ));
                added = true;
                const resolvedExisting = resolveLaneCollisions(next);
                persistedNodes = resolvedExisting.filter((n) => n.type !== "lane");
                return resolvedExisting;
            }

            const laneCourses = prev
                .filter((n) => n.type === "course" && laneIdx(n) === laneIndex)
                .sort((a, b) => (a?.position?.y ?? 0) - (b?.position?.y ?? 0));
            const last = laneCourses[laneCourses.length - 1];
            const y = last ? (last.position.y + COURSE_LAYOUT_HEIGHT + COLLISION_GAP) : FIRST_COURSE_Y;

            const next = prev.concat({
                id,
                type: "course",
                data: {
                    label: course?.name || courseCode,
                    code: courseCode,
                    type: courseType ?? null,
                    ects: course?.ects ?? null,
                    moduleMeta: course?.moduleMeta ?? null,
                    onRemove: removeCourseNode,
                    onRemoveModuleGroup: removeModuleGroup,
                    onToggleDone: toggleCourseDone,
                    onUpdateEcts: updateCourseEcts,
                    nodeId: id,
                    examSubject,
                    category: course?.category ?? "unknown",
                    programCode,
                    subjectColor: resolvedSubjectColor,
                    status: "in_plan",
                    termAvailability: termAvailabilityForCode(courseCode),
                },
                position: { x, y },
                sourcePosition: "right",
                targetPosition: "left",
                zIndex: 1,
            });
            added = true;
            const resolved = resolveLaneCollisions(next);
            persistedNodes = resolved.filter((n) => n.type !== "lane");
            return resolved;
        });
        if (!added) return false;
        if (Array.isArray(persistedNodes)) {
            setCoursesFromNodes(persistedNodes);
            setNeedsPersist(false);
        } else {
            setNeedsPersist(true);
        }
        return true;
    }, [catalog, clampPlacementLane, firstAllowedLaneForCourse, getCourseStatus, isCourseAllowedInLane, maxSemesterCount, parkCourseCodes, removeCourseNode, setCoursesFromNodes, setNodes, subjectColors, toggleCourseDone, updateCourseEcts, termAvailabilityForCode]);

    const addGraphModuleToPlan = useCallback<AddModuleToPlan>((modulePayload, requestedLaneIndex, options = null) => {
        const variantResolution = resolveModuleVariantCourses(
            modulePayload as Parameters<typeof resolveModuleVariantCourses>[0],
            options?.variantId ?? null
        );
        const selectedCoursesRaw: CourseLike[] = Array.isArray(variantResolution?.selectedCourses)
            ? variantResolution.selectedCourses
            : (Array.isArray(modulePayload?.courses) ? modulePayload.courses : []);
        const allVariantCoursesRaw: CourseLike[] = Array.isArray(variantResolution?.allVariantCourses)
            ? variantResolution.allVariantCourses
            : selectedCoursesRaw;
        const enrichCourse = (course: CourseLike): CourseLike | null => {
            const code = String(course?.code || "").trim();
            if (!code) return null;
            const fromCatalog: Partial<CatalogueCourseEntry> = catalogCourseByCode.get(code) || {};
            return {
                ...fromCatalog,
                ...(course || {}),
                code,
                name: course?.name || fromCatalog?.name || code,
                ects: course?.ects ?? fromCatalog?.ects ?? null,
                type: course?.type ?? fromCatalog?.type ?? null,
                category: modulePayload?.category ?? course?.category ?? fromCatalog?.category ?? "unknown",
                examSubject: course?.examSubject ?? fromCatalog?.examSubject ?? null,
                subjectColor: course?.subjectColor ?? null,
            };
        };
        const courses = selectedCoursesRaw.map(enrichCourse).filter((c): c is CourseLike => Boolean(c));
        const allVariantCourses = allVariantCoursesRaw.map(enrichCourse).filter((c): c is CourseLike => Boolean(c));
        if (courses.length === 1) {
            return addGraphCourseToPlan({
                ...courses[0],
                category: modulePayload?.category ?? courses?.[0]?.category ?? "unknown",
                subjectColor: modulePayload?.subjectColor ?? courses?.[0]?.subjectColor ?? null,
            }, requestedLaneIndex, options);
        }
        if (courses.length < 2) return false;
        const codes = courses.map((c) => c?.code).filter((code): code is string => Boolean(code));
        if (!codes.length) return false;
        if (Number(requestedLaneIndex) < 0) {
            return parkCourseCodes(courses);
        }
        if (codes.some((code) => {
            const status = getCourseStatus(code);
            return status !== "todo" && status !== "parked";
        })) return false;
        // The courses of the variants the student did not choose have to leave
        // the plan, since only one route through a split module may be taken.
        const conflictingVariantCodes = allVariantCourses
            .map((c) => c?.code)
            .filter((code): code is string => Boolean(code) && !codes.includes(code as string));

        const allowDirect = Boolean(options?.allowDirectLaneSelection);
        const rawLaneIndex = allowDirect
            ? Math.max(0, Math.min(Number(requestedLaneIndex) || 0, maxSemesterCount - 1))
            : clampPlacementLane(requestedLaneIndex);
        const allAllowedAtLane = (lane: number) => codes.every((code) => isCourseAllowedInLane(code, lane));
        let laneIndex: number | null = null;
        if (allowDirect) {
            laneIndex = allAllowedAtLane(rawLaneIndex) ? rawLaneIndex : null;
        } else {
            for (let idx = rawLaneIndex; idx <= maxSemesterCount - 1; idx += 1) {
                if (allAllowedAtLane(idx)) {
                    laneIndex = idx;
                    break;
                }
            }
            if (laneIndex == null) {
                for (let idx = rawLaneIndex - 1; idx >= 0; idx -= 1) {
                    if (allAllowedAtLane(idx)) {
                        laneIndex = idx;
                        break;
                    }
                }
            }
        }
        if (laneIndex == null) {
            // No single lane suits the whole module, so its courses are spread
            // over the lanes each of them does fit, and the panel is drawn
            // across them.
            const targetLaneByCode = new Map<string, number>();
            for (const course of courses) {
                const code = String(course?.code || "").trim();
                if (!code) continue;
                const targetLane = firstAllowedLaneForCourse(code, rawLaneIndex);
                if (targetLane == null) return false;
                targetLaneByCode.set(code, targetLane);
            }
            if (targetLaneByCode.size !== codes.length) return false;

            const y = Math.max(144, minGroupChildY);
            const now = Date.now();
            const groupId = `mod-${now}-graph`;
            const groupExamSubject =
                modulePayload?.examSubject ||
                getExamSubjectForCode(catalog, modulePayload?.code) ||
                getExamSubjectForCode(catalog, courses?.[0]?.code) ||
                null;
            const resolvedGroupSubjectColor =
                modulePayload?.subjectColor ||
                (groupExamSubject ? subjectColors?.[groupExamSubject] : null) ||
                FALLBACK_SUBJECT_COLOR;

            const groupNode: BoardNode = {
                id: groupId,
                type: "moduleBg",
                data: {
                    title: `${modulePayload?.name || "Module"}`,
                    code: null,
                    moduleCode: modulePayload?.code ?? null,
                    moduleEcts: modulePayload?.ects ?? null,
                    moduleCourseCount: courses.length,
                    moduleCourseCodes: codes,
                    status: "in_plan",
                    groupId,
                    onRemoveGroup: removeModuleGroup,
                    onRemove: () => removeModuleGroup(groupId),
                    onToggleModuleDone: toggleModuleDoneCodes,
                    examSubject: groupExamSubject,
                    category: modulePayload?.category ?? "unknown",
                    programCode,
                    subjectColor: resolvedGroupSubjectColor,
                },
                position: { x: centerX(rawLaneIndex), y },
                draggable: true,
                dragHandle: ".module-bg-drag-handle",
                selectable: false,
                zIndex: 0,
            };

            const childCourseNodes = courses.map((course, idx): BoardNode => {
                const code = String(course?.code || "").trim();
                const childId = `${code}-${now}-${idx}-graph`;
                const targetLane = targetLaneByCode.get(code) ?? 0;
                const baseY = y + idx * (COURSE_LAYOUT_HEIGHT + COURSE_VERTICAL_GAP);
                const examSubject =
                    getExamSubjectForCode(catalog, code) || getExamSubjectForCode(catalog, modulePayload?.code);
                const resolvedCourseSubjectColor =
                    (examSubject ? subjectColors?.[examSubject] : null) ||
                    resolvedGroupSubjectColor;
                return {
                    id: childId,
                    type: "course",
                    data: {
                        label: course?.name || code || "Course",
                        code,
                        type: course?.type ?? getCourseTypeForCode(catalog, code),
                        ects: course?.ects ?? null,
                        groupId,
                        baseY,
                        onRemove: removeCourseNode,
                        onRemoveModuleGroup: removeModuleGroup,
                        onToggleDone: toggleCourseDone,
                        onUpdateEcts: updateCourseEcts,
                        nodeId: childId,
                        examSubject,
                        category: modulePayload?.category ?? "unknown",
                        programCode,
                        subjectColor: resolvedCourseSubjectColor,
                        status: "in_plan",
                        termAvailability: termAvailabilityForCode(code),
                    },
                    position: { x: centerX(targetLane), y: baseY },
                    sourcePosition: "right",
                    targetPosition: "left",
                    zIndex: 1,
                };
            });

            setNodes((prev) => addModuleNodes(prev, {
                codes,
                conflictingVariantCodes,
                groupId,
                groupNode,
                childCourseNodes,
                resolveLaneCollisions,
            }));

            // The updater above cannot report back, so the canvas is read on the
            // next commit rather than written through here. That makes a module
            // spread over several lanes reach the plan one render later than a
            // module placed in a single lane does.
            setNeedsPersist(true);
            return true;
        }
        const x = centerX(laneIndex);
        const y = Math.max(144, minGroupChildY);
        const now = Date.now();
        const groupId = `mod-${now}-graph`;
        const groupExamSubject =
            modulePayload?.examSubject ||
            getExamSubjectForCode(catalog, modulePayload?.code) ||
            getExamSubjectForCode(catalog, courses?.[0]?.code) ||
            null;
        const resolvedGroupSubjectColor =
            modulePayload?.subjectColor ||
            (groupExamSubject ? subjectColors?.[groupExamSubject] : null) ||
            FALLBACK_SUBJECT_COLOR;

        const groupNode: BoardNode = {
            id: groupId,
            type: "moduleBg",
            data: {
                title: `${modulePayload?.name || "Module"}`,
                code: null,
                moduleCode: modulePayload?.code ?? null,
                moduleEcts: modulePayload?.ects ?? null,
                moduleCourseCount: courses.length,
                moduleCourseCodes: codes,
                status: "in_plan",
                groupId,
                onRemoveGroup: removeModuleGroup,
                onRemove: () => removeModuleGroup(groupId),
                onToggleModuleDone: toggleModuleDoneCodes,
                examSubject: groupExamSubject,
                category: modulePayload?.category ?? "unknown",
                programCode,
                subjectColor: resolvedGroupSubjectColor,
            },
            position: { x, y },
            draggable: true,
            dragHandle: ".module-bg-drag-handle",
            selectable: false,
            zIndex: 0,
        };

        const childCourseNodes = courses.map((course, idx): BoardNode => {
            const childId = `${course.code}-${now}-${idx}-graph`;
            const baseY = y + idx * (COURSE_LAYOUT_HEIGHT + COURSE_VERTICAL_GAP);
            const examSubject =
                getExamSubjectForCode(catalog, course.code) || getExamSubjectForCode(catalog, modulePayload?.code);
            const resolvedCourseSubjectColor =
                (examSubject ? subjectColors?.[examSubject] : null) ||
                resolvedGroupSubjectColor;

            return {
                id: childId,
                type: "course",
                data: {
                    label: course?.name || course?.code || "Course",
                    code: course?.code,
                    type: course?.type ?? getCourseTypeForCode(catalog, course?.code),
                    ects: course?.ects ?? null,
                    groupId,
                    baseY,
                    onRemove: removeCourseNode,
                    onToggleDone: toggleCourseDone,
                    onUpdateEcts: updateCourseEcts,
                    nodeId: childId,
                    examSubject,
                    category: modulePayload?.category ?? "unknown",
                    programCode,
                    subjectColor: resolvedCourseSubjectColor,
                    status: "in_plan",
                    termAvailability: termAvailabilityForCode(course?.code ?? ""),
                },
                position: { x, y: baseY },
                sourcePosition: "right",
                targetPosition: "left",
                zIndex: 1,
            };
        });

        setNodes((prev) => addModuleNodes(prev, {
            codes,
            conflictingVariantCodes,
            groupId,
            groupNode,
            childCourseNodes,
            resolveLaneCollisions,
        }));

        setNeedsPersist(true);
        return true;
    }, [minGroupChildY, addGraphCourseToPlan, catalog, catalogCourseByCode, clampPlacementLane, firstAllowedLaneForCourse, getCourseStatus, isCourseAllowedInLane, maxSemesterCount, removeCourseNode, removeModuleGroup, setCoursesFromNodes, setNodes, subjectColors, toggleCourseDone, toggleModuleDoneCodes, updateCourseEcts, termAvailabilityForCode]);

    useEffect(() => {
        addGraphModuleToPlanRef.current = addGraphModuleToPlan;
    }, [addGraphModuleToPlan]);

    return { parkCourseCodes, addGraphCourseToPlan, addGraphModuleToPlan };
}

interface AddModuleNodesInput {
    codes: string[];
    conflictingVariantCodes: string[];
    groupId: string;
    groupNode: BoardNode;
    childCourseNodes: BoardNode[];
    resolveLaneCollisions: (nodes: BoardNode[]) => BoardNode[];
}

/**
 * Puts a module's panel and cards onto the canvas.
 *
 * A course already in the plan is adopted by the new panel rather than added
 * twice, and the panel it used to belong to is resized around what is left,
 * which is why the old groups are recomputed before the new one is drawn.
 */
function addModuleNodes(prev: BoardNode[], {
    codes,
    conflictingVariantCodes,
    groupId,
    groupNode,
    childCourseNodes,
    resolveLaneCollisions,
}: AddModuleNodesInput): BoardNode[] {
    const existingNodes = prev.filter((n) => n.type === "course" && codes.includes(n?.data?.code ?? "") && n?.data?.status !== "parked");
    const existingCodes = new Set(existingNodes.map((n) => n.data?.code));
    if (existingCodes.size === codes.length) return prev;

    const affectedGroupIds = new Set<string>();
    prev.forEach((n) => {
        if (n.type === "course" && existingCodes.has(n?.data?.code) && n?.data?.groupId) {
            affectedGroupIds.add(n.data.groupId);
        }
    });

    const removeSet = new Set(conflictingVariantCodes);
    prev.forEach((n) => {
        if (n.type === "course" && removeSet.has(n?.data?.code ?? "") && n?.data?.groupId) {
            affectedGroupIds.add(n.data.groupId);
        }
    });

    let next = prev.filter((n) => !(n.type === "course" && (removeSet.has(n?.data?.code ?? "") || (codes.includes(n?.data?.code ?? "") && n?.data?.status === "parked"))));
    next = next.map((n) => {
        if (n.type === "course" && existingCodes.has(n?.data?.code)) {
            return {
                ...n,
                data: {
                    ...n.data,
                    groupId,
                }
            };
        }
        return n;
    });

    for (const oldGroupId of affectedGroupIds) {
        next = recomputeGroupFromChildren(next, oldGroupId);
    }

    const newCourseNodes = childCourseNodes.filter((node) => !existingCodes.has(node?.data?.code));
    const withAll = next.concat(groupNode, ...newCourseNodes);
    const sized = recomputeGroupFromChildren(withAll, groupId);
    return resolveLaneCollisions(sized);
}
