import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import { SEMESTERS } from "./utils/constants.js";
import { laneIndexFromX } from "./utils/geometry.js";

const ProgramContext = createContext();
const BACHELOR_PROGRAM_CODE = "033 521";
const EMPTY_COURSES_PLAN = emptyCoursesOnlyPlan();
const EMPTY_DONE_CODES = [];
const EMPTY_GRAPH_VIEW_STATE = { collapsedIds: null, nodePosById: {} };

function emptyCoursesOnlyPlan() {
    const bySem = {};
    for (const s of SEMESTERS) bySem[s.id] = [];
    return bySem;
}

function normalizeBySemesterMap(value) {
    const next = emptyCoursesOnlyPlan();
    if (!value || typeof value !== "object") return next;
    for (const s of SEMESTERS) {
        const arr = Array.isArray(value?.[s.id]) ? value[s.id] : [];
        next[s.id] = arr;
    }
    return next;
}

function buildCoursesOnlyFromNodes(nodes) {
    if (!Array.isArray(nodes)) return emptyCoursesOnlyPlan();

    const modules = new Map();
    for (const n of nodes) {
        if (n?.type === "moduleBg") {
            modules.set(n.id, {
                id: n.id,
                title: n?.data?.title ?? n?.data?.label ?? "Module",
                examSubject: n?.data?.examSubject ?? null,
                category: n?.data?.category ?? "unknown",
                subjectColor: n?.data?.subjectColor ?? null,
                code: n?.data?.moduleCode ?? null,
                ects: n?.data?.moduleEcts ?? null,
            });
        }
    }

    const bySem = emptyCoursesOnlyPlan();
    const yById = Object.fromEntries(nodes.map((n) => [n.id, n?.position?.y ?? 0]));

    for (const n of nodes) {
        if (n?.type !== "course") continue;
        const laneIdx = Math.max(0, Math.min(laneIndexFromX(n.position?.x ?? 0), SEMESTERS.length - 1));
        const semesterId = SEMESTERS[laneIdx].id;
        const modMeta = n?.data?.groupId ? (modules.get(n.data.groupId) || { id: n.data.groupId }) : null;

        bySem[semesterId].push({
            id: n.id,
            code: n?.data?.code ?? null,
            name: n?.data?.name ?? n?.data?.label ?? null,
            ects: n?.data?.ects ?? null,
            category: n?.data?.category ?? "unknown",
            examSubject: n?.data?.examSubject ?? null,
            position: { x: n?.position?.x ?? 0, y: n?.position?.y ?? 0 },
            laneIndex: laneIdx,
            subjectColor: n?.data?.subjectColor ?? null,
            module: n?.data?.groupId ? { ...modMeta } : null,
        });
    }

    for (const s of SEMESTERS) {
        bySem[s.id].sort((a, b) => (yById[a.id] ?? 0) - (yById[b.id] ?? 0));
    }
    return bySem;
}

function flattenBySemester(bySemester) {
    const out = [];
    for (const s of SEMESTERS) {
        const list = bySemester?.[s.id] ?? [];
        for (const c of list) out.push({ ...c, semesterId: s.id });
    }
    return out;
}

function mapByCourseId(list) {
    const byId = new Map();
    for (const c of list || []) {
        if (c?.id) byId.set(c.id, c);
    }
    return byId;
}

function diffPlannedCourses(prevBySemester, nextBySemester) {
    const prevFlat = flattenBySemester(prevBySemester);
    const nextFlat = flattenBySemester(nextBySemester);
    const prevById = mapByCourseId(prevFlat);
    const nextById = mapByCourseId(nextFlat);
    const added = [];
    const removed = [];
    const moved = [];
    const updated = [];

    for (const [id, course] of nextById.entries()) {
        const before = prevById.get(id);
        if (!before) {
            const toLaneIndex = Number.isFinite(course?.laneIndex) ? course.laneIndex : null;
            added.push({
                id,
                code: course.code ?? null,
                toSemester: course.semesterId,
                toLaneIndex,
                toSemesterNumber: toLaneIndex != null ? toLaneIndex + 1 : null,
            });
            continue;
        }
        if (before.semesterId !== course.semesterId) {
            const fromLaneIndex = Number.isFinite(before?.laneIndex) ? before.laneIndex : null;
            const toLaneIndex = Number.isFinite(course?.laneIndex) ? course.laneIndex : null;
            moved.push({
                id,
                code: course.code ?? null,
                fromSemester: before.semesterId,
                toSemester: course.semesterId,
                fromLaneIndex,
                toLaneIndex,
                fromSemesterNumber: fromLaneIndex != null ? fromLaneIndex + 1 : null,
                toSemesterNumber: toLaneIndex != null ? toLaneIndex + 1 : null,
            });
            continue;
        }
        const beforeEcts = Number(before?.ects ?? 0);
        const nextEcts = Number(course?.ects ?? 0);
        if (Number.isFinite(beforeEcts) && Number.isFinite(nextEcts) && beforeEcts !== nextEcts) {
            const laneIndex = Number.isFinite(course?.laneIndex) ? course.laneIndex : null;
            updated.push({
                id,
                code: course.code ?? null,
                fromEcts: beforeEcts,
                toEcts: nextEcts,
                laneIndex,
                semesterId: course.semesterId,
                semesterNumber: laneIndex != null ? laneIndex + 1 : null,
            });
        }
    }

    for (const [id, course] of prevById.entries()) {
        if (!nextById.has(id)) {
            const fromLaneIndex = Number.isFinite(course?.laneIndex) ? course.laneIndex : null;
            removed.push({
                id,
                code: course.code ?? null,
                fromSemester: course.semesterId,
                fromLaneIndex,
                fromSemesterNumber: fromLaneIndex != null ? fromLaneIndex + 1 : null,
            });
        }
    }

    if (!added.length && !removed.length && !moved.length && !updated.length) return null;
    return { type: "plan_updated", added, removed, moved, updated };
}

export function ProgramProvider({ children }) {
    const [programCode, setProgramCode] = useState("066 937");
    const [coursesByProgram, setCoursesByProgram] = useState({});
    const [doneByProgram, setDoneByProgram] = useState({});
    const [lastPlanChange, setLastPlanChange] = useState(null);
    const [selectedFocusByProgram, setSelectedFocusByProgram] = useState({});
    const [graphViewByProgram, setGraphViewByProgram] = useState({});

    const coursesBySemester = coursesByProgram?.[programCode] ?? EMPTY_COURSES_PLAN;
    const doneCourseCodes = doneByProgram?.[programCode] ?? EMPTY_DONE_CODES;
    const selectedFocus = selectedFocusByProgram?.[programCode] ?? "";
    const graphViewState = graphViewByProgram?.[programCode] ?? EMPTY_GRAPH_VIEW_STATE;

    const setCoursesFromNodes = useCallback((nodes) => {
        const nextPlan = buildCoursesOnlyFromNodes(nodes);

        setCoursesByProgram((prev) => {
            const prevPlan = prev?.[programCode] ?? emptyCoursesOnlyPlan();
            const diff = diffPlannedCourses(prevPlan, nextPlan);
            if (diff) setLastPlanChange({ id: Date.now(), ...diff });
            return { ...prev, [programCode]: nextPlan };
        });

        const plannedCodes = new Set(flattenBySemester(nextPlan).map((c) => c?.code).filter(Boolean));
        setDoneByProgram((prev) => {
            const currentDone = Array.isArray(prev?.[programCode]) ? prev[programCode] : [];
            const pruned = currentDone.filter((code) => plannedCodes.has(code));
            if (pruned.length === currentDone.length) return prev;
            return { ...prev, [programCode]: pruned };
        });
    }, [programCode]);

    const getCoursesForSemester = useCallback((semesterId) => {
        return coursesBySemester[semesterId] ?? [];
    }, [coursesBySemester]);

    const getModulesForSemester = useCallback((semesterId) => {
        const list = coursesBySemester[semesterId] ?? [];
        const byId = new Map();
        for (const c of list) {
            if (c.module?.id) {
                if (!byId.has(c.module.id)) byId.set(c.module.id, { module: c.module, courses: [] });
                byId.get(c.module.id).courses.push(c);
            }
        }
        return Array.from(byId.values());
    }, [coursesBySemester]);

    const getCourseStatus = useCallback((courseCode) => {
        if (!courseCode) return "todo";
        if ((doneByProgram?.[programCode] ?? []).includes(courseCode)) return "done";
        for (const s of SEMESTERS) {
            if ((coursesBySemester?.[s.id] ?? []).some((c) => c?.code === courseCode)) return "in_plan";
        }
        return "todo";
    }, [coursesBySemester, doneByProgram, programCode]);

    const setCourseDone = useCallback((courseCode, nextDone) => {
        if (!courseCode) return;
        let currentLaneIndex = null;
        let currentSemesterId = null;
        for (const s of SEMESTERS) {
            const match = (coursesBySemester?.[s.id] ?? []).find((c) => c?.code === courseCode);
            if (match) {
                currentLaneIndex = Number.isFinite(match?.laneIndex) ? match.laneIndex : null;
                currentSemesterId = s.id;
                break;
            }
        }
        setDoneByProgram((prev) => {
            const current = Array.isArray(prev?.[programCode]) ? prev[programCode] : [];
            const exists = current.includes(courseCode);
            const target = Boolean(nextDone);
            if ((target && exists) || (!target && !exists)) return prev;
            const updated = target ? [...current, courseCode] : current.filter((code) => code !== courseCode);
            return { ...prev, [programCode]: updated };
        });
        setLastPlanChange({
            id: Date.now(),
            type: "course_status_toggled",
            courseCode,
            toStatus: nextDone ? "done" : "in_plan",
            laneIndex: currentLaneIndex,
            semesterId: currentSemesterId,
            semesterNumber: currentLaneIndex != null ? currentLaneIndex + 1 : null,
        });
    }, [coursesBySemester, programCode]);

    const setSelectedFocus = useCallback((focusName) => {
        const nextValue = typeof focusName === "string" ? focusName : "";
        setSelectedFocusByProgram((prev) => {
            const current = prev?.[programCode] ?? "";
            if (current === nextValue) return prev;
            return { ...prev, [programCode]: nextValue };
        });
        if (programCode !== BACHELOR_PROGRAM_CODE) return;
        setLastPlanChange({ id: Date.now(), type: "focus_updated", selectedFocus: nextValue || null });
    }, [programCode]);

    const setGraphViewState = useCallback((nextStateOrUpdater) => {
        setGraphViewByProgram((prev) => {
            const current = prev?.[programCode] ?? EMPTY_GRAPH_VIEW_STATE;
            const patch = typeof nextStateOrUpdater === "function" ? nextStateOrUpdater(current) : nextStateOrUpdater;
            const safePatch = patch && typeof patch === "object" ? patch : {};
            const nextCollapsedIds = Array.isArray(safePatch.collapsedIds) ? safePatch.collapsedIds : (current.collapsedIds ?? null);
            const legacyNodeXById = safePatch.nodeXById && typeof safePatch.nodeXById === "object"
                ? safePatch.nodeXById
                : (current.nodeXById ?? {});
            const nextNodePosById = safePatch.nodePosById && typeof safePatch.nodePosById === "object"
                ? safePatch.nodePosById
                : (current.nodePosById ?? {});

            // Backward compatibility: if only nodeXById exists, convert to nodePosById.
            const nodePosCandidate =
                Object.keys(nextNodePosById).length > 0
                    ? nextNodePosById
                    : Object.fromEntries(
                        Object.entries(legacyNodeXById || {})
                            .filter(([, x]) => Number.isFinite(x))
                            .map(([id, x]) => [id, { x, y: 0 }])
                    );

            return { ...prev, [programCode]: { collapsedIds: nextCollapsedIds, nodePosById: nodePosCandidate } };
        });
    }, [programCode]);

    const exportPlannerStateSnapshot = useCallback(() => ({
        version: 1,
        programCode,
        coursesByProgram,
        doneByProgram,
        selectedFocusByProgram,
        graphViewByProgram,
    }), [programCode, coursesByProgram, doneByProgram, selectedFocusByProgram, graphViewByProgram]);

    const importPlannerStateSnapshot = useCallback((snapshot) => {
        if (!snapshot || typeof snapshot !== "object") return;
        const nextCoursesByProgram = snapshot?.coursesByProgram && typeof snapshot.coursesByProgram === "object"
            ? snapshot.coursesByProgram
            : {};
        const normalizedCoursesByProgram = {};
        for (const [prog, bySem] of Object.entries(nextCoursesByProgram)) {
            normalizedCoursesByProgram[prog] = normalizeBySemesterMap(bySem);
        }
        setCoursesByProgram(normalizedCoursesByProgram);
        setDoneByProgram(snapshot?.doneByProgram && typeof snapshot.doneByProgram === "object" ? snapshot.doneByProgram : {});
        setSelectedFocusByProgram(snapshot?.selectedFocusByProgram && typeof snapshot.selectedFocusByProgram === "object" ? snapshot.selectedFocusByProgram : {});
        const rawGraphViewByProgram =
            snapshot?.graphViewByProgram && typeof snapshot.graphViewByProgram === "object"
                ? snapshot.graphViewByProgram
                : {};
        const normalizedGraphViewByProgram = {};
        for (const [prog, state] of Object.entries(rawGraphViewByProgram)) {
            const collapsedIds = Array.isArray(state?.collapsedIds) ? state.collapsedIds : null;
            const nodePosById = state?.nodePosById && typeof state.nodePosById === "object"
                ? state.nodePosById
                : {};
            const legacyNodeXById = state?.nodeXById && typeof state.nodeXById === "object"
                ? state.nodeXById
                : {};
            const mergedNodePosById = {
                ...Object.fromEntries(
                    Object.entries(legacyNodeXById)
                        .filter(([, x]) => Number.isFinite(x))
                        .map(([id, x]) => [id, { x, y: 0 }])
                ),
                ...nodePosById,
            };
            normalizedGraphViewByProgram[prog] = { collapsedIds, nodePosById: mergedNodePosById };
        }
        setGraphViewByProgram(normalizedGraphViewByProgram);
        if (typeof snapshot?.programCode === "string" && snapshot.programCode.trim()) {
            setProgramCode(snapshot.programCode);
        }
    }, []);

    const clearPlannerState = useCallback(() => {
        setProgramCode("066 937");
        setCoursesByProgram({});
        setDoneByProgram({});
        setLastPlanChange(null);
        setSelectedFocusByProgram({});
        setGraphViewByProgram({});
    }, []);

    const value = useMemo(() => ({
        programCode,
        setProgramCode,
        coursesBySemester,
        setCoursesFromNodes,
        doneCourseCodes,
        selectedFocus,
        setSelectedFocus,
        setCourseDone,
        getCourseStatus,
        lastPlanChange,
        graphViewState,
        setGraphViewState,
        getCoursesForSemester,
        getModulesForSemester,
        exportPlannerStateSnapshot,
        importPlannerStateSnapshot,
        clearPlannerState,
    }), [
        programCode,
        coursesBySemester,
        setCoursesFromNodes,
        doneCourseCodes,
        selectedFocus,
        setSelectedFocus,
        setCourseDone,
        getCourseStatus,
        lastPlanChange,
        graphViewState,
        setGraphViewState,
        getCoursesForSemester,
        getModulesForSemester,
        exportPlannerStateSnapshot,
        importPlannerStateSnapshot,
        clearPlannerState,
    ]);

    return <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>;
}

export function currentProgram() {
    return useContext(ProgramContext);
}
