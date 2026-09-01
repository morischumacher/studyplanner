/**
 * Drawing the canvas from a stored plan.
 *
 * This is the only place the plan writes positions rather than reading them. It
 * runs once per programme, guarded by `hydratedProgramRef`, because after the
 * first draw the canvas is the record and rebuilding it would throw away every
 * card the student has moved since.
 *
 * A card keeps the position the plan stored for it where there is one, and is
 * stacked down its lane where there is not, so a plan written by an older
 * version of the planner still opens in a readable state.
 */

import { useEffect } from "react";
import type { MutableRefObject } from "react";

import { getCourseTypeForCode, getExamSubjectForCode } from "../../domain/catalogue.ts";
import {
    COLLISION_GAP,
    COURSE_LAYOUT_HEIGHT,
    COURSE_VERTICAL_GAP,
    centerX,
} from "../../domain/layout.ts";
import type { CoursesBySemester, PlanCourse } from "../../domain/plan/state.ts";
import type { Catalogue } from "../../domain/types.ts";
import type { CatalogueCourseEntry } from "../catalogue/index.ts";
import { recomputeGroupFromChildren, resolveGroupCourseOverlaps } from "./node-layout.ts";
import type {
    AddModuleToPlan,
    BoardModuleMeta,
    BoardNode,
    CourseLike,
    ModulePayload,
    SemesterOption,
} from "./types.ts";

/** The default card colour, used where the exam subject has none of its own. */
const FALLBACK_SUBJECT_COLOR = "#2563eb";

/** The topmost row a card may occupy in a lane, below the lane header. */
const FIRST_COURSE_Y = 96;

/** Turns a module's identity into an id a parked panel can be found again by. */
function parkedGroupIdFor(moduleMeta: BoardModuleMeta | null | undefined): string {
    const key = String(moduleMeta?.id || moduleMeta?.code || moduleMeta?.title || "module");
    return `parked-group-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

/** The handlers every card and panel the rebuild draws is wired up with. */
interface RebuildHandlers {
    removeCourseNode: (nodeId: string) => void;
    removeModuleGroup: (groupId: string) => void;
    toggleCourseDone: (courseCode: string, nextDone: boolean, nodeId?: string) => void;
    toggleModuleDoneCodes: (courseCodes: string[], nextDone: boolean, groupId?: string) => void;
    updateCourseEcts: (nodeId: string, nextEcts: number) => void;
    addGraphModuleToPlan: AddModuleToPlan;
    validSemestersForModule: (courses: readonly CourseLike[] | null | undefined) => SemesterOption[];
}

interface RebuildInput extends RebuildHandlers {
    programCode: string;
    catalog: Catalogue;
    catalogCourseByCode: Map<string, CatalogueCourseEntry>;
    subjectColors: Record<string, string> | null | undefined;
    coursesBySemester: CoursesBySemester | null | undefined;
    semesterIdsFromPlan: readonly number[];
    doneCourseCodes: readonly string[] | null | undefined;
    parkedCourseCodes: readonly string[] | null | undefined;
    laneNodes: BoardNode[];
    maxSemesterCount: number;
    minGroupChildY: number;
}

/** A plan course carrying the lane it was filed under. */
interface PlanCourseWithLane extends PlanCourse {
    laneIndex: number;
}

interface RebuiltCanvas {
    nodes: BoardNode[];
    /** The panels that still have to be stacked and sized around their cards. */
    groupIds: string[];
}

function rebuildCanvasFromPlan({
    programCode,
    catalog,
    catalogCourseByCode,
    subjectColors,
    coursesBySemester,
    semesterIdsFromPlan,
    doneCourseCodes,
    parkedCourseCodes,
    laneNodes,
    maxSemesterCount,
    minGroupChildY,
    removeCourseNode,
    removeModuleGroup,
    toggleCourseDone,
    toggleModuleDoneCodes,
    updateCourseEcts,
    addGraphModuleToPlan,
    validSemestersForModule,
}: RebuildInput): RebuiltCanvas {
    const doneSet = new Set(doneCourseCodes || []);
    const courseRows: PlanCourseWithLane[] = [];
    for (const semesterId of semesterIdsFromPlan) {
        const laneIndex = semesterId - 1;
        const list = Array.isArray(coursesBySemester?.[semesterId]) ? coursesBySemester[semesterId] : [];
        for (const course of list ?? []) {
            courseRows.push({
                ...course,
                laneIndex: Number.isFinite(course?.laneIndex) ? course.laneIndex : laneIndex,
            });
        }
    }

    const grouped = new Map<string, PlanCourseWithLane[]>();
    const standalone: PlanCourseWithLane[] = [];
    for (const course of courseRows) {
        if (course?.module?.id) {
            const key = course.module.id;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)?.push(course);
        } else {
            standalone.push(course);
        }
    }

    const rebuilt: BoardNode[] = [...laneNodes];
    const groupIds: string[] = [];

    for (const [groupId, children] of grouped.entries()) {
        const first = children[0];
        const moduleMeta = first?.module ?? null;
        const codes = children.map((c) => c?.code).filter((code): code is string => Boolean(code));
        const status = children.every((c) => doneSet.has(c?.code ?? ""))
            ? "done"
            : "in_plan";

        rebuilt.push({
            id: groupId,
            type: "moduleBg",
            data: {
                title: moduleMeta?.title || "Module",
                code: null,
                moduleCode: moduleMeta?.code ?? null,
                moduleEcts: moduleMeta?.ects ?? null,
                moduleCourseCount: children.length,
                moduleCourseCodes: codes,
                status,
                groupId,
                onRemoveGroup: removeModuleGroup,
                onRemove: () => removeModuleGroup(groupId),
                onToggleModuleDone: toggleModuleDoneCodes,
                examSubject: moduleMeta?.examSubject ?? null,
                category: moduleMeta?.category ?? first?.category ?? "unknown",
                programCode,
                subjectColor: moduleMeta?.subjectColor ?? first?.subjectColor ?? FALLBACK_SUBJECT_COLOR,
            },
            position: { x: 0, y: 0 },
            draggable: true,
            dragHandle: ".module-bg-drag-handle",
            selectable: false,
            zIndex: 0,
        });
        groupIds.push(groupId);

        children.forEach((course, idx) => {
            const laneIndex = Math.max(0, Math.min(Number(course?.laneIndex) || 0, maxSemesterCount - 1));
            const x = Number.isFinite(course?.position?.x) ? course.position.x : centerX(laneIndex);
            const y = Number.isFinite(course?.position?.y)
                ? course.position.y
                : (FIRST_COURSE_Y + idx * (COURSE_LAYOUT_HEIGHT + COURSE_VERTICAL_GAP));
            const id = course?.id || `${course?.code || "course"}-${groupId}-${idx}`;
            rebuilt.push({
                id,
                type: "course",
                data: {
                    label: course?.name || course?.code || "Course",
                    code: course?.code ?? null,
                    type: course?.type ?? getCourseTypeForCode(catalog, course?.code),
                    ects: course?.ects ?? null,
                    groupId,
                    onRemove: removeCourseNode,
                    onRemoveModuleGroup: removeModuleGroup,
                    onToggleDone: toggleCourseDone,
                    onUpdateEcts: updateCourseEcts,
                    nodeId: id,
                    examSubject: course?.examSubject ?? moduleMeta?.examSubject ?? null,
                    category: course?.category ?? moduleMeta?.category ?? "unknown",
                    programCode,
                    subjectColor: course?.subjectColor ?? moduleMeta?.subjectColor ?? FALLBACK_SUBJECT_COLOR,
                    status: doneSet.has(course?.code ?? "") ? "done" : "in_plan",
                },
                position: { x, y },
                sourcePosition: "right",
                targetPosition: "left",
                zIndex: 1,
            });
        });
    }

    standalone.forEach((course, idx) => {
        const laneIndex = Math.max(0, Math.min(Number(course?.laneIndex) || 0, maxSemesterCount - 1));
        const x = Number.isFinite(course?.position?.x) ? course.position.x : centerX(laneIndex);
        const y = Number.isFinite(course?.position?.y)
            ? course.position.y
            : (FIRST_COURSE_Y + idx * (COURSE_LAYOUT_HEIGHT + COLLISION_GAP));
        const id = course?.id || `${course?.code || "course"}-${laneIndex}-${idx}`;
        rebuilt.push({
            id,
            type: "course",
            data: {
                label: course?.name || course?.code || "Course",
                code: course?.code ?? null,
                type: course?.type ?? getCourseTypeForCode(catalog, course?.code),
                ects: course?.ects ?? null,
                moduleMeta: course?.module ?? null,
                onRemove: removeCourseNode,
                onToggleDone: toggleCourseDone,
                onUpdateEcts: updateCourseEcts,
                nodeId: id,
                examSubject: course?.examSubject ?? null,
                category: course?.category ?? "unknown",
                programCode,
                subjectColor: course?.subjectColor ?? FALLBACK_SUBJECT_COLOR,
                status: doneSet.has(course?.code ?? "") ? "done" : "in_plan",
            },
            position: { x, y },
            sourcePosition: "right",
            targetPosition: "left",
            zIndex: 1,
        });
    });

    const parkingX = centerX(-1);
    const parkedEntries: BoardNode[] = [];
    (Array.isArray(parkedCourseCodes) ? parkedCourseCodes : []).forEach((code, idx) => {
        const normalizedCode = String(code || "").trim();
        if (!normalizedCode) return;
        const fromCatalog: Partial<CatalogueCourseEntry> = catalogCourseByCode.get(normalizedCode) || {};
        const examSubject = fromCatalog?.examSubject || getExamSubjectForCode(catalog, normalizedCode) || null;
        const subjectColor =
            (examSubject ? subjectColors?.[examSubject] : null) ||
            FALLBACK_SUBJECT_COLOR;
        const id = `${normalizedCode}-parked-${idx}`;
        parkedEntries.push({
            id,
            type: "course",
            data: {
                label: fromCatalog?.name || normalizedCode,
                code: normalizedCode,
                type: fromCatalog?.type ?? getCourseTypeForCode(catalog, normalizedCode),
                ects: fromCatalog?.ects ?? null,
                moduleMeta: fromCatalog?.moduleMeta ?? null,
                onRemove: removeCourseNode,
                onRemoveModuleGroup: removeModuleGroup,
                onToggleDone: toggleCourseDone,
                onUpdateEcts: updateCourseEcts,
                nodeId: id,
                examSubject,
                category: fromCatalog?.category ?? "unknown",
                programCode,
                subjectColor,
                status: "parked",
            },
            position: { x: parkingX, y: FIRST_COURSE_Y + idx * (COURSE_LAYOUT_HEIGHT + COLLISION_GAP) },
            sourcePosition: "right",
            targetPosition: "left",
            zIndex: 1,
        });
    });

    // A module is drawn again in the parking stage only once every one of its
    // courses is parked, so that a half-parked module shows as loose cards
    // rather than as a panel that misrepresents the plan.
    const parkedCodeSet = new Set(
        parkedEntries
            .map((node) => String(node?.data?.code || "").trim())
            .filter(Boolean)
    );
    const eligibleParkedGroups = new Map<string, { groupId: string; moduleMeta: BoardModuleMeta }>();
    for (const node of parkedEntries) {
        const modMeta = node?.data?.moduleMeta;
        if (!modMeta || !Array.isArray(modMeta?.courseCodes) || modMeta.courseCodes.length < 2) continue;
        const allParked = modMeta.courseCodes.every((courseCode) => parkedCodeSet.has(String(courseCode || "").trim()));
        if (!allParked) continue;
        const groupId = parkedGroupIdFor(modMeta);
        if (!eligibleParkedGroups.has(groupId)) {
            eligibleParkedGroups.set(groupId, {
                groupId,
                moduleMeta: modMeta,
            });
        }
    }

    parkedEntries.forEach((node) => {
        const modMeta = node?.data?.moduleMeta;
        if (!modMeta) return;
        const groupId = parkedGroupIdFor(modMeta);
        if (!eligibleParkedGroups.has(groupId)) return;
        if (node.data) node.data.groupId = groupId;
    });
    rebuilt.push(...parkedEntries);

    for (const { groupId, moduleMeta } of eligibleParkedGroups.values()) {
        const moduleCourses = (Array.isArray(moduleMeta?.courseCodes) ? moduleMeta.courseCodes : [])
            .map((courseCode) => {
                const normalizedCode = String(courseCode || "").trim();
                const courseCatalog: Partial<CatalogueCourseEntry> = catalogCourseByCode.get(normalizedCode) || {};
                return {
                    code: normalizedCode,
                    name: courseCatalog?.name || normalizedCode,
                    ects: courseCatalog?.ects ?? null,
                    type: courseCatalog?.type ?? null,
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
        rebuilt.push({
            id: groupId,
            type: "moduleBg",
            data: {
                title: moduleMeta?.title || "Module",
                code: null,
                moduleCode: moduleMeta?.code ?? null,
                moduleEcts: moduleMeta?.ects ?? null,
                moduleCourseCount: moduleCourses.length,
                moduleCourseCodes: moduleCourses.map((c) => c?.code).filter((code): code is string => Boolean(code)),
                status: "parked",
                groupId,
                onRemoveGroup: removeModuleGroup,
                onRemove: () => removeModuleGroup(groupId),
                onToggleModuleDone: toggleModuleDoneCodes,
                onAddModuleToPlan: addGraphModuleToPlan,
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
            position: { x: parkingX, y: minGroupChildY },
            draggable: true,
            dragHandle: ".module-bg-drag-handle",
            selectable: false,
            zIndex: 0,
        });
        groupIds.push(groupId);
    }

    return { nodes: rebuilt, groupIds };
}

export interface UseBoardHydrationInput extends RebuildHandlers {
    plannerHydrated: boolean;
    programCode: string;
    catalog: Catalogue;
    catalogCourseByCode: Map<string, CatalogueCourseEntry>;
    subjectColors: Record<string, string> | null | undefined;
    coursesBySemester: CoursesBySemester | null | undefined;
    semesterIdsFromPlan: readonly number[];
    doneCourseCodes: readonly string[] | null | undefined;
    parkedCourseCodes: readonly string[] | null | undefined;
    laneNodes: BoardNode[];
    maxSemesterCount: number;
    minGroupChildY: number;
    setNodes: (nodes: BoardNode[]) => void;
    setNeedsPersist: (needsPersist: boolean) => void;
    resolveLaneCollisions: (nodes: BoardNode[]) => BoardNode[];
    /** The programme whose canvas has been drawn, so that it is drawn once. */
    hydratedProgramRef: MutableRefObject<string | null>;
    /** Set so that the freshly drawn plan is checked against the curriculum. */
    pendingInitialSyncProgramRef: MutableRefObject<string | null>;
}

export function useBoardHydration({
    plannerHydrated,
    programCode,
    catalog,
    catalogCourseByCode,
    subjectColors,
    coursesBySemester,
    semesterIdsFromPlan,
    doneCourseCodes,
    parkedCourseCodes,
    laneNodes,
    maxSemesterCount,
    minGroupChildY,
    setNodes,
    setNeedsPersist,
    resolveLaneCollisions,
    hydratedProgramRef,
    pendingInitialSyncProgramRef,
    removeCourseNode,
    removeModuleGroup,
    toggleCourseDone,
    toggleModuleDoneCodes,
    updateCourseEcts,
    addGraphModuleToPlan,
    validSemestersForModule,
}: UseBoardHydrationInput): void {
    useEffect(() => {
        if (!plannerHydrated) return;
        if (!Array.isArray(catalog) || catalog.length === 0) return;
        if (hydratedProgramRef.current === programCode) return;

        const { nodes: rebuilt, groupIds } = rebuildCanvasFromPlan({
            programCode,
            catalog,
            catalogCourseByCode,
            subjectColors,
            coursesBySemester,
            semesterIdsFromPlan,
            doneCourseCodes,
            parkedCourseCodes,
            laneNodes,
            maxSemesterCount,
            minGroupChildY,
            removeCourseNode,
            removeModuleGroup,
            toggleCourseDone,
            toggleModuleDoneCodes,
            updateCourseEcts,
            addGraphModuleToPlan,
            validSemestersForModule,
        });

        let withGroups = rebuilt;
        for (const groupId of groupIds) {
            withGroups = resolveGroupCourseOverlaps(withGroups, groupId);
            withGroups = recomputeGroupFromChildren(withGroups, groupId);
        }
        const resolved = resolveLaneCollisions(withGroups);
        setNodes(resolved);
        // The canvas has just been read out of the plan, so writing it back
        // would record a change nobody made.
        setNeedsPersist(false);
        pendingInitialSyncProgramRef.current = programCode;
        hydratedProgramRef.current = programCode;
    }, [
        plannerHydrated,
        programCode,
        catalog,
        coursesBySemester,
        doneCourseCodes,
        parkedCourseCodes,
        laneNodes,
        maxSemesterCount,
        catalogCourseByCode,
        removeCourseNode,
        removeModuleGroup,
        semesterIdsFromPlan,
        subjectColors,
        toggleCourseDone,
        toggleModuleDoneCodes,
        updateCourseEcts,
        addGraphModuleToPlan,
        validSemestersForModule,
        setNodes,
    ]);
}
