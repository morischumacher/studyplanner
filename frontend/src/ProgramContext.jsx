import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import { SEMESTERS } from "./utils/constants.js";              // :contentReference[oaicite:0]{index=0}
import { laneIndexFromX } from "./utils/geometry.js";          // :contentReference[oaicite:1]{index=1}

const ProgramContext = createContext();
const DONE_STORAGE_KEY = "study_planner_done_courses_v1";

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

    for (const [id, course] of nextById.entries()) {
        const before = prevById.get(id);
        if (!before) {
            added.push({ id, code: course.code ?? null, toSemester: course.semesterId });
            continue;
        }
        if (before.semesterId !== course.semesterId) {
            moved.push({
                id,
                code: course.code ?? null,
                fromSemester: before.semesterId,
                toSemester: course.semesterId,
            });
        }
    }

    for (const [id, course] of prevById.entries()) {
        if (!nextById.has(id)) {
            removed.push({ id, code: course.code ?? null, fromSemester: course.semesterId });
        }
    }

    if (!added.length && !removed.length && !moved.length) return null;
    return { type: "plan_updated", added, removed, moved };
}

export function ProgramProvider({ children }) {
    // Your existing field:
    const [programCode, setProgramCode] = useState("066 937");

    // New: "courses-only" plan
    const [coursesBySemester, setCoursesBySemester] = useState(() => emptyCoursesOnlyPlan());
    const [doneByProgram, setDoneByProgram] = useState(() => loadDoneByProgram());
    const [lastPlanChange, setLastPlanChange] = useState(null);

    const doneCourseCodes = doneByProgram?.[programCode] ?? [];

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
        });
    }, [programCode]);

    const value = useMemo(() => ({
        programCode,
        setProgramCode,
        coursesBySemester,     // storage = courses only
        setCoursesFromNodes,   // updater you’ll call from App.jsx
        doneCourseCodes,
        setCourseDone,
        getCourseStatus,
        lastPlanChange,

        // optional derived helpers
        getCoursesForSemester,
        getModulesForSemester,
    }), [
        programCode,
        coursesBySemester,
        setCoursesFromNodes,
        doneCourseCodes,
        setCourseDone,
        getCourseStatus,
        lastPlanChange,
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
        if (!lastPlanChange) return;
        console.log("[ProgramContext] lastPlanChange:", lastPlanChange);
    }, [lastPlanChange]);

    return <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>;
}

export function currentProgram() {
    return useContext(ProgramContext);
}
