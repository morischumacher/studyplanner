import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import { SEMESTERS } from "./utils/constants.js";              // :contentReference[oaicite:0]{index=0}
import { laneIndexFromX } from "./utils/geometry.js";          // :contentReference[oaicite:1]{index=1}

const ProgramContext = createContext();
const DONE_STORAGE_KEY = "study_planner_done_courses_v1";
const BACHELOR_PROGRAM_CODE = "033 521";

function emptyCoursesOnlyPlan() {
    const bySem = {};
    for (const s of SEMESTERS) bySem[s.id] = [];
    return bySem;
}

/**
 * Build "courses-only" storage from React Flow nodes.
 * We only keep course items; each course embeds its module reference (if any).
 */
function buildCoursesOnlyFromNodes(nodes) {
    if (!Array.isArray(nodes)) return emptyCoursesOnlyPlan();

    // collect module (group) metadata just to embed into the courses
    const modules = new Map();
    for (const n of nodes) {
        if (n?.type === "moduleBg") {
            modules.set(n.id, {
                id: n.id,
                title: n?.data?.title ?? n?.data?.label ?? "Module",
                examSubject: n?.data?.examSubject ?? null,
                category: n?.data?.category ?? "unknown",
                subjectColor: n?.data?.subjectColor ?? null,
            });
        }
    }

    const bySem = emptyCoursesOnlyPlan();
    const yById = Object.fromEntries(nodes.map(n => [n.id, n?.position?.y ?? 0]));

    for (const n of nodes) {
        if (n?.type !== "course") continue;

        const laneIdx = Math.max(0, Math.min(laneIndexFromX(n.position?.x ?? 0), SEMESTERS.length - 1));
        const semesterId = SEMESTERS[laneIdx].id;

        const modMeta = n?.data?.groupId ? (modules.get(n.data.groupId) || { id: n.data.groupId }) : null;

        const course = {
            id: n.id,
            code: n?.data?.code ?? null,
            name: n?.data?.name ?? n?.data?.label ?? null,
            ects: n?.data?.ects ?? null,
            category: n?.data?.category ?? "unknown",
            examSubject: n?.data?.examSubject ?? null,
            // keep visual info around if you need ordering later:
            position: { x: n?.position?.x ?? 0, y: n?.position?.y ?? 0 },
            laneIndex: laneIdx,
            subjectColor: n?.data?.subjectColor ?? null,
            // embed module reference (no separate module store):
            module: n?.data?.groupId ? { ...modMeta } : null,
        };

        bySem[semesterId].push(course);
    }

    // optional: sort by vertical position within each semester
    for (const s of SEMESTERS) {
        bySem[s.id].sort((a, b) => (yById[a.id] ?? 0) - (yById[b.id] ?? 0));
    }

    return bySem;
}

function loadDoneByProgram() {
    if (typeof window === "undefined") return {};
    try {
        const parsed = JSON.parse(window.localStorage.getItem(DONE_STORAGE_KEY) ?? "{}");
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function persistDoneByProgram(value) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(DONE_STORAGE_KEY, JSON.stringify(value));
    } catch {
        // ignore local storage write failures
    }
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
    // Your existing field:
    const [programCode, setProgramCode] = useState("066 937");

    // New: "courses-only" plan
    const [coursesBySemester, setCoursesBySemester] = useState(() => emptyCoursesOnlyPlan());
    const [doneByProgram, setDoneByProgram] = useState(() => loadDoneByProgram());
    const [lastPlanChange, setLastPlanChange] = useState(null);
    const [selectedFocusByProgram, setSelectedFocusByProgram] = useState({});
    const [graphViewByProgram, setGraphViewByProgram] = useState({});

    const doneCourseCodes = doneByProgram?.[programCode] ?? [];
    const selectedFocus = selectedFocusByProgram?.[programCode] ?? "";

    // Call this whenever the React Flow node list changes (e.g., after drag/drop/snap)
    const setCoursesFromNodes = useCallback((nodes) => {
        const nextPlan = buildCoursesOnlyFromNodes(nodes);

        setCoursesBySemester((prevPlan) => {
            const diff = diffPlannedCourses(prevPlan, nextPlan);
            if (diff) setLastPlanChange({ id: Date.now(), ...diff });
            return nextPlan;
        });

        const plannedCodes = new Set(flattenBySemester(nextPlan).map((c) => c?.code).filter(Boolean));
        setDoneByProgram((prev) => {
            const currentDone = Array.isArray(prev?.[programCode]) ? prev[programCode] : [];
            const pruned = currentDone.filter((code) => plannedCodes.has(code));
            if (pruned.length === currentDone.length) return prev;
            const next = { ...prev, [programCode]: pruned };
            persistDoneByProgram(next);
            return next;
        });
    }, [programCode]);

    // ----- Optional: tiny derived helpers (they DO NOT store modules) -----
    const getCoursesForSemester = useCallback((semesterId) => {
        return coursesBySemester[semesterId] ?? [];
    }, [coursesBySemester]);

    // Derive modules present in a semester from the courses (no storage)
    const getModulesForSemester = useCallback((semesterId) => {
        const list = coursesBySemester[semesterId] ?? [];
        const byId = new Map();
        for (const c of list) {
            if (c.module?.id) {
                const key = c.module.id;
                if (!byId.has(key)) byId.set(key, { module: c.module, courses: [] });
                byId.get(key).courses.push(c);
            }
        }
        return Array.from(byId.values());
    }, [coursesBySemester]);

    const getCourseStatus = useCallback((courseCode) => {
        if (!courseCode) return "todo";
        if ((doneByProgram?.[programCode] ?? []).includes(courseCode)) return "done";

        for (const s of SEMESTERS) {
            if ((coursesBySemester?.[s.id] ?? []).some((c) => c?.code === courseCode)) {
                return "in_plan";
            }
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
            const next = { ...prev, [programCode]: updated };
            persistDoneByProgram(next);
            return next;
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
        setLastPlanChange({
            id: Date.now(),
            type: "focus_updated",
            selectedFocus: nextValue || null,
        });
    }, [programCode]);

    const graphViewState = graphViewByProgram?.[programCode] ?? { collapsedIds: null, nodeXById: {} };

    const setGraphViewState = useCallback((nextStateOrUpdater) => {
        setGraphViewByProgram((prev) => {
            const current = prev?.[programCode] ?? { collapsedIds: null, nodeXById: {} };
            const patch =
                typeof nextStateOrUpdater === "function"
                    ? nextStateOrUpdater(current)
                    : nextStateOrUpdater;
            const safePatch = patch && typeof patch === "object" ? patch : {};
            const nextCollapsedIds = Array.isArray(safePatch.collapsedIds)
                ? safePatch.collapsedIds
                : (current.collapsedIds ?? null);
            const nextNodeXById = safePatch.nodeXById && typeof safePatch.nodeXById === "object"
                ? safePatch.nodeXById
                : (current.nodeXById ?? {});

            const collapsedEqual = (() => {
                const a = Array.isArray(current.collapsedIds) ? current.collapsedIds : null;
                const b = Array.isArray(nextCollapsedIds) ? nextCollapsedIds : null;
                if (a === b) return true;
                if (a === null || b === null) return a === b;
                if (a.length !== b.length) return false;
                for (let i = 0; i < a.length; i += 1) {
                    if (a[i] !== b[i]) return false;
                }
                return true;
            })();
            const nodeXEqual = (() => {
                const a = current.nodeXById ?? {};
                const b = nextNodeXById ?? {};
                const aKeys = Object.keys(a);
                const bKeys = Object.keys(b);
                if (aKeys.length !== bKeys.length) return false;
                for (const key of aKeys) {
                    if (a[key] !== b[key]) return false;
                }
                return true;
            })();
            if (collapsedEqual && nodeXEqual) return prev;

            return {
                ...prev,
                [programCode]: {
                    collapsedIds: nextCollapsedIds,
                    nodeXById: nextNodeXById,
                },
            };
        });
    }, [programCode]);

    const value = useMemo(() => ({
        programCode,
        setProgramCode,
        coursesBySemester,     // storage = courses only
        setCoursesFromNodes,   // updater you’ll call from App.jsx
        doneCourseCodes,
        selectedFocus,
        setSelectedFocus,
        setCourseDone,
        getCourseStatus,
        lastPlanChange,
        graphViewState,
        setGraphViewState,

        // optional derived helpers
        getCoursesForSemester,
        getModulesForSemester,
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
    ]);

    useEffect(() => {
        console.log("[ProgramContext] programCode changed:", programCode);
    }, [programCode]);

    useEffect(() => {
        console.log("[ProgramContext] coursesBySemester changed:", coursesBySemester);
    }, [coursesBySemester]);

    useEffect(() => {
        console.log("[ProgramContext] doneCourseCodes changed:", doneCourseCodes);
    }, [doneCourseCodes]);

    useEffect(() => {
        console.log("[ProgramContext] selectedFocus changed:", selectedFocus);
    }, [selectedFocus]);

    useEffect(() => {
        if (!lastPlanChange) return;
        console.log("[ProgramContext] lastPlanChange:", lastPlanChange);
    }, [lastPlanChange]);

    return <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>;
}

export function currentProgram() {
    return useContext(ProgramContext);
}
