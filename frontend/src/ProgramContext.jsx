import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import { SEMESTERS } from "./utils/constants.js";              // :contentReference[oaicite:0]{index=0}
import { laneIndexFromX } from "./utils/geometry.js";          // :contentReference[oaicite:1]{index=1}

const ProgramContext = createContext();

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

export function ProgramProvider({ children }) {
    // Your existing field:
    const [programCode, setProgramCode] = useState("066 937");   // :contentReference[oaicite:2]{index=2}

    // New: "courses-only" plan
    const [coursesBySemester, setCoursesBySemester] = useState(() => emptyCoursesOnlyPlan());

    // Call this whenever the React Flow node list changes (e.g., after drag/drop/snap)
    const setCoursesFromNodes = useCallback((nodes) => {
        setCoursesBySemester(buildCoursesOnlyFromNodes(nodes));
    }, []);

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

    const value = useMemo(() => ({
        programCode,
        setProgramCode,
        coursesBySemester,     // storage = courses only
        setCoursesFromNodes,   // updater you’ll call from App.jsx

        // optional derived helpers
        getCoursesForSemester,
        getModulesForSemester,
    }), [
        programCode,
        coursesBySemester,
        setCoursesFromNodes,
        getCoursesForSemester,
        getModulesForSemester,
    ]);

    return <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>;
}

export function currentProgram() {
    return useContext(ProgramContext);
}
