import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import { laneIndexFromX } from "./utils/geometry.js";
import { BACHELOR_PROGRAM_CODE, semesterBoundsForProgram } from "./utils/semesters.js";

const ProgramContext = createContext();
const EMPTY_DONE_CODES = [];
const EMPTY_PARKED_CODES = [];
const DEFAULT_GRAPH_FILTERS = {
    obligationTypes: [],
    ectsRange: null,
    courseTypes: [],
    examSubjects: [],
    progressStates: ["todo", "in_plan", "done"],
    termAvailabilities: ["summer", "winter", "both"],
};
const EMPTY_GRAPH_VIEW_STATE = {
    collapsedIds: null,
    nodePosById: {},
    filters: DEFAULT_GRAPH_FILTERS,
    filtersConfigured: false,
};
const DEFAULT_SEMESTER_LOAD_LIMITS = {
    maxEctsPerSemester: 42,
    recommendedEctsPerSemester: 30,
    maxWeekHoursPerSemester: 50,
    recommendedWeekHoursPerSemester: 40,
};
const EMPTY_COURSE_META = Object.freeze({
    notes: "",
    estimatedHours: "",
    grade: "",
});

function sanitizeCourseMetaEntry(value) {
    const source = value && typeof value === "object" ? value : {};
    const notes = typeof source.notes === "string" ? source.notes : "";
    const estimatedHoursRaw = source.estimatedHours;
    const estimatedHours = estimatedHoursRaw == null ? "" : String(estimatedHoursRaw);
    const gradeRaw = source.grade;
    let grade = gradeRaw == null ? "" : String(gradeRaw);
    const normalizedGrade = grade.trim().replace(",", ".");
    const parsedGrade = Number(normalizedGrade);
    if (normalizedGrade && Number.isFinite(parsedGrade) && parsedGrade > 5) {
        grade = "5";
    }
    return { notes, estimatedHours, grade };
}

function sanitizeCourseMetaByProgram(value) {
    const source = value && typeof value === "object" ? value : {};
    const normalized = {};
    for (const [program, byCourse] of Object.entries(source)) {
        if (!byCourse || typeof byCourse !== "object") continue;
        const normalizedByCourse = {};
        for (const [courseCode, meta] of Object.entries(byCourse)) {
            const code = String(courseCode || "").trim();
            if (!code) continue;
            normalizedByCourse[code] = sanitizeCourseMetaEntry(meta);
        }
        normalized[program] = normalizedByCourse;
    }
    return normalized;
}

function sanitizeSemesterNotesByProgram(value) {
    const source = value && typeof value === "object" ? value : {};
    const normalized = {};
    for (const [program, bySemester] of Object.entries(source)) {
        if (!bySemester || typeof bySemester !== "object") continue;
        const normalizedBySemester = {};
        for (const [semesterId, note] of Object.entries(bySemester)) {
            const sem = Number(semesterId);
            if (!Number.isInteger(sem) || sem < 1) continue;
            normalizedBySemester[sem] = typeof note === "string" ? note : "";
        }
        normalized[program] = normalizedBySemester;
    }
    return normalized;
}

function sanitizeParkedByProgram(value) {
    const source = value && typeof value === "object" ? value : {};
    const normalized = {};
    for (const [program, codes] of Object.entries(source)) {
        const safeCodes = Array.isArray(codes) ? codes : [];
        normalized[program] = [...new Set(
            safeCodes
                .map((code) => String(code || "").trim())
                .filter(Boolean)
        )];
    }
    return normalized;
}

function sanitizeSemesterLoadLimits(value) {
    const source = value && typeof value === "object" ? value : {};
    const parsedMax = Number(source.maxEctsPerSemester);
    const parsedRecommended = Number(source.recommendedEctsPerSemester);
    const parsedMaxWeekHours = Number(source.maxWeekHoursPerSemester);
    const parsedRecommendedWeekHours = Number(source.recommendedWeekHoursPerSemester);
    const maxEctsPerSemester = Number.isFinite(parsedMax) && parsedMax > 0
        ? parsedMax
        : DEFAULT_SEMESTER_LOAD_LIMITS.maxEctsPerSemester;
    const recommendedRaw = Number.isFinite(parsedRecommended) && parsedRecommended > 0
        ? parsedRecommended
        : DEFAULT_SEMESTER_LOAD_LIMITS.recommendedEctsPerSemester;
    const recommendedEctsPerSemester = Math.min(recommendedRaw, maxEctsPerSemester);
    const maxWeekHoursPerSemester = Number.isFinite(parsedMaxWeekHours) && parsedMaxWeekHours > 0
        ? parsedMaxWeekHours
        : DEFAULT_SEMESTER_LOAD_LIMITS.maxWeekHoursPerSemester;
    const recommendedWeekHoursRaw = Number.isFinite(parsedRecommendedWeekHours) && parsedRecommendedWeekHours > 0
        ? parsedRecommendedWeekHours
        : DEFAULT_SEMESTER_LOAD_LIMITS.recommendedWeekHoursPerSemester;
    const recommendedWeekHoursPerSemester = Math.min(recommendedWeekHoursRaw, maxWeekHoursPerSemester);
    return {
        maxEctsPerSemester,
        recommendedEctsPerSemester,
        maxWeekHoursPerSemester,
        recommendedWeekHoursPerSemester,
    };
}

function sanitizeGraphFilters(filters) {
    const source = filters && typeof filters === "object" ? filters : {};
    return {
        obligationTypes: Array.isArray(source.obligationTypes) ? source.obligationTypes : DEFAULT_GRAPH_FILTERS.obligationTypes,
        ectsRange: source.ectsRange && typeof source.ectsRange === "object"
            ? {
                min: Number(source.ectsRange.min),
                max: Number(source.ectsRange.max),
            }
            : null,
        courseTypes: Array.isArray(source.courseTypes) ? source.courseTypes : DEFAULT_GRAPH_FILTERS.courseTypes,
        examSubjects: Array.isArray(source.examSubjects) ? source.examSubjects : DEFAULT_GRAPH_FILTERS.examSubjects,
        progressStates: Array.isArray(source.progressStates) ? source.progressStates : DEFAULT_GRAPH_FILTERS.progressStates,
        termAvailabilities: Array.isArray(source.termAvailabilities) ? source.termAvailabilities : DEFAULT_GRAPH_FILTERS.termAvailabilities,
    };
}

function emptyCoursesOnlyPlan(minCount = 6) {
    const bySem = {};
    for (let i = 1; i <= Math.max(1, Number(minCount) || 1); i += 1) bySem[i] = [];
    return bySem;
}

function numericSemesterIds(bySemester, minCount, maxCount) {
    const ids = new Set();
    const min = Math.max(1, Number(minCount) || 1);
    const max = Math.max(min, Number(maxCount) || min);
    for (let i = 1; i <= min; i += 1) ids.add(i);
    if (bySemester && typeof bySemester === "object") {
        for (const key of Object.keys(bySemester)) {
            const n = Number(key);
            if (Number.isInteger(n) && n >= 1 && n <= max) ids.add(n);
        }
    }
    return [...ids].sort((a, b) => a - b);
}

function normalizeBySemesterMap(value, minCount, maxCount) {
    const next = emptyCoursesOnlyPlan(minCount);
    if (!value || typeof value !== "object") return next;
    for (const id of numericSemesterIds(value, minCount, maxCount)) {
        const arr = Array.isArray(value?.[id]) ? value[id] : [];
        next[id] = arr;
    }
    return next;
}

function buildCoursesOnlyFromNodes(nodes, programCode) {
    const bounds = semesterBoundsForProgram(programCode);
    if (!Array.isArray(nodes)) {
        return { bySem: emptyCoursesOnlyPlan(bounds.min), parkedCodes: [] };
    }

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

    const bySem = emptyCoursesOnlyPlan(bounds.min);
    const parkedCodes = [];
    const yById = Object.fromEntries(nodes.map((n) => [n.id, n?.position?.y ?? 0]));

    for (const n of nodes) {
        if (n?.type !== "course") continue;
        if (String(n?.data?.status || "").trim() === "parked") {
            const parkedCode = String(n?.data?.code || "").trim();
            if (parkedCode) parkedCodes.push(parkedCode);
            continue;
        }
        const laneIdx = Math.max(0, Math.min(laneIndexFromX(n.position?.x ?? 0, bounds.max - 1), bounds.max - 1));
        const semesterId = laneIdx + 1;
        const modMeta = n?.data?.groupId
            ? (modules.get(n.data.groupId) || { id: n.data.groupId })
            : (n?.data?.moduleMeta && typeof n.data.moduleMeta === "object" ? n.data.moduleMeta : null);

        if (!bySem[semesterId]) bySem[semesterId] = [];

        bySem[semesterId].push({
            id: n.id,
            code: n?.data?.code ?? null,
            name: n?.data?.name ?? n?.data?.label ?? null,
            type: n?.data?.type ?? null,
            ects: n?.data?.ects ?? null,
            category: n?.data?.category ?? "unknown",
            examSubject: n?.data?.examSubject ?? null,
            position: { x: n?.position?.x ?? 0, y: n?.position?.y ?? 0 },
            laneIndex: laneIdx,
            subjectColor: n?.data?.subjectColor ?? null,
            module: modMeta ? { ...modMeta } : null,
        });
    }

    for (const semesterId of Object.keys(bySem)) {
        bySem[semesterId].sort((a, b) => (yById[a.id] ?? 0) - (yById[b.id] ?? 0));
    }
    return {
        bySem,
        parkedCodes: [...new Set(parkedCodes)],
    };
}

function flattenBySemester(bySemester, minCount, maxCount) {
    const out = [];
    for (const id of numericSemesterIds(bySemester, minCount, maxCount)) {
        const list = bySemester?.[id] ?? [];
        for (const c of list) out.push({ ...c, semesterId: id });
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

function diffPlannedCourses(prevBySemester, nextBySemester, minCount, maxCount) {
    const prevFlat = flattenBySemester(prevBySemester, minCount, maxCount);
    const nextFlat = flattenBySemester(nextBySemester, minCount, maxCount);
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

export function ProgramProvider({ children, initialProgramCode = "066 937" }) {
    const [programCode, setProgramCode] = useState(() => {
        const next = String(initialProgramCode || "").trim();
        return next || "066 937";
    });
    const [coursesByProgram, setCoursesByProgram] = useState({});
    const [doneByProgram, setDoneByProgram] = useState({});
    const [parkedByProgram, setParkedByProgram] = useState({});
    const [lastPlanChange, setLastPlanChange] = useState(null);
    const [selectedFocusByProgram, setSelectedFocusByProgram] = useState({});
    const [graphViewByProgram, setGraphViewByProgram] = useState({});
    const [semesterLoadLimitsByProgram, setSemesterLoadLimitsByProgram] = useState({});
    const [courseMetaByProgram, setCourseMetaByProgram] = useState({});
    const [semesterNotesByProgram, setSemesterNotesByProgram] = useState({});

    const semesterBounds = semesterBoundsForProgram(programCode);
    const emptyPlanForProgram = useMemo(() => emptyCoursesOnlyPlan(semesterBounds.min), [semesterBounds.min]);
    const coursesBySemester = coursesByProgram?.[programCode] ?? emptyPlanForProgram;
    const doneCourseCodes = doneByProgram?.[programCode] ?? EMPTY_DONE_CODES;
    const parkedCourseCodes = parkedByProgram?.[programCode] ?? EMPTY_PARKED_CODES;
    const selectedFocus = selectedFocusByProgram?.[programCode] ?? "";
    const graphViewState = graphViewByProgram?.[programCode] ?? EMPTY_GRAPH_VIEW_STATE;
    const semesterLoadLimits = sanitizeSemesterLoadLimits(
        semesterLoadLimitsByProgram?.[programCode] ?? DEFAULT_SEMESTER_LOAD_LIMITS
    );
    const courseMetaByCode = courseMetaByProgram?.[programCode] ?? {};
    const semesterNotesBySemesterId = semesterNotesByProgram?.[programCode] ?? {};

    const setCoursesFromNodes = useCallback((nodes) => {
        const bounds = semesterBoundsForProgram(programCode);
        const parsed = buildCoursesOnlyFromNodes(nodes, programCode);
        const nextPlan = parsed?.bySem ?? emptyCoursesOnlyPlan(bounds.min);
        const nextParked = Array.isArray(parsed?.parkedCodes) ? parsed.parkedCodes : [];

        setCoursesByProgram((prev) => {
            const prevPlan = prev?.[programCode] ?? emptyCoursesOnlyPlan(bounds.min);
            const diff = diffPlannedCourses(prevPlan, nextPlan, bounds.min, bounds.max);
            if (diff) setLastPlanChange({ id: Date.now(), ...diff });
            return { ...prev, [programCode]: nextPlan };
        });

        const plannedCodes = new Set(flattenBySemester(nextPlan, bounds.min, bounds.max).map((c) => c?.code).filter(Boolean));
        const removedDoneByPrune = (doneByProgram?.[programCode] ?? []).filter((code) => !plannedCodes.has(code));
        setDoneByProgram((prev) => {
            const currentDone = Array.isArray(prev?.[programCode]) ? prev[programCode] : [];
            const pruned = currentDone.filter((code) => plannedCodes.has(code));
            if (pruned.length === currentDone.length) return prev;
            return { ...prev, [programCode]: pruned };
        });
        if (removedDoneByPrune.length > 0) {
            setCourseMetaByProgram((prev) => {
                const byCode = prev?.[programCode] && typeof prev[programCode] === "object"
                    ? prev[programCode]
                    : {};
                let changed = false;
                const nextByCode = { ...byCode };
                for (const code of removedDoneByPrune) {
                    const key = String(code || "").trim();
                    if (!key) continue;
                    const entry = sanitizeCourseMetaEntry(nextByCode?.[key] ?? EMPTY_COURSE_META);
                    if (!entry.grade) continue;
                    nextByCode[key] = { ...entry, grade: "" };
                    changed = true;
                }
                if (!changed) return prev;
                return {
                    ...(prev || {}),
                    [programCode]: nextByCode,
                };
            });
        }
        setParkedByProgram((prev) => {
            const current = Array.isArray(prev?.[programCode]) ? prev[programCode] : [];
            if (
                current.length === nextParked.length &&
                current.every((code, idx) => code === nextParked[idx])
            ) {
                return prev;
            }
            return { ...(prev || {}), [programCode]: nextParked };
        });
    }, [doneByProgram, programCode]);

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
        if ((parkedByProgram?.[programCode] ?? []).includes(courseCode)) return "parked";
        for (const semesterId of numericSemesterIds(coursesBySemester, semesterBounds.min, semesterBounds.max)) {
            if ((coursesBySemester?.[semesterId] ?? []).some((c) => c?.code === courseCode)) return "in_plan";
        }
        return "todo";
    }, [coursesBySemester, doneByProgram, parkedByProgram, programCode, semesterBounds.max, semesterBounds.min]);

    const setCourseDone = useCallback((courseCode, nextDone) => {
        if (!courseCode) return;
        let currentLaneIndex = null;
        let currentSemesterId = null;
        for (const semesterId of numericSemesterIds(coursesBySemester, semesterBounds.min, semesterBounds.max)) {
            const match = (coursesBySemester?.[semesterId] ?? []).find((c) => c?.code === courseCode);
            if (match) {
                currentLaneIndex = Number.isFinite(match?.laneIndex) ? match.laneIndex : null;
                currentSemesterId = semesterId;
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
        if (!nextDone) {
            setCourseMetaByProgram((prev) => {
                const byCode = prev?.[programCode] && typeof prev[programCode] === "object"
                    ? prev[programCode]
                    : {};
                const key = String(courseCode || "").trim();
                if (!key) return prev;
                const entry = sanitizeCourseMetaEntry(byCode?.[key] ?? EMPTY_COURSE_META);
                if (!entry.grade) return prev;
                return {
                    ...(prev || {}),
                    [programCode]: {
                        ...byCode,
                        [key]: { ...entry, grade: "" },
                    },
                };
            });
        }
        setLastPlanChange({
            id: Date.now(),
            type: "course_status_toggled",
            courseCode,
            toStatus: nextDone ? "done" : "in_plan",
            laneIndex: currentLaneIndex,
            semesterId: currentSemesterId,
            semesterNumber: currentLaneIndex != null ? currentLaneIndex + 1 : null,
        });
    }, [coursesBySemester, programCode, semesterBounds.max, semesterBounds.min]);

    const setMultipleCoursesDone = useCallback((courseCodes, nextDone) => {
        const codes = Array.isArray(courseCodes) ? courseCodes.filter(Boolean) : [];
        if (codes.length === 0) return;

        setDoneByProgram((prev) => {
            const current = Array.isArray(prev?.[programCode]) ? prev[programCode] : [];
            let updated = [...current];
            const target = Boolean(nextDone);
            for (const code of codes) {
                const exists = updated.includes(code);
                if (target && !exists) {
                    updated.push(code);
                } else if (!target && exists) {
                    updated = updated.filter((c) => c !== code);
                }
            }
            return { ...prev, [programCode]: updated };
        });

        if (!nextDone) {
            setCourseMetaByProgram((prev) => {
                const byCode = prev?.[programCode] && typeof prev[programCode] === "object"
                    ? prev[programCode]
                    : {};
                let updatedByCode = { ...byCode };
                let modified = false;
                for (const code of codes) {
                    const key = String(code || "").trim();
                    if (!key) continue;
                    const entry = sanitizeCourseMetaEntry(byCode?.[key] ?? EMPTY_COURSE_META);
                    if (entry.grade) {
                        updatedByCode[key] = { ...entry, grade: "" };
                        modified = true;
                    }
                }
                if (!modified) return prev;
                return {
                    ...(prev || {}),
                    [programCode]: updatedByCode,
                };
            });
        }

        setLastPlanChange({
            id: Date.now(),
            type: "course_status_toggled",
            courseCodes: codes,
            toStatus: nextDone ? "done" : "in_plan",
        });
    }, [programCode]);

    const rollbackCourseDone = useCallback((courseCode, nextDone) => {
        if (!courseCode) return;
        setDoneByProgram((prev) => {
            const current = Array.isArray(prev?.[programCode]) ? prev[programCode] : [];
            const exists = current.includes(courseCode);
            const target = Boolean(nextDone);
            if ((target && exists) || (!target && !exists)) return prev;
            const updated = target ? [...current, courseCode] : current.filter((code) => code !== courseCode);
            return { ...prev, [programCode]: updated };
        });
        if (!nextDone) {
            setCourseMetaByProgram((prev) => {
                const byCode = prev?.[programCode] && typeof prev[programCode] === "object"
                    ? prev[programCode]
                    : {};
                const key = String(courseCode || "").trim();
                if (!key) return prev;
                const entry = sanitizeCourseMetaEntry(byCode?.[key] ?? EMPTY_COURSE_META);
                if (!entry.grade) return prev;
                return {
                    ...(prev || {}),
                    [programCode]: {
                        ...byCode,
                        [key]: { ...entry, grade: "" },
                    },
                };
            });
        }
    }, [programCode]);


    const getCourseMeta = useCallback((courseCode) => {
        const code = String(courseCode || "").trim();
        if (!code) return EMPTY_COURSE_META;
        return courseMetaByProgram?.[programCode]?.[code] ?? EMPTY_COURSE_META;
    }, [courseMetaByProgram, programCode]);

    const setCourseMeta = useCallback((courseCode, nextMetaOrUpdater) => {
        const code = String(courseCode || "").trim();
        if (!code) return;
        setCourseMetaByProgram((prev) => {
            const currentByCode = prev?.[programCode] && typeof prev[programCode] === "object"
                ? prev[programCode]
                : {};
            const currentEntry = sanitizeCourseMetaEntry(currentByCode?.[code] ?? EMPTY_COURSE_META);
            const patchCandidate = typeof nextMetaOrUpdater === "function"
                ? nextMetaOrUpdater(currentEntry)
                : nextMetaOrUpdater;
            const nextEntry = sanitizeCourseMetaEntry({
                ...currentEntry,
                ...(patchCandidate && typeof patchCandidate === "object" ? patchCandidate : {}),
            });
            if (
                currentEntry.notes === nextEntry.notes &&
                currentEntry.estimatedHours === nextEntry.estimatedHours &&
                currentEntry.grade === nextEntry.grade
            ) {
                return prev;
            }
            return {
                ...(prev || {}),
                [programCode]: {
                    ...currentByCode,
                    [code]: nextEntry,
                },
            };
        });
    }, [programCode]);

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

    const setSelectedFocusForProgram = useCallback((targetProgramCode, focusName) => {
        const key = String(targetProgramCode || "").trim();
        if (!key) return;
        const nextValue = typeof focusName === "string" ? focusName : "";
        setSelectedFocusByProgram((prev) => {
            const current = prev?.[key] ?? "";
            if (current === nextValue) return prev;
            return { ...prev, [key]: nextValue };
        });
        if (key !== BACHELOR_PROGRAM_CODE) return;
        setLastPlanChange({ id: Date.now(), type: "focus_updated", selectedFocus: nextValue || null });
    }, []);

    const setGraphViewState = useCallback((nextStateOrUpdater) => {
        setGraphViewByProgram((prev) => {
            const current = prev?.[programCode] ?? EMPTY_GRAPH_VIEW_STATE;
            const patch = typeof nextStateOrUpdater === "function" ? nextStateOrUpdater(current) : nextStateOrUpdater;
            if (patch === current) return prev;
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
            const nextFiltersCandidate = sanitizeGraphFilters(safePatch?.filters ?? current?.filters);
            const filtersUnchanged =
                JSON.stringify(current?.filters ?? null) === JSON.stringify(nextFiltersCandidate ?? null);
            const filters = filtersUnchanged ? (current?.filters ?? nextFiltersCandidate) : nextFiltersCandidate;
            const filtersConfigured =
                typeof safePatch?.filtersConfigured === "boolean"
                    ? safePatch.filtersConfigured
                    : Boolean(current?.filtersConfigured);
            const nextProgramGraphState = {
                ...current,
                ...safePatch,
                collapsedIds: nextCollapsedIds,
                nodePosById: nodePosCandidate,
                filters,
                filtersConfigured,
            };
            if (
                current?.collapsedIds === nextProgramGraphState.collapsedIds &&
                current?.nodePosById === nextProgramGraphState.nodePosById &&
                current?.filters === nextProgramGraphState.filters &&
                current?.filtersConfigured === nextProgramGraphState.filtersConfigured
            ) {
                return prev;
            }
            return {
                ...prev,
                [programCode]: nextProgramGraphState,
            };
        });
    }, [programCode]);

    const setSemesterLoadLimits = useCallback((nextValueOrUpdater) => {
        setSemesterLoadLimitsByProgram((prev) => {
            const current = sanitizeSemesterLoadLimits(prev?.[programCode] ?? DEFAULT_SEMESTER_LOAD_LIMITS);
            const patchCandidate = typeof nextValueOrUpdater === "function"
                ? nextValueOrUpdater(current)
                : nextValueOrUpdater;
            const next = sanitizeSemesterLoadLimits(patchCandidate);
            if (
                current.maxEctsPerSemester === next.maxEctsPerSemester &&
                current.recommendedEctsPerSemester === next.recommendedEctsPerSemester &&
                current.maxWeekHoursPerSemester === next.maxWeekHoursPerSemester &&
                current.recommendedWeekHoursPerSemester === next.recommendedWeekHoursPerSemester
            ) {
                return prev;
            }
            setLastPlanChange({
                id: Date.now(),
                type: "semester_load_limits_updated",
                maxEctsPerSemester: next.maxEctsPerSemester,
                recommendedEctsPerSemester: next.recommendedEctsPerSemester,
                maxWeekHoursPerSemester: next.maxWeekHoursPerSemester,
                recommendedWeekHoursPerSemester: next.recommendedWeekHoursPerSemester,
            });
            return {
                ...(prev || {}),
                [programCode]: next,
            };
        });
    }, [programCode]);

    const getSemesterNote = useCallback((semesterId) => {
        const sem = Number(semesterId);
        if (!Number.isInteger(sem) || sem < 1) return "";
        const note = semesterNotesByProgram?.[programCode]?.[sem];
        return typeof note === "string" ? note : "";
    }, [semesterNotesByProgram, programCode]);

    const setSemesterNote = useCallback((semesterId, note) => {
        const sem = Number(semesterId);
        if (!Number.isInteger(sem) || sem < 1) return;
        const nextNote = typeof note === "string" ? note : "";
        setSemesterNotesByProgram((prev) => {
            const currentBySemester = prev?.[programCode] && typeof prev[programCode] === "object"
                ? prev[programCode]
                : {};
            const current = typeof currentBySemester?.[sem] === "string" ? currentBySemester[sem] : "";
            if (current === nextNote) return prev;
            return {
                ...(prev || {}),
                [programCode]: {
                    ...currentBySemester,
                    [sem]: nextNote,
                },
            };
        });
    }, [programCode]);

    const exportPlannerStateSnapshot = useCallback(() => ({
        version: 1,
        programCode,
        coursesByProgram,
        doneByProgram,
        parkedByProgram,
        courseMetaByProgram,
        semesterNotesByProgram,
        selectedFocusByProgram,
        graphViewByProgram,
        semesterLoadLimitsByProgram,
    }), [programCode, coursesByProgram, doneByProgram, parkedByProgram, courseMetaByProgram, semesterNotesByProgram, selectedFocusByProgram, graphViewByProgram, semesterLoadLimitsByProgram]);

    const importPlannerStateSnapshot = useCallback((snapshot) => {
        if (!snapshot || typeof snapshot !== "object") return;
        const nextCoursesByProgram = snapshot?.coursesByProgram && typeof snapshot.coursesByProgram === "object"
            ? snapshot.coursesByProgram
            : {};
        const normalizedCoursesByProgram = {};
        for (const [prog, bySem] of Object.entries(nextCoursesByProgram)) {
            const bounds = semesterBoundsForProgram(prog);
            normalizedCoursesByProgram[prog] = normalizeBySemesterMap(bySem, bounds.min, bounds.max);
        }
        setCoursesByProgram(normalizedCoursesByProgram);
        setDoneByProgram(snapshot?.doneByProgram && typeof snapshot.doneByProgram === "object" ? snapshot.doneByProgram : {});
        setParkedByProgram(sanitizeParkedByProgram(snapshot?.parkedByProgram));
        setCourseMetaByProgram(sanitizeCourseMetaByProgram(snapshot?.courseMetaByProgram));
        setSemesterNotesByProgram(sanitizeSemesterNotesByProgram(snapshot?.semesterNotesByProgram));
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
            normalizedGraphViewByProgram[prog] = {
                ...state,
                collapsedIds,
                nodePosById: mergedNodePosById,
                filters: sanitizeGraphFilters(state?.filters),
                filtersConfigured: Boolean(state?.filtersConfigured),
            };
        }
        setGraphViewByProgram(normalizedGraphViewByProgram);
        const rawSemesterLoadLimitsByProgram =
            snapshot?.semesterLoadLimitsByProgram && typeof snapshot.semesterLoadLimitsByProgram === "object"
                ? snapshot.semesterLoadLimitsByProgram
                : {};
        const normalizedSemesterLoadLimitsByProgram = {};
        for (const [prog, limits] of Object.entries(rawSemesterLoadLimitsByProgram)) {
            normalizedSemesterLoadLimitsByProgram[prog] = sanitizeSemesterLoadLimits(limits);
        }
        setSemesterLoadLimitsByProgram(normalizedSemesterLoadLimitsByProgram);
        if (typeof snapshot?.programCode === "string" && snapshot.programCode.trim()) {
            setProgramCode(snapshot.programCode);
        }
    }, []);

    const clearPlannerState = useCallback(() => {
        setProgramCode("066 937");
        setCoursesByProgram({});
        setDoneByProgram({});
        setParkedByProgram({});
        setLastPlanChange(null);
        setSelectedFocusByProgram({});
        setGraphViewByProgram({});
        setSemesterLoadLimitsByProgram({});
        setCourseMetaByProgram({});
        setSemesterNotesByProgram({});
    }, []);

    const value = useMemo(() => ({
        programCode,
        setProgramCode,
        coursesBySemester,
        setCoursesFromNodes,
        doneCourseCodes,
        parkedCourseCodes,
        courseMetaByCode,
        semesterNotesBySemesterId,
        getCourseMeta,
        setCourseMeta,
        getSemesterNote,
        setSemesterNote,
        selectedFocus,
        setSelectedFocus,
        setSelectedFocusForProgram,
        setCourseDone,
        setMultipleCoursesDone,
        rollbackCourseDone,
        getCourseStatus,
        lastPlanChange,
        graphViewState,
        setGraphViewState,
        semesterLoadLimits,
        setSemesterLoadLimits,
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
        parkedCourseCodes,
        courseMetaByCode,
        semesterNotesBySemesterId,
        getCourseMeta,
        setCourseMeta,
        getSemesterNote,
        setSemesterNote,
        selectedFocus,
        setSelectedFocus,
        setSelectedFocusForProgram,
        setCourseDone,
        setMultipleCoursesDone,
        rollbackCourseDone,
        getCourseStatus,
        lastPlanChange,
        graphViewState,
        setGraphViewState,
        semesterLoadLimits,
        setSemesterLoadLimits,
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
