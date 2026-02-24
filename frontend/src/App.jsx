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

import {
    fetchCatalog,
    fetchPlannerState,
    savePlannerState,
    sendRuleCheckUpdate,
} from "./lib/api";
import { CourseCard, LaneColumn, ModuleGroupBackground, Sidebar } from "./components";
import VisualLegend from "./components/VisualLegend.jsx";
import CurriculumGraphView from "./components/CurriculumGraphView.jsx";
import PlannerNotifications from "./components/app/PlannerNotifications.jsx";
import {
    CANVAS_HEIGHT,
    COLLISION_GAP,
    GRID_SIZE,
    LANE_GAP,
    LANE_WIDTH,
    GROUP_PADDING_Y,
    COURSE_VERTICAL_GAP,
    COURSE_LAYOUT_HEIGHT,
    MODULE_BOTTOM_PADDING,
    MODULE_HEADER_HEIGHT,
} from "./utils/constants.js";
import { centerX, laneIndexFromX, laneX, projectToLaneAndSnap } from "./utils/geometry.js";
import { createExamSubjectColorMap } from "./utils/examSubjectColors.js";
import { buildSemesterList, semesterBoundsForProgram } from "./utils/semesters.js";
import { buildBachelorPrefillPlan } from "./utils/bachelorPrefillPlan.js";
import { buildMasterPrefillPlan } from "./utils/masterPrefillPlan.js";
import { resolveModuleVariantCourses } from "./utils/bachelorCourseVariants.js";
import {
    BACHELOR_FOCUS_OPTIONS,
    BACHELOR_PROGRAM_CODE,
    DEFAULT_DONE_SECTION_ORDER,
    DEFAULT_PLANNED_SECTION_ORDER,
    EMPTY_RULE_CHECK_STATE,
    FOCUS_INFO_TEXT,
    MASTER_PROGRAM_CODE,
    PROGRAM_OPTIONS,
    STEOP_RULES_TEXT,
    sanitizeSectionOrder,
} from "./app/constants.js";
import {
    getCourseTypeForCode,
    getExamSubjectForCode,
    normalizeCatalog,
    normalizeRulecheckCategoryForProgram,
    resolveDashboardCategoryForProgram,
} from "./app/catalogUtils.js";
import {
    compactPrefillLayout as compactPrefillLayoutBase,
    laneIdx,
    recomputeGroupFromChildren,
    resolveGroupCourseOverlaps,
    resolveLaneCollisions as resolveLaneCollisionsBase,
} from "./lib/flowLayout.js";
import { useDashboardSectionOrdering } from "./hooks/useDashboardSectionOrdering.js";
import { useDashboardMetrics } from "./hooks/useDashboardMetrics.jsx";

/*********************************
 * React Flow node type registry *
 *********************************/
const NODE_TYPES = {
    course: CourseCard,
    lane: LaneColumn,
    moduleBg: ModuleGroupBackground,
};

/****************
 * Main component
 ****************/
export default function App({ currentUser, onSignOut }) {
    const MIN_MODULE_GROUP_TOP_Y = 108;
    const MIN_GROUP_CHILD_Y = MIN_MODULE_GROUP_TOP_Y + GROUP_PADDING_Y + MODULE_HEADER_HEIGHT;
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
        exportPlannerStateSnapshot,
        importPlannerStateSnapshot,
    } = currentProgram();
    const [viewMode, setViewMode] = useState("table");

    // Catalog state
    const [catalog, setCatalog] = useState([]);
    const [loadingCatalog, setLoadingCatalog] = useState(false);
    const [catalogError, setCatalogError] = useState("");
    const [ruleCheckStateByProgram, setRuleCheckStateByProgram] = useState({});
    const [isRuleDashboardOpen, setIsRuleDashboardOpen] = useState(false);
    const [dashboardViewMode, setDashboardViewMode] = useState("planning");
    const [isLegendOpen, setIsLegendOpen] = useState(false);
    const [isSteopInfoOpen, setIsSteopInfoOpen] = useState(false);
    const [isSteopChecklistOpen, setIsSteopChecklistOpen] = useState(false);
    const [isFocusInfoOpen, setIsFocusInfoOpen] = useState(false);
    const [isFocusChecklistOpen, setIsFocusChecklistOpen] = useState(false);
    const [isExamSubjectProgressOpen, setIsExamSubjectProgressOpen] = useState(false);
    const [isPerSemesterEctsOpen, setIsPerSemesterEctsOpen] = useState(false);
    const [isDonePerSemesterEctsOpen, setIsDonePerSemesterEctsOpen] = useState(false);
    const [isPlannedExamSubjectOpen, setIsPlannedExamSubjectOpen] = useState(false);
    const [isByCategoryOpen, setIsByCategoryOpen] = useState(false);
    const [isDoneByCategoryOpen, setIsDoneByCategoryOpen] = useState(false);
    const [isMissingRequirementsOpen, setIsMissingRequirementsOpen] = useState(false);
    const [isWarningsOpen, setIsWarningsOpen] = useState(false);
    const [plannedDashboardSectionOrder, setPlannedDashboardSectionOrder] = useState(DEFAULT_PLANNED_SECTION_ORDER);
    const [doneDashboardSectionOrder, setDoneDashboardSectionOrder] = useState(DEFAULT_DONE_SECTION_ORDER);
    const [stickyViolation, setStickyViolation] = useState({ message: "", until: 0, tone: "" });
    const [progressMilestone, setProgressMilestone] = useState({ text: "", until: 0 });
    const subjectColors = useMemo(
        () => createExamSubjectColorMap((catalog || []).map((pf) => pf?.pruefungsfach).filter(Boolean)),
        [catalog]
    );

    // React Flow refs
    const wrapperRef = useRef(null);
    const rfRef = useRef(null);
    const groupDragRef = useRef(new Map()); // Map<groupId, { lastX, lastY }>
    const latestRuleCheckChangeIdRef = useRef({});
    const pendingInitialSyncProgramRef = useRef(programCode);
    const pendingDragPayloadRef = useRef(null);
    const savePlannerTimerRef = useRef(null);
    const hydratedProgramRef = useRef(null);
    const latestGraphSnapshotRef = useRef(null);
    const loadedDashboardUiRef = useRef({ byProgram: {}, global: {} });
    const progressMilestoneRef = useRef({ programCode: null, pct: 0 });
    const [plannerHydrated, setPlannerHydrated] = useState(false);
    const [plannerLoadOk, setPlannerLoadOk] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [focusPrefillPrompt, setFocusPrefillPrompt] = useState(null);
    const [dismissedInitialPrefillPrompt, setDismissedInitialPrefillPrompt] = useState(false);
    const focusSelectionTrackerRef = useRef({ programCode, selectedFocus });
    const ruleCheckState = ruleCheckStateByProgram?.[programCode] ?? EMPTY_RULE_CHECK_STATE;
    const setProgramRuleCheckState = useCallback((targetProgramCode, updater) => {
        if (!targetProgramCode) return;
        setRuleCheckStateByProgram((prev) => {
            const current = prev?.[targetProgramCode] ?? EMPTY_RULE_CHECK_STATE;
            const next = typeof updater === "function" ? updater(current) : updater;
            return {
                ...(prev || {}),
                [targetProgramCode]: next,
            };
        });
    }, []);

    const buildPersistSnapshot = useCallback(() => {
        const snapshot = exportPlannerStateSnapshot?.() || {};
        const latestGraphSnapshot = latestGraphSnapshotRef.current;
        if (latestGraphSnapshot && typeof latestGraphSnapshot === "object") {
            snapshot.graphViewByProgram = {
                ...(snapshot.graphViewByProgram || {}),
                [programCode]: {
                    ...((snapshot.graphViewByProgram || {})[programCode] || {}),
                    ...latestGraphSnapshot,
                },
            };
        }
        snapshot.dashboardUiByProgram = {
            ...(snapshot.dashboardUiByProgram || {}),
            [programCode]: {
                dashboardViewMode,
                isSteopInfoOpen,
                isSteopChecklistOpen,
                isFocusInfoOpen,
                isFocusChecklistOpen,
                isExamSubjectProgressOpen,
                isPerSemesterEctsOpen,
                isDonePerSemesterEctsOpen,
                isPlannedExamSubjectOpen,
                isByCategoryOpen,
                isDoneByCategoryOpen,
                isMissingRequirementsOpen,
                isWarningsOpen,
                plannedDashboardSectionOrder: sanitizeSectionOrder(plannedDashboardSectionOrder, DEFAULT_PLANNED_SECTION_ORDER),
                doneDashboardSectionOrder: sanitizeSectionOrder(doneDashboardSectionOrder, DEFAULT_DONE_SECTION_ORDER),
            },
        };
        snapshot.dashboardUiGlobal = {
            ...(snapshot.dashboardUiGlobal || {}),
            isRuleDashboardOpen,
            isLegendOpen,
        };
        return snapshot;
    }, [
        exportPlannerStateSnapshot,
        programCode,
        dashboardViewMode,
        isSteopInfoOpen,
        isSteopChecklistOpen,
        isFocusInfoOpen,
        isFocusChecklistOpen,
        isExamSubjectProgressOpen,
        isPerSemesterEctsOpen,
        isDonePerSemesterEctsOpen,
        isPlannedExamSubjectOpen,
        isByCategoryOpen,
        isDoneByCategoryOpen,
        isMissingRequirementsOpen,
        isWarningsOpen,
        plannedDashboardSectionOrder,
        doneDashboardSectionOrder,
        isRuleDashboardOpen,
        isLegendOpen,
    ]);

    useEffect(() => {
        latestGraphSnapshotRef.current = null;
    }, [programCode]);

    useEffect(() => {
        pendingInitialSyncProgramRef.current = programCode;
    }, [programCode]);

    useEffect(() => {
        setDragPreviewSemesterCount(null);
    }, [programCode]);

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

    useEffect(() => {
        let cancelled = false;
        setPlannerHydrated(false);
        setPlannerLoadOk(false);
        hydratedProgramRef.current = null;
        (async () => {
            try {
                const payload = await fetchPlannerState();
                if (cancelled) return;
                const state = payload?.state ?? {};
                importPlannerStateSnapshot(state);
                loadedDashboardUiRef.current = {
                    byProgram: state?.dashboardUiByProgram && typeof state.dashboardUiByProgram === "object" ? state.dashboardUiByProgram : {},
                    global: state?.dashboardUiGlobal && typeof state.dashboardUiGlobal === "object" ? state.dashboardUiGlobal : {},
                };
                const dashboardUi = loadedDashboardUiRef.current.byProgram?.[programCode] || {};
                const dashboardUiGlobal = loadedDashboardUiRef.current.global || {};
                if (typeof dashboardUi?.dashboardViewMode === "string") setDashboardViewMode(dashboardUi.dashboardViewMode);
                if (typeof dashboardUi?.isSteopInfoOpen === "boolean") setIsSteopInfoOpen(dashboardUi.isSteopInfoOpen);
                if (typeof dashboardUi?.isSteopChecklistOpen === "boolean") setIsSteopChecklistOpen(dashboardUi.isSteopChecklistOpen);
                if (typeof dashboardUi?.isFocusInfoOpen === "boolean") setIsFocusInfoOpen(dashboardUi.isFocusInfoOpen);
                if (typeof dashboardUi?.isFocusChecklistOpen === "boolean") setIsFocusChecklistOpen(dashboardUi.isFocusChecklistOpen);
                if (typeof dashboardUi?.isExamSubjectProgressOpen === "boolean") setIsExamSubjectProgressOpen(dashboardUi.isExamSubjectProgressOpen);
                if (typeof dashboardUi?.isPerSemesterEctsOpen === "boolean") setIsPerSemesterEctsOpen(dashboardUi.isPerSemesterEctsOpen);
                if (typeof dashboardUi?.isDonePerSemesterEctsOpen === "boolean") setIsDonePerSemesterEctsOpen(dashboardUi.isDonePerSemesterEctsOpen);
                if (typeof dashboardUi?.isPlannedExamSubjectOpen === "boolean") setIsPlannedExamSubjectOpen(dashboardUi.isPlannedExamSubjectOpen);
                if (typeof dashboardUi?.isByCategoryOpen === "boolean") setIsByCategoryOpen(dashboardUi.isByCategoryOpen);
                if (typeof dashboardUi?.isDoneByCategoryOpen === "boolean") setIsDoneByCategoryOpen(dashboardUi.isDoneByCategoryOpen);
                if (typeof dashboardUi?.isMissingRequirementsOpen === "boolean") setIsMissingRequirementsOpen(dashboardUi.isMissingRequirementsOpen);
                if (typeof dashboardUi?.isWarningsOpen === "boolean") setIsWarningsOpen(dashboardUi.isWarningsOpen);
                setPlannedDashboardSectionOrder(
                    sanitizeSectionOrder(dashboardUi?.plannedDashboardSectionOrder, DEFAULT_PLANNED_SECTION_ORDER)
                );
                setDoneDashboardSectionOrder(
                    sanitizeSectionOrder(dashboardUi?.doneDashboardSectionOrder, DEFAULT_DONE_SECTION_ORDER)
                );
                if (typeof dashboardUiGlobal?.isRuleDashboardOpen === "boolean") setIsRuleDashboardOpen(dashboardUiGlobal.isRuleDashboardOpen);
                if (typeof dashboardUiGlobal?.isLegendOpen === "boolean") setIsLegendOpen(dashboardUiGlobal.isLegendOpen);
                setPlannerLoadOk(true);
            } catch (e) {
                if (cancelled) return;
                console.error("Failed to load planner state", e);
                setPlannerLoadOk(false);
            } finally {
                if (!cancelled) setPlannerHydrated(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [importPlannerStateSnapshot]);

    useEffect(() => {
        const dashboardUi = loadedDashboardUiRef.current?.byProgram?.[programCode] || null;
        if (!dashboardUi || typeof dashboardUi !== "object") return;
        if (typeof dashboardUi?.dashboardViewMode === "string") setDashboardViewMode(dashboardUi.dashboardViewMode);
        if (typeof dashboardUi?.isSteopInfoOpen === "boolean") setIsSteopInfoOpen(dashboardUi.isSteopInfoOpen);
        if (typeof dashboardUi?.isSteopChecklistOpen === "boolean") setIsSteopChecklistOpen(dashboardUi.isSteopChecklistOpen);
        if (typeof dashboardUi?.isFocusInfoOpen === "boolean") setIsFocusInfoOpen(dashboardUi.isFocusInfoOpen);
        if (typeof dashboardUi?.isFocusChecklistOpen === "boolean") setIsFocusChecklistOpen(dashboardUi.isFocusChecklistOpen);
        if (typeof dashboardUi?.isExamSubjectProgressOpen === "boolean") setIsExamSubjectProgressOpen(dashboardUi.isExamSubjectProgressOpen);
        if (typeof dashboardUi?.isPerSemesterEctsOpen === "boolean") setIsPerSemesterEctsOpen(dashboardUi.isPerSemesterEctsOpen);
        if (typeof dashboardUi?.isDonePerSemesterEctsOpen === "boolean") setIsDonePerSemesterEctsOpen(dashboardUi.isDonePerSemesterEctsOpen);
        if (typeof dashboardUi?.isPlannedExamSubjectOpen === "boolean") setIsPlannedExamSubjectOpen(dashboardUi.isPlannedExamSubjectOpen);
        if (typeof dashboardUi?.isByCategoryOpen === "boolean") setIsByCategoryOpen(dashboardUi.isByCategoryOpen);
        if (typeof dashboardUi?.isDoneByCategoryOpen === "boolean") setIsDoneByCategoryOpen(dashboardUi.isDoneByCategoryOpen);
        if (typeof dashboardUi?.isMissingRequirementsOpen === "boolean") setIsMissingRequirementsOpen(dashboardUi.isMissingRequirementsOpen);
        if (typeof dashboardUi?.isWarningsOpen === "boolean") setIsWarningsOpen(dashboardUi.isWarningsOpen);
        setPlannedDashboardSectionOrder(
            sanitizeSectionOrder(dashboardUi?.plannedDashboardSectionOrder, DEFAULT_PLANNED_SECTION_ORDER)
        );
        setDoneDashboardSectionOrder(
            sanitizeSectionOrder(dashboardUi?.doneDashboardSectionOrder, DEFAULT_DONE_SECTION_ORDER)
        );
    }, [programCode]);

    useEffect(() => {
        if (!plannerHydrated || !plannerLoadOk) return;
        if (savePlannerTimerRef.current) {
            window.clearTimeout(savePlannerTimerRef.current);
        }
        savePlannerTimerRef.current = window.setTimeout(async () => {
            try {
                await savePlannerState(buildPersistSnapshot());
            } catch (e) {
                console.error("Failed to save planner state", e);
            }
        }, 500);
        return () => {
            if (savePlannerTimerRef.current) {
                window.clearTimeout(savePlannerTimerRef.current);
                savePlannerTimerRef.current = null;
            }
        };
    }, [plannerHydrated, plannerLoadOk, buildPersistSnapshot]);

    const handleSignOut = useCallback(async () => {
        if (isSigningOut) return;
        setIsSigningOut(true);
        try {
            if (savePlannerTimerRef.current) {
                window.clearTimeout(savePlannerTimerRef.current);
                savePlannerTimerRef.current = null;
            }
            try {
                await savePlannerState(buildPersistSnapshot());
            } catch (e) {
                console.error("Failed to save planner state before sign out", e);
            }
            await onSignOut?.();
        } finally {
            setIsSigningOut(false);
        }
    }, [isSigningOut, buildPersistSnapshot, onSignOut]);

    const semesterBounds = useMemo(() => semesterBoundsForProgram(programCode), [programCode]);
    const minSemesterCount = semesterBounds.min;
    const maxSemesterCount = semesterBounds.max;
    const [dragPreviewSemesterCount, setDragPreviewSemesterCount] = useState(null);

    const usedSemesterCount = useMemo(() => {
        let maxLane = -1;
        let maxSemesterKey = -1;
        const bySem = coursesBySemester && typeof coursesBySemester === "object" ? coursesBySemester : {};
        for (const [semesterKey, list] of Object.entries(bySem)) {
            const semNum = Number(semesterKey);
            const safeList = Array.isArray(list) ? list : [];
            if (Number.isInteger(semNum) && safeList.length > 0) maxSemesterKey = Math.max(maxSemesterKey, semNum - 1);
            for (const course of safeList) {
                const li = Number(course?.laneIndex);
                if (Number.isFinite(li)) maxLane = Math.max(maxLane, Math.floor(li));
            }
        }
        const requiredByData = Math.max(maxLane, maxSemesterKey) + 1;
        return Math.max(minSemesterCount, Math.min(maxSemesterCount, requiredByData));
    }, [coursesBySemester, minSemesterCount, maxSemesterCount]);

    const activeSemesterCount = useMemo(
        () => Math.max(minSemesterCount, Math.min(maxSemesterCount, usedSemesterCount)),
        [minSemesterCount, maxSemesterCount, usedSemesterCount]
    );
    const displayedSemesterCount = useMemo(
        () => Math.max(activeSemesterCount, Math.min(maxSemesterCount, Number(dragPreviewSemesterCount) || 0)),
        [activeSemesterCount, dragPreviewSemesterCount, maxSemesterCount]
    );
    const semesters = useMemo(() => buildSemesterList(displayedSemesterCount), [displayedSemesterCount]);
    const semesterIdsFromPlan = useMemo(() => {
        const ids = new Set();
        for (let i = 1; i <= minSemesterCount; i += 1) ids.add(i);
        const bySem = coursesBySemester && typeof coursesBySemester === "object" ? coursesBySemester : {};
        for (const key of Object.keys(bySem)) {
            const n = Number(key);
            if (Number.isInteger(n) && n >= 1 && n <= maxSemesterCount) ids.add(n);
        }
        return [...ids].sort((a, b) => a - b);
    }, [coursesBySemester, maxSemesterCount, minSemesterCount]);
    const sidebarSemesters = useMemo(
        () => buildSemesterList(maxSemesterCount).map((semester) => ({
            ...semester,
            isPlus: semester.id > activeSemesterCount,
        })),
        [activeSemesterCount, maxSemesterCount]
    );

    const plannedEctsBySemester = useMemo(() => {
        const out = {};
        for (const semester of semesters) {
            const list = Array.isArray(coursesBySemester?.[semester.id]) ? coursesBySemester[semester.id] : [];
            out[semester.id] = list.reduce((sum, course) => sum + Number(course?.ects || 0), 0);
        }
        return out;
    }, [coursesBySemester, semesters]);

    // Lane background columns
    const laneNodes = useMemo(
        () =>
            semesters.map((s, i) => ({
                id: `lane-${s.id}`,
                type: "lane",
                data: {
                    title: s.title,
                    even: i % 2 === 0,
                    height: CANVAS_HEIGHT,
                    ectsPlanned: Number(plannedEctsBySemester?.[s.id] ?? 0),
                },
                position: { x: laneX(i), y: 0 },
                draggable: false,
                selectable: false,
                zIndex: 0,
                style: { height: CANVAS_HEIGHT },
            })),
        [plannedEctsBySemester, semesters]
    );

    // React Flow state
    const initialNodes = useMemo(() => [...laneNodes], [laneNodes]);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const requiredLaneHeight = useMemo(() => {
        let maxBottom = 0;
        for (const node of nodes) {
            if (node?.type === "lane") continue;
            if (node?.type === "course") {
                maxBottom = Math.max(maxBottom, Number(node?.position?.y || 0) + COURSE_LAYOUT_HEIGHT);
                continue;
            }
            if (node?.type === "moduleBg") {
                const groupHeight =
                    Number(node?.data?.height) ||
                    (COURSE_LAYOUT_HEIGHT + MODULE_HEADER_HEIGHT + GROUP_PADDING_Y + MODULE_BOTTOM_PADDING);
                maxBottom = Math.max(maxBottom, Number(node?.position?.y || 0) + groupHeight);
            }
        }
        const padded = Math.max(CANVAS_HEIGHT, maxBottom + 220);
        return Math.ceil(padded / GRID_SIZE) * GRID_SIZE;
    }, [nodes]);
    // Persist scheduling flag – set to true to persist after the next commit
    const [needsPersist, setNeedsPersist] = useState(false);

    const {
        handlePlannedSectionDragStart,
        handlePlannedSectionDragOver,
        handlePlannedSectionDrop,
        handlePlannedSectionDragEnd,
        handleDoneSectionDragStart,
        handleDoneSectionDragOver,
        handleDoneSectionDrop,
        handleDoneSectionDragEnd,
        plannedSectionStyle,
        doneSectionStyle,
    } = useDashboardSectionOrdering({
        plannedDashboardSectionOrder,
        setPlannedDashboardSectionOrder,
        doneDashboardSectionOrder,
        setDoneDashboardSectionOrder,
    });

    useEffect(() => {
        setNodes((prev) => {
            const nonLane = prev.filter((n) => n.type !== "lane");
            const prevLaneIds = prev.filter((n) => n.type === "lane").map((n) => n.id).join("|");
            const nextLaneIds = laneNodes.map((n) => n.id).join("|");
            if (prevLaneIds === nextLaneIds) return prev;
            return [...laneNodes, ...nonLane];
        });
    }, [laneNodes, setNodes]);

    useEffect(() => {
        setNodes((prev) => {
            let changed = false;
            const next = prev.map((node) => {
                if (node.type !== "lane") return node;
                const semesterId = Number(String(node.id).replace("lane-", ""));
                const ectsPlanned = Number(plannedEctsBySemester?.[semesterId] ?? 0);
                const currentEcts = Number(node?.data?.ectsPlanned ?? 0);
                const currentHeight = Number(node?.data?.height ?? 0);
                if (currentEcts === ectsPlanned && currentHeight === requiredLaneHeight) return node;
                changed = true;
                return {
                    ...node,
                    data: {
                        ...node.data,
                        ectsPlanned,
                        height: requiredLaneHeight,
                    },
                };
            });
            return changed ? next : prev;
        });
    }, [plannedEctsBySemester, requiredLaneHeight, setNodes]);

    /***********************
     * Sidebar drag & drop *
     ***********************/
    const handleDragStart = useCallback((e, payload) => {
        pendingDragPayloadRef.current = payload ?? null;
        const dt = e?.dataTransfer || e?.nativeEvent?.dataTransfer || null;
        if (!dt) return;
        try {
            dt.setData("application/x-course", JSON.stringify(payload));
            dt.effectAllowed = "move";
        } catch {
            // Some environments block setData for custom MIME types; fallback ref handles drop.
        }
    }, []);

    const laneIndexFromClientPosition = useCallback((clientX) => {
        const bounds = wrapperRef.current?.getBoundingClientRect?.();
        const viewport = typeof rfRef.current?.getViewport === "function"
            ? rfRef.current.getViewport()
            : { x: 0, zoom: 1 };
        const zoom = Number.isFinite(viewport?.zoom) && viewport.zoom > 0 ? viewport.zoom : 1;
        const vx = Number.isFinite(viewport?.x) ? viewport.x : 0;
        const left = Number.isFinite(bounds?.left) ? bounds.left : 0;
        const flowX = (Number(clientX) - left - vx) / zoom;
        const span = LANE_WIDTH + LANE_GAP;
        return Math.max(0, Math.floor((flowX + LANE_GAP * 0.5) / span));
    }, []);

    const clampPlacementLane = useCallback((requestedLaneIndex) => {
        const raw = Math.max(0, Math.floor(Number(requestedLaneIndex) || 0));
        const highestActive = Math.max(0, activeSemesterCount - 1);
        const nextAllowed = activeSemesterCount < maxSemesterCount ? activeSemesterCount : highestActive;
        return Math.max(0, Math.min(raw, nextAllowed));
    }, [activeSemesterCount, maxSemesterCount]);

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        const dt = event?.dataTransfer || event?.nativeEvent?.dataTransfer || null;
        if (dt) dt.dropEffect = "move";
        const previewLane = laneIndexFromClientPosition(event?.clientX);
        const nextAllowedLane = activeSemesterCount;
        if (previewLane === nextAllowedLane && activeSemesterCount < maxSemesterCount) {
            setDragPreviewSemesterCount(nextAllowedLane + 1);
        } else {
            setDragPreviewSemesterCount(null);
        }
    }, [activeSemesterCount, laneIndexFromClientPosition, maxSemesterCount]);

    const onDragLeave = useCallback(() => {
        setDragPreviewSemesterCount(null);
    }, []);

    const flowLayoutOptions = useMemo(() => ({
        maxSemesterCount,
        minModuleGroupTopY: MIN_MODULE_GROUP_TOP_Y,
    }), [maxSemesterCount, MIN_MODULE_GROUP_TOP_Y]);

    const compactPrefillLayout = useCallback(
        (allNodes) => compactPrefillLayoutBase(allNodes, flowLayoutOptions),
        [flowLayoutOptions]
    );

    const resolveLaneCollisions = useCallback(
        (allNodes) => resolveLaneCollisionsBase(allNodes, flowLayoutOptions),
        [flowLayoutOptions]
    );

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

    const toggleModuleDoneCodes = useCallback((courseCodes, nextDone, groupId) => {
        let codes = Array.isArray(courseCodes) ? courseCodes.filter(Boolean) : [];
        if (!codes.length && groupId) {
            const source = (rfRef.current?.getNodes?.() || nodes);
            codes = source
                .filter((n) => n.type === "course" && n.data?.groupId === groupId)
                .map((n) => n?.data?.code)
                .filter(Boolean);
        }
        const uniqueCodes = [...new Set(codes)];
        if (!uniqueCodes.length) return;
        const allowedCodes = uniqueCodes.filter((code) => {
            const status = getCourseStatus(code);
            return status === "in_plan" || status === "done";
        });
        if (!allowedCodes.length) return;
        for (const code of allowedCodes) {
            setCourseDone(code, Boolean(nextDone));
        }
        setNodes((prev) => {
            const patched = prev.map((n) => {
                if (n.type !== "course" || !allowedCodes.includes(n?.data?.code)) return n;
                return { ...n, data: { ...n.data, status: nextDone ? "done" : "in_plan" } };
            });
            if (groupId) {
                return patched.map((n) => (
                    n.type === "moduleBg" && n.id === groupId
                        ? {
                            ...n,
                            data: {
                                ...n.data,
                                status: nextDone ? "done" : "in_plan",
                                moduleCourseCodes: allowedCodes,
                            },
                        }
                        : n
                ));
            }
            return patched;
        });
    }, [getCourseStatus, nodes, setCourseDone, setNodes]);

    const addGraphCourseToPlan = useCallback((course, requestedLaneIndex, options = null) => {
        const courseCode = course?.code;
        if (!courseCode || getCourseStatus(courseCode) !== "todo") return false;

        const allowDirect = Boolean(options?.allowDirectLaneSelection);
        const laneIndex = allowDirect
            ? Math.max(0, Math.min(Number(requestedLaneIndex) || 0, maxSemesterCount - 1))
            : clampPlacementLane(requestedLaneIndex);
        const x = centerX(laneIndex);
        const now = Date.now();
        const id = `${courseCode}-${now}-graph`;
        const examSubject = course?.examSubject || getExamSubjectForCode(catalog, courseCode);
        const courseType = course?.type ?? getCourseTypeForCode(catalog, courseCode);
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
            const y = last ? (last.position.y + COURSE_LAYOUT_HEIGHT + COLLISION_GAP) : 96;

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
    }, [catalog, clampPlacementLane, getCourseStatus, maxSemesterCount, removeCourseNode, setCoursesFromNodes, setNodes, subjectColors, toggleCourseDone, updateCourseEcts]);

    const addGraphModuleToPlan = useCallback((modulePayload, requestedLaneIndex, options = null) => {
        const variantResolution = resolveModuleVariantCourses(modulePayload, options?.variantId ?? null);
        const courses = Array.isArray(variantResolution?.selectedCourses)
            ? variantResolution.selectedCourses
            : (Array.isArray(modulePayload?.courses) ? modulePayload.courses : []);
        const allVariantCourses = Array.isArray(variantResolution?.allVariantCourses) ? variantResolution.allVariantCourses : courses;
        if (courses.length === 1) {
            return addGraphCourseToPlan({
                ...courses[0],
                category: modulePayload?.category ?? courses?.[0]?.category ?? "unknown",
                subjectColor: modulePayload?.subjectColor ?? courses?.[0]?.subjectColor ?? null,
            }, requestedLaneIndex, options);
        }
        if (courses.length < 2) return false;
        const codes = courses.map((c) => c?.code).filter(Boolean);
        if (!codes.length) return false;
        if (codes.some((code) => getCourseStatus(code) !== "todo")) return false;
        const conflictingVariantCodes = allVariantCourses
            .map((c) => c?.code)
            .filter((code) => code && !codes.includes(code));

        const allowDirect = Boolean(options?.allowDirectLaneSelection);
        const laneIndex = allowDirect
            ? Math.max(0, Math.min(Number(requestedLaneIndex) || 0, maxSemesterCount - 1))
            : clampPlacementLane(requestedLaneIndex);
        const x = centerX(laneIndex);
        const y = Math.max(144, MIN_GROUP_CHILD_Y);
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
            "#2563eb";

        const groupNode = {
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
            selectable: false,
            zIndex: 0,
        };

        const childCourseNodes = courses.map((course, idx) => {
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
            const hasSelectedAlready = codes.some((code) => prev.some((n) => n.type === "course" && n?.data?.code === code));
            if (hasSelectedAlready) return prev;

            const removeSet = new Set(conflictingVariantCodes);
            const affectedGroupIds = new Set(
                prev
                    .filter((n) => n.type === "course" && removeSet.has(n?.data?.code) && n?.data?.groupId)
                    .map((n) => n.data.groupId)
            );
            let next = prev.filter((n) => !(n.type === "course" && removeSet.has(n?.data?.code)));
            for (const oldGroupId of affectedGroupIds) {
                next = recomputeGroupFromChildren(next, oldGroupId);
            }

            const withAll = next.concat(groupNode, ...childCourseNodes);
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
    }, [MIN_GROUP_CHILD_Y, addGraphCourseToPlan, catalog, clampPlacementLane, getCourseStatus, maxSemesterCount, removeCourseNode, removeModuleGroup, setCoursesFromNodes, setNodes, subjectColors, toggleCourseDone, toggleModuleDoneCodes, updateCourseEcts]);

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

    const applyBachelorPrefilledPlan = useCallback((focusName) => {
        if (programCode !== BACHELOR_PROGRAM_CODE) return false;
        const { plannedCourses, missingAliases } = buildBachelorPrefillPlan(catalog, focusName);
        if (!plannedCourses.length) {
            setStickyViolation({
                message: "Prebuilt bachelor plan could not be applied (no matching catalog courses found).",
                until: Date.now() + 5000,
                tone: "error",
            });
            return false;
        }

        const doneSet = new Set(doneCourseCodes || []);
        const groupedByModule = new Map();
        for (const course of plannedCourses) {
            const moduleKey = course?.module?.key || "";
            if (!moduleKey) continue;
            if (!groupedByModule.has(moduleKey)) groupedByModule.set(moduleKey, []);
            groupedByModule.get(moduleKey).push(course);
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
        const moduleRowYByKey = new Map();
        groupedModuleEntries.forEach(([moduleKey], rowIdx) => {
            moduleRowYByKey.set(moduleKey, MIN_GROUP_CHILD_Y + rowIdx * (COURSE_LAYOUT_HEIGHT + 32));
        });

        const bySemester = new Map();
        for (const item of plannedCourses) {
            const semester = Number(item?.semester);
            if (!Number.isInteger(semester) || semester < 1 || semester > maxSemesterCount) continue;
            if (!bySemester.has(semester)) bySemester.set(semester, []);
            bySemester.get(semester).push(item);
        }

        const now = Date.now();
        const rebuilt = [...laneNodes];
        const groupNodeMetaByModuleKey = new Map();
        const groupedModuleSemesterOffset = new Map();
        let sequence = 0;
        for (let semesterId = 1; semesterId <= maxSemesterCount; semesterId += 1) {
            const laneIndex = semesterId - 1;
            const list = bySemester.get(semesterId) || [];
            list.forEach((course, idx) => {
                const examSubject = course?.examSubject ?? getExamSubjectForCode(catalog, course?.code);
                const subjectColor =
                    (examSubject ? subjectColors?.[examSubject] : null) ||
                    "#2563eb";
                const moduleKey = course?.module?.key || "";
                const isGroupedModuleCourse = groupedModuleKeys.has(moduleKey);
                const moduleRowY = moduleRowYByKey.get(moduleKey);
                let groupId = null;
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
                if (isGroupedModuleCourse && Number.isFinite(moduleRowY)) {
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
                        type: course?.type ?? getCourseTypeForCode(catalog, course?.code),
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
            if (children.length < 2) continue;
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
                    subjectColor: groupMeta?.subjectColor ?? "#2563eb",
                },
                position: { x: children[0].position.x, y: children[0].position.y },
                draggable: true,
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
        MIN_GROUP_CHILD_Y,
        catalog,
        doneCourseCodes,
        laneNodes,
        maxSemesterCount,
        programCode,
        removeModuleGroup,
        removeCourseNode,
        setCoursesFromNodes,
        setNodes,
        subjectColors,
        toggleCourseDone,
        toggleModuleDoneCodes,
        updateCourseEcts,
    ]);

    const applyMasterPrefilledPlan = useCallback(() => {
        if (programCode !== MASTER_PROGRAM_CODE) return false;
        const { plannedCourses, missingAliases } = buildMasterPrefillPlan(catalog);
        if (!plannedCourses.length) {
            setStickyViolation({
                message: "Prebuilt master plan could not be applied (no matching catalog courses found).",
                until: Date.now() + 5000,
                tone: "error",
            });
            return false;
        }

        const doneSet = new Set(doneCourseCodes || []);
        const bySemester = new Map();
        for (const item of plannedCourses) {
            const semester = Number(item?.semester);
            if (!Number.isInteger(semester) || semester < 1 || semester > maxSemesterCount) continue;
            if (!bySemester.has(semester)) bySemester.set(semester, []);
            bySemester.get(semester).push(item);
        }

        const now = Date.now();
        const rebuilt = [...laneNodes];
        let sequence = 0;
        for (let semesterId = 1; semesterId <= maxSemesterCount; semesterId += 1) {
            const laneIndex = semesterId - 1;
            const list = bySemester.get(semesterId) || [];
            list.forEach((course, idx) => {
                const examSubject = course?.examSubject ?? getExamSubjectForCode(catalog, course?.code);
                const subjectColor =
                    (examSubject ? subjectColors?.[examSubject] : null) ||
                    "#2563eb";
                const id = `${course?.code || "course"}-prefill-master-${now}-${sequence}`;
                sequence += 1;
                rebuilt.push({
                    id,
                    type: "course",
                    data: {
                        label: course?.name || course?.code || "Course",
                        code: course?.code ?? null,
                        type: course?.type ?? getCourseTypeForCode(catalog, course?.code),
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
        laneNodes,
        maxSemesterCount,
        programCode,
        removeCourseNode,
        setCoursesFromNodes,
        setNodes,
        subjectColors,
        toggleCourseDone,
        updateCourseEcts,
    ]);

    /************************
     * Group drag mechanics *
     ************************/
    const onNodeDragStart = useCallback((_, node) => {
        if (node?.type !== "moduleBg") return;
        groupDragRef.current.set(node.id, { lastX: node.position.x, lastY: node.position.y });
    }, []);

    const onNodeDrag = useCallback((_, node) => {
        const rawLane = laneIndexFromX(node?.position?.x ?? 0, maxSemesterCount - 1);
        if (rawLane === activeSemesterCount && activeSemesterCount < maxSemesterCount) {
            setDragPreviewSemesterCount(activeSemesterCount + 1);
        } else {
            setDragPreviewSemesterCount(null);
        }

        // Dragging a module background: move all children by the same live delta.
        if (node?.type === "moduleBg") {
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
            return;
        }

        // Dragging a child course inside a module: keep the module background synced live.
        if (node?.type === "course" && node?.data?.groupId) {
            const groupId = node.data.groupId;
            setNodes((prev) => {
                const withDraggedCourse = prev.map((n) => (
                    n.id === node.id ? { ...n, position: { x: node.position.x, y: node.position.y } } : n
                ));
                return recomputeGroupFromChildren(withDraggedCourse, groupId);
            });
        }
    }, [activeSemesterCount, maxSemesterCount, setNodes]);

    /** Mark that we should persist after the next nodes commit. */
    const schedulePersist = useCallback(() => setNeedsPersist(true), []);

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
        setNodes((prev) => {
            const groupStatuses = new Map();
            for (const n of prev) {
                if (n.type !== "course" || !n?.data?.groupId) continue;
                const groupId = n.data.groupId;
                const nextCourseStatus = doneSet.has(n?.data?.code) ? "done" : "in_plan";
                const current = groupStatuses.get(groupId) || { total: 0, done: 0 };
                current.total += 1;
                if (nextCourseStatus === "done") current.done += 1;
                groupStatuses.set(groupId, current);
            }

            return prev.map((n) => {
                if (n.type === "course") {
                    const status = doneSet.has(n?.data?.code) ? "done" : "in_plan";
                    if (n?.data?.status === status) return n;
                    return { ...n, data: { ...n.data, status } };
                }
                if (n.type === "moduleBg") {
                    const group = groupStatuses.get(n.id);
                    if (!group || group.total <= 0) return n;
                    const status = group.done === group.total ? "done" : "in_plan";
                    if (n?.data?.status === status) return n;
                    return { ...n, data: { ...n.data, status } };
                }
                return n;
            });
        });
    }, [doneCourseCodes, setNodes]);

    // Notify backend rule-check endpoint on each plan/status change.
    useEffect(() => {
        if (!lastPlanChange) return;
        const requestProgramCode = programCode;
        latestRuleCheckChangeIdRef.current = {
            ...(latestRuleCheckChangeIdRef.current || {}),
            [requestProgramCode]: lastPlanChange.id ?? null,
        };
        const doneSet = new Set(doneCourseCodes || []);
        const allCourses = Object.values(coursesBySemester || {})
            .flat()
            .map((course) => normalizeRulecheckCategoryForProgram(course, requestProgramCode));
        const doneCourses = allCourses.filter((c) => c?.code && doneSet.has(c.code));
        const plannedCourses = allCourses.filter((c) => c?.code && !doneSet.has(c.code));
        const changeSnapshot = lastPlanChange;
        const changeIdSnapshot = changeSnapshot.id ?? null;

        setProgramRuleCheckState(requestProgramCode, (prev) => ({ ...prev, sending: true, error: "" }));
        sendRuleCheckUpdate({
            programCode: requestProgramCode,
            plannedCourses,
            doneCourses,
            change: changeSnapshot,
            selectedFocus: requestProgramCode === BACHELOR_PROGRAM_CODE ? (selectedFocus || null) : null,
        })
            .then((response) => {
                if ((latestRuleCheckChangeIdRef.current?.[requestProgramCode] ?? null) !== changeIdSnapshot) return;
                setProgramRuleCheckState(requestProgramCode, {
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
                        tone: "error",
                    });
                    rollbackAddedCourses(changeSnapshot);
                }
                const isStatusToggleChange = changeSnapshot?.type === "course_status_toggled";
                if (isStatusToggleChange && response?.ok === false) {
                    setStickyViolation({
                        message: response?.message || "Rule violation: change rejected.",
                        until: Date.now() + 5000,
                        tone: "error",
                    });
                    rollbackCourseStatusToggle(changeSnapshot);
                }
            })
            .catch((err) => {
                if ((latestRuleCheckChangeIdRef.current?.[requestProgramCode] ?? null) !== changeIdSnapshot) return;
                console.error("Failed to send rulecheck update", err);
                setStickyViolation({
                    message: String(err?.message || err),
                    until: Date.now() + 5000,
                    tone: "error",
                });
                setProgramRuleCheckState(requestProgramCode, (prev) => ({
                    ...prev,
                    sending: false,
                    error: String(err?.message || err),
                    lastUpdatedAt: Date.now(),
                }));
            });
    }, [coursesBySemester, doneCourseCodes, lastPlanChange, programCode, rollbackAddedCourses, rollbackCourseStatusToggle, selectedFocus, setProgramRuleCheckState]);

    // Initial sync for current program so dashboard has data before first edit.
    useEffect(() => {
        if (!plannerHydrated) return;
        if (pendingInitialSyncProgramRef.current !== programCode) return;
        const requestProgramCode = programCode;
        const allCourses = Object.values(coursesBySemester || {})
            .flat()
            .map((course) => normalizeRulecheckCategoryForProgram(course, requestProgramCode));

        const doneSet = new Set(doneCourseCodes || []);
        const doneCourses = allCourses.filter((c) => c?.code && doneSet.has(c.code));
        const plannedCourses = allCourses.filter((c) => c?.code && !doneSet.has(c.code));

        setProgramRuleCheckState(requestProgramCode, (prev) => ({ ...prev, sending: true, error: "" }));
        sendRuleCheckUpdate({
            programCode: requestProgramCode,
            plannedCourses,
            doneCourses,
            change: { type: "initial_sync" },
            selectedFocus: requestProgramCode === BACHELOR_PROGRAM_CODE ? (selectedFocus || null) : null,
        })
            .then((response) => {
                setProgramRuleCheckState(requestProgramCode, {
                    sending: false,
                    error: "",
                    response,
                    lastUpdatedAt: Date.now(),
                });
                pendingInitialSyncProgramRef.current = null;
            })
            .catch((err) => {
                setProgramRuleCheckState(requestProgramCode, (prev) => ({
                    ...prev,
                    sending: false,
                    error: String(err?.message || err),
                    lastUpdatedAt: Date.now(),
                }));
                pendingInitialSyncProgramRef.current = null;
            });
    }, [plannerHydrated, coursesBySemester, doneCourseCodes, programCode, selectedFocus, setProgramRuleCheckState]);

    useEffect(() => {
        if (!stickyViolation?.message) return;
        const waitMs = Math.max(0, (stickyViolation.until || 0) - Date.now());
        const t = window.setTimeout(() => {
            setStickyViolation({ message: "", until: 0, tone: "" });
        }, waitMs);
        return () => window.clearTimeout(t);
    }, [stickyViolation]);

    /***************************
     * Snap & collision resolve *
     ***************************/
    const onNodeDragStop = useCallback((_, node) => {
        setDragPreviewSemesterCount(null);
        const snappedYRaw = Math.round(node.position.y / GRID_SIZE) * GRID_SIZE;
        const snappedY = Math.max(0, snappedYRaw);

        // If a whole module group was dragged: shift children by the snap delta, snap the group,
        // then recompute the group bbox, and resolve collisions.
        if (node?.type === "moduleBg") {
            setNodes((prev) => {
                const children = prev.filter((n) => n.type === "course" && n.data?.groupId === node.id);
                const clampedGroupY = Math.max(MIN_MODULE_GROUP_TOP_Y, snappedY);
                const dySnap = clampedGroupY - node.position.y;
                const moved = prev.map((n) => {
                    if (n.type === "course" && n.data?.groupId === node.id) {
                        const targetLane = clampPlacementLane(laneIndexFromX(n.position.x, maxSemesterCount - 1));
                        return {
                            ...n,
                            position: {
                                x: centerX(targetLane),
                                y: n.position.y + dySnap,
                            },
                        };
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
                const targetLane = clampPlacementLane(laneIndexFromX(node.position.x, maxSemesterCount - 1));
                const targetLaneX = centerX(targetLane);
                const snappedGroupChildY = Math.max(MIN_GROUP_CHILD_Y, snappedY);
                const updated = prev.map((n) =>
                    n.id === node.id ? { ...n, position: { x: targetLaneX, y: snappedGroupChildY } } : n
                );
                const stacked = resolveGroupCourseOverlaps(updated, groupId);
                return resolveLaneCollisions(recomputeGroupFromChildren(stacked, groupId));
            });
            return;
        }

        // All other nodes: normal snapping + collision resolution
        const li = clampPlacementLane(laneIndexFromX(node.position.x, maxSemesterCount - 1));
        const snappedX = centerX(li);
        setNodes((prev) => {
            const next = prev.map((n) => (n.id === node.id ? { ...n, position: { x: snappedX, y: snappedY } } : n));
            return resolveLaneCollisions(next);
        });
    }, [MIN_GROUP_CHILD_Y, MIN_MODULE_GROUP_TOP_Y, clampPlacementLane, maxSemesterCount, setNodes]);

    // Merge: run drag-stop logic, then schedule a persist
    const onNodeDragStopMerged = useCallback((evt, node) => {
        onNodeDragStop(evt, node);
        schedulePersist();
    }, [onNodeDragStop, schedulePersist]);

    // Handle drop from the sidebar
    const onDrop = useCallback(
        (evt) => {
            evt.preventDefault();
            const dt = evt?.dataTransfer || evt?.nativeEvent?.dataTransfer || null;
            let payload = null;
            const raw = dt ? dt.getData("application/x-course") : "";
            if (raw) {
                try {
                    payload = JSON.parse(raw);
                } catch {
                    payload = null;
                }
            }
            if (!payload && pendingDragPayloadRef.current) {
                payload = pendingDragPayloadRef.current;
            }
            if (!payload) return;
            pendingDragPayloadRef.current = null;
            setDragPreviewSemesterCount(null);

            const { x, y } = projectToLaneAndSnap({
                evt,
                wrapperEl: wrapperRef.current,
                rfInstance: rfRef.current,
                maxLaneIndex: Math.min(maxSemesterCount - 1, activeSemesterCount),
            });
            const now = Date.now();

            // A) Module with >= 2 courses → create group + children
            if (payload?.kind === "module" && Array.isArray(payload.courses) && payload.courses.length >= 2) {
                const groupChildBaseY = Math.max(y, MIN_GROUP_CHILD_Y);
                const variantResolution = resolveModuleVariantCourses(payload, payload?.variantId ?? null);
                const moduleCourses = Array.isArray(variantResolution?.selectedCourses) ? variantResolution.selectedCourses : payload.courses;
                if (!moduleCourses.length) return;
                if (moduleCourses.length === 1) {
                    const single = moduleCourses[0];
                    const singlePayload = {
                        code: single?.code ?? payload?.code,
                        name: single?.name ?? payload?.name,
                        type: single?.type ?? payload?.type ?? getCourseTypeForCode(catalog, single?.code ?? payload?.code),
                        ects: single?.ects ?? payload?.ects ?? null,
                        category: payload?.category ?? null,
                        subjectColor: payload?.subjectColor ?? null,
                    };
                    const id = `${singlePayload.code}-${now}`;
                    const examSubject = getExamSubjectForCode(catalog, singlePayload.code);
                    const resolvedSubjectColor =
                        singlePayload.subjectColor ||
                        (examSubject ? subjectColors?.[examSubject] : null) ||
                        "#2563eb";
                    setNodes((prev) => {
                        const next = prev.concat({
                            id,
                            type: "course",
                            data: {
                                label: singlePayload.name,
                                code: singlePayload.code,
                                type: singlePayload.type ?? null,
                                ects: singlePayload.ects ?? null,
                                moduleMeta: null,
                                onRemove: removeCourseNode,
                                onToggleDone: toggleCourseDone,
                                onUpdateEcts: updateCourseEcts,
                                nodeId: id,
                                examSubject,
                                category: singlePayload.category ?? "unknown",
                                programCode,
                                subjectColor: resolvedSubjectColor,
                                status: "in_plan",
                            },
                            position: { x, y: groupChildBaseY },
                            sourcePosition: "right",
                            targetPosition: "left",
                            zIndex: 1,
                        });
                        return resolveLaneCollisions(next);
                    });
                    schedulePersist();
                    return;
                }
                const groupId = `mod-${now}`;
                const groupExamSubject =
                    getExamSubjectForCode(catalog, payload.code) ||
                    getExamSubjectForCode(catalog, moduleCourses?.[0]?.code) ||
                    null;
                const resolvedGroupSubjectColor =
                    payload.subjectColor ||
                    (groupExamSubject ? subjectColors?.[groupExamSubject] : null) ||
                    "#2563eb";

                const groupNode = {
                    id: groupId,
                    type: "moduleBg",
                    data: {
                        title: `${payload.name}`,
                        code: null,
                        moduleCode: payload?.code ?? null,
                        moduleEcts: payload?.ects ?? null,
                        moduleCourseCount: moduleCourses?.length ?? 0,
                        moduleCourseCodes: moduleCourses?.map((c) => c?.code).filter(Boolean) ?? [],
                        status: "in_plan",
                        groupId,
                        onRemoveGroup: removeModuleGroup,
                        onRemove: () => removeModuleGroup(groupId),
                        onToggleModuleDone: toggleModuleDoneCodes,
                        examSubject: groupExamSubject,
                        category: payload.category ?? "unknown",
                        programCode,
                        subjectColor: resolvedGroupSubjectColor,
                    },
                    position: { x, y: groupChildBaseY }, // preliminary; will be resized by recomputeGroupFromChildren
                    draggable: true,
                    selectable: false,
                    zIndex: 0,
                };

                const childCourseNodes = moduleCourses.map((course, idx) => {
                    const childId = `${course.code}-${now}-${idx}`;
                    const baseY = groupChildBaseY + idx * (COURSE_LAYOUT_HEIGHT + COURSE_VERTICAL_GAP);
                    const examSubject =
                        getExamSubjectForCode(catalog, course.code) || getExamSubjectForCode(catalog, payload.code);
                    const resolvedCourseSubjectColor =
                        (examSubject ? subjectColors?.[examSubject] : null) ||
                        resolvedGroupSubjectColor;

                    return {
                        id: childId,
                        type: "course",
                        data: {
                            label: course.name,
                            code: course.code,
                            type: course?.type ?? getCourseTypeForCode(catalog, course?.code),
                            ects: course.ects ?? null,
                            groupId,
                            baseY,
                            onRemove: removeCourseNode,
                            onRemoveModuleGroup: removeModuleGroup,
                            onToggleDone: toggleCourseDone,
                            onUpdateEcts: updateCourseEcts,
                            nodeId: childId,
                            examSubject,
                            category: payload.category ?? "unknown",
                            programCode,
                            subjectColor: resolvedCourseSubjectColor,
                            status: "in_plan",
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
                        type: payload?.type ?? getCourseTypeForCode(catalog, payload?.code),
                        ects: payload.ects ?? null,
                        moduleMeta: payload?.moduleMeta ?? null,
                        onRemove: removeCourseNode,
                        onToggleDone: toggleCourseDone,
                        onUpdateEcts: updateCourseEcts,
                        nodeId: id,
                        examSubject,
                        category: payload.category ?? "unknown",
                        programCode,
                        subjectColor: resolvedSubjectColor,
                        status: "in_plan",
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
        [MIN_GROUP_CHILD_Y, activeSemesterCount, catalog, getCourseStatus, maxSemesterCount, removeCourseNode, removeModuleGroup, subjectColors, toggleCourseDone, toggleModuleDoneCodes, updateCourseEcts]
    );

    useEffect(() => {
        if (!plannerHydrated) return;
        if (!Array.isArray(catalog) || catalog.length === 0) return;
        if (hydratedProgramRef.current === programCode) return;

        const doneSet = new Set(doneCourseCodes || []);
        const courseRows = [];
        for (const semesterId of semesterIdsFromPlan) {
            const laneIndex = semesterId - 1;
            const list = Array.isArray(coursesBySemester?.[semesterId]) ? coursesBySemester[semesterId] : [];
            for (const course of list) {
                courseRows.push({
                    ...course,
                    laneIndex: Number.isFinite(course?.laneIndex) ? course.laneIndex : laneIndex,
                });
            }
        }

        const grouped = new Map();
        const standalone = [];
        for (const course of courseRows) {
            if (course?.module?.id) {
                const key = course.module.id;
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key).push(course);
            } else {
                standalone.push(course);
            }
        }

        const rebuilt = [...laneNodes];
        const groupIds = [];

        for (const [groupId, children] of grouped.entries()) {
            const first = children[0] || {};
            const moduleMeta = first?.module || {};
            const codes = children.map((c) => c?.code).filter(Boolean);
            const status = children.every((c) => doneSet.has(c?.code))
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
                    subjectColor: moduleMeta?.subjectColor ?? first?.subjectColor ?? "#2563eb",
                },
                position: { x: 0, y: 0 },
                draggable: true,
                selectable: false,
                zIndex: 0,
            });
            groupIds.push(groupId);

            children.forEach((course, idx) => {
                const laneIndex = Math.max(0, Math.min(Number(course?.laneIndex) || 0, maxSemesterCount - 1));
                const x = Number.isFinite(course?.position?.x) ? course.position.x : centerX(laneIndex);
                const y = Number.isFinite(course?.position?.y)
                    ? course.position.y
                    : (96 + idx * (COURSE_LAYOUT_HEIGHT + COURSE_VERTICAL_GAP));
                rebuilt.push({
                    id: course?.id || `${course?.code || "course"}-${groupId}-${idx}`,
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
                        nodeId: course?.id || `${course?.code || "course"}-${groupId}-${idx}`,
                        examSubject: course?.examSubject ?? moduleMeta?.examSubject ?? null,
                        category: course?.category ?? moduleMeta?.category ?? "unknown",
                        programCode,
                        subjectColor: course?.subjectColor ?? moduleMeta?.subjectColor ?? "#2563eb",
                        status: doneSet.has(course?.code) ? "done" : "in_plan",
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
                : (96 + idx * (COURSE_LAYOUT_HEIGHT + COLLISION_GAP));
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
                    subjectColor: course?.subjectColor ?? "#2563eb",
                    status: doneSet.has(course?.code) ? "done" : "in_plan",
                },
                position: { x, y },
                sourcePosition: "right",
                targetPosition: "left",
                zIndex: 1,
            });
        });

        let withGroups = rebuilt;
        for (const groupId of groupIds) {
            withGroups = recomputeGroupFromChildren(withGroups, groupId);
        }
        const resolved = resolveLaneCollisions(withGroups);
        setNodes(resolved);
        setNeedsPersist(false);
        pendingInitialSyncProgramRef.current = programCode;
        hydratedProgramRef.current = programCode;
    }, [
        plannerHydrated,
        programCode,
        catalog,
        coursesBySemester,
        doneCourseCodes,
        laneNodes,
        maxSemesterCount,
        removeCourseNode,
        removeModuleGroup,
        semesterIdsFromPlan,
        subjectColors,
        toggleCourseDone,
        toggleModuleDoneCodes,
        updateCourseEcts,
        setNodes,
    ]);

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

    /***********
     * Render  *
     ***********/
    const {
        ruleOk,
        ruleStats,
        isBachelorDashboard,
        ectsStats,
        allPlannedCourses,
        hasAnyPlannedOrDoneCourses,
        shouldOfferInitialBachelorPrefill,
        shouldOfferInitialMasterPrefill,
        doneCodesSet,
        doneEctsKpi,
        plannedEctsKpi,
        totalEctsKpi,
        targetEctsKpi,
        buckets,
        perSemester,
        byCategory,
        byExamSubject,
        bachelorTotalEcts,
        bachelorMissingTo180,
        bachelorNarrow,
        bachelorFocus,
        bachelorTransferableEcts,
        bachelorNarrowCompleted,
        bachelorNarrowRequired,
        donePctKpi,
        totalPctKpi,
        renderKpiProgress,
        steopMandatoryRequiredEcts,
        steopPoolRequiredEcts,
        steopRequiredEcts,
        doneCoursesLocal,
        steopDoneProgress,
        steopMandatoryDoneEcts,
        steopPoolDoneEcts,
        steopDoneEcts,
        steopDonePct,
        steopMandatoryPlannedEcts,
        steopPoolPlannedEcts,
        steopPlannedEcts,
        steopPlannedPct,
        bachelorSteopComplete,
        bachelorSteopPlannedComplete,
        steopMandatoryChecklist,
        steopPoolChecklist,
        steopMandatoryChecklistPlanned,
        steopPoolChecklistPlanned,
        bachelorSteopLane,
        bachelorSteopPlannedLane,
        examSubjectProgress,
        examSubjectDoneEctsTotal,
        examSubjectTotalEctsTotal,
        examSubjectTotalDoneCount,
        examSubjectTotalCourseCount,
        examSubjectAggregatePct,
        perSemesterRows,
        donePerSemesterRows,
        donePerSemesterTotal,
        perSemesterPlannedTotal,
        workloadTargetPerSemester,
        perSemesterWithinDesiredWorkload,
        baselineWorkloadScale,
        maxSemesterWorkloadForScale,
        donePerSemesterWithinDesiredWorkload,
        maxDoneSemesterWorkloadForScale,
        byCategoryRows,
        byCategoryTotalEcts,
        topByCategoryRow,
        donePerCategoryProgressRows,
        donePerCategoryPlannedTotalEcts,
        donePerCategoryDoneTotalEcts,
        donePerCategoryCompleteCount,
        warnings,
        bachelorFocusMissingCount,
        bachelorFocusComplete,
        bachelorFocusMissingCountPlanned,
        bachelorFocusCompletePlanned,
        focusChecklist,
        focusChecklistPlanned,
        focusChecklistDoneCount,
        focusChecklistTotalCount,
        focusRequiredItems,
        focusChooseItems,
        focusChooseSummary,
        focusChooseGroupsSummary,
        focusChooseGroupRows,
        focusRequiredItemsPlanned,
        focusChooseItemsPlanned,
        focusChooseSummaryPlanned,
        focusChooseGroupsSummaryPlanned,
        focusChooseGroupRowsPlanned,
        focusRequiredDoneCount,
        focusRequiredNeedCount,
        focusChooseNeedCount,
        focusChooseDoneCount,
        focusChooseGroupsNeedCount,
        focusChooseGroupsDoneCount,
        focusRequiredDoneCountPlanned,
        focusRequiredNeedCountPlanned,
        focusChooseNeedCountPlanned,
        focusChooseDoneCountPlanned,
        focusChooseGroupsNeedCountPlanned,
        focusChooseGroupsDoneCountPlanned,
        focusRequirementDoneCount,
        focusRequirementTotalCount,
        focusChecklistPct,
        focusRequirementDoneCountPlanned,
        focusRequirementTotalCountPlanned,
        focusChecklistPctPlanned,
        bachelorModuleProgress,
        bachelorThesisHave,
        masterModuleProgress,
        moduleProgressForDashboard,
        requirementItems,
        fulfilledRequirementsCount,
        totalRequirementsCount,
        requirementsPct,
        plannedEctsByExamSubjectRows,
        plannedEctsByExamSubjectTotal,
        violations,
        missingItems,
        hasMissingRequirements,
        hasWarnings,
        plannedChecklistComplete,
        doneChecklistComplete,
        getDashboardModeButtonStyle,
        stickyActive,
        feedbackText,
        feedbackBg,
        feedbackBorder,
        feedbackColor,
    } = useDashboardMetrics({
        ruleCheckState,
        programCode,
        bachelorProgramCode: BACHELOR_PROGRAM_CODE,
        masterProgramCode: MASTER_PROGRAM_CODE,
        coursesBySemester,
        doneCourseCodes,
        plannerHydrated,
        dismissedInitialPrefillPrompt,
        minSemesterCount,
        selectedFocus,
        catalog,
        dashboardViewMode,
        stickyViolation,
        resolveDashboardCategoryForProgram,
        getExamSubjectForCode,
    });
    const hasSelectedFocusArea = Boolean(String(selectedFocus || bachelorFocus?.selected || "").trim());
    useEffect(() => {
        if (!hasMissingRequirements && isMissingRequirementsOpen) setIsMissingRequirementsOpen(false);
    }, [hasMissingRequirements, isMissingRequirementsOpen]);

    useEffect(() => {
        if (!hasWarnings && isWarningsOpen) setIsWarningsOpen(false);
    }, [hasWarnings, isWarningsOpen]);

    useEffect(() => {
        if (!plannerHydrated) return;
        const last = progressMilestoneRef.current;
        const roundedPct = Math.round(totalPctKpi);
        if (last?.programCode !== programCode) {
            progressMilestoneRef.current = { programCode, pct: roundedPct };
            return;
        }
        const milestones = [25, 50, 75, 100];
        const crossed = milestones.find((m) => last.pct < m && roundedPct >= m);
        progressMilestoneRef.current = { programCode, pct: roundedPct };
        if (!crossed) return;
        setProgressMilestone({
            text: `Milestone reached: ${crossed}% completion (${totalEctsKpi.toFixed(1)}/${targetEctsKpi.toFixed(1)} ECTS).`,
            until: Date.now() + 3000,
        });
    }, [plannerHydrated, programCode, targetEctsKpi, totalEctsKpi, totalPctKpi]);

    useEffect(() => {
        if (!progressMilestone?.text) return;
        const waitMs = Math.max(0, (progressMilestone.until || 0) - Date.now());
        const t = window.setTimeout(() => {
            setProgressMilestone({ text: "", until: 0 });
        }, waitMs);
        return () => window.clearTimeout(t);
    }, [progressMilestone]);

    useEffect(() => {
        setFocusPrefillPrompt(null);
        setDismissedInitialPrefillPrompt(false);
    }, [programCode]);

    useEffect(() => {
        const previous = focusSelectionTrackerRef.current;
        const programChanged = previous?.programCode !== programCode;
        const focusChanged = previous?.selectedFocus !== selectedFocus;
        focusSelectionTrackerRef.current = { programCode, selectedFocus };
        if (!plannerHydrated) return;
        if (programChanged || !focusChanged) return;
        if (programCode !== BACHELOR_PROGRAM_CODE) return;
        if (!hasAnyPlannedOrDoneCourses) return;
        setFocusPrefillPrompt({ focus: selectedFocus || "" });
    }, [hasAnyPlannedOrDoneCourses, plannerHydrated, programCode, selectedFocus]);

    const plannerNotificationsNode = (
        <PlannerNotifications
            focusPrefillPrompt={focusPrefillPrompt}
            onApplyFocusPrefill={(focus) => {
                applyBachelorPrefilledPlan(focus);
                setFocusPrefillPrompt(null);
            }}
            onDismissFocusPrefill={() => setFocusPrefillPrompt(null)}
            shouldOfferInitialBachelorPrefill={shouldOfferInitialBachelorPrefill}
            shouldOfferInitialMasterPrefill={shouldOfferInitialMasterPrefill}
            programCode={programCode}
            bachelorProgramCode={BACHELOR_PROGRAM_CODE}
            selectedFocus={selectedFocus}
            onApplyInitialPrefill={(focus) => {
                const applied = programCode === BACHELOR_PROGRAM_CODE
                    ? applyBachelorPrefilledPlan(focus)
                    : applyMasterPrefilledPlan();
                if (applied) setDismissedInitialPrefillPrompt(true);
            }}
            onDismissInitialPrefill={() => setDismissedInitialPrefillPrompt(true)}
            progressMilestoneText={progressMilestone?.text || ""}
        />
    );

    const ruleDashboardAside = isRuleDashboardOpen && (
                    <aside
                        style={{
                            width: 420,
                            borderLeft: "1px solid #e5e7eb",
                            background: "#ffffff",
                            padding: 12,
                            overflow: "auto",
                            display: "flex",
                            flexDirection: "column",
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

                        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
                            <div>Program: {programCode}</div>
                            {programCode === BACHELOR_PROGRAM_CODE && <div>Focus: {selectedFocus || "-"}</div>}
                        </div>
                        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "flex-start" }}>
                                <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", minWidth: 118 }}>
                                    <div style={{ fontSize: 11, color: "#6b7280" }}>Target ECTS</div>
                                    <div style={{ fontSize: 18, fontWeight: 700 }}>{targetEctsKpi.toFixed(1)}</div>
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                    <div style={{ fontSize: 11, color: "#6b7280" }}>Planned ECTS</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: plannedChecklistComplete ? "#166534" : "#111827" }}>{totalEctsKpi.toFixed(1)}</div>
                                    {renderKpiProgress(totalPctKpi, plannedChecklistComplete ? "#16a34a" : "#2563eb")}
                                </div>
                                <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                    <div style={{ fontSize: 11, color: "#6b7280" }}>Done ECTS</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: donePctKpi >= 100 - 1e-6 ? "#166534" : "#111827" }}>{doneEctsKpi.toFixed(1)}</div>
                                    {renderKpiProgress(donePctKpi, donePctKpi >= 100 - 1e-6 ? "#16a34a" : "#2563eb")}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "inline-flex", gap: 6, marginBottom: 12 }}>
                            <button
                                onClick={() => setDashboardViewMode("planning")}
                                style={getDashboardModeButtonStyle("planning")}
                            >
                                Planned
                            </button>
                            <button
                                onClick={() => setDashboardViewMode("progress")}
                                style={getDashboardModeButtonStyle("progress")}
                            >
                                Done
                            </button>
                        </div>

                        {isBachelorDashboard && dashboardViewMode === "planning" && (
                            <div
                                draggable
                                onDragStart={() => handlePlannedSectionDragStart("steop")}
                                onDragOver={(event) => handlePlannedSectionDragOver(event, "steop")}
                                onDrop={() => handlePlannedSectionDrop("steop")}
                                onDragEnd={handlePlannedSectionDragEnd}
                                style={plannedSectionStyle("steop", { marginBottom: 12 })}
                            >
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
                                        Status: <strong style={{ color: bachelorSteopPlannedComplete ? "#166534" : "#991b1b" }}>
                                            {bachelorSteopPlannedComplete ? "completed" : "not completed"}
                                        </strong>
                                    </div>
                                    <div style={{ fontSize: 12 }}>
                                        Complete in semester: <strong>{bachelorSteopPlannedLane == null ? "-" : bachelorSteopPlannedLane + 1}</strong>
                                    </div>
                                    <div style={{ fontSize: 12 }}>
                                        Planned progress: <strong>{steopPlannedEcts.toFixed(1)}</strong> / {steopRequiredEcts.toFixed(1)} ECTS
                                        {" "}(
                                        mandatory {steopMandatoryPlannedEcts.toFixed(1)}/{steopMandatoryRequiredEcts.toFixed(1)},
                                        {" "}pool {steopPoolPlannedEcts.toFixed(1)}/{steopPoolRequiredEcts.toFixed(1)}
                                        )
                                    </div>
                                    <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                                        <div style={{ width: `${steopPlannedPct}%`, height: "100%", background: bachelorSteopPlannedComplete ? "#16a34a" : "#2563eb" }} />
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Required courses</div>
                                        <button
                                            onClick={() => setIsSteopChecklistOpen((v) => !v)}
                                            style={{
                                                border: "1px solid #d1d5db",
                                                background: "#ffffff",
                                                borderRadius: 999,
                                                padding: "2px 8px",
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: "pointer",
                                            }}
                                        >
                                            {isSteopChecklistOpen ? "Collapse" : "Expand"}
                                        </button>
                                    </div>
                                    {isSteopChecklistOpen && (
                                        <>
                                            {steopMandatoryChecklistPlanned
                                                .filter((row) => !bachelorSteopPlannedComplete || row.done)
                                                .map((row, idx) => (
                                                <div key={`steop-man-planned-${idx}`} style={{ fontSize: 12, color: row.done ? "#166534" : "#991b1b" }}>
                                                    {row.done ? "✓" : "○"} {row.label}
                                                </div>
                                            ))}
                                            <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>
                                                Pool requirement (need at least {steopPoolRequiredEcts.toFixed(1)} ECTS):
                                            </div>
                                            {steopPoolChecklistPlanned
                                                .filter((row) => !bachelorSteopPlannedComplete || row.done)
                                                .map((row, idx) => (
                                                <div key={`steop-pool-planned-${idx}`} style={{ fontSize: 12, color: row.done ? "#166534" : "#991b1b" }}>
                                                    {row.done ? "✓" : "○"} {row.label}
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {isBachelorDashboard && hasSelectedFocusArea && dashboardViewMode === "planning" && (
                            <div
                                draggable
                                onDragStart={() => handlePlannedSectionDragStart("focus")}
                                onDragOver={(event) => handlePlannedSectionDragOver(event, "focus")}
                                onDrop={() => handlePlannedSectionDrop("focus")}
                                onDragEnd={handlePlannedSectionDragEnd}
                                style={plannedSectionStyle("focus", { marginBottom: 12 })}
                            >
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
                                    <div style={{ fontSize: 12 }}>Selected: <strong>{bachelorFocus?.selected || selectedFocus || "-"}</strong></div>
                                    <div style={{ fontSize: 12 }}>
                                        Status: <strong style={{ color: bachelorFocusCompletePlanned ? "#166534" : "#991b1b" }}>
                                            {bachelorFocusCompletePlanned ? "completed" : "not completed"}
                                        </strong>
                                    </div>
                                    <div style={{ fontSize: 12 }}>
                                        Checklist progress: <strong>{focusRequirementDoneCountPlanned}</strong> / {focusRequirementTotalCountPlanned}
                                    </div>
                                    <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                                        <div style={{ width: `${focusChecklistPctPlanned}%`, height: "100%", background: bachelorFocusCompletePlanned ? "#16a34a" : "#2563eb" }} />
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Required modules</div>
                                        <button
                                            onClick={() => setIsFocusChecklistOpen((v) => !v)}
                                            style={{
                                                border: "1px solid #d1d5db",
                                                background: "#ffffff",
                                                borderRadius: 999,
                                                padding: "2px 8px",
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: "pointer",
                                            }}
                                        >
                                            {isFocusChecklistOpen ? "Collapse" : "Expand"}
                                        </button>
                                    </div>
                                    {isFocusChecklistOpen && (
                                        <>
                                            {focusChecklistPlanned.length === 0 && (
                                                <div style={{ fontSize: 12, color: "#6b7280" }}>No detailed focus checklist available.</div>
                                            )}
                                            {focusRequiredItemsPlanned.length > 0 && (
                                                <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginTop: 2 }}>Mandatory modules</div>
                                            )}
                                            {focusRequiredItemsPlanned
                                                .filter((item) => !bachelorFocusCompletePlanned || Boolean(item?.done))
                                                .map((item, idx) => (
                                                <div key={`focus-req-planned-${idx}`} style={{ fontSize: 12, color: item?.done ? "#166534" : "#991b1b" }}>
                                                    {item?.done ? "✓" : "○"} {item?.label}
                                                </div>
                                            ))}
                                            {focusChooseItemsPlanned.length > 0 && (
                                                <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginTop: 4 }}>
                                                    Choose {Number(focusChooseSummaryPlanned?.min || 0)} from {focusChooseItemsPlanned.length} modules
                                                    {focusChooseSummaryPlanned ? ` (${Number(focusChooseSummaryPlanned?.done || 0)} done)` : ""}
                                                </div>
                                            )}
                                            {focusChooseItemsPlanned
                                                .filter((item) => !bachelorFocusCompletePlanned || Boolean(item?.done))
                                                .map((item, idx) => (
                                                <div key={`focus-choose-planned-${idx}`} style={{ fontSize: 12, color: item?.done ? "#166534" : "#991b1b" }}>
                                                    {item?.done ? "✓" : "○"} {item?.label}
                                                </div>
                                            ))}
                                            {focusChooseGroupRowsPlanned.map((group, gIdx) => (
                                                <div key={`focus-group-planned-${gIdx}`} style={{ display: "grid", gap: 4 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginTop: 4 }}>
                                                        Choose {Number(group?.summary?.min || 0)} from {group.items.length} modules
                                                        {group?.summary ? ` (${Number(group.summary?.done || 0)} done)` : ""}
                                                    </div>
                                                    {group.items
                                                        .filter((item) => !bachelorFocusCompletePlanned || Boolean(item?.done))
                                                        .map((item, idx) => (
                                                        <div key={`focus-group-item-planned-${gIdx}-${idx}`} style={{ fontSize: 12, color: item?.done ? "#166534" : "#991b1b" }}>
                                                            {item?.done ? "✓" : "○"} {item?.label}
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {dashboardViewMode === "planning" && (
                            <div
                                draggable
                                onDragStart={() => handlePlannedSectionDragStart("planned_exam_subject")}
                                onDragOver={(event) => handlePlannedSectionDragOver(event, "planned_exam_subject")}
                                onDrop={() => handlePlannedSectionDrop("planned_exam_subject")}
                                onDragEnd={handlePlannedSectionDragEnd}
                                style={plannedSectionStyle("planned_exam_subject", { marginBottom: 12 })}
                            >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700 }}>Planned per Exam Subject (ECTS)</div>
                                    <button
                                        onClick={() => setIsPlannedExamSubjectOpen((v) => !v)}
                                        style={{
                                            border: "1px solid #d1d5db",
                                            background: "#ffffff",
                                            borderRadius: 999,
                                            padding: "2px 8px",
                                            fontSize: 11,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                        }}
                                    >
                                        {isPlannedExamSubjectOpen ? "Collapse" : "Expand"}
                                    </button>
                                </div>
                                <div style={{ display: "grid", gap: 4, marginBottom: isPlannedExamSubjectOpen ? 6 : 0 }}>
                                    <div style={{ fontSize: 12, color: "#374151" }}>
                                        Planned <strong>{plannedEctsByExamSubjectTotal.toFixed(1)} ECTS</strong> across <strong>{plannedEctsByExamSubjectRows.length}</strong> exam subject{plannedEctsByExamSubjectRows.length === 1 ? "" : "s"}
                                    </div>
                                    <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden", display: "flex" }}>
                                        {plannedEctsByExamSubjectRows.length === 0 && <div style={{ width: "100%", height: "100%", background: "#d1d5db" }} />}
                                        {plannedEctsByExamSubjectRows.map((row, idx) => {
                                            const pct = plannedEctsByExamSubjectTotal > 0
                                                ? Math.max(0, Math.min(100, (Number(row?.ects || 0) / plannedEctsByExamSubjectTotal) * 100))
                                                : 0;
                                            const color = subjectColors?.[row?.subject] || "#9ca3af";
                                            return (
                                                <div
                                                    key={`planned-exam-segment-${idx}`}
                                                    title={`${row?.subject}: ${Number(row?.ects || 0).toFixed(1)} ECTS`}
                                                    style={{ width: `${pct}%`, height: "100%", background: color }}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                                {isPlannedExamSubjectOpen && (
                                    <div style={{ display: "grid", gap: 6 }}>
                                        {plannedEctsByExamSubjectRows.length === 0 && (
                                            <div style={{ fontSize: 12, color: "#6b7280" }}>No planned exam-subject ECTS yet.</div>
                                        )}
                                        {plannedEctsByExamSubjectRows.map((row, idx) => {
                                            const pct = plannedEctsByExamSubjectTotal > 0
                                                ? Math.max(0, Math.min(100, (Number(row?.ects || 0) / plannedEctsByExamSubjectTotal) * 100))
                                                : 0;
                                            const color = subjectColors?.[row?.subject] || "#9ca3af";
                                            return (
                                                <div key={`${row?.subject}-${idx}`} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{row?.subject}</div>
                                                    <div style={{ fontSize: 11, color: "#374151", marginBottom: 4 }}>
                                                        {Number(row?.ects || 0).toFixed(1)} ECTS planned ({pct.toFixed(1)}%)
                                                    </div>
                                                    <div style={{ height: 6, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                                                        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {dashboardViewMode === "planning" && !isBachelorDashboard && (
                            <div
                                draggable
                                onDragStart={() => handlePlannedSectionDragStart("key_buckets")}
                                onDragOver={(event) => handlePlannedSectionDragOver(event, "key_buckets")}
                                onDrop={() => handlePlannedSectionDrop("key_buckets")}
                                onDragEnd={handlePlannedSectionDragEnd}
                                style={plannedSectionStyle("key_buckets", { marginBottom: 12 })}
                            >
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

                        {dashboardViewMode === "planning" && (
                        <div
                            draggable
                            onDragStart={() => handlePlannedSectionDragStart("planned_semester")}
                            onDragOver={(event) => handlePlannedSectionDragOver(event, "planned_semester")}
                            onDrop={() => handlePlannedSectionDrop("planned_semester")}
                            onDragEnd={handlePlannedSectionDragEnd}
                            style={plannedSectionStyle("planned_semester", { marginBottom: 12 })}
                        >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>Planned per Semester (ECTS)</div>
                                <button
                                    onClick={() => setIsPerSemesterEctsOpen((v) => !v)}
                                    style={{
                                        border: "1px solid #d1d5db",
                                        background: "#ffffff",
                                        borderRadius: 999,
                                        padding: "2px 8px",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    {isPerSemesterEctsOpen ? "Collapse" : "Expand"}
                                </button>
                            </div>
                            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: isPerSemesterEctsOpen ? 6 : 0 }}>
                                Target ~ {workloadTargetPerSemester.toFixed(1)} ECTS / semester
                            </div>
                            <div style={{ fontSize: 12, color: perSemesterWithinDesiredWorkload ? "#166534" : "#991b1b", marginBottom: isPerSemesterEctsOpen ? 6 : 0 }}>
                                {perSemesterRows.length === 0
                                    ? "No semester data yet."
                                    : (perSemesterWithinDesiredWorkload
                                        ? "You are under your desired workload in every semester."
                                        : "At least one semester is above your desired workload.")}
                            </div>
                            {isPerSemesterEctsOpen && (
                                <div style={{ display: "grid", gap: 8 }}>
                                    {perSemesterRows.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>No semester data yet.</div>}
                                    {perSemesterRows.map((row) => {
                                        const rowPct = Math.max(0, Math.min(100, (row.ects / maxSemesterWorkloadForScale) * 100));
                                        const targetPct = Math.max(0, Math.min(100, (workloadTargetPerSemester / maxSemesterWorkloadForScale) * 100));
                                        const greenPct = Math.max(0, Math.min(rowPct, targetPct));
                                        const redPct = Math.max(0, rowPct - targetPct);
                                        return (
                                            <div key={row.sem} style={{ display: "grid", gap: 4 }}>
                                                <div style={{ fontSize: 12, color: "#374151", display: "flex", justifyContent: "space-between" }}>
                                                    <span>Semester {row.sem}</span>
                                                    <strong>{row.ects.toFixed(1)} ECTS</strong>
                                                </div>
                                                <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden", position: "relative" }}>
                                                    <div style={{ display: "flex", height: "100%" }}>
                                                        <div style={{ width: `${greenPct}%`, height: "100%", background: "#16a34a" }} />
                                                        {redPct > 0 && <div style={{ width: `${redPct}%`, height: "100%", background: "#dc2626" }} />}
                                                    </div>
                                                    <div
                                                        style={{
                                                            position: "absolute",
                                                            left: `${targetPct}%`,
                                                            top: 0,
                                                            width: 2,
                                                            height: "100%",
                                                            background: "#1f2937",
                                                            opacity: 0.45,
                                                            transform: "translateX(-1px)",
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        )}

                        {dashboardViewMode === "planning" && (
                        <div
                            draggable
                            onDragStart={() => handlePlannedSectionDragStart("planned_category")}
                            onDragOver={(event) => handlePlannedSectionDragOver(event, "planned_category")}
                            onDrop={() => handlePlannedSectionDrop("planned_category")}
                            onDragEnd={handlePlannedSectionDragEnd}
                            style={plannedSectionStyle("planned_category", { marginBottom: 12 })}
                        >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>Planned per Category (ECTS)</div>
                                <button
                                    onClick={() => setIsByCategoryOpen((v) => !v)}
                                    style={{
                                        border: "1px solid #d1d5db",
                                        background: "#ffffff",
                                        borderRadius: 999,
                                        padding: "2px 8px",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    {isByCategoryOpen ? "Collapse" : "Expand"}
                                </button>
                            </div>
                            <div style={{ display: "grid", gap: 4, marginBottom: isByCategoryOpen ? 6 : 0 }}>
                                <div style={{ fontSize: 12, color: "#374151" }}>
                                    Total categorized: <strong>{byCategoryTotalEcts.toFixed(1)} ECTS</strong> across <strong>{byCategoryRows.length}</strong> categories
                                </div>
                                {topByCategoryRow && (
                                    <div style={{ fontSize: 12, color: "#374151" }}>
                                        Largest category: <strong>{topByCategoryRow.category}</strong> ({topByCategoryRow.ects.toFixed(1)} ECTS)
                                    </div>
                                )}
                            </div>
                            {isByCategoryOpen && (
                                <div style={{ display: "grid", gap: 6 }}>
                                    {byCategoryRows.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>No category data yet.</div>}
                                    {byCategoryRows.map((row, idx) => {
                                        const pct = byCategoryTotalEcts > 0
                                            ? Math.max(0, Math.min(100, (row.ects / byCategoryTotalEcts) * 100))
                                            : 0;
                                        return (
                                            <div key={`${row.category}-${idx}`} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                                                    #{idx + 1} {row.category}
                                                </div>
                                                <div style={{ fontSize: 11, color: "#374151", display: "flex", justifyContent: "space-between" }}>
                                                    <span>{row.ects.toFixed(1)} ECTS</span>
                                                    <span>{pct.toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        )}

                        {isBachelorDashboard && dashboardViewMode === "progress" && (
                            <div
                                draggable
                                onDragStart={() => handleDoneSectionDragStart("steop")}
                                onDragOver={(event) => handleDoneSectionDragOver(event, "steop")}
                                onDrop={() => handleDoneSectionDrop("steop")}
                                onDragEnd={handleDoneSectionDragEnd}
                                style={doneSectionStyle("steop", { marginBottom: 12 })}
                            >
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
                                    <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                                        <div style={{ width: `${steopDonePct}%`, height: "100%", background: bachelorSteopComplete ? "#16a34a" : "#2563eb" }} />
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Required courses</div>
                                        <button
                                            onClick={() => setIsSteopChecklistOpen((v) => !v)}
                                            style={{
                                                border: "1px solid #d1d5db",
                                                background: "#ffffff",
                                                borderRadius: 999,
                                                padding: "2px 8px",
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: "pointer",
                                            }}
                                        >
                                            {isSteopChecklistOpen ? "Collapse" : "Expand"}
                                        </button>
                                    </div>
                                    {isSteopChecklistOpen && (
                                        <>
                                            {steopMandatoryChecklist
                                                .filter((row) => !bachelorSteopComplete || row.done)
                                                .map((row, idx) => (
                                                <div key={`steop-man-${idx}`} style={{ fontSize: 12, color: row.done ? "#166534" : "#991b1b" }}>
                                                    {row.done ? "✓" : "○"} {row.label}
                                                </div>
                                            ))}
                                            <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>
                                                Pool requirement (need at least {steopPoolRequiredEcts.toFixed(1)} ECTS):
                                            </div>
                                            {steopPoolChecklist
                                                .filter((row) => !bachelorSteopComplete || row.done)
                                                .map((row, idx) => (
                                                <div key={`steop-pool-${idx}`} style={{ fontSize: 12, color: row.done ? "#166534" : "#991b1b" }}>
                                                    {row.done ? "✓" : "○"} {row.label}
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {isBachelorDashboard && hasSelectedFocusArea && dashboardViewMode === "progress" && (
                            <div
                                draggable
                                onDragStart={() => handleDoneSectionDragStart("focus")}
                                onDragOver={(event) => handleDoneSectionDragOver(event, "focus")}
                                onDrop={() => handleDoneSectionDrop("focus")}
                                onDragEnd={handleDoneSectionDragEnd}
                                style={doneSectionStyle("focus", { marginBottom: 12 })}
                            >
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
                                    <div style={{ fontSize: 12 }}>Selected: <strong>{bachelorFocus?.selected || selectedFocus || "-"}</strong></div>
                                    <div style={{ fontSize: 12 }}>
                                        Status: <strong style={{ color: bachelorFocusComplete ? "#166534" : "#991b1b" }}>
                                            {bachelorFocusComplete ? "completed" : "not completed"}
                                        </strong>
                                    </div>
                                    <div style={{ fontSize: 12 }}>
                                        Checklist progress: <strong>{focusRequirementDoneCount}</strong> / {focusRequirementTotalCount}
                                    </div>
                                    <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                                        <div style={{ width: `${focusChecklistPct}%`, height: "100%", background: bachelorFocusComplete ? "#16a34a" : "#2563eb" }} />
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Required modules</div>
                                        <button
                                            onClick={() => setIsFocusChecklistOpen((v) => !v)}
                                            style={{
                                                border: "1px solid #d1d5db",
                                                background: "#ffffff",
                                                borderRadius: 999,
                                                padding: "2px 8px",
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: "pointer",
                                            }}
                                        >
                                            {isFocusChecklistOpen ? "Collapse" : "Expand"}
                                        </button>
                                    </div>
                                    {isFocusChecklistOpen && (
                                        <>
                                            {focusChecklist.length === 0 && (
                                                <div style={{ fontSize: 12, color: "#6b7280" }}>No detailed focus checklist available.</div>
                                            )}
                                            {focusRequiredItems.length > 0 && (
                                                <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginTop: 2 }}>Mandatory modules</div>
                                            )}
                                            {focusRequiredItems
                                                .filter((item) => !bachelorFocusComplete || Boolean(item?.done))
                                                .map((item, idx) => (
                                                <div key={`focus-req-${idx}`} style={{ fontSize: 12, color: item?.done ? "#166534" : "#991b1b" }}>
                                                    {item?.done ? "✓" : "○"} {item?.label}
                                                </div>
                                            ))}
                                            {focusChooseItems.length > 0 && (
                                                <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginTop: 4 }}>
                                                    Choose {Number(focusChooseSummary?.min || 0)} from {focusChooseItems.length} modules
                                                    {focusChooseSummary ? ` (${Number(focusChooseSummary?.done || 0)} done)` : ""}
                                                </div>
                                            )}
                                            {focusChooseItems
                                                .filter((item) => !bachelorFocusComplete || Boolean(item?.done))
                                                .map((item, idx) => (
                                                <div key={`focus-choose-${idx}`} style={{ fontSize: 12, color: item?.done ? "#166534" : "#991b1b" }}>
                                                    {item?.done ? "✓" : "○"} {item?.label}
                                                </div>
                                            ))}
                                            {focusChooseGroupRows.map((group, gIdx) => (
                                                <div key={`focus-group-${gIdx}`} style={{ display: "grid", gap: 4 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginTop: 4 }}>
                                                        Choose {Number(group?.summary?.min || 0)} from {group.items.length} modules
                                                        {group?.summary ? ` (${Number(group.summary?.done || 0)} done)` : ""}
                                                    </div>
                                                    {group.items
                                                        .filter((item) => !bachelorFocusComplete || Boolean(item?.done))
                                                        .map((item, idx) => (
                                                        <div key={`focus-group-item-${gIdx}-${idx}`} style={{ fontSize: 12, color: item?.done ? "#166534" : "#991b1b" }}>
                                                            {item?.done ? "✓" : "○"} {item?.label}
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {dashboardViewMode === "progress" && (
                            <div
                                draggable
                                onDragStart={() => handleDoneSectionDragStart("exam_subject")}
                                onDragOver={(event) => handleDoneSectionDragOver(event, "exam_subject")}
                                onDrop={() => handleDoneSectionDrop("exam_subject")}
                                onDragEnd={handleDoneSectionDragEnd}
                                style={doneSectionStyle("exam_subject", { marginBottom: 12 })}
                            >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700 }}>Done per Exam Subject (ECTS)</div>
                                    <button
                                        onClick={() => setIsExamSubjectProgressOpen((v) => !v)}
                                        style={{
                                            border: "1px solid #d1d5db",
                                            background: "#ffffff",
                                            borderRadius: 999,
                                            padding: "2px 8px",
                                            fontSize: 11,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                        }}
                                    >
                                        {isExamSubjectProgressOpen ? "Collapse" : "Expand"}
                                    </button>
                                </div>
                                <div style={{ display: "grid", gap: 4, marginBottom: isExamSubjectProgressOpen ? 6 : 0 }}>
                                    <div style={{ fontSize: 12, color: "#374151" }}>
                                        Done <strong>{examSubjectTotalDoneCount}/{examSubjectTotalCourseCount}</strong> courses •{" "}
                                        <strong>{examSubjectDoneEctsTotal.toFixed(1)}/{examSubjectTotalEctsTotal.toFixed(1)} ECTS</strong>
                                    </div>
                                    <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                                        <div style={{ width: `${examSubjectAggregatePct}%`, height: "100%", background: examSubjectAggregatePct >= 100 - 1e-6 ? "#16a34a" : "#2563eb" }} />
                                    </div>
                                </div>
                                {isExamSubjectProgressOpen && (
                                    <div style={{ display: "grid", gap: 6 }}>
                                        {examSubjectProgress.length === 0 && (
                                            <div style={{ fontSize: 12, color: "#6b7280" }}>No exam-subject progress available yet.</div>
                                        )}
                                        {examSubjectProgress.map((row, idx) => {
                                            const totalEcts = Number(row?.totalEcts || 0);
                                            const doneEcts = Number(row?.doneEcts || 0);
                                            const donePct = totalEcts > 0 ? Math.max(0, Math.min(100, (doneEcts / totalEcts) * 100)) : 0;
                                            return (
                                                <div key={`${row?.subject}-${idx}`} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{row?.subject}</div>
                                                    <div style={{ fontSize: 11, color: "#374151", marginBottom: 4 }}>
                                                        Done {row.doneCount}/{row.totalCount} courses • {doneEcts.toFixed(1)}/{totalEcts.toFixed(1)} ECTS
                                                    </div>
                                                    <div style={{ height: 6, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                                                        <div style={{ width: `${donePct}%`, height: "100%", background: donePct >= 100 - 1e-6 ? "#16a34a" : "#2563eb" }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {dashboardViewMode === "progress" && (
                            <div
                                draggable
                                onDragStart={() => handleDoneSectionDragStart("done_semester")}
                                onDragOver={(event) => handleDoneSectionDragOver(event, "done_semester")}
                                onDrop={() => handleDoneSectionDrop("done_semester")}
                                onDragEnd={handleDoneSectionDragEnd}
                                style={doneSectionStyle("done_semester", { marginBottom: 12 })}
                            >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700 }}>Done per Semester (ECTS)</div>
                                    <button
                                        onClick={() => setIsDonePerSemesterEctsOpen((v) => !v)}
                                        style={{
                                            border: "1px solid #d1d5db",
                                            background: "#ffffff",
                                            borderRadius: 999,
                                            padding: "2px 8px",
                                            fontSize: 11,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                        }}
                                    >
                                        {isDonePerSemesterEctsOpen ? "Collapse" : "Expand"}
                                    </button>
                                </div>
                                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: isDonePerSemesterEctsOpen ? 6 : 0 }}>
                                    Target ~ {workloadTargetPerSemester.toFixed(1)} ECTS / semester
                                </div>
                                <div style={{ fontSize: 12, color: donePerSemesterWithinDesiredWorkload ? "#166534" : "#991b1b", marginBottom: isDonePerSemesterEctsOpen ? 6 : 0 }}>
                                    {donePerSemesterRows.length === 0
                                        ? "No done semester data yet."
                                        : (donePerSemesterWithinDesiredWorkload
                                            ? `Done total ${donePerSemesterTotal.toFixed(1)} ECTS and under desired workload in every semester.`
                                            : `Done total ${donePerSemesterTotal.toFixed(1)} ECTS; at least one semester is above desired workload.`)}
                                </div>
                                {isDonePerSemesterEctsOpen && (
                                    <div style={{ display: "grid", gap: 8 }}>
                                        {donePerSemesterRows.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>No done semester data yet.</div>}
                                        {donePerSemesterRows.map((row) => {
                                            const rowPct = Math.max(0, Math.min(100, (row.ects / maxDoneSemesterWorkloadForScale) * 100));
                                            const targetPct = Math.max(0, Math.min(100, (workloadTargetPerSemester / maxDoneSemesterWorkloadForScale) * 100));
                                            const greenPct = Math.max(0, Math.min(rowPct, targetPct));
                                            const redPct = Math.max(0, rowPct - targetPct);
                                            return (
                                                <div key={`done-semester-row-${row.sem}`} style={{ display: "grid", gap: 4 }}>
                                                    <div style={{ fontSize: 12, color: "#374151", display: "flex", justifyContent: "space-between" }}>
                                                        <span>Semester {row.sem}</span>
                                                        <strong>{row.ects.toFixed(1)} ECTS</strong>
                                                    </div>
                                                    <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden", position: "relative" }}>
                                                        <div style={{ display: "flex", height: "100%" }}>
                                                            <div style={{ width: `${greenPct}%`, height: "100%", background: "#16a34a" }} />
                                                            {redPct > 0 && <div style={{ width: `${redPct}%`, height: "100%", background: "#dc2626" }} />}
                                                        </div>
                                                        <div
                                                            style={{
                                                                position: "absolute",
                                                                left: `${targetPct}%`,
                                                                top: 0,
                                                                width: 2,
                                                                height: "100%",
                                                                background: "#1f2937",
                                                                opacity: 0.45,
                                                                transform: "translateX(-1px)",
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {dashboardViewMode === "progress" && (
                            <div
                                draggable
                                onDragStart={() => handleDoneSectionDragStart("category")}
                                onDragOver={(event) => handleDoneSectionDragOver(event, "category")}
                                onDrop={() => handleDoneSectionDrop("category")}
                                onDragEnd={handleDoneSectionDragEnd}
                                style={doneSectionStyle("category", { marginBottom: 12 })}
                            >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700 }}>Done per Category (ECTS)</div>
                                    <button
                                        onClick={() => setIsDoneByCategoryOpen((v) => !v)}
                                        style={{
                                            border: "1px solid #d1d5db",
                                            background: "#ffffff",
                                            borderRadius: 999,
                                            padding: "2px 8px",
                                            fontSize: 11,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                        }}
                                    >
                                        {isDoneByCategoryOpen ? "Collapse" : "Expand"}
                                    </button>
                                </div>
                                <div style={{ display: "grid", gap: 4, marginBottom: isDoneByCategoryOpen ? 6 : 0 }}>
                                    <div style={{ fontSize: 12, color: "#374151" }}>
                                        Done <strong>{donePerCategoryDoneTotalEcts.toFixed(1)} / {donePerCategoryPlannedTotalEcts.toFixed(1)} ECTS</strong> across <strong>{donePerCategoryProgressRows.length}</strong> categories
                                    </div>
                                    {donePerCategoryProgressRows.length > 0 && (
                                        <div style={{ fontSize: 12, color: "#374151" }}>
                                            Fully done categories: <strong>{donePerCategoryCompleteCount}</strong> / {donePerCategoryProgressRows.length}
                                        </div>
                                    )}
                                </div>
                                {isDoneByCategoryOpen && (
                                    <div style={{ display: "grid", gap: 6 }}>
                                        {donePerCategoryProgressRows.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>No done category data yet.</div>}
                                        {donePerCategoryProgressRows.map((row, idx) => {
                                            return (
                                                <div key={`done-by-category-row-${idx}`} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                                                        #{idx + 1} {row.category}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: "#374151", marginBottom: 4 }}>
                                                        {row.doneEcts.toFixed(1)} / {row.plannedEcts.toFixed(1)} ECTS done ({row.pct.toFixed(1)}%)
                                                    </div>
                                                    <div style={{ height: 6, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                                                        <div style={{ width: `${row.pct}%`, height: "100%", background: row.pct >= 100 - 1e-6 ? "#16a34a" : "#2563eb" }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {dashboardViewMode === "planning" && (
                            <>
                                <div
                                    draggable
                                    onDragStart={() => handlePlannedSectionDragStart("missing")}
                                    onDragOver={(event) => handlePlannedSectionDragOver(event, "missing")}
                                    onDrop={() => handlePlannedSectionDrop("missing")}
                                    onDragEnd={handlePlannedSectionDragEnd}
                                    style={plannedSectionStyle("missing", { marginBottom: 12 })}
                                >
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700 }}>Missing Requirements</div>
                                        <button
                                            onClick={() => {
                                                if (!hasMissingRequirements) return;
                                                setIsMissingRequirementsOpen((v) => !v);
                                            }}
                                            disabled={!hasMissingRequirements}
                                            style={{
                                                border: "1px solid #d1d5db",
                                                background: "#ffffff",
                                                borderRadius: 999,
                                                padding: "2px 8px",
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: hasMissingRequirements ? "pointer" : "not-allowed",
                                                opacity: hasMissingRequirements ? 1 : 0.45,
                                            }}
                                        >
                                            {isMissingRequirementsOpen ? "Collapse" : "Expand"}
                                        </button>
                                    </div>
                                    <div style={{ fontSize: 12, color: missingItems.length === 0 ? "#166534" : "#991b1b", marginBottom: isMissingRequirementsOpen ? 6 : 0 }}>
                                        {missingItems.length === 0
                                            ? "No missing requirements."
                                            : `${missingItems.length} missing requirement${missingItems.length === 1 ? "" : "s"}.`}
                                    </div>
                                    {isMissingRequirementsOpen && (
                                        <div style={{ display: "grid", gap: 6 }}>
                                            {missingItems.length === 0 && (
                                                <div style={{ fontSize: 12, color: "#166534" }}>No missing requirements reported.</div>
                                            )}
                                            {missingItems.map((m, idx) => (
                                                <div
                                                    key={`${m}-${idx}`}
                                                    style={{
                                                        fontSize: 12,
                                                        color: "#991b1b",
                                                        border: "1px solid #fecaca",
                                                        borderLeft: "4px solid #dc2626",
                                                        borderRadius: 8,
                                                        background: "#fef2f2",
                                                        padding: "6px 8px",
                                                    }}
                                                >
                                                    {m}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div
                                    draggable
                                    onDragStart={() => handlePlannedSectionDragStart("warnings")}
                                    onDragOver={(event) => handlePlannedSectionDragOver(event, "warnings")}
                                    onDrop={() => handlePlannedSectionDrop("warnings")}
                                    onDragEnd={handlePlannedSectionDragEnd}
                                    style={plannedSectionStyle("warnings", { marginBottom: 12 })}
                                >
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700 }}>Warnings</div>
                                        <button
                                            onClick={() => {
                                                if (!hasWarnings) return;
                                                setIsWarningsOpen((v) => !v);
                                            }}
                                            disabled={!hasWarnings}
                                            style={{
                                                border: "1px solid #d1d5db",
                                                background: "#ffffff",
                                                borderRadius: 999,
                                                padding: "2px 8px",
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: hasWarnings ? "pointer" : "not-allowed",
                                                opacity: hasWarnings ? 1 : 0.45,
                                            }}
                                        >
                                            {isWarningsOpen ? "Collapse" : "Expand"}
                                        </button>
                                    </div>
                                    <div style={{ fontSize: 12, color: warnings.length === 0 ? "#6b7280" : "#92400e", marginBottom: isWarningsOpen ? 6 : 0 }}>
                                        {warnings.length === 0
                                            ? "No warnings."
                                            : `${warnings.length} warning${warnings.length === 1 ? "" : "s"}.`}
                                    </div>
                                    {isWarningsOpen && (
                                        <div style={{ display: "grid", gap: 6 }}>
                                            {warnings.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>No warnings.</div>}
                                            {warnings.map((w, idx) => (
                                                <div
                                                    key={`${w}-${idx}`}
                                                    style={{
                                                        fontSize: 12,
                                                        color: "#92400e",
                                                        border: "1px solid #fde68a",
                                                        borderLeft: "4px solid #f59e0b",
                                                        borderRadius: 8,
                                                        background: "#fffbeb",
                                                        padding: "6px 8px",
                                                    }}
                                                >
                                                    {w}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                            </>
                        )}

                        <div style={{ fontSize: 12, color: "#6b7280", order: 9999, marginTop: 4 }}>
                            Last update: {ruleCheckState.lastUpdatedAt ? new Date(ruleCheckState.lastUpdatedAt).toLocaleTimeString() : "-"}
                        </div>
                    </aside>
                );

    if (viewMode === "graph") {
        return (
            <div style={{ display: "flex", height: "100vh", width: "100vw", background: "#f9fafb" }}>
                {plannerNotificationsNode}
                <button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    style={{
                        position: "fixed",
                        top: 12,
                        right: 12,
                        zIndex: 30,
                        border: "1px solid #d1d5db",
                        background: "#ffffff",
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        opacity: isSigningOut ? 0.65 : 1,
                    }}
                    title={`Signed in as ${currentUser?.username || "user"}`}
                >
                    {isSigningOut ? "⏻ Signing Out..." : `⏻ Sign Out (${currentUser?.username || "user"})`}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <CurriculumGraphView
                        catalog={catalog}
                        catalogError={catalogError}
                        loadingCatalog={loadingCatalog}
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
                        graphStateReady={plannerHydrated && plannerLoadOk}
                        onGraphViewSnapshot={(snapshot) => {
                            latestGraphSnapshotRef.current = snapshot;
                        }}
                        isRuleDashboardOpen={isRuleDashboardOpen}
                        onToggleRuleDashboard={() => setIsRuleDashboardOpen((v) => !v)}
                        isLegendOpen={isLegendOpen}
                        onToggleLegend={() => setIsLegendOpen((v) => !v)}
                        ruleFeedback={{
                            text: feedbackText,
                            bg: feedbackBg,
                            border: feedbackBorder,
                            color: feedbackColor,
                        }}
                    />
                </div>
                {ruleDashboardAside}
            </div>
        );
    }

    return (
        <div style={{ display: "flex", height: "100vh", width: "100vw", background: "#f9fafb" }}>
            {plannerNotificationsNode}
            <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                style={{
                    position: "fixed",
                    top: 12,
                    right: 12,
                    zIndex: 30,
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    opacity: isSigningOut ? 0.65 : 1,
                }}
                title={`Signed in as ${currentUser?.username || "user"}`}
            >
                {isSigningOut ? "⏻ Signing Out..." : `⏻ Sign Out (${currentUser?.username || "user"})`}
            </button>
            <Sidebar
                catalog={catalog}
                loading={loadingCatalog}
                error={catalogError}
                expandedSet={expandedPf}
                togglePf={togglePf}
                onDragStart={handleDragStart}
                subjectColors={subjectColors}
                programCode={programCode}
                onProgramChange={setProgramCode}
                programOptions={PROGRAM_OPTIONS}
                selectedFocus={selectedFocus}
                setSelectedFocus={setSelectedFocus}
                bachelorProgramCode={BACHELOR_PROGRAM_CODE}
                bachelorFocusOptions={BACHELOR_FOCUS_OPTIONS}
                getCourseStatus={getCourseStatus}
                onAddCourseToPlan={addGraphCourseToPlan}
                onAddModuleToPlan={addGraphModuleToPlan}
                onToggleCourseDone={toggleGraphCourseDone}
                onToggleModuleDone={toggleGraphModuleDone}
                onRemoveCourseFromPlan={removeGraphCourseFromPlan}
                onRemoveModuleFromPlan={removeGraphModuleFromPlan}
                semesterOptions={sidebarSemesters}
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
                    <button
                        onClick={() => setIsLegendOpen((v) => !v)}
                        style={{
                            position: "absolute",
                            top: 12,
                            left: 306,
                            zIndex: 5,
                            border: "1px solid #d1d5db",
                            background: "#ffffff",
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        {isLegendOpen ? "Hide Legend" : "Show Legend"}
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

                    <div className="rf-wrapper" ref={wrapperRef} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} style={{ position: "absolute", inset: 0 }}>
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
                            <Controls position="bottom-left" />
                            <Background gap={GRID_SIZE} />
                        </ReactFlow>
                    </div>
                    {isLegendOpen && (
                        <div style={{ position: "absolute", right: 12, bottom: 12, zIndex: 6 }}>
                            <VisualLegend programCode={programCode} />
                        </div>
                    )}
                </div>

                {ruleDashboardAside}
            </div>
        </div>
    );
}
