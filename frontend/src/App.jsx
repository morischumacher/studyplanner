// src/App.jsx
// Cleaned, commented, and lightly restructured version.
// NOTE: Logic and behaviors are preserved.

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { currentProgram } from "./ProgramContext.jsx";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

import { fetchCatalog, sendRuleCheckUpdate } from "./lib/api";
import { CourseCard, LaneColumn, ModuleGroupBackground, Sidebar } from "./components";
import CurriculumGraphView from "./components/CurriculumGraphView.jsx";
import {
    CANVAS_HEIGHT,
    CARD_WIDTH,
    COLLISION_GAP,
    GRID_SIZE,
    GROUP_EXTRA_RIGHT,
    GROUP_PADDING_X,
    GROUP_PADDING_Y,
    MODULE_HEADER_HEIGHT,
    NODE_HEIGHT,
    SEMESTERS,
} from "./utils/constants.js";
import { centerX, laneIndexFromX, projectToLaneAndSnap } from "./utils/geometry.js";
import { createExamSubjectColorMap } from "./utils/examSubjectColors.js";

/*********************************
 * React Flow node type registry *
 *********************************/
const NODE_TYPES = {
    course: CourseCard,
    lane: LaneColumn,
    moduleBg: ModuleGroupBackground,
};

const PROGRAM_OPTIONS = [
    { code: "066 937", label: "Master Software Engineering" },
    { code: "033 521", label: "Bachelor Informatics" },
];
const BACHELOR_PROGRAM_CODE = "033 521";
const BACHELOR_FOCUS_OPTIONS = [
    "Artificial Intelligence und Machine Learning",
    "Cybersecurity",
    "Digital Health",
    "Human-Centered Computing",
    "Software Engineering",
    "Theoretische Informatik und Logik",
    "Visual Computing",
];
const STEOP_RULES_TEXT = `Die Studieneingangs- und Orientierungsphase des Bachelorstudiums Informatik umfasst die Lehrveranstaltungen
5,5 VU Einfuehrung in die Programmierung 1
2,0 VU Mathematisches Arbeiten fuer Informatik und Wirtschaftsinformatik
1,0 VU Orientierung Informatik und Wirtschaftsinformatik
sowie mindestens 8 ECTS aus dem Pool folgender Lehrveranstaltungen:
4,0 VO Algebra und Diskrete Mathematik fuer Informatik und Wirtschaftsinformatik
5,0 UE Algebra und Diskrete Mathematik fuer Informatik und Wirtschaftsinformatik
9,0 VU Algebra und Diskrete Mathematik fuer Informatik und Wirtschaftsinformatik
2,0 VO Analysis fuer Informatik und Wirtschaftsinformatik
4,0 UE Analysis fuer Informatik und Wirtschaftsinformatik
6,0 VU Analysis fuer Informatik und Wirtschaftsinformatik
5,5 VU Denkweisen der Informatik
6,0 VU Grundzuege digitaler Systeme
Vor positiver Absolvierung der StEOP duerfen weitere Lehrveranstaltungen im Umfang von 22 ECTS absolviert werden, die aus den oben genannten Lehrveranstaltungen und den folgenden gewaehlt werden koennen:
8,0 VU Algorithmen und Datenstrukturen
6,0 VU Datenbanksysteme
6,0 VU Daten- und Informatikrecht
4,0 VU Einfuehrung in die Programmierung 2
6,0 VU Einfuehrung in Visual Computing
Weiters koennen Lehrveranstaltungen im Rahmen des Moduls Freie Wahlfaecher und Transferable Skills gewaehlt werden, sofern deren Absolvierung nicht anderweitig beschraenkt ist.`;
const FOCUS_INFO_TEXT = `Die Vertiefung (Focus Area) wird nur ausgewertet, wenn sie ausgewaehlt ist.
Der Rulechecker meldet dann:
- ob die Vertiefung erkannt wurde,
- wie viele Vertiefungsanforderungen noch fehlen.
Die Detailhinweise findest du in "Missing Requirements".`;

/** Return lane index for a node (based on its X). */
function laneIdx(node) {
    return laneIndexFromX(node.position.x);
}

/***********************
 * Module group background (size/position) calc *
 ***********************************************/
/**
 * Recompute a group background node's size and position from its child course nodes.
 * If the group has no children, remove the group node.
 */
function recomputeGroupFromChildren(nodes, groupId) {
    const children = nodes.filter((n) => n.type === "course" && n.data?.groupId === groupId);
    const group = nodes.find((n) => n.type === "moduleBg" && n.id === groupId);
    if (!group) return nodes;

    // No children → remove the group background.
    if (children.length === 0) return nodes.filter((n) => n.id !== groupId);

    // Compute bounding box around children (spanning multiple lanes if needed).
    const minX = Math.min(...children.map((c) => c.position.x));
    const minY = Math.min(...children.map((c) => c.position.y));
    const maxX = Math.max(...children.map((c) => c.position.x + CARD_WIDTH));
    const maxY = Math.max(...children.map((c) => c.position.y + NODE_HEIGHT));

    const width = maxX - minX + GROUP_PADDING_X * 2 + GROUP_EXTRA_RIGHT;
    const height = maxY - minY + GROUP_PADDING_Y * 2 + MODULE_HEADER_HEIGHT;

    return nodes.map((n) =>
        n.id === groupId
            ? {
                ...n,
                position: {
                    x: minX - GROUP_PADDING_X,
                    y: minY - GROUP_PADDING_Y - MODULE_HEADER_HEIGHT,
                },
                data: { ...n.data, width, height },
            }
            : n
    );
}

/****************************************
 * Catalog → exam subject lookup helpers *
 ****************************************/
/**
 * Walk a normalized catalog to find the exam subject tied to a module or course code.
 * Returns the closest module exam subject; falls back to parent subject.
 */
function getExamSubjectForCode(catalog, code) {
    if (!code) return null;
    for (const pf of catalog || []) {
        const pfName = pf.pruefungsfach ?? null;
        for (const mod of pf.modules || []) {
            if (mod.code === code) return mod.module_exam_subject || pfName || null; // module by code
            for (const c of mod.courses || []) {
                if (c.code === code) return mod.module_exam_subject || pfName || null; // child course by code
            }
        }
    }
    return null;
}

/***********************************
 * Normalize backend payload → UI  *
 ***********************************/
const normalizeCatalog = (raw) => {
    const subjects = Array.isArray(raw) ? raw : [];
    if (!subjects.length) return [];

    return subjects.map((s, sIdx) => {
        const modules = Array.isArray(s.modules) ? s.modules : [];
        return {
            pruefungsfach: s.exam_subject ?? `Prüfungsfach ${sIdx + 1}`,
            modules: modules.map((m) => {
                const courses = Array.isArray(m.courses) ? m.courses : [];
                return {
                    code: courses[0]?.code ?? m.code ?? `M-${sIdx}`,
                    name: m.name ?? "Ohne Titel",
                    ects: Number(m.ects) || 0,
                    category: m.category ?? null,
                    is_mandatory: !!m.is_mandatory,
                    module_exam_subject: m.module_exam_subject ?? s.exam_subject ?? null,
                    courses: courses.map((c) => ({
                        name: c.title ?? c.name ?? "",
                        code: c.code ?? "",
                        ects: Number(c.ects) || null,
                    })),
                };
            }),
        };
    });
};

/****************
 * Main component
 ****************/
export default function App() {
    const {
        programCode,
        setProgramCode,
        setCoursesFromNodes,
        coursesBySemester,
        doneCourseCodes,
        selectedFocus,
        setSelectedFocus,
        setCourseDone,
        getCourseStatus,
        lastPlanChange,
        graphViewState,
        setGraphViewState,
    } = currentProgram();
    const [viewMode, setViewMode] = useState("table");

    // Catalog state
    const [catalog, setCatalog] = useState([]);
    const [loadingCatalog, setLoadingCatalog] = useState(false);
    const [catalogError, setCatalogError] = useState("");
    const [ruleCheckState, setRuleCheckState] = useState({
        sending: false,
        error: "",
        response: null,
        lastUpdatedAt: null,
    });
    const [isRuleDashboardOpen, setIsRuleDashboardOpen] = useState(false);
    const [isSteopInfoOpen, setIsSteopInfoOpen] = useState(false);
    const [isFocusInfoOpen, setIsFocusInfoOpen] = useState(false);
    const [stickyViolation, setStickyViolation] = useState({ message: "", until: 0 });
    const subjectColors = useMemo(
        () => createExamSubjectColorMap((catalog || []).map((pf) => pf?.pruefungsfach).filter(Boolean)),
        [catalog]
    );

    // React Flow refs
    const wrapperRef = useRef(null);
    const rfRef = useRef(null);
    const groupDragRef = useRef(new Map()); // Map<groupId, { lastX, lastY }>
    const latestRuleCheckChangeIdRef = useRef(null);
    const pendingInitialSyncProgramRef = useRef(programCode);

    // Fetch & normalize catalog whenever programCode changes
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingCatalog(true);
            setCatalogError("");
            try {
                const raw = await fetchCatalog(programCode);
                if (cancelled) return;
                setCatalog(normalizeCatalog(raw));
            } catch (e) {
                if (cancelled) return;
                console.error(e);
                setCatalog([]);
                setCatalogError(String(e?.message || e));
            } finally {
                if (!cancelled) setLoadingCatalog(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [programCode]);

    // Lane background columns (static)
    const laneNodes = useMemo(
        () =>
            SEMESTERS.map((s, i) => ({
                id: `lane-${s.id}`,
                type: "lane",
                data: { title: s.title, even: i % 2 === 0 },
                position: { x: i * 340 /* fallback for LANE_WIDTH+LANE_GAP */, y: 0 },
                draggable: false,
                selectable: false,
                zIndex: 0,
                style: { height: CANVAS_HEIGHT },
            })),
        []
    );

    // React Flow state
    const initialNodes = useMemo(() => [...laneNodes], [laneNodes]);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

    // Persist scheduling flag – set to true to persist after the next commit
    const [needsPersist, setNeedsPersist] = useState(false);

    // Changing the study program invalidates placed nodes from the previous catalog.
    // Keep only empty lane backgrounds and clear persisted semester storage.
    useEffect(() => {
        setNodes([...laneNodes]);
        setCoursesFromNodes([]);
        setNeedsPersist(false);
        pendingInitialSyncProgramRef.current = programCode;
    }, [programCode, laneNodes, setNodes, setCoursesFromNodes]);

    /***********************
     * Sidebar drag & drop *
     ***********************/
    const handleDragStart = useCallback((e, payload) => {
        e.dataTransfer.setData("application/x-course", JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "move";
    }, []);

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }, []);

    /***********************
     * Node remove helpers *
     ***********************/
    const removeCourseNode = useCallback((id) => {
        setNodes((prev) => {
            const victim = prev.find((n) => n.id === id);
            const groupId = victim?.data?.groupId;
            let next = prev.filter((n) => n.id !== id);
            if (groupId) next = recomputeGroupFromChildren(next, groupId);
            return next;
        });
        setNeedsPersist(true);
    }, [setNodes]);

    const removeModuleGroup = useCallback((groupId) => {
        setNodes((prev) => prev.filter((n) => n.id !== groupId && n.data?.groupId !== groupId));
        setNeedsPersist(true);
    }, [setNodes]);

    const rollbackAddedCourses = useCallback((change) => {
        const addedIds = Array.isArray(change?.added) ? change.added.map((a) => a?.id).filter(Boolean) : [];
        if (!addedIds.length) return;

        setNodes((prev) => {
            let next = prev.filter((n) => !addedIds.includes(n.id));
            const affectedGroupIds = new Set(
                prev
                    .filter((n) => addedIds.includes(n.id) && n.type === "course" && n.data?.groupId)
                    .map((n) => n.data.groupId)
            );

            for (const groupId of affectedGroupIds) {
                next = recomputeGroupFromChildren(next, groupId);
            }
            return next;
        });
        setNeedsPersist(true);
    }, [setNodes]);

    const rollbackCourseStatusToggle = useCallback((change) => {
        if (change?.type !== "course_status_toggled") return;
        const courseCode = change?.courseCode;
        if (!courseCode) return;

        const attemptedDone = change?.toStatus === "done";
        const revertedDone = !attemptedDone;

        setCourseDone(courseCode, revertedDone);
        setNodes((prev) => prev.map((n) => {
            if (n.type !== "course" || n?.data?.code !== courseCode) return n;
            return { ...n, data: { ...n.data, status: revertedDone ? "done" : "in_plan" } };
        }));
    }, [setCourseDone, setNodes]);

    const toggleCourseDone = useCallback((courseCode, nextDone, nodeId) => {
        setCourseDone(courseCode, nextDone);
        setNodes((prev) => prev.map((n) => {
            if (n.id !== nodeId) return n;
            return { ...n, data: { ...n.data, status: nextDone ? "done" : "in_plan" } };
        }));
    }, [setCourseDone, setNodes]);

    const updateCourseEcts = useCallback((nodeId, nextEcts) => {
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

    const addGraphCourseToPlan = useCallback((course, requestedLaneIndex) => {
        const courseCode = course?.code;
        if (!courseCode || getCourseStatus(courseCode) !== "todo") return false;

        const laneIndex = Math.max(0, Math.min(Number(requestedLaneIndex) || 0, SEMESTERS.length - 1));
        const x = centerX(laneIndex);
        const now = Date.now();
        const id = `${courseCode}-${now}-graph`;
        const examSubject = course?.examSubject || getExamSubjectForCode(catalog, courseCode);
        const resolvedSubjectColor =
            course?.subjectColor ||
            (examSubject ? subjectColors?.[examSubject] : null) ||
            "#2563eb";

        let persistedNodes = null;
        let added = false;
        setNodes((prev) => {
            if (prev.some((n) => n.type === "course" && n?.data?.code === courseCode)) return prev;

            const laneNodes = prev
                .filter((n) => n.type === "course" && laneIdx(n) === laneIndex)
                .sort((a, b) => (a?.position?.y ?? 0) - (b?.position?.y ?? 0));
            const last = laneNodes[laneNodes.length - 1];
            const y = last ? (last.position.y + NODE_HEIGHT + COLLISION_GAP) : 96;

            const next = prev.concat({
                id,
                type: "course",
                data: {
                    label: course?.name || courseCode,
                    code: courseCode,
                    ects: course?.ects ?? null,
                    onRemove: removeCourseNode,
                    onToggleDone: toggleCourseDone,
                    onUpdateEcts: updateCourseEcts,
                    nodeId: id,
                    examSubject,
                    category: course?.category ?? "unknown",
                    subjectColor: resolvedSubjectColor,
                    status: "in_plan",
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
    }, [catalog, getCourseStatus, removeCourseNode, setCoursesFromNodes, setNodes, subjectColors, toggleCourseDone, updateCourseEcts]);

    const addGraphModuleToPlan = useCallback((modulePayload, requestedLaneIndex) => {
        const courses = Array.isArray(modulePayload?.courses) ? modulePayload.courses : [];
        if (courses.length < 2) return false;
        const codes = courses.map((c) => c?.code).filter(Boolean);
        if (!codes.length) return false;
        if (codes.some((code) => getCourseStatus(code) !== "todo")) return false;

        const laneIndex = Math.max(0, Math.min(Number(requestedLaneIndex) || 0, SEMESTERS.length - 1));
        const x = centerX(laneIndex);
        const y = 96;
        const now = Date.now();
        const groupId = `mod-${now}-graph`;
        const groupExamSubject =
            modulePayload?.examSubject ||
            getExamSubjectForCode(catalog, modulePayload?.code) ||
            getExamSubjectForCode(catalog, courses?.[0]?.code) ||
            null;
        const resolvedSubjectColor =
            modulePayload?.subjectColor ||
            (groupExamSubject ? subjectColors?.[groupExamSubject] : null) ||
            "#2563eb";

        const groupNode = {
            id: groupId,
            type: "moduleBg",
            data: {
                title: `${modulePayload?.name || "Module"}`,
                code: null,
                groupId,
                onRemoveGroup: removeModuleGroup,
                onRemove: () => removeModuleGroup(groupId),
                examSubject: groupExamSubject,
                category: modulePayload?.category ?? "unknown",
                subjectColor: resolvedSubjectColor,
            },
            position: { x, y },
            draggable: true,
            selectable: false,
            zIndex: 0,
        };

        const childCourseNodes = courses.map((course, idx) => {
            const childId = `${course.code}-${now}-${idx}-graph`;
            const baseY = y + idx * (56 + 8);
            const examSubject =
                getExamSubjectForCode(catalog, course.code) || getExamSubjectForCode(catalog, modulePayload?.code);

            return {
                id: childId,
                type: "course",
                data: {
                    label: course?.name || course?.code || "Course",
                    code: course?.code,
                    ects: course?.ects ?? null,
                    groupId,
                    baseY,
                    onRemove: removeCourseNode,
                    onToggleDone: toggleCourseDone,
                    onUpdateEcts: updateCourseEcts,
                    nodeId: childId,
                    examSubject,
                    category: modulePayload?.category ?? "unknown",
                    subjectColor: resolvedSubjectColor,
                    status: "in_plan",
                },
                position: { x, y: baseY },
                sourcePosition: "right",
                targetPosition: "left",
                zIndex: 1,
            };
        });

        let persistedNodes = null;
        let added = false;
        setNodes((prev) => {
            if (codes.some((code) => prev.some((n) => n.type === "course" && n?.data?.code === code))) return prev;
            const withAll = prev.concat(groupNode, ...childCourseNodes);
            const sized = recomputeGroupFromChildren(withAll, groupId);
            const resolved = resolveLaneCollisions(sized);
            persistedNodes = resolved.filter((n) => n.type !== "lane");
            added = true;
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
    }, [catalog, getCourseStatus, removeCourseNode, removeModuleGroup, setCoursesFromNodes, setNodes, subjectColors, toggleCourseDone, updateCourseEcts]);

    const toggleGraphCourseDone = useCallback((courseCode, nextDone) => {
        if (!courseCode) return;
        const currentStatus = getCourseStatus(courseCode);
        if (currentStatus !== "in_plan" && currentStatus !== "done") return;

        setCourseDone(courseCode, Boolean(nextDone));
        setNodes((prev) => prev.map((n) => {
            if (n.type !== "course" || n?.data?.code !== courseCode) return n;
            return { ...n, data: { ...n.data, status: nextDone ? "done" : "in_plan" } };
        }));
    }, [getCourseStatus, setCourseDone, setNodes]);

    const toggleGraphModuleDone = useCallback((courseCodes, nextDone) => {
        const codes = Array.isArray(courseCodes) ? courseCodes.filter(Boolean) : [];
        if (!codes.length) return;
        const allowed = codes.filter((code) => {
            const status = getCourseStatus(code);
            return status === "in_plan" || status === "done";
        });
        if (!allowed.length) return;
        for (const code of allowed) {
            setCourseDone(code, Boolean(nextDone));
        }
        setNodes((prev) => prev.map((n) => {
            if (n.type !== "course" || !allowed.includes(n?.data?.code)) return n;
            return { ...n, data: { ...n.data, status: nextDone ? "done" : "in_plan" } };
        }));
    }, [getCourseStatus, setCourseDone, setNodes]);

    const removeGraphCoursesFromPlan = useCallback((courseCodes) => {
        const codes = Array.isArray(courseCodes) ? courseCodes.filter(Boolean) : [];
        if (!codes.length) return false;
        const removeSet = new Set(codes);

        let persistedNodes = null;
        let changed = false;
        setNodes((prev) => {
            const affectedGroupIds = new Set(
                prev
                    .filter((n) => n.type === "course" && removeSet.has(n?.data?.code) && n?.data?.groupId)
                    .map((n) => n.data.groupId)
            );
            let next = prev.filter((n) => !(n.type === "course" && removeSet.has(n?.data?.code)));
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

    const removeGraphCourseFromPlan = useCallback((courseCode) => {
        if (!courseCode) return false;
        return removeGraphCoursesFromPlan([courseCode]);
    }, [removeGraphCoursesFromPlan]);

    const removeGraphModuleFromPlan = useCallback((modulePayload) => {
        const codes = Array.isArray(modulePayload?.courses)
            ? modulePayload.courses.map((c) => c?.code).filter(Boolean)
            : [];
        if (!codes.length) return false;
        return removeGraphCoursesFromPlan(codes);
    }, [removeGraphCoursesFromPlan]);

    /************************
     * Group drag mechanics *
     ************************/
    const onNodeDragStart = useCallback((_, node) => {
        if (node?.type !== "moduleBg") return;
        groupDragRef.current.set(node.id, { lastX: node.position.x, lastY: node.position.y });
    }, []);

    const onNodeDrag = useCallback((_, node) => {
        if (node?.type !== "moduleBg") return;
        const st = groupDragRef.current.get(node.id) || { lastX: node.position.x, lastY: node.position.y };
        const dx = node.position.x - st.lastX;
        const dy = node.position.y - st.lastY;
        if (dx === 0 && dy === 0) return;
        groupDragRef.current.set(node.id, { lastX: node.position.x, lastY: node.position.y });
        setNodes((prev) =>
            prev.map((n) => (n.type === "course" && n.data?.groupId === node.id
                ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
                : n))
        );
    }, [setNodes]);

    /** Mark that we should persist after the next nodes commit. */
    const schedulePersist = useCallback(() => setNeedsPersist(true), []);

    // Debug logging (kept, but behind dev-only guard if you add one later)
    useEffect(() => {
        // eslint-disable-next-line no-console
        console.log("Full frontend plan storage:", coursesBySemester);
    }, [coursesBySemester]);

    // Persist storage once, right after nodes changed (drop or drag-stop)
    useEffect(() => {
        if (!needsPersist) return;
        const latestNodes = (rfRef.current?.getNodes?.() || nodes).filter((n) => n.type !== "lane");
        setCoursesFromNodes(latestNodes);
        setNeedsPersist(false);
    }, [needsPersist, nodes, setCoursesFromNodes]);

    // Keep node status visuals in sync with persisted done-state.
    useEffect(() => {
        const doneSet = new Set(doneCourseCodes || []);
        setNodes((prev) => prev.map((n) => {
            if (n.type !== "course") return n;
            const status = doneSet.has(n?.data?.code) ? "done" : "in_plan";
            if (n?.data?.status === status) return n;
            return { ...n, data: { ...n.data, status } };
        }));
    }, [doneCourseCodes, setNodes]);

    // Notify backend rule-check endpoint on each plan/status change.
    useEffect(() => {
        if (!lastPlanChange) return;
        latestRuleCheckChangeIdRef.current = lastPlanChange.id ?? null;
        const doneSet = new Set(doneCourseCodes || []);
        const allCourses = Object.values(coursesBySemester || {}).flat();
        const doneCourses = allCourses.filter((c) => c?.code && doneSet.has(c.code));
        const plannedCourses = allCourses.filter((c) => c?.code && !doneSet.has(c.code));
        const changeSnapshot = lastPlanChange;
        const changeIdSnapshot = changeSnapshot.id ?? null;

        setRuleCheckState((prev) => ({ ...prev, sending: true, error: "" }));
        sendRuleCheckUpdate({
            programCode,
            plannedCourses,
            doneCourses,
            change: changeSnapshot,
            selectedFocus: programCode === BACHELOR_PROGRAM_CODE ? (selectedFocus || null) : null,
        })
            .then((response) => {
                if (latestRuleCheckChangeIdRef.current !== changeIdSnapshot) return;
                setRuleCheckState({
                    sending: false,
                    error: "",
                    response,
                    lastUpdatedAt: Date.now(),
                });

                const isAddChange =
                    changeSnapshot?.type === "plan_updated" &&
                    Array.isArray(changeSnapshot?.added) &&
                    changeSnapshot.added.length > 0;
                if (isAddChange && response?.ok === false) {
                    setStickyViolation({
                        message: response?.message || "Rule violation: change rejected.",
                        until: Date.now() + 5000,
                    });
                    rollbackAddedCourses(changeSnapshot);
                }
                const isStatusToggleChange = changeSnapshot?.type === "course_status_toggled";
                if (isStatusToggleChange && response?.ok === false) {
                    setStickyViolation({
                        message: response?.message || "Rule violation: change rejected.",
                        until: Date.now() + 5000,
                    });
                    rollbackCourseStatusToggle(changeSnapshot);
                }
            })
            .catch((err) => {
                if (latestRuleCheckChangeIdRef.current !== changeIdSnapshot) return;
                console.error("Failed to send rulecheck update", err);
                setStickyViolation({
                    message: String(err?.message || err),
                    until: Date.now() + 5000,
                });
                setRuleCheckState((prev) => ({
                    ...prev,
                    sending: false,
                    error: String(err?.message || err),
                    lastUpdatedAt: Date.now(),
                }));
            });
    }, [coursesBySemester, doneCourseCodes, lastPlanChange, programCode, rollbackAddedCourses, rollbackCourseStatusToggle, selectedFocus]);

    // Initial sync for current program so dashboard has data before first edit.
    useEffect(() => {
        if (pendingInitialSyncProgramRef.current !== programCode) return;
        const allCourses = Object.values(coursesBySemester || {}).flat();
        // Wait until program switch reset has cleared previous-plan courses.
        if (allCourses.length > 0) return;

        const doneSet = new Set(doneCourseCodes || []);
        const doneCourses = allCourses.filter((c) => c?.code && doneSet.has(c.code));
        const plannedCourses = allCourses.filter((c) => c?.code && !doneSet.has(c.code));

        setRuleCheckState((prev) => ({ ...prev, sending: true, error: "" }));
        sendRuleCheckUpdate({
            programCode,
            plannedCourses,
            doneCourses,
            change: { type: "initial_sync" },
            selectedFocus: programCode === BACHELOR_PROGRAM_CODE ? (selectedFocus || null) : null,
        })
            .then((response) => {
                setRuleCheckState({
                    sending: false,
                    error: "",
                    response,
                    lastUpdatedAt: Date.now(),
                });
                pendingInitialSyncProgramRef.current = null;
            })
            .catch((err) => {
                setRuleCheckState((prev) => ({
                    ...prev,
                    sending: false,
                    error: String(err?.message || err),
                    lastUpdatedAt: Date.now(),
                }));
                pendingInitialSyncProgramRef.current = null;
            });
    }, [coursesBySemester, doneCourseCodes, programCode, selectedFocus]);

    useEffect(() => {
        if (!stickyViolation?.message) return;
        const waitMs = Math.max(0, (stickyViolation.until || 0) - Date.now());
        const t = window.setTimeout(() => {
            setStickyViolation({ message: "", until: 0 });
        }, waitMs);
        return () => window.clearTimeout(t);
    }, [stickyViolation]);

    /***************************
     * Snap & collision resolve *
     ***************************/
    const onNodeDragStop = useCallback((_, node) => {
        const li = laneIndexFromX(node.position.x);
        const snappedX = centerX(li);
        const snappedY = Math.max(0, Math.round(node.position.y / GRID_SIZE) * GRID_SIZE);

        // If a whole module group was dragged: shift children by the snap delta, snap the group,
        // then recompute the group bbox, and resolve collisions.
        if (node?.type === "moduleBg") {
            const dxSnap = snappedX - node.position.x;
            const dySnap = snappedY - node.position.y;
            setNodes((prev) => {
                const moved = prev.map((n) => {
                    if (n.id === node.id) return { ...n, position: { x: snappedX, y: snappedY } };
                    if (n.type === "course" && n.data?.groupId === node.id) {
                        return { ...n, position: { x: n.position.x + dxSnap, y: n.position.y + dySnap } };
                    }
                    return n;
                });
                const sized = recomputeGroupFromChildren(moved, node.id);
                return resolveLaneCollisions(sized);
            });
            groupDragRef.current.delete(node.id);
            return;
        }

        // Course inside a group → snap only the course, then recompute the group bbox
        if (node?.type === "course" && node?.data?.groupId) {
            const groupId = node.data.groupId;
            setNodes((prev) => {
                const updated = prev.map((n) => (n.id === node.id ? { ...n, position: { x: snappedX, y: snappedY } } : n));
                return resolveLaneCollisions(recomputeGroupFromChildren(updated, groupId));
            });
            return;
        }

        // All other nodes: normal snapping + collision resolution
        setNodes((prev) => {
            const next = prev.map((n) => (n.id === node.id ? { ...n, position: { x: snappedX, y: snappedY } } : n));
            return resolveLaneCollisions(next);
        });
    }, [setNodes]);

    // Merge: run drag-stop logic, then schedule a persist
    const onNodeDragStopMerged = useCallback((evt, node) => {
        onNodeDragStop(evt, node);
        schedulePersist();
    }, [onNodeDragStop, schedulePersist]);

    // Handle drop from the sidebar
    const onDrop = useCallback(
        (evt) => {
            evt.preventDefault();
            const raw = evt.dataTransfer.getData("application/x-course");
            if (!raw) return;

            let payload;
            try {
                payload = JSON.parse(raw);
            } catch {
                return;
            }

            const { x, y } = projectToLaneAndSnap({ evt, wrapperEl: wrapperRef.current, rfInstance: rfRef.current });
            const now = Date.now();

            // A) Module with >= 2 courses → create group + children
            if (payload?.kind === "module" && Array.isArray(payload.courses) && payload.courses.length >= 2) {
                const groupId = `mod-${now}`;
                const groupExamSubject =
                    getExamSubjectForCode(catalog, payload.code) ||
                    getExamSubjectForCode(catalog, payload.courses?.[0]?.code) ||
                    null;
                const resolvedSubjectColor =
                    payload.subjectColor ||
                    (groupExamSubject ? subjectColors?.[groupExamSubject] : null) ||
                    "#2563eb";

                const groupNode = {
                    id: groupId,
                    type: "moduleBg",
                    data: {
                        title: `${payload.name}`,
                        code: null,
                        groupId,
                        onRemoveGroup: removeModuleGroup,
                        onRemove: () => removeModuleGroup(groupId),
                        examSubject: groupExamSubject,
                        category: payload.category ?? "unknown",
                        subjectColor: resolvedSubjectColor,
                    },
                    position: { x, y }, // preliminary; will be resized by recomputeGroupFromChildren
                    draggable: true,
                    selectable: false,
                    zIndex: 0,
                };

                const childCourseNodes = payload.courses.map((course, idx) => {
                    const childId = `${course.code}-${now}-${idx}`;
                    const baseY = y + idx * (56 /* NODE_HEIGHT */ + 8 /* COURSE_VERTICAL_GAP */);
                    const examSubject =
                        getExamSubjectForCode(catalog, course.code) || getExamSubjectForCode(catalog, payload.code);

                    return {
                        id: childId,
                        type: "course",
                        data: {
                            label: course.name,
                            code: course.code,
                            ects: course.ects ?? null,
                            groupId,
                            baseY,
                            onRemove: removeCourseNode,
                            onToggleDone: toggleCourseDone,
                            onUpdateEcts: updateCourseEcts,
                            nodeId: childId,
                            examSubject,
                            category: payload.category ?? "unknown",
                            subjectColor: resolvedSubjectColor,
                            status: getCourseStatus(course.code),
                        },
                        position: { x, y: baseY },
                        sourcePosition: "right",
                        targetPosition: "left",
                        zIndex: 1,
                    };
                });

                setNodes((prev) => {
                    const withAll = prev.concat(groupNode, ...childCourseNodes);
                    const sized = recomputeGroupFromChildren(withAll, groupId);
                    return resolveLaneCollisions(sized);
                });
                schedulePersist();
                return;
            }

            // B) Single course card (or module with a single course treated as course)
            const id = `${payload.code}-${now}`;
            const examSubject = getExamSubjectForCode(catalog, payload.code);
            const resolvedSubjectColor =
                payload.subjectColor ||
                (examSubject ? subjectColors?.[examSubject] : null) ||
                "#2563eb";
            setNodes((prev) => {
                const next = prev.concat({
                    id,
                    type: "course",
                    data: {
                        label: payload.name,
                        code: payload.code,
                        ects: payload.ects ?? null,
                        onRemove: removeCourseNode,
                        onToggleDone: toggleCourseDone,
                        onUpdateEcts: updateCourseEcts,
                        nodeId: id,
                        examSubject,
                        category: payload.category ?? "unknown",
                        subjectColor: resolvedSubjectColor,
                        status: getCourseStatus(payload.code),
                    },
                    position: { x, y },
                    sourcePosition: "right",
                    targetPosition: "left",
                    zIndex: 1,
                });
                return resolveLaneCollisions(next);
            });
            schedulePersist();
        },
        [catalog, getCourseStatus, removeCourseNode, removeModuleGroup, subjectColors, toggleCourseDone, updateCourseEcts]
    );

    /***************************************
     * Sidebar expand/collapse (per subject)
     ***************************************/
    const [expandedPf, setExpandedPf] = useState(new Set());
    const togglePf = useCallback((name) => {
        setExpandedPf((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    }, []);

    /****************************
     * Collision avoidance utils *
     ****************************/
    function nodeBBox(n) {
        if (n.type === "course") {
            return {
                x1: n.position.x,
                y1: n.position.y,
                x2: n.position.x + CARD_WIDTH,
                y2: n.position.y + NODE_HEIGHT,
                h: NODE_HEIGHT,
            };
        }
        if (n.type === "moduleBg") {
            const w = Number(n?.data?.width) || CARD_WIDTH + 2 * GROUP_PADDING_X;
            const h = Number(n?.data?.height) || NODE_HEIGHT + MODULE_HEADER_HEIGHT + 2 * GROUP_PADDING_Y;
            return { x1: n.position.x, y1: n.position.y, x2: n.position.x + w, y2: n.position.y + h, h };
        }
        return { x1: n.position.x, y1: n.position.y, x2: n.position.x, y2: n.position.y, h: 0 };
    }

    function isRelevantForCollision(n) {
        // Avoid collisions between: single courses (not in a group) and module groups.
        // Courses inside groups are handled by the group's own layout.
        return n.type === "moduleBg" || (n.type === "course" && !n.data?.groupId);
    }

    function applyDeltaToGroupChildren(nodes, groupId, dx, dy) {
        if (!groupId || (dx === 0 && dy === 0)) return nodes;
        return nodes.map((n) =>
            n.type === "course" && n.data?.groupId === groupId
                ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
                : n
        );
    }

    /**
     * Resolve vertical overlaps per lane among module groups and un-grouped course nodes.
     * Strategy: sort by Y, then push each down if it touches the previous (with COLLISION_GAP).
     * If a moduleBg is moved, shift its children by the same delta.
     */
    function resolveLaneCollisions(allNodes) {
        let nodes = allNodes.slice(); // defensive copy

        // Group by lane index
        const lanes = new Map();
        for (const n of nodes) {
            if (!isRelevantForCollision(n)) continue;
            const li = laneIdx(n);
            if (!lanes.has(li)) lanes.set(li, []);
            lanes.get(li).push(n.id);
        }

        for (const ids of lanes.values()) {
            const laneNodes = ids
                .map((id) => nodes.find((n) => n.id === id))
                .filter(Boolean)
                .sort((a, b) => a.position.y - b.position.y);

            let prev = null;
            for (const curr of laneNodes) {
                if (!prev) {
                    prev = curr;
                    continue;
                }
                const prevB = nodeBBox(prev);
                const curB = nodeBBox(curr);
                const minY = prevB.y2 + COLLISION_GAP; // previous bottom + gap
                if (curB.y1 < minY) {
                    const dy = minY - curB.y1;
                    nodes = nodes.map((n) => (n.id === curr.id ? { ...n, position: { x: n.position.x, y: n.position.y + dy } } : n));
                    if (curr.type === "moduleBg") nodes = applyDeltaToGroupChildren(nodes, curr.id, 0, dy);
                    // update working copy for subsequent comparisons
                    const idx = laneNodes.findIndex((ln) => ln.id === curr.id);
                    if (idx !== -1) laneNodes[idx] = { ...curr, position: { x: curr.position.x, y: curr.position.y + dy } };
                }
                prev = laneNodes.find((ln) => ln.id === curr.id) || curr;
            }
        }
        return nodes;
    }

    /***********
     * Render  *
     ***********/
    const ruleOk = Boolean(ruleCheckState.response?.ok);
    const ruleStats = ruleCheckState.response?.stats ?? {};
    const isBachelorDashboard = programCode === BACHELOR_PROGRAM_CODE;
    const ectsStats = ruleStats?.ects ?? {};
    const allPlannedCourses = Object.values(coursesBySemester || {}).flat();
    const doneCodesSet = new Set(doneCourseCodes || []);
    const doneEctsKpi = allPlannedCourses
        .filter((c) => c?.code && doneCodesSet.has(c.code))
        .reduce((sum, c) => sum + Number(c?.ects || 0), 0);
    const plannedEctsKpi = allPlannedCourses
        .filter((c) => c?.code && !doneCodesSet.has(c.code))
        .reduce((sum, c) => sum + Number(c?.ects || 0), 0);
    const totalEctsKpi = doneEctsKpi + plannedEctsKpi;
    const targetEctsKpi = isBachelorDashboard ? 180 : Number(ectsStats?.target_total ?? 120);
    const buckets = ruleStats?.buckets ?? {};
    const perSemester = isBachelorDashboard ? (ruleStats?.ectsPerSemester ?? {}) : (ruleStats?.per_semester ?? {});
    const byCategory = isBachelorDashboard ? (ruleStats?.ectsByCategory ?? {}) : (ruleStats?.by_category ?? {});
    const byExamSubject = isBachelorDashboard ? (ruleStats?.ectsByExamSubject ?? {}) : (ruleStats?.by_exam_subject ?? {});
    const bachelorTotalEcts = Number(ruleStats?.totalEcts ?? 0);
    const bachelorMissingTo180 = Number(ruleStats?.ectsMissingTo180 ?? 0);
    const bachelorNarrow = ruleStats?.narrowElectives ?? {};
    const bachelorFocus = ruleStats?.focus ?? {};
    const bachelorTransferableEcts = Number(byCategory?.transferable_skills ?? 0);
    const bachelorNarrowCompleted = Number(bachelorNarrow?.completedCount ?? 0);
    const bachelorNarrowRequired = Number(bachelorNarrow?.requiredCount ?? 7);
    const normalizeSteopKey = (value) =>
        String(value || "")
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    const steopMandatoryTagByKey = {
        [normalizeSteopKey("Einführung in die Programmierung 1")]: "eidi1",
        [normalizeSteopKey("EIDI1-VU")]: "eidi1",
        [normalizeSteopKey("Mathematisches Arbeiten")]: "ma",
        [normalizeSteopKey("MA-VU")]: "ma",
        [normalizeSteopKey("Orientierung Informatik und Wirtschaftsinformatik")]: "ori",
        [normalizeSteopKey("ORI-VU")]: "ori",
    };
    const steopPoolKeys = new Set([
        "Algebra und Diskrete Mathematik",
        "Analysis",
        "Denkweisen der Informatik",
        "Grundzüge digitaler Systeme",
        "ADM-VO",
        "ADM-UE",
        "ADM-VU",
        "ANL-VO",
        "ANL-UE",
        "ANL-VU",
        "DWI-VU",
        "GDS-VU",
    ].map(normalizeSteopKey));
    const steopMandatoryEctsByTag = { eidi1: 5.5, ma: 2.0, ori: 1.0 };
    const steopMandatoryRequiredEcts = 8.5;
    const steopPoolRequiredEcts = 8.0;
    const steopRequiredEcts = steopMandatoryRequiredEcts + steopPoolRequiredEcts;
    const steopTagOfCourse = (course) => {
        const codeKey = normalizeSteopKey(course?.code || course?.name);
        const moduleKey = normalizeSteopKey(course?.module?.title);
        return steopMandatoryTagByKey[codeKey] || steopMandatoryTagByKey[moduleKey] || null;
    };
    const isSteopPoolCourse = (course) => {
        const codeKey = normalizeSteopKey(course?.code || course?.name);
        const moduleKey = normalizeSteopKey(course?.module?.title);
        return steopPoolKeys.has(codeKey) || steopPoolKeys.has(moduleKey);
    };
    const computeSteopProgress = (courses) => {
        const tags = new Set();
        let pool = 0;
        for (const c of courses || []) {
            const tag = steopTagOfCourse(c);
            if (tag) tags.add(tag);
            if (isSteopPoolCourse(c)) pool += Number(c?.ects || 0);
        }
        const mandatoryEcts = [...tags].reduce((sum, tag) => sum + Number(steopMandatoryEctsByTag[tag] ?? 0), 0);
        return {
            mandatoryEcts,
            poolEcts: pool,
            totalEcts: mandatoryEcts + pool,
            tags,
        };
    };
    const doneCoursesLocal = allPlannedCourses.filter((c) => c?.code && doneCodesSet.has(c.code));
    const steopDoneProgress = computeSteopProgress(doneCoursesLocal);
    const steopMandatoryDoneEcts = steopDoneProgress.mandatoryEcts;
    const steopPoolDoneEcts = steopDoneProgress.poolEcts;
    const steopDoneEcts = steopMandatoryDoneEcts + steopPoolDoneEcts;
    const bachelorSteopComplete =
        steopDoneProgress.tags.has("eidi1") &&
        steopDoneProgress.tags.has("ma") &&
        steopDoneProgress.tags.has("ori") &&
        steopPoolDoneEcts >= steopPoolRequiredEcts - 1e-6;
    let bachelorSteopLane = null;
    if (doneCoursesLocal.length > 0) {
        const doneByLane = new Map();
        for (const c of doneCoursesLocal) {
            const li = Number.isFinite(c?.laneIndex) ? c.laneIndex : 0;
            if (!doneByLane.has(li)) doneByLane.set(li, []);
            doneByLane.get(li).push(c);
        }
        const cumTags = new Set();
        let cumPool = 0;
        for (const li of [...doneByLane.keys()].sort((a, b) => a - b)) {
            for (const c of doneByLane.get(li)) {
                const tag = steopTagOfCourse(c);
                if (tag) cumTags.add(tag);
                if (isSteopPoolCourse(c)) cumPool += Number(c?.ects || 0);
            }
            if (cumTags.has("eidi1") && cumTags.has("ma") && cumTags.has("ori") && cumPool >= steopPoolRequiredEcts - 1e-6) {
                bachelorSteopLane = li;
                break;
            }
        }
    }
    const warnings = Array.isArray(ruleStats?.warnings) ? ruleStats.warnings : [];
    const bachelorFocusMissingCount = Number(bachelorFocus?.missingCount ?? 0);
    const bachelorFocusComplete = selectedFocus && bachelorFocus?.recognized && bachelorFocusMissingCount === 0;
    const violations = Array.isArray(ruleStats?.violations) ? ruleStats.violations : [];
    const missingItems = Array.isArray(ruleCheckState.response?.missing) ? ruleCheckState.response.missing : [];
    const stickyActive = Boolean(stickyViolation?.message) && Date.now() < (stickyViolation?.until || 0);
    const feedbackText = stickyActive
        ? stickyViolation.message
        : (ruleCheckState.sending
        ? "Checking rules..."
        : (ruleCheckState.error
            ? `Rule check error: ${ruleCheckState.error}`
            : (ruleCheckState.response
                ? (ruleCheckState.response?.message ?? "Rule check updated")
                : "No rule check response yet")));
    const feedbackBg = stickyActive
        ? "#fee2e2"
        : (ruleCheckState.sending ? "#dbeafe" : (ruleCheckState.error ? "#fee2e2" : (ruleOk ? "#dcfce7" : "#f3f4f6")));
    const feedbackBorder = stickyActive
        ? "#fca5a5"
        : (ruleCheckState.sending ? "#93c5fd" : (ruleCheckState.error ? "#fca5a5" : (ruleOk ? "#86efac" : "#d1d5db")));
    const feedbackColor = stickyActive
        ? "#991b1b"
        : (ruleCheckState.sending ? "#1d4ed8" : (ruleCheckState.error ? "#991b1b" : (ruleOk ? "#166534" : "#374151")));

    if (viewMode === "graph") {
        return (
            <div style={{ display: "flex", height: "100vh", width: "100vw", background: "#f9fafb" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <CurriculumGraphView
                        catalog={catalog}
                        subjectColors={subjectColors}
                        onSwitchToTable={() => setViewMode("table")}
                        programCode={programCode}
                        setProgramCode={setProgramCode}
                        programOptions={PROGRAM_OPTIONS}
                        selectedFocus={selectedFocus}
                        setSelectedFocus={setSelectedFocus}
                        bachelorProgramCode={BACHELOR_PROGRAM_CODE}
                        bachelorFocusOptions={BACHELOR_FOCUS_OPTIONS}
                        getCourseStatus={getCourseStatus}
                        onAddToPlan={addGraphCourseToPlan}
                        onToggleDone={toggleGraphCourseDone}
                        onAddModuleToPlan={addGraphModuleToPlan}
                        onToggleModuleDone={toggleGraphModuleDone}
                        onRemoveFromPlan={removeGraphCourseFromPlan}
                        onRemoveModuleFromPlan={removeGraphModuleFromPlan}
                        graphViewState={graphViewState}
                        setGraphViewState={setGraphViewState}
                        isRuleDashboardOpen={isRuleDashboardOpen}
                        onToggleRuleDashboard={() => setIsRuleDashboardOpen((v) => !v)}
                        ruleFeedback={{
                            text: feedbackText,
                            bg: feedbackBg,
                            border: feedbackBorder,
                            color: feedbackColor,
                        }}
                    />
                </div>
                {isRuleDashboardOpen && (
                    <aside
                        style={{
                            width: 420,
                            borderLeft: "1px solid #e5e7eb",
                            background: "#ffffff",
                            padding: 12,
                            overflow: "auto",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>Rule Engine Dashboard</div>
                            <button
                                onClick={() => setIsRuleDashboardOpen(false)}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    borderRadius: 8,
                                    padding: "6px 10px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                Close
                            </button>
                        </div>

                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>Program: {programCode}</div>
                        {programCode === BACHELOR_PROGRAM_CODE && (
                            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>Focus: {selectedFocus || "-"}</div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>Done ECTS</div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>{doneEctsKpi.toFixed(1)}</div>
                            </div>
                            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>Planned ECTS</div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>{plannedEctsKpi.toFixed(1)}</div>
                            </div>
                            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>Total ECTS</div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>{totalEctsKpi.toFixed(1)}</div>
                            </div>
                            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>Target ECTS</div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>{targetEctsKpi.toFixed(1)}</div>
                            </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Missing Requirements</div>
                            <div style={{ display: "grid", gap: 6 }}>
                                {missingItems.length === 0 && <div style={{ fontSize: 12, color: "#166534" }}>No missing requirements reported.</div>}
                                {missingItems.map((m, idx) => (
                                    <div key={`${m}-${idx}`} style={{ fontSize: 12, color: "#991b1b" }}>{m}</div>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Warnings</div>
                            <div style={{ display: "grid", gap: 6 }}>
                                {warnings.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>No warnings.</div>}
                                {warnings.map((w, idx) => (
                                    <div key={`${w}-${idx}`} style={{ fontSize: 12, color: "#92400e" }}>{w}</div>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Violations</div>
                            <div style={{ display: "grid", gap: 6 }}>
                                {violations.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>No violations.</div>}
                                {violations.map((v, idx) => (
                                    <div key={`${v}-${idx}`} style={{ fontSize: 12, color: "#991b1b" }}>{v}</div>
                                ))}
                            </div>
                        </div>

                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                            Last update: {ruleCheckState.lastUpdatedAt ? new Date(ruleCheckState.lastUpdatedAt).toLocaleTimeString() : "-"}
                        </div>
                    </aside>
                )}
            </div>
        );
    }

    return (
        <div style={{ display: "flex", height: "100vh", width: "100vw", background: "#f9fafb" }}>
            <Sidebar
                catalog={catalog}
                loading={loadingCatalog}
                error={catalogError}
                expandedSet={expandedPf}
                togglePf={togglePf}
                onDragStart={handleDragStart}
                subjectColors={subjectColors}
                programCode={programCode}
                setProgramCode={setProgramCode}
                programOptions={PROGRAM_OPTIONS}
                selectedFocus={selectedFocus}
                setSelectedFocus={setSelectedFocus}
                bachelorProgramCode={BACHELOR_PROGRAM_CODE}
                bachelorFocusOptions={BACHELOR_FOCUS_OPTIONS}
                getCourseStatus={getCourseStatus}
            />

            <div style={{ flex: 1, display: "flex", minWidth: 0 }}>
                <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
                    <button
                        onClick={() => setViewMode("graph")}
                        style={{
                            position: "absolute",
                            top: 12,
                            left: 12,
                            zIndex: 5,
                            border: "1px solid #d1d5db",
                            background: "#ffffff",
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        Graph View
                    </button>

                    <button
                        onClick={() => setIsRuleDashboardOpen((v) => !v)}
                        style={{
                            position: "absolute",
                            top: 12,
                            left: 120,
                            zIndex: 5,
                            border: "1px solid #d1d5db",
                            background: "#ffffff",
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        {isRuleDashboardOpen ? "Close Rule Dashboard" : "Open Rule Dashboard"}
                    </button>

                    <div
                        style={{
                            position: "absolute",
                            top: 12,
                            right: 12,
                            zIndex: 5,
                            border: `1px solid ${feedbackBorder}`,
                            background: feedbackBg,
                            color: feedbackColor,
                            borderRadius: 8,
                            padding: "8px 10px",
                            fontSize: 12,
                            fontWeight: 600,
                            maxWidth: 360,
                        }}
                    >
                        {feedbackText}
                    </div>

                    <div className="rf-wrapper" ref={wrapperRef} onDrop={onDrop} onDragOver={onDragOver} style={{ position: "absolute", inset: 0 }}>
                        <ReactFlow
                            onInit={(inst) => (rfRef.current = inst)}
                            nodes={nodes}
                            onNodesChange={onNodesChange}
                            onNodeDragStart={onNodeDragStart}
                            onNodeDrag={onNodeDrag}
                            onNodeDragStop={onNodeDragStopMerged}
                            onSelectionDragStop={schedulePersist}
                            nodeTypes={NODE_TYPES}
                            fitView
                            snapToGrid
                            snapGrid={[GRID_SIZE, GRID_SIZE]}
                            proOptions={{ hideAttribution: true }}
                        >
                            <MiniMap pannable zoomable />
                            <Controls position="top-right" />
                            <Background gap={GRID_SIZE} />
                        </ReactFlow>
                    </div>
                </div>

                {isRuleDashboardOpen && (
                    <aside
                        style={{
                            width: 420,
                            borderLeft: "1px solid #e5e7eb",
                            background: "#ffffff",
                            padding: 12,
                            overflow: "auto",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>Rule Engine Dashboard</div>
                            <button
                                onClick={() => setIsRuleDashboardOpen(false)}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    borderRadius: 8,
                                    padding: "6px 10px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                Close
                            </button>
                        </div>

                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
                            Program: {programCode}
                        </div>
                        {programCode === BACHELOR_PROGRAM_CODE && (
                            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
                                Focus: {selectedFocus || "-"}
                            </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>Done ECTS</div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>{doneEctsKpi.toFixed(1)}</div>
                            </div>
                            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>Planned ECTS</div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>{plannedEctsKpi.toFixed(1)}</div>
                            </div>
                            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>Total ECTS</div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>{totalEctsKpi.toFixed(1)}</div>
                            </div>
                            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>Target ECTS</div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>{targetEctsKpi.toFixed(1)}</div>
                            </div>
                            {isBachelorDashboard && (
                                <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                    <div style={{ fontSize: 11, color: "#6b7280" }}>Narrow Electives</div>
                                    <div style={{ fontSize: 18, fontWeight: 700 }}>{bachelorNarrowCompleted}/{bachelorNarrowRequired}</div>
                                </div>
                            )}
                        </div>

                        {!isBachelorDashboard && (
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Key Buckets</div>
                                <div style={{ display: "grid", gap: 6 }}>
                                    <div style={{ fontSize: 12 }}>Subject modules (excl. free): <strong>{buckets.subject_modules_excl_free ?? 0}</strong></div>
                                    <div style={{ fontSize: 12 }}>Free choice + TS: <strong>{buckets.free_choice_and_ts ?? 0}</strong></div>
                                    <div style={{ fontSize: 12 }}>Transferable skills: <strong>{buckets.transferable_skills ?? 0}</strong></div>
                                    <div style={{ fontSize: 12 }}>Diploma total: <strong>{buckets.diploma_total ?? 0}</strong></div>
                                    <div style={{ fontSize: 12 }}>Needed free to hit 120: <strong>{buckets.needed_free_to_hit_120 ?? 0}</strong></div>
                                </div>
                            </div>
                        )}

                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Per Semester ECTS</div>
                            <div style={{ display: "grid", gap: 6 }}>
                                {Object.keys(perSemester).length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>No semester data yet.</div>}
                                {Object.entries(perSemester).map(([sem, ects]) => (
                                    <div key={sem} style={{ fontSize: 12 }}>
                                        Semester {Number(sem) + 1}: <strong>{ects}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>By Category</div>
                            <div style={{ display: "grid", gap: 6 }}>
                                {Object.keys(byCategory).length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>No category data yet.</div>}
                                {Object.entries(byCategory).map(([k, v]) => (
                                    <div key={k} style={{ fontSize: 12 }}>{k}: <strong>{v}</strong></div>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>By Exam Subject</div>
                            <div style={{ display: "grid", gap: 6 }}>
                                {Object.keys(byExamSubject).length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>No exam-subject data yet.</div>}
                                {Object.entries(byExamSubject).map(([k, v]) => (
                                    <div key={k} style={{ fontSize: 12 }}>{k}: <strong>{v}</strong></div>
                                ))}
                            </div>
                        </div>

                        {isBachelorDashboard && (
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700 }}>StEOP</div>
                                    <button
                                        onClick={() => setIsSteopInfoOpen((v) => !v)}
                                        style={{
                                            border: "1px solid #d1d5db",
                                            background: "#ffffff",
                                            borderRadius: 999,
                                            padding: "2px 8px",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                        }}
                                        title="Show StEOP rules"
                                    >
                                        i
                                    </button>
                                </div>
                                {isSteopInfoOpen && (
                                    <div
                                        style={{
                                            border: "1px solid #e5e7eb",
                                            borderRadius: 8,
                                            background: "#f9fafb",
                                            padding: 8,
                                            marginBottom: 8,
                                            fontSize: 11,
                                            color: "#374151",
                                            whiteSpace: "pre-line",
                                        }}
                                    >
                                        {STEOP_RULES_TEXT}
                                    </div>
                                )}
                                <div style={{ display: "grid", gap: 6 }}>
                                    <div style={{ fontSize: 12 }}>
                                        Status: <strong style={{ color: bachelorSteopComplete ? "#166534" : "#991b1b" }}>
                                            {bachelorSteopComplete ? "completed" : "not completed"}
                                        </strong>
                                    </div>
                                    <div style={{ fontSize: 12 }}>
                                        Complete in semester: <strong>{bachelorSteopLane == null ? "-" : bachelorSteopLane + 1}</strong>
                                    </div>
                                    <div style={{ fontSize: 12 }}>
                                        Done progress: <strong>{steopDoneEcts.toFixed(1)}</strong> / {steopRequiredEcts.toFixed(1)} ECTS
                                        {" "}(
                                        mandatory {steopMandatoryDoneEcts.toFixed(1)}/{steopMandatoryRequiredEcts.toFixed(1)},
                                        {" "}pool {steopPoolDoneEcts.toFixed(1)}/{steopPoolRequiredEcts.toFixed(1)}
                                        )
                                    </div>
                                </div>
                            </div>
                        )}

                        {isBachelorDashboard && selectedFocus && (
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700 }}>Focus Area</div>
                                    <button
                                        onClick={() => setIsFocusInfoOpen((v) => !v)}
                                        style={{
                                            border: "1px solid #d1d5db",
                                            background: "#ffffff",
                                            borderRadius: 999,
                                            padding: "2px 8px",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                        }}
                                        title="Show Focus Area info"
                                    >
                                        i
                                    </button>
                                </div>
                                {isFocusInfoOpen && (
                                    <div
                                        style={{
                                            border: "1px solid #e5e7eb",
                                            borderRadius: 8,
                                            background: "#f9fafb",
                                            padding: 8,
                                            marginBottom: 8,
                                            fontSize: 11,
                                            color: "#374151",
                                            whiteSpace: "pre-line",
                                        }}
                                    >
                                        {FOCUS_INFO_TEXT}
                                    </div>
                                )}
                                <div style={{ display: "grid", gap: 6 }}>
                                    <div style={{ fontSize: 12 }}>Selected: <strong>{bachelorFocus?.selected || selectedFocus}</strong></div>
                                    <div style={{ fontSize: 12 }}>
                                        Status: <strong style={{ color: bachelorFocusComplete ? "#166534" : "#991b1b" }}>
                                            {bachelorFocusComplete ? "completed" : "not completed"}
                                        </strong>
                                    </div>
                                    <div style={{ fontSize: 12 }}>
                                        Missing items: <strong style={{ color: bachelorFocusComplete ? "#166534" : "#991b1b" }}>{bachelorFocusMissingCount}</strong>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Missing Requirements</div>
                            <div style={{ display: "grid", gap: 6 }}>
                                {missingItems.length === 0 && <div style={{ fontSize: 12, color: "#166534" }}>No missing requirements reported.</div>}
                                {missingItems.map((m, idx) => (
                                    <div key={`${m}-${idx}`} style={{ fontSize: 12, color: "#991b1b" }}>{m}</div>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Warnings</div>
                            <div style={{ display: "grid", gap: 6 }}>
                                {warnings.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>No warnings.</div>}
                                {warnings.map((w, idx) => (
                                    <div key={`${w}-${idx}`} style={{ fontSize: 12, color: "#92400e" }}>{w}</div>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Violations</div>
                            <div style={{ display: "grid", gap: 6 }}>
                                {violations.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>No violations.</div>}
                                {violations.map((v, idx) => (
                                    <div key={`${v}-${idx}`} style={{ fontSize: 12, color: "#991b1b" }}>{v}</div>
                                ))}
                            </div>
                        </div>

                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                            Last update: {ruleCheckState.lastUpdatedAt ? new Date(ruleCheckState.lastUpdatedAt).toLocaleTimeString() : "-"}
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
}
