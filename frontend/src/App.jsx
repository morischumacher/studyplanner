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
    ControlButton,
    Controls,
    MiniMap,
    useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

import {
    fetchCatalog,
    fetchProfileSettings,
    fetchPlannerState,
    saveCourseTerms,
    savePlannerState,
    saveRecommendationProfile,
    saveStartTerm,
    sendRuleCheckUpdate,
    fetchRecommendations,
} from "./lib/api";
import { CourseCard, LaneColumn, ModuleGroupBackground, Sidebar, OnboardingTour } from "./components";
import VisualLegend from "./components/VisualLegend.jsx";
import CurriculumGraphView from "./components/CurriculumGraphView.jsx";
import PlannerNotifications from "./components/app/PlannerNotifications.jsx";
import RecommendationPanel from "./components/RecommendationPanel.jsx";
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
import {
    buildSemesterList,
    firstAllowedLaneAtOrAfter,
    isLaneAllowedForTerm,
    laneSeason,
    normalizeStartSeason,
    normalizeTermAvailability,
    semesterBoundsForProgram,
    TERM_BOTH,
    TERM_SUMMER,
    TERM_WINTER,
} from "./utils/semesters.js";
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
export default function App({ currentUser, onSignOut, openSignupSetupOnEntry = false, onSignupSetupPromptConsumed }) {
    const MIN_MODULE_GROUP_TOP_Y = 108;
    const MIN_GROUP_CHILD_Y = MIN_MODULE_GROUP_TOP_Y + GROUP_PADDING_Y + MODULE_HEADER_HEIGHT;
    const SIDEBAR_WIDTH = 300;
    const SIDEBAR_VISUAL_WIDTH = 333;
    const REC_PANEL_WIDTH = 320;
    const SIDEBAR_LEFT_OFFSET = 12;
    const TABLE_TOP_CONTROLS_TOP = 12;
    const TABLE_TOP_CONTROLS_HEIGHT = 78;
    const TABLE_SIDEBAR_TOP_OFFSET = TABLE_TOP_CONTROLS_TOP + TABLE_TOP_CONTROLS_HEIGHT + 8;
    const TABLE_SIDEBAR_BOTTOM_OFFSET = 0;
    const PANEL_TOP_MARGIN = 56;
    const PANEL_BOTTOM_MARGIN = 0;
    const {
        programCode,
        setProgramCode,
        setCoursesFromNodes,
        coursesBySemester,
        doneCourseCodes,
        parkedCourseCodes,
        courseMetaByCode,
        getCourseMeta,
        setCourseMeta,
        getSemesterNote,
        setSemesterNote,
        selectedFocus,
        setSelectedFocus,
        setSelectedFocusForProgram,
        setCourseDone,
        rollbackCourseDone,
        getCourseStatus,
        lastPlanChange,
        graphViewState,
        setGraphViewState,
        semesterLoadLimits,
        setSemesterLoadLimits,
        exportPlannerStateSnapshot,
        importPlannerStateSnapshot,
    } = currentProgram();
    const [viewMode, setViewMode] = useState("table");
    const [tableVerticalSemantics, setTableVerticalSemantics] = useState("no_meaning");
    const [tableVerticalCustomText, setTableVerticalCustomText] = useState("");
    const [isTableSemanticsPopupOpen, setIsTableSemanticsPopupOpen] = useState(false);
    const [activeTourStep, setActiveTourStep] = useState(null);

    // Catalog state
    const [catalog, setCatalog] = useState([]);
    const [loadingCatalog, setLoadingCatalog] = useState(false);
    const [catalogError, setCatalogError] = useState("");
    const [ruleCheckStateByProgram, setRuleCheckStateByProgram] = useState({});
    const [isRuleDashboardOpen, setIsRuleDashboardOpen] = useState(false);
    const [rightPanelTab, setRightPanelTab] = useState("dashboard");
    const [recommendations, setRecommendations] = useState([]);

    // ── Recommendation state derived data ────────────────────────────────────
    const recommendedCourseMap = useMemo(() => {
        const map = new Map();
        for (const rec of Array.isArray(recommendations) ? recommendations : []) {
            if (rec?.courseCode) {
                map.set(String(rec.courseCode), { type: rec.type || "interest", content: rec.content || [] });
            }
        }
        return map;
    }, [recommendations]);
    const [dashboardViewMode, setDashboardViewMode] = useState("planning");
    const [isLegendOpen, setIsLegendOpen] = useState(false);
    const [isSteopInfoOpen, setIsSteopInfoOpen] = useState(false);
    const [isSteopChecklistOpen, setIsSteopChecklistOpen] = useState(false);
    const [isFocusInfoOpen, setIsFocusInfoOpen] = useState(false);
    const [isFocusChecklistOpen, setIsFocusChecklistOpen] = useState(false);
    const [isExamSubjectProgressOpen, setIsExamSubjectProgressOpen] = useState(false);
    const [isPerSemesterEctsOpen, setIsPerSemesterEctsOpen] = useState(false);
    const [isPlannedEstimatedHoursOpen, setIsPlannedEstimatedHoursOpen] = useState(false);
    const [isDonePerSemesterEctsOpen, setIsDonePerSemesterEctsOpen] = useState(false);
    const [isDoneGradePerSemesterOpen, setIsDoneGradePerSemesterOpen] = useState(false);
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
    const addGraphModuleToPlanRef = useRef(null);
    const groupDragRef = useRef(new Map()); // Map<groupId, { lastX, lastY }>
    const nodeDragStartPosRef = useRef(new Map()); // Map<nodeId, { x, y }>
    const nodeDragInProgressRef = useRef(false);
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
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isSignupSetupOpen, setIsSignupSetupOpen] = useState(false);
    const [profileSearch, setProfileSearch] = useState("");
    const [profileSettingsByProgram, setProfileSettingsByProgram] = useState({});
    const [lockedProgramCode, setLockedProgramCode] = useState(null);
    const [signupSetupProgramCode, setSignupSetupProgramCode] = useState(programCode);
    const [signupSetupStartSeason, setSignupSetupStartSeason] = useState(TERM_WINTER);
    const [signupSetupStartYear, setSignupSetupStartYear] = useState(new Date().getFullYear());
    const [signupSetupFocus, setSignupSetupFocus] = useState(selectedFocus || "");
    const [isSavingSignupSetup, setIsSavingSignupSetup] = useState(false);
    const [pendingCourseTermUpdateByCode, setPendingCourseTermUpdateByCode] = useState({});
    const [isSavingProfileSettings, setIsSavingProfileSettings] = useState(false);
    const [isCurriculumSettingsOpen, setIsCurriculumSettingsOpen] = useState(false);
    const [profileDraftFocus, setProfileDraftFocus] = useState("");
    const [profileDraftStartSeason, setProfileDraftStartSeason] = useState(TERM_WINTER);
    const [profileDraftStartYear, setProfileDraftStartYear] = useState(new Date().getFullYear());
    const [profileDraftMaxEcts, setProfileDraftMaxEcts] = useState(42);
    const [profileDraftRecommendedEcts, setProfileDraftRecommendedEcts] = useState(30);
    const [profileDraftMaxWeekHours, setProfileDraftMaxWeekHours] = useState(50);
    const [profileDraftRecommendedWeekHours, setProfileDraftRecommendedWeekHours] = useState(40);
    const [profileDraftInterests, setProfileDraftInterests] = useState("");
    const [profileDraftCareer, setProfileDraftCareer] = useState("");
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isRecPanelOpen, setIsRecPanelOpen] = useState(false);
    const [profileDisableGraphView, setProfileDisableGraphView] = useState(() => {
        return localStorage.getItem("disable-graph-view-" + currentUser?.username) === "true";
    });

    useEffect(() => {
        if (currentUser?.username) {
            setProfileDisableGraphView(localStorage.getItem("disable-graph-view-" + currentUser?.username) === "true");
        }
    }, [currentUser]);

    const [tourCompleted, setTourCompleted] = useState(true);

    useEffect(() => {
        if (currentUser?.username) {
            const completedKey = "study-planner-tour-completed-" + currentUser.username;
            setTourCompleted(localStorage.getItem(completedKey) === "true");
        } else {
            setTourCompleted(true);
        }
    }, [currentUser, activeTourStep]);

    const [isParkingCollapsed, setIsParkingCollapsed] = useState(false);
    const [tableInteractionMode, setTableInteractionMode] = useState("pan");
    const [showTransientSuccessFeedback, setShowTransientSuccessFeedback] = useState(true);
    const [focusPrefillPrompt, setFocusPrefillPrompt] = useState(null);
    const [dismissedInitialPrefillPrompt, setDismissedInitialPrefillPrompt] = useState(false);
    const focusSelectionTrackerRef = useRef({ programCode, selectedFocus });
    const successFeedbackSignatureRef = useRef("");
    const ruleCheckState = ruleCheckStateByProgram?.[programCode] ?? EMPTY_RULE_CHECK_STATE;

    useEffect(() => {
        if (activeTourStep === null) return;
        if (activeTourStep === 0) {
            setIsSidebarOpen(true);
            setIsRecPanelOpen(false);
            setIsRuleDashboardOpen(false);
            setIsProfileOpen(false);
        } else if (activeTourStep === 5) {
            setIsRecPanelOpen(false);
        } else if (activeTourStep === 6) {
            setIsRecPanelOpen(true);
            setIsRuleDashboardOpen(false);
        } else if (activeTourStep === 7) {
            setIsRecPanelOpen(false);
            setIsRuleDashboardOpen(false);
        } else if (activeTourStep === 8) {
            setIsRuleDashboardOpen(true);
            setIsProfileOpen(false);
        } else if (activeTourStep === 9) {
            setIsRuleDashboardOpen(false);
            setIsProfileOpen(false);
        } else if (activeTourStep === 10) {
            setIsProfileOpen(true);
        } else if (activeTourStep === 11) {
            setIsProfileOpen(false);
        }
    }, [activeTourStep]);

    useEffect(() => {
        if (!openSignupSetupOnEntry) return;
        const defaultProgram = String(programCode || PROGRAM_OPTIONS?.[0]?.code || "").trim() || "066 937";
        setSignupSetupProgramCode(defaultProgram);
        setSignupSetupStartSeason(TERM_WINTER);
        setSignupSetupStartYear(new Date().getFullYear());
        setSignupSetupFocus(defaultProgram === BACHELOR_PROGRAM_CODE ? (selectedFocus || "") : "");
        setIsSignupSetupOpen(true);
        onSignupSetupPromptConsumed?.();
    }, [
        openSignupSetupOnEntry,
        onSignupSetupPromptConsumed,
        programCode,
        selectedFocus,
    ]);
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
                isPlannedEstimatedHoursOpen,
                isDonePerSemesterEctsOpen,
                isDoneGradePerSemesterOpen,
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
        isPlannedEstimatedHoursOpen,
        isDonePerSemesterEctsOpen,
        isDoneGradePerSemesterOpen,
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
    }, [programCode, setProgramCode]);

    useEffect(() => {
        pendingInitialSyncProgramRef.current = programCode;
    }, [programCode]);

    useEffect(() => {
        setDragPreviewSemesterCount(null);
    }, [programCode]);

    useEffect(() => {
        setPendingCourseTermUpdateByCode({});
        setProfileSearch("");
    }, [programCode, isProfileOpen]);
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
        (async () => {
            try {
                const payload = await fetchProfileSettings(programCode);
                if (cancelled) return;
                const startTerm = payload?.start_term && typeof payload.start_term === "object"
                    ? {
                        season: normalizeStartSeason(payload.start_term.season),
                        year: Number(payload.start_term.year) || new Date().getFullYear(),
                    }
                    : null;
                const overridesRaw =
                    payload?.course_term_overrides && typeof payload.course_term_overrides === "object"
                        ? payload.course_term_overrides
                        : {};
                const normalizedOverrides = Object.fromEntries(
                    Object.entries(overridesRaw)
                        .map(([code, term]) => [String(code || "").trim(), normalizeTermAvailability(term)])
                        .filter(([code]) => Boolean(code))
                );
                const nextLockedProgramCode = String(payload?.locked_program_code || "").trim() || null;
                setLockedProgramCode(nextLockedProgramCode);
                if (nextLockedProgramCode && nextLockedProgramCode !== programCode) {
                    setProgramCode?.(nextLockedProgramCode);
                }
                setProfileSettingsByProgram((prev) => ({
                    ...(prev || {}),
                    [programCode]: {
                        startTerm,
                        startTermLocked: Boolean(payload?.start_term_locked ?? startTerm),
                        courseTermOverrides: normalizedOverrides,
                        interests: payload?.interests || [],
                        careerDirection: payload?.career_direction || "",
                        recommendation_toggles: payload?.recommendation_toggles || {},
                    },
                }));
            } catch (error) {
                if (cancelled) return;
                console.error("Failed to load profile settings", error);
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
                if (typeof dashboardUi?.isPlannedEstimatedHoursOpen === "boolean") setIsPlannedEstimatedHoursOpen(dashboardUi.isPlannedEstimatedHoursOpen);
                if (typeof dashboardUi?.isDonePerSemesterEctsOpen === "boolean") setIsDonePerSemesterEctsOpen(dashboardUi.isDonePerSemesterEctsOpen);
                if (typeof dashboardUi?.isDoneGradePerSemesterOpen === "boolean") setIsDoneGradePerSemesterOpen(dashboardUi.isDoneGradePerSemesterOpen);
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
        if (typeof dashboardUi?.isPlannedEstimatedHoursOpen === "boolean") setIsPlannedEstimatedHoursOpen(dashboardUi.isPlannedEstimatedHoursOpen);
        if (typeof dashboardUi?.isDonePerSemesterEctsOpen === "boolean") setIsDonePerSemesterEctsOpen(dashboardUi.isDonePerSemesterEctsOpen);
        if (typeof dashboardUi?.isDoneGradePerSemesterOpen === "boolean") setIsDoneGradePerSemesterOpen(dashboardUi.isDoneGradePerSemesterOpen);
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
    const profileSettingsForProgram = profileSettingsByProgram?.[programCode] ?? {};
    const startTermSeason = normalizeStartSeason(profileSettingsForProgram?.startTerm?.season ?? TERM_WINTER);
    const startTermYear = Number(profileSettingsForProgram?.startTerm?.year) || new Date().getFullYear();
    const isStartTermLocked = Boolean(profileSettingsForProgram?.startTermLocked);
    const isProgramLocked = Boolean(String(lockedProgramCode || "").trim());
    const courseTermOverrides = profileSettingsForProgram?.courseTermOverrides ?? {};
    useEffect(() => {
        if (!isProfileOpen) return;
        setProfileDraftFocus(selectedFocus || "");
        setProfileDraftStartSeason(startTermSeason);
        setProfileDraftStartYear(startTermYear);
        setProfileDraftMaxEcts(Number(semesterLoadLimits?.maxEctsPerSemester ?? 42));
        setProfileDraftRecommendedEcts(Number(semesterLoadLimits?.recommendedEctsPerSemester ?? 30));
        setProfileDraftMaxWeekHours(Number(semesterLoadLimits?.maxWeekHoursPerSemester ?? 50));
        setProfileDraftRecommendedWeekHours(Number(semesterLoadLimits?.recommendedWeekHoursPerSemester ?? 40));
        setProfileDraftInterests(Array.isArray(profileSettingsForProgram?.interests) ? profileSettingsForProgram.interests.join(", ") : "");
        setProfileDraftCareer(profileSettingsForProgram?.careerDirection || "");
    }, [
        isProfileOpen,
        selectedFocus,
        startTermSeason,
        startTermYear,
        semesterLoadLimits?.maxEctsPerSemester,
        semesterLoadLimits?.recommendedEctsPerSemester,
        semesterLoadLimits?.maxWeekHoursPerSemester,
        semesterLoadLimits?.recommendedEctsPerSemester,
        semesterLoadLimits?.maxWeekHoursPerSemester,
        semesterLoadLimits?.recommendedWeekHoursPerSemester,
        profileSettingsForProgram?.interests,
        profileSettingsForProgram?.careerDirection,
    ]);

    const effectiveCourseTermByCode = useMemo(() => {
        const map = {};
        for (const subject of Array.isArray(catalog) ? catalog : []) {
            for (const module of Array.isArray(subject?.modules) ? subject.modules : []) {
                for (const course of Array.isArray(module?.courses) ? module.courses : []) {
                    const code = String(course?.code || "").trim();
                    if (!code) continue;
                    map[code] = normalizeTermAvailability(course?.termAvailability ?? TERM_BOTH);
                }
            }
        }
        for (const [code, term] of Object.entries(courseTermOverrides || {})) {
            const normalizedCode = String(code || "").trim();
            if (!normalizedCode) continue;
            map[normalizedCode] = normalizeTermAvailability(term);
        }
        return map;
    }, [catalog, courseTermOverrides]);

    const termAvailabilityForCode = useCallback((courseCode) => {
        const code = String(courseCode || "").trim();
        if (!code) return TERM_BOTH;
        return normalizeTermAvailability(effectiveCourseTermByCode?.[code] ?? TERM_BOTH);
    }, [effectiveCourseTermByCode]);

    const isCourseAllowedInLane = useCallback((courseCode, laneIndex) => {
        const term = termAvailabilityForCode(courseCode);
        return isLaneAllowedForTerm(term, startTermSeason, laneIndex);
    }, [startTermSeason, termAvailabilityForCode]);

    const firstAllowedLaneForCourse = useCallback((courseCode, preferredLane) => {
        const preferred = Math.max(0, Math.min(Number(preferredLane) || 0, maxSemesterCount - 1));
        const term = termAvailabilityForCode(courseCode);
        const forward = firstAllowedLaneAtOrAfter(
            term,
            startTermSeason,
            preferred,
            maxSemesterCount - 1
        );
        if (forward != null) return forward;
        for (let idx = preferred - 1; idx >= 0; idx -= 1) {
            if (isLaneAllowedForTerm(term, startTermSeason, idx)) return idx;
        }
        return null;
    }, [maxSemesterCount, startTermSeason, termAvailabilityForCode]);

    const validSemestersForCourse = useCallback((courseCode) => {
        const allowed = sidebarSemesters.filter((semester) => {
            const laneIndex = (Number(semester?.id) || 1) - 1;
            return isCourseAllowedInLane(courseCode, laneIndex);
        });
        return [{ id: 0, title: "Parking Stage", isParking: true }, ...allowed];
    }, [isCourseAllowedInLane, sidebarSemesters]);

    const validSemestersForModule = useCallback((courses) => {
        const codes = (Array.isArray(courses) ? courses : []).map((course) => course?.code).filter(Boolean);
        if (!codes.length) return [{ id: 0, title: "Parking Stage", isParking: true }];
        const allowed = sidebarSemesters.filter((semester) => {
            const laneIndex = (Number(semester?.id) || 1) - 1;
            return codes.every((code) => isCourseAllowedInLane(code, laneIndex));
        });
        if (allowed.length > 0) {
            return [{ id: 0, title: "Parking Stage", isParking: true }, ...allowed];
        }
        const pairOptions = [];
        for (let idx = 0; idx < sidebarSemesters.length - 1; idx += 1) {
            const first = sidebarSemesters[idx];
            const second = sidebarSemesters[idx + 1];
            const firstLane = (Number(first?.id) || 1) - 1;
            const secondLane = (Number(second?.id) || 1) - 1;
            const canPlaceInWindow = codes.every((code) =>
                isCourseAllowedInLane(code, firstLane) || isCourseAllowedInLane(code, secondLane)
            );
            if (!canPlaceInWindow) continue;
            pairOptions.push({
                id: `pair-${first?.id}-${second?.id}`,
                laneIndex: firstLane,
                windowEndLaneIndex: secondLane,
                isPlus: Boolean(first?.isPlus || second?.isPlus),
                title: `${first?.title ?? `Semester ${first?.id}`} & ${second?.title ?? `Semester ${second?.id}`}`,
            });
        }
        if (pairOptions.length > 0) {
            return [{ id: 0, title: "Parking Stage", isParking: true }, ...pairOptions];
        }
        const fallbackAllowed = sidebarSemesters.filter((semester) => {
            const laneIndex = (Number(semester?.id) || 1) - 1;
            return codes.some((code) => isCourseAllowedInLane(code, laneIndex));
        });
        return [{ id: 0, title: "Parking Stage", isParking: true }, ...fallbackAllowed];
    }, [isCourseAllowedInLane, sidebarSemesters]);
    const catalogCourseByCode = useMemo(() => {
        const byCode = new Map();
        const subjects = Array.isArray(catalog) ? catalog : [];
        subjects.forEach((subject, subjectIdx) => {
            const modules = Array.isArray(subject?.modules) ? subject.modules : [];
            modules.forEach((module, moduleIdx) => {
                const standaloneCode = String(module?.code || `MOD-${subjectIdx + 1}-${moduleIdx + 1}`).trim();
                const moduleCourses = Array.isArray(module?.courses) ? module.courses : [];
                const moduleCourseCodes = moduleCourses
                    .map((course) => String(course?.code || "").trim())
                    .filter(Boolean);
                const moduleId = `mod-cat-${subjectIdx + 1}-${moduleIdx + 1}-${standaloneCode || "module"}`;
                const moduleMeta = moduleCourseCodes.length >= 2
                    ? {
                        id: moduleId,
                        title: module?.name || "Module",
                        code: module?.code ?? null,
                        ects: module?.ects ?? null,
                        examSubject: subject?.pruefungsfach ?? null,
                        category: module?.category ?? "unknown",
                        courseCodes: moduleCourseCodes,
                    }
                    : null;
                if (moduleCourses.length === 0 && standaloneCode && !byCode.has(standaloneCode)) {
                    byCode.set(standaloneCode, {
                        code: standaloneCode,
                        name: module?.name || standaloneCode,
                        type: module?.category || null,
                        ects: module?.ects ?? null,
                        category: module?.category ?? "unknown",
                        examSubject: subject?.pruefungsfach ?? null,
                    });
                }
                for (const course of moduleCourses) {
                    const code = String(course?.code || "").trim();
                    if (!code || byCode.has(code)) continue;
                    byCode.set(code, {
                        code,
                        name: course?.name || code,
                        type: course?.type || null,
                        ects: course?.ects ?? null,
                        category: module?.category ?? "unknown",
                        examSubject: subject?.pruefungsfach ?? null,
                        moduleMeta,
                    });
                }
            });
        });
        return byCode;
    }, [catalog]);

    const plannedEctsBySemester = useMemo(() => {
        const out = {};
        for (const semester of semesters) {
            const list = Array.isArray(coursesBySemester?.[semester.id]) ? coursesBySemester[semester.id] : [];
            out[semester.id] = list.reduce((sum, course) => sum + Number(course?.ects || 0), 0);
        }
        return out;
    }, [coursesBySemester, semesters]);
    const parkingEctsFromParkedCodes = useMemo(() => {
        const seenCodes = new Set();
        let total = 0;
        for (const codeRaw of Array.isArray(parkedCourseCodes) ? parkedCourseCodes : []) {
            const code = String(codeRaw || "").trim();
            if (!code || seenCodes.has(code)) continue;
            seenCodes.add(code);
            const catalogCourse = catalogCourseByCode.get(code);
            total += Number(catalogCourse?.ects || 0);
        }
        return total;
    }, [catalogCourseByCode, parkedCourseCodes]);
    const laneInsightsBySemester = useMemo(() => {
        const doneSet = new Set(doneCourseCodes || []);
        const parseNumeric = (value) => {
            if (value == null) return null;
            const normalized = String(value).trim().replace(",", ".");
            if (!normalized) return null;
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : null;
        };
        const out = {};
        for (const semester of semesters) {
            const semesterId = Number(semester?.id);
            const list = Array.isArray(coursesBySemester?.[semesterId]) ? coursesBySemester[semesterId] : [];
            let estimatedHoursTotal = 0;
            let weightedGradeNumerator = 0;
            let weightedGradeDenominator = 0;
            const courseNotes = [];
            for (const course of list) {
                const code = String(course?.code || "").trim();
                if (!code) continue;
                const meta = getCourseMeta(code);
                const note = String(meta?.notes || "").trim();
                if (note) {
                    courseNotes.push({
                        code,
                        name: String(course?.name || code),
                        note,
                    });
                }
                const estimated = parseNumeric(meta?.estimatedHours);
                if (estimated != null && estimated > 0) {
                    estimatedHoursTotal += estimated;
                }
                if (!doneSet.has(code)) continue;
                const ects = Number(course?.ects);
                const grade = parseNumeric(meta?.grade);
                if (!Number.isFinite(ects) || ects <= 0 || grade == null || grade <= 0) continue;
                weightedGradeNumerator += grade * ects;
                weightedGradeDenominator += ects;
            }
            out[semesterId] = {
                courseNotes,
                estimatedHoursTotal,
                weightedGrade: weightedGradeDenominator > 0 ? (weightedGradeNumerator / weightedGradeDenominator) : null,
                additionalNote: getSemesterNote(semesterId),
            };
        }
        return out;
    }, [coursesBySemester, doneCourseCodes, getCourseMeta, getSemesterNote, semesters]);
    const plannedEstimatedHoursPerSemesterRows = useMemo(() => (
        semesters
            .map((semester) => ({
                sem: Number(semester?.id),
                hours: Number(laneInsightsBySemester?.[semester?.id]?.estimatedHoursTotal ?? 0),
            }))
            .filter((row) => Number.isFinite(row?.sem) && row.sem >= 1 && Number(row?.hours || 0) > 0)
    ), [laneInsightsBySemester, semesters]);
    const plannedEstimatedHoursTotal = useMemo(
        () => plannedEstimatedHoursPerSemesterRows.reduce((sum, row) => sum + Number(row?.hours || 0), 0),
        [plannedEstimatedHoursPerSemesterRows]
    );
    const plannedEstimatedHoursAverage = useMemo(() => {
        const count = plannedEstimatedHoursPerSemesterRows.length;
        if (count <= 0) return 0;
        return plannedEstimatedHoursTotal / count;
    }, [plannedEstimatedHoursPerSemesterRows.length, plannedEstimatedHoursTotal]);
    const maxWeekHoursPerSemester = (() => {
        const parsed = Number(semesterLoadLimits?.maxWeekHoursPerSemester);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
        return 50;
    })();
    const recommendedWeekHoursPerSemester = (() => {
        const parsed = Number(semesterLoadLimits?.recommendedWeekHoursPerSemester);
        if (Number.isFinite(parsed) && parsed > 0) return Math.min(parsed, maxWeekHoursPerSemester);
        return 40;
    })();
    const plannedWeekHoursWithinDesiredWorkload = plannedEstimatedHoursPerSemesterRows.every(
        (row) => Number(row?.hours || 0) <= recommendedWeekHoursPerSemester + 1e-6
    );
    const maxWeekHoursForScale = Math.max(maxWeekHoursPerSemester, 1);
    const doneGradePerSemesterRows = useMemo(() => (
        semesters
            .map((semester) => ({
                sem: Number(semester?.id),
                grade: laneInsightsBySemester?.[semester?.id]?.weightedGrade ?? null,
            }))
            .filter((row) => Number.isFinite(row?.sem) && row.sem >= 1 && row?.grade != null && Number.isFinite(Number(row?.grade)))
            .map((row) => ({ ...row, grade: Number(row.grade) }))
    ), [laneInsightsBySemester, semesters]);
    const doneGradeOverall = useMemo(() => {
        const doneSet = new Set(doneCourseCodes || []);
        let numerator = 0;
        let denominator = 0;
        for (const semester of semesters) {
            const semesterId = Number(semester?.id);
            const list = Array.isArray(coursesBySemester?.[semesterId]) ? coursesBySemester[semesterId] : [];
            for (const course of list) {
                const code = String(course?.code || "").trim();
                if (!code || !doneSet.has(code)) continue;
                const ects = Number(course?.ects);
                const meta = getCourseMeta(code);
                const gradeRaw = String(meta?.grade ?? "").trim().replace(",", ".");
                if (!gradeRaw) continue;
                const grade = Number(gradeRaw);
                if (!Number.isFinite(ects) || ects <= 0 || !Number.isFinite(grade) || grade <= 0) continue;
                numerator += grade * ects;
                denominator += ects;
            }
        }
        return denominator > 0 ? (numerator / denominator) : null;
    }, [coursesBySemester, doneCourseCodes, getCourseMeta, semesters]);
    const missingDoneGradesBySemester = useMemo(() => {
        const doneSet = new Set(doneCourseCodes || []);
        const out = [];
        for (const semester of semesters) {
            const semesterId = Number(semester?.id);
            const list = Array.isArray(coursesBySemester?.[semesterId]) ? coursesBySemester[semesterId] : [];
            const missingCourses = [];
            for (const course of list) {
                const code = String(course?.code || "").trim();
                if (!code || !doneSet.has(code)) continue;
                const meta = getCourseMeta(code);
                const gradeRaw = String(meta?.grade ?? "").trim().replace(",", ".");
                const grade = Number(gradeRaw);
                const hasValidGrade = gradeRaw && Number.isFinite(grade) && grade > 0;
                if (!hasValidGrade) {
                    missingCourses.push({
                        code,
                        name: String(course?.name || code),
                    });
                }
            }
            if (missingCourses.length > 0) {
                out.push({ sem: semesterId, missingCourses });
            }
        }
        return out;
    }, [coursesBySemester, doneCourseCodes, getCourseMeta, semesters]);
    const missingDoneGradesCount = useMemo(
        () => missingDoneGradesBySemester.reduce((sum, row) => sum + Number(row?.missingCourses?.length || 0), 0),
        [missingDoneGradesBySemester]
    );

    // Lane background columns
    const laneNodes = useMemo(
        () => {
            const parkingLaneHeight = isParkingCollapsed ? 88 : CANVAS_HEIGHT;
            const parkingLane = {
                id: "lane-0",
                type: "lane",
                data: {
                    title: "Parking Stage",
                    isParking: true,
                    isParkingCollapsed,
                    onToggleParkingCollapsed: () => setIsParkingCollapsed((v) => !v),
                    even: false,
                    height: parkingLaneHeight,
                    ectsPlanned: Number(parkingEctsFromParkedCodes ?? 0),
                    semesterId: 0,
                    courseNotes: [],
                    estimatedHoursTotal: 0,
                    weightedGrade: null,
                    additionalNote: "",
                    onSetSemesterNote: null,
                },
                position: { x: laneX(-1), y: 0 },
                draggable: false,
                selectable: false,
                zIndex: 0,
                style: { height: parkingLaneHeight, width: LANE_WIDTH },
            };
            const regular = semesters.map((s, i) => ({
                id: `lane-${s.id}`,
                type: "lane",
                data: {
                    title: s.title,
                    isParking: false,
                    even: i % 2 === 0,
                    height: CANVAS_HEIGHT,
                    ectsPlanned: Number(plannedEctsBySemester?.[s.id] ?? 0),
                    semesterId: Number(s.id),
                    courseNotes: laneInsightsBySemester?.[s.id]?.courseNotes ?? [],
                    estimatedHoursTotal: Number(laneInsightsBySemester?.[s.id]?.estimatedHoursTotal ?? 0),
                    weightedGrade: laneInsightsBySemester?.[s.id]?.weightedGrade ?? null,
                    additionalNote: String(laneInsightsBySemester?.[s.id]?.additionalNote || ""),
                    onSetSemesterNote: setSemesterNote,
                },
                position: { x: laneX(i), y: 0 },
                draggable: false,
                selectable: false,
                zIndex: 0,
                style: { height: CANVAS_HEIGHT },
            }));
            return [parkingLane, ...regular];
        },
        [isParkingCollapsed, laneInsightsBySemester, parkingEctsFromParkedCodes, plannedEctsBySemester, semesters, setSemesterNote]
    );

    // React Flow state
    const initialNodes = useMemo(() => [...laneNodes], [laneNodes]);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const renderNodes = useMemo(() => {
        return nodes.map((node) => {
            const isParkedCourse = node?.type === "course" && String(node?.data?.status || "") === "parked";
            const isParkedGroup = node?.type === "moduleBg" && String(node?.data?.status || "") === "parked";
            const shouldHide = Boolean(isParkingCollapsed && (isParkedCourse || isParkedGroup));
            const hadGhost = Boolean(node?.data?.collapsedGhost);
            if (Boolean(node?.hidden) === shouldHide && !hadGhost) return node;
            return {
                ...node,
                hidden: shouldHide,
                data: {
                    ...(node?.data || {}),
                    collapsedGhost: false,
                },
            };
        });
    }, [isParkingCollapsed, nodes]);
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
            return [...laneNodes, ...nonLane];
        });
    }, [laneNodes, setNodes]);

    useEffect(() => {
        setNodes((prev) => {
            const seenParkedCodes = new Set();
            let parkedEctsFromNodes = 0;
            for (const node of prev) {
                if (node?.type !== "course") continue;
                if (String(node?.data?.status || "") !== "parked") continue;
                const code = String(node?.data?.code || "").trim();
                if (code && seenParkedCodes.has(code)) continue;
                if (code) seenParkedCodes.add(code);
                parkedEctsFromNodes += Number(node?.data?.ects || 0);
            }
            let changed = false;
            const next = prev.map((node) => {
                if (node.type !== "lane") return node;
                const semesterId = Number(String(node.id).replace("lane-", ""));
                const ectsPlanned = semesterId === 0
                    ? Number(parkedEctsFromNodes || 0)
                    : Number(plannedEctsBySemester?.[semesterId] ?? 0);
                const laneInsight = laneInsightsBySemester?.[semesterId] ?? {};
                const currentEcts = Number(node?.data?.ectsPlanned ?? 0);
                const currentHeight = Number(node?.data?.height ?? 0);
                const nextCourseNotes = Array.isArray(laneInsight?.courseNotes) ? laneInsight.courseNotes : [];
                const nextEstimatedHoursTotal = Number(laneInsight?.estimatedHoursTotal ?? 0);
                const nextWeightedGrade = laneInsight?.weightedGrade ?? null;
                const nextAdditionalNote = String(laneInsight?.additionalNote || "");
                const notesUnchanged = JSON.stringify(node?.data?.courseNotes ?? []) === JSON.stringify(nextCourseNotes);
                if (
                    currentEcts === ectsPlanned &&
                    currentHeight === requiredLaneHeight &&
                    notesUnchanged &&
                    Number(node?.data?.estimatedHoursTotal ?? 0) === nextEstimatedHoursTotal &&
                    (node?.data?.weightedGrade ?? null) === nextWeightedGrade &&
                    String(node?.data?.additionalNote || "") === nextAdditionalNote
                ) {
                    return node;
                }
                changed = true;
                return {
                    ...node,
                    data: {
                        ...node.data,
                        ectsPlanned,
                        height: requiredLaneHeight,
                        courseNotes: nextCourseNotes,
                        estimatedHoursTotal: nextEstimatedHoursTotal,
                        weightedGrade: nextWeightedGrade,
                        additionalNote: nextAdditionalNote,
                        onSetSemesterNote: setSemesterNote,
                    },
                };
            });
            return changed ? next : prev;
        });
    }, [laneInsightsBySemester, plannedEctsBySemester, requiredLaneHeight, setNodes, setSemesterNote]);

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
        verticalSemantics: tableVerticalSemantics,
    }), [maxSemesterCount, MIN_MODULE_GROUP_TOP_Y, tableVerticalSemantics]);

    const compactPrefillLayout = useCallback(
        (allNodes) => compactPrefillLayoutBase(allNodes, flowLayoutOptions),
        [flowLayoutOptions]
    );

    const resolveLaneCollisions = useCallback(
        (allNodes) => resolveLaneCollisionsBase(allNodes, flowLayoutOptions),
        [flowLayoutOptions]
    );

    useEffect(() => {
        if (viewMode === "table") {
            setNodes((prev) => resolveLaneCollisions(prev));
        }
    }, [tableVerticalSemantics, resolveLaneCollisions, viewMode, setNodes]);

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

    const rollbackMovedCourses = useCallback((change) => {
        const movedItems = Array.isArray(change?.moved) ? change.moved : [];
        if (!movedItems.length) return;

        const byId = new Map();
        const byCode = new Map();
        for (const item of movedItems) {
            const id = String(item?.id || "").trim();
            const code = String(item?.code || "").trim();
            const fromLane = Number(item?.fromLaneIndex);
            if (!Number.isInteger(fromLane) || fromLane < 0) continue;
            if (id) byId.set(id, fromLane);
            if (code && !byCode.has(code)) byCode.set(code, fromLane);
        }
        if (!byId.size && !byCode.size) return;

        setNodes((prev) => {
            const affectedGroupIds = new Set();
            const next = prev.map((node) => {
                if (node?.type !== "course") return node;
                const nodeId = String(node?.id || "").trim();
                const nodeCode = String(node?.data?.code || "").trim();
                const fromLane = byId.has(nodeId)
                    ? byId.get(nodeId)
                    : (nodeCode && byCode.has(nodeCode) ? byCode.get(nodeCode) : null);
                if (!Number.isInteger(fromLane) || fromLane < 0) return node;
                if (node?.data?.groupId) affectedGroupIds.add(node.data.groupId);
                return {
                    ...node,
                    position: {
                        ...node.position,
                        x: centerX(fromLane),
                    },
                };
            });

            let resolved = next;
            for (const groupId of affectedGroupIds) {
                resolved = recomputeGroupFromChildren(resolved, groupId);
            }
            return resolveLaneCollisions(resolved);
        });
        setNeedsPersist(true);
    }, [centerX, recomputeGroupFromChildren, resolveLaneCollisions, setNodes]);

    const rollbackCourseStatusToggle = useCallback((change) => {
        if (change?.type !== "course_status_toggled") return;
        const courseCode = change?.courseCode;
        if (!courseCode) return;

        const attemptedDone = change?.toStatus === "done";
        const revertedDone = !attemptedDone;

        rollbackCourseDone(courseCode, revertedDone);
        setNodes((prev) => prev.map((n) => {
            if (n.type !== "course" || n?.data?.code !== courseCode) return n;
            return { ...n, data: { ...n.data, status: revertedDone ? "done" : "in_plan" } };
        }));
    }, [rollbackCourseDone, setNodes]);

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
        const source = (rfRef.current?.getNodes?.() || nodes);
        const codesFromGroup = groupId
            ? source
                .filter((n) => n.type === "course" && n.data?.groupId === groupId)
                .map((n) => n?.data?.code)
                .filter(Boolean)
            : [];
        const codesFromPayload = Array.isArray(courseCodes) ? courseCodes.filter(Boolean) : [];
        const codes = codesFromGroup.length ? codesFromGroup : codesFromPayload;
        const uniqueCodes = [...new Set(codes)];
        if (!uniqueCodes.length) return;
        for (const code of uniqueCodes) {
            setCourseDone(code, Boolean(nextDone));
        }
        setNodes((prev) => {
            const patched = prev.map((n) => {
                if (n.type !== "course" || !uniqueCodes.includes(n?.data?.code)) return n;
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
                                moduleCourseCodes: uniqueCodes,
                            },
                        }
                        : n
                ));
            }
            return patched;
        });
    }, [nodes, setCourseDone, setNodes]);

    const parkCourseCodes = useCallback((courseCodes) => {
        const input = Array.isArray(courseCodes) ? courseCodes : [courseCodes];
        const requestedByCode = new Map();
        for (const item of input) {
            const isObject = item && typeof item === "object";
            const code = String(isObject ? item?.code : item || "").trim();
            if (!code) continue;
            if (!requestedByCode.has(code)) {
                requestedByCode.set(code, isObject ? item : null);
            }
        }
        const requestedCodes = [...requestedByCode.keys()];
        if (!requestedCodes.length) return false;

        const source = rfRef.current?.getNodes?.() || nodes;
        const groupedCodes = new Set();
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
        let persistedNodes = null;
        let changed = false;
        setNodes((prev) => {
            const parkedByCode = new Map();
            const removeGroupIds = new Set();
            const removedCourseByCode = new Map();
            const next = [];
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
            const appended = [];
            for (const code of allCodes) {
                if (parkedByCode.has(code)) {
                    const parked = parkedByCode.get(code);
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
                const requestedMeta = requestedByCode.get(code) || {};
                const fromCatalog = catalogCourseByCode.get(code) || {};
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
                    fromCatalog?.subjectColor ||
                    (examSubject ? subjectColors?.[examSubject] : null) ||
                    "#2563eb";
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
                        y: 96 + parkingIndex * (COURSE_LAYOUT_HEIGHT + COLLISION_GAP),
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
            const eligibleGroups = new Map();
            for (const parkedCourse of parkedCourses) {
                const code = String(parkedCourse?.data?.code || "").trim();
                if (!code) continue;
                const courseCatalog = catalogCourseByCode.get(code) || {};
                const modMeta = parkedCourse?.data?.moduleMeta || courseCatalog?.moduleMeta || null;
                if (!modMeta || !Array.isArray(modMeta?.courseCodes) || modMeta.courseCodes.length < 2) continue;
                const allParked = modMeta.courseCodes.every((courseCode) => parkedCodeSet.has(String(courseCode || "").trim()));
                if (!allParked) continue;
                const groupKey = `parked-group-${String(modMeta.id || modMeta.code || modMeta.title || "module").replace(/[^a-zA-Z0-9_-]/g, "_")}`;
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
                const courseCatalog = catalogCourseByCode.get(code) || {};
                const modMeta = node?.data?.moduleMeta || courseCatalog?.moduleMeta || null;
                const groupId = modMeta
                    ? `parked-group-${String(modMeta.id || modMeta.code || modMeta.title || "module").replace(/[^a-zA-Z0-9_-]/g, "_")}`
                    : null;
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

            const parkingGroupNodes = [...eligibleGroups.values()].map(({ groupId, moduleMeta }) => {
                const moduleCourses = (Array.isArray(moduleMeta?.courseCodes) ? moduleMeta.courseCodes : [])
                    .map((courseCode) => {
                        const normalizedCode = String(courseCode || "").trim();
                        const fromCatalog = catalogCourseByCode.get(normalizedCode) || {};
                        return {
                            code: normalizedCode,
                            name: fromCatalog?.name || normalizedCode,
                            ects: fromCatalog?.ects ?? null,
                            type: fromCatalog?.type ?? null,
                        };
                    })
                    .filter((course) => Boolean(course?.code));
                const modulePayload = {
                    kind: "module",
                    code: moduleMeta?.code ?? null,
                    name: moduleMeta?.title || "Module",
                    category: moduleMeta?.category ?? "unknown",
                    subjectColor: (moduleMeta?.examSubject ? subjectColors?.[moduleMeta.examSubject] : null) || "#2563eb",
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
                        onAddModuleToPlan: (...args) => addGraphModuleToPlanRef.current?.(...args),
                        semestersForModule: validSemestersForModule(moduleCourses).map((semester) => ({
                            ...semester,
                            title: semester?.title ?? `Semester ${semester?.id}`,
                        })),
                        modulePayload,
                        examSubject: moduleMeta?.examSubject ?? null,
                        category: moduleMeta?.category ?? "unknown",
                        programCode,
                        subjectColor: (moduleMeta?.examSubject ? subjectColors?.[moduleMeta.examSubject] : null) || "#2563eb",
                    },
                    position: { x, y: MIN_GROUP_CHILD_Y },
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
        MIN_GROUP_CHILD_Y,
        catalog,
        catalogCourseByCode,
        centerX,
        nodes,
        programCode,
        removeCourseNode,
        removeModuleGroup,
        recomputeGroupFromChildren,
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

    const addGraphCourseToPlan = useCallback((course, requestedLaneIndex, options = null) => {
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
            "#2563eb";

        let persistedNodes = null;
        let added = false;
        setNodes((prev) => {
            const existing = prev.find((n) => n.type === "course" && n?.data?.code === courseCode);
            if (existing && existing?.data?.status !== "parked") return prev;
            if (existing && existing?.data?.status === "parked") {
                const laneNodes = prev
                    .filter((n) => n.type === "course" && laneIdx(n) === laneIndex && n.id !== existing.id)
                    .sort((a, b) => (a?.position?.y ?? 0) - (b?.position?.y ?? 0));
                const last = laneNodes[laneNodes.length - 1];
                const y = last ? (last.position.y + COURSE_LAYOUT_HEIGHT + COLLISION_GAP) : 96;
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
    }, [catalog, clampPlacementLane, firstAllowedLaneForCourse, getCourseStatus, isCourseAllowedInLane, maxSemesterCount, parkCourseCodes, removeCourseNode, setCoursesFromNodes, setNodes, subjectColors, toggleCourseDone, updateCourseEcts]);

    const addGraphModuleToPlan = useCallback((modulePayload, requestedLaneIndex, options = null) => {
        const variantResolution = resolveModuleVariantCourses(modulePayload, options?.variantId ?? null);
        const selectedCoursesRaw = Array.isArray(variantResolution?.selectedCourses)
            ? variantResolution.selectedCourses
            : (Array.isArray(modulePayload?.courses) ? modulePayload.courses : []);
        const allVariantCoursesRaw = Array.isArray(variantResolution?.allVariantCourses)
            ? variantResolution.allVariantCourses
            : selectedCoursesRaw;
        const enrichCourse = (course) => {
            const code = String(course?.code || "").trim();
            if (!code) return null;
            const fromCatalog = catalogCourseByCode.get(code) || {};
            return {
                ...fromCatalog,
                ...(course || {}),
                code,
                name: course?.name || fromCatalog?.name || code,
                ects: course?.ects ?? fromCatalog?.ects ?? null,
                type: course?.type ?? fromCatalog?.type ?? null,
                category: modulePayload?.category ?? course?.category ?? fromCatalog?.category ?? "unknown",
                examSubject: course?.examSubject ?? fromCatalog?.examSubject ?? null,
                subjectColor: course?.subjectColor ?? fromCatalog?.subjectColor ?? null,
            };
        };
        const courses = selectedCoursesRaw.map(enrichCourse).filter(Boolean);
        const allVariantCourses = allVariantCoursesRaw.map(enrichCourse).filter(Boolean);
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
        if (Number(requestedLaneIndex) < 0) {
            return parkCourseCodes(courses);
        }
        if (codes.some((code) => {
            const status = getCourseStatus(code);
            return status !== "todo" && status !== "parked";
        })) return false;
        const conflictingVariantCodes = allVariantCourses
            .map((c) => c?.code)
            .filter((code) => code && !codes.includes(code));

        const allowDirect = Boolean(options?.allowDirectLaneSelection);
        const rawLaneIndex = allowDirect
            ? Math.max(0, Math.min(Number(requestedLaneIndex) || 0, maxSemesterCount - 1))
            : clampPlacementLane(requestedLaneIndex);
        const allAllowedAtLane = (laneIdx) => codes.every((code) => isCourseAllowedInLane(code, laneIdx));
        let laneIndex = null;
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
            const targetLaneByCode = new Map();
            for (const course of courses) {
                const code = String(course?.code || "").trim();
                if (!code) continue;
                const targetLane = firstAllowedLaneForCourse(code, rawLaneIndex);
                if (targetLane == null) return false;
                targetLaneByCode.set(code, targetLane);
            }
            if (targetLaneByCode.size !== codes.length) return false;

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
                position: { x: centerX(rawLaneIndex), y },
                draggable: true,
                dragHandle: ".module-bg-drag-handle",
                selectable: false,
                zIndex: 0,
            };

            const childCourseNodes = courses.map((course, idx) => {
                const code = String(course?.code || "").trim();
                const childId = `${code}-${now}-${idx}-graph`;
                const targetLane = targetLaneByCode.get(code);
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

            let persistedNodes = null;
            let added = false;
            setNodes((prev) => {
                const hasSelectedAlready = codes.some((code) => prev.some((n) => n.type === "course" && n?.data?.code === code && n?.data?.status !== "parked"));
                if (hasSelectedAlready) return prev;

                const removeSet = new Set(conflictingVariantCodes);
                const affectedGroupIds = new Set(
                    prev
                        .filter((n) =>
                            n.type === "course" &&
                            n?.data?.groupId &&
                            (
                                removeSet.has(n?.data?.code) ||
                                (codes.includes(n?.data?.code) && n?.data?.status === "parked")
                            )
                        )
                        .map((n) => n.data.groupId)
                );
                let next = prev.filter((n) => !(n.type === "course" && (removeSet.has(n?.data?.code) || (codes.includes(n?.data?.code) && n?.data?.status === "parked"))));
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
        }
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
            dragHandle: ".module-bg-drag-handle",
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
                    termAvailability: termAvailabilityForCode(course?.code),
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
            const hasSelectedAlready = codes.some((code) => prev.some((n) => n.type === "course" && n?.data?.code === code && n?.data?.status !== "parked"));
            if (hasSelectedAlready) return prev;

            const removeSet = new Set(conflictingVariantCodes);
            const affectedGroupIds = new Set(
                prev
                    .filter((n) =>
                        n.type === "course" &&
                        n?.data?.groupId &&
                        (
                            removeSet.has(n?.data?.code) ||
                            (codes.includes(n?.data?.code) && n?.data?.status === "parked")
                        )
                    )
                    .map((n) => n.data.groupId)
            );
            let next = prev.filter((n) => !(n.type === "course" && (removeSet.has(n?.data?.code) || (codes.includes(n?.data?.code) && n?.data?.status === "parked"))));
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
    }, [MIN_GROUP_CHILD_Y, addGraphCourseToPlan, catalog, catalogCourseByCode, clampPlacementLane, firstAllowedLaneForCourse, getCourseStatus, isCourseAllowedInLane, maxSemesterCount, removeCourseNode, removeModuleGroup, setCoursesFromNodes, setNodes, subjectColors, toggleCourseDone, toggleModuleDoneCodes, updateCourseEcts]);

    useEffect(() => {
        addGraphModuleToPlanRef.current = addGraphModuleToPlan;
    }, [addGraphModuleToPlan]);

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

    const toggleGraphModuleDone = useCallback((courseCodes, nextDone, groupId) => {
        const source = (rfRef.current?.getNodes?.() || nodes);
        const codesFromGroup = groupId
            ? source
                .filter((n) => n.type === "course" && n.data?.groupId === groupId)
                .map((n) => n?.data?.code)
                .filter(Boolean)
            : [];
        const codesFromPayload = Array.isArray(courseCodes) ? courseCodes.filter(Boolean) : [];
        const codes = codesFromGroup.length ? codesFromGroup : codesFromPayload;
        if (!codes.length) return;
        const uniqueCodes = [...new Set(codes)];
        for (const code of uniqueCodes) {
            setCourseDone(code, Boolean(nextDone));
        }
        setNodes((prev) => prev.map((n) => {
            if (n.type !== "course" || !uniqueCodes.includes(n?.data?.code)) return n;
            return { ...n, data: { ...n.data, status: nextDone ? "done" : "in_plan" } };
        }));
    }, [nodes, setCourseDone, setNodes]);

    const updateCourseMeta = useCallback((courseCode, patch) => {
        const code = String(courseCode || "").trim();
        if (!code) return;
        setCourseMeta(code, patch);
    }, [setCourseMeta]);

    useEffect(() => {
        setNodes((prev) => {
            let changed = false;
            const next = prev.map((node) => {
                if (node?.type !== "course") return node;
                const code = String(node?.data?.code || "").trim();
                if (!code) return node;
                const meta = getCourseMeta(code);
                const nextNotes = String(meta?.notes ?? "");
                const nextEstimatedHours = String(meta?.estimatedHours ?? "");
                const nextGrade = String(meta?.grade ?? "");
                const nextSemesters = validSemestersForCourse(code).map((semester) => ({
                    ...semester,
                    title: semester?.title ?? `Semester ${semester?.id}`,
                }));
                const needsAddToPlanHandler = typeof node?.data?.onAddToPlan !== "function";
                const needsAddModuleToPlanHandler = typeof node?.data?.onAddModuleToPlan !== "function";
                const currentSemesterSig = (Array.isArray(node?.data?.semesters) ? node.data.semesters : [])
                    .map((semester) => `${Number(semester?.id) || 0}:${semester?.title || ""}:${semester?.isParking ? 1 : 0}:${semester?.isPlus ? 1 : 0}`)
                    .join("|");
                const nextSemesterSig = nextSemesters
                    .map((semester) => `${Number(semester?.id) || 0}:${semester?.title || ""}:${semester?.isParking ? 1 : 0}:${semester?.isPlus ? 1 : 0}`)
                    .join("|");
                const nextTermAvailability = termAvailabilityForCode(code);
                if (
                    node?.data?.notes === nextNotes &&
                    String(node?.data?.estimatedHours ?? "") === nextEstimatedHours &&
                    String(node?.data?.grade ?? "") === nextGrade &&
                    node?.data?.onUpdateCourseMeta === updateCourseMeta &&
                    !needsAddToPlanHandler &&
                    !needsAddModuleToPlanHandler &&
                    currentSemesterSig === nextSemesterSig &&
                    node?.data?.termAvailability === nextTermAvailability
                ) {
                    return node;
                }
                changed = true;
                return {
                    ...node,
                    data: {
                        ...node.data,
                        notes: nextNotes,
                        estimatedHours: nextEstimatedHours,
                        grade: nextGrade,
                        onUpdateCourseMeta: updateCourseMeta,
                        onAddToPlan: needsAddToPlanHandler ? addGraphCourseToPlan : node?.data?.onAddToPlan,
                        onAddModuleToPlan: needsAddModuleToPlanHandler ? addGraphModuleToPlan : node?.data?.onAddModuleToPlan,
                        semesters: nextSemesters,
                        recommendation: recommendedCourseMap.get(code) || null,
                        termAvailability: nextTermAvailability,
                    },
                };
            });
            return changed ? next : prev;
        });
    }, [addGraphCourseToPlan, addGraphModuleToPlan, courseMetaByCode, getCourseMeta, nodes, setNodes, updateCourseMeta, validSemestersForCourse, recommendedCourseMap, termAvailabilityForCode]);

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
            const preferredLane = semester - 1;
            const targetLane = item?.prefillFixedSemester
                ? preferredLane
                : firstAllowedLaneForCourse(item?.code, preferredLane);
            if (targetLane == null) continue;
            const targetSemester = targetLane + 1;
            if (!bySemester.has(targetSemester)) bySemester.set(targetSemester, []);
            bySemester.get(targetSemester).push(item);
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
        MIN_GROUP_CHILD_Y,
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
        subjectColors,
        toggleCourseDone,
        toggleModuleDoneCodes,
        updateCourseEcts,
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
        const bySemester = new Map();
        for (const item of plannedCourses) {
            const semester = Number(item?.semester);
            if (!Number.isInteger(semester) || semester < 1 || semester > maxSemesterCount) continue;
            const preferredLane = semester - 1;
            const targetLane = firstAllowedLaneForCourse(item?.code, preferredLane);
            if (targetLane == null) continue;
            const targetSemester = targetLane + 1;
            if (!bySemester.has(targetSemester)) bySemester.set(targetSemester, []);
            bySemester.get(targetSemester).push(item);
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
        startTermSeason,
        subjectColors,
        toggleCourseDone,
        updateCourseEcts,
    ]);

    /************************
     * Group drag mechanics *
     ************************/
    const onNodeDragStart = useCallback((_, node) => {
        nodeDragInProgressRef.current = true;
        nodeDragStartPosRef.current.set(node?.id, {
            x: Number(node?.position?.x ?? 0),
            y: Number(node?.position?.y ?? 0),
        });
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
        const parkedSet = new Set(parkedCourseCodes || []);
        setNodes((prev) => {
            const groupStatuses = new Map();
            for (const n of prev) {
                if (n.type !== "course" || !n?.data?.groupId) continue;
                const groupId = n.data.groupId;
                const nextCourseStatus = parkedSet.has(n?.data?.code) ? "parked" : (doneSet.has(n?.data?.code) ? "done" : "in_plan");
                const current = groupStatuses.get(groupId) || { total: 0, done: 0, parked: 0 };
                current.total += 1;
                if (nextCourseStatus === "done") current.done += 1;
                if (nextCourseStatus === "parked") current.parked += 1;
                groupStatuses.set(groupId, current);
            }

            return prev.map((n) => {
                if (n.type === "course") {
                    const status = parkedSet.has(n?.data?.code)
                        ? "parked"
                        : (doneSet.has(n?.data?.code) ? "done" : "in_plan");
                    if (n?.data?.status === status) return n;
                    return { ...n, data: { ...n.data, status } };
                }
                if (n.type === "moduleBg") {
                    const group = groupStatuses.get(n.id);
                    if (!group || group.total <= 0) return n;
                    const status = group.done === group.total
                        ? "done"
                        : (group.parked === group.total ? "parked" : "in_plan");
                    if (n?.data?.status === status) return n;
                    return { ...n, data: { ...n.data, status } };
                }
                return n;
            });
        });
    }, [doneCourseCodes, parkedCourseCodes, setNodes]);

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
            maxEctsPerSemester: Number(semesterLoadLimits?.maxEctsPerSemester),
            recommendedEctsPerSemester: Number(semesterLoadLimits?.recommendedEctsPerSemester),
            maxWeekHoursPerSemester: Number(semesterLoadLimits?.maxWeekHoursPerSemester),
            recommendedWeekHoursPerSemester: Number(semesterLoadLimits?.recommendedWeekHoursPerSemester),
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
                const isMoveChange =
                    changeSnapshot?.type === "plan_updated" &&
                    Array.isArray(changeSnapshot?.moved) &&
                    changeSnapshot.moved.length > 0;
                if (isAddChange && response?.ok === false) {
                    setStickyViolation({
                        message: response?.message || "Rule violation: change rejected.",
                        until: Date.now() + 5000,
                        tone: "error",
                    });
                    rollbackAddedCourses(changeSnapshot);
                }
                if (isMoveChange && response?.ok === false) {
                    setStickyViolation({
                        message: response?.message || "Rule violation: change rejected.",
                        until: Date.now() + 5000,
                        tone: "error",
                    });
                    rollbackMovedCourses(changeSnapshot);
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
    }, [coursesBySemester, doneCourseCodes, lastPlanChange, programCode, rollbackAddedCourses, rollbackMovedCourses, rollbackCourseStatusToggle, selectedFocus, semesterLoadLimits?.maxEctsPerSemester, semesterLoadLimits?.recommendedEctsPerSemester, semesterLoadLimits?.maxWeekHoursPerSemester, semesterLoadLimits?.recommendedWeekHoursPerSemester, setProgramRuleCheckState]);

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
            maxEctsPerSemester: Number(semesterLoadLimits?.maxEctsPerSemester),
            recommendedEctsPerSemester: Number(semesterLoadLimits?.recommendedEctsPerSemester),
            maxWeekHoursPerSemester: Number(semesterLoadLimits?.maxWeekHoursPerSemester),
            recommendedWeekHoursPerSemester: Number(semesterLoadLimits?.recommendedWeekHoursPerSemester),
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
    }, [plannerHydrated, coursesBySemester, doneCourseCodes, programCode, selectedFocus, semesterLoadLimits?.maxEctsPerSemester, semesterLoadLimits?.recommendedEctsPerSemester, semesterLoadLimits?.maxWeekHoursPerSemester, semesterLoadLimits?.recommendedWeekHoursPerSemester, setProgramRuleCheckState]);

    // Notify backend recommendations endpoint on each plan/status change
    const latestRecChangeIdRef = useRef({});
    useEffect(() => {
        if (!lastPlanChange) return;
        const requestProgramCode = programCode;
        latestRecChangeIdRef.current = {
            ...(latestRecChangeIdRef.current || {}),
            [requestProgramCode]: lastPlanChange.id ?? null,
        };
        const doneSet = new Set(doneCourseCodes || []);
        const allCourses = Object.values(coursesBySemester || {})
            .flat()
            .map((course) => normalizeRulecheckCategoryForProgram(course, requestProgramCode));
        const doneCourses = allCourses.filter((c) => c?.code && doneSet.has(c.code));
        const plannedCourses = allCourses.filter((c) => c?.code && !doneSet.has(c.code));
        const changeIdSnapshot = lastPlanChange.id ?? null;

        fetchRecommendations({
            programCode: requestProgramCode,
            plannedCourses,
            doneCourses,
            parkedCourses: parkedCourseCodes,
        })
            .then((response) => {
                if ((latestRecChangeIdRef.current?.[requestProgramCode] ?? null) !== changeIdSnapshot) return;
                if (response?.ok && response?.recommendations) {
                    setRecommendations(response.recommendations);
                } else {
                    setRecommendations([]);
                }
            })
            .catch((err) => {
                console.error("Failed to fetch recommendations", err);
                if ((latestRecChangeIdRef.current?.[requestProgramCode] ?? null) !== changeIdSnapshot) return;
                setRecommendations([]);
            });
    }, [lastPlanChange, programCode, coursesBySemester, doneCourseCodes, parkedCourseCodes]);

    // Initial recommendations fetch
    useEffect(() => {
        if (!plannerHydrated || !programCode || lastPlanChange) return;
        const requestProgramCode = programCode;
        if (latestRecChangeIdRef.current?.[requestProgramCode] === "initial") return;
        latestRecChangeIdRef.current = {
            ...(latestRecChangeIdRef.current || {}),
            [requestProgramCode]: "initial",
        };
        const doneSet = new Set(doneCourseCodes || []);
        const allCourses = Object.values(coursesBySemester || {})
            .flat()
            .map((course) => normalizeRulecheckCategoryForProgram(course, requestProgramCode));
        const doneCourses = allCourses.filter((c) => c?.code && doneSet.has(c.code));
        const plannedCourses = allCourses.filter((c) => c?.code && !doneSet.has(c.code));

        fetchRecommendations({
            programCode: requestProgramCode,
            plannedCourses,
            doneCourses,
            parkedCourses: parkedCourseCodes,
        })
            .then((response) => {
                if (latestRecChangeIdRef.current?.[requestProgramCode] !== "initial") return;
                if (response?.ok && response?.recommendations) {
                    setRecommendations(response.recommendations);
                } else {
                    setRecommendations([]);
                }
            })
            .catch((err) => {
                console.error("Failed to fetch initial recommendations", err);
                if (latestRecChangeIdRef.current?.[requestProgramCode] !== "initial") return;
                setRecommendations([]);
            });
    }, [plannerHydrated, coursesBySemester, doneCourseCodes, programCode, lastPlanChange, parkedCourseCodes]);

    const handleRecommendationToggle = useCallback(async (key, newValue) => {
        const nextToggles = {
            ...(profileSettingsForProgram?.recommendation_toggles || {
                interest: true, similarity: true, sequence: true, completed: true, internship: true, peer: true
            }),
            [key]: newValue
        };
        
        // Optimistic UI update
        setProfileSettingsByProgram(prev => ({
            ...(prev || {}),
            [programCode]: {
                ...(prev?.[programCode] || {}),
                recommendation_toggles: nextToggles
            }
        }));

        try {
            await saveRecommendationProfile({
                programCode,
                interests: profileSettingsForProgram?.interests || [],
                careerDirection: profileSettingsForProgram?.careerDirection || "",
                recommendationToggles: nextToggles,
            });
            // trigger refetch of recommendations
            const doneSet = new Set(doneCourseCodes || []);
            const allCourses = Object.values(coursesBySemester || {})
                .flat()
                .map((course) => normalizeRulecheckCategoryForProgram(course, programCode));
            const doneCourses = allCourses.filter((c) => c?.code && doneSet.has(c.code));
            const plannedCourses = allCourses.filter((c) => c?.code && !doneSet.has(c.code));
            const response = await fetchRecommendations({ 
                programCode, 
                plannedCourses, 
                doneCourses,
                parkedCourses: parkedCourseCodes
            });
            if (response?.ok && response?.recommendations) {
                setRecommendations(response.recommendations);
            }
        } catch (e) {
            console.error("Failed to save toggle", e);
        }
    }, [programCode, profileSettingsForProgram, doneCourseCodes, coursesBySemester, parkedCourseCodes]);

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
        nodeDragInProgressRef.current = false;
        setDragPreviewSemesterCount(null);
        const snappedYRaw = Math.round(node.position.y / GRID_SIZE) * GRID_SIZE;
        const snappedY = Math.max(0, snappedYRaw);
        let invalidPlacementAttempted = false;

        // If a whole module group was dragged: shift children by the snap delta, snap the group,
        // then recompute the group bbox, and resolve collisions.
        if (node?.type === "moduleBg") {
            const span = LANE_WIDTH + LANE_GAP;
            const rawLane = Math.floor((Number(node?.position?.x || 0) + LANE_GAP * 0.5) / span);
            if (rawLane < 0) {
                const source = rfRef.current?.getNodes?.() || [];
                const codes = source
                    .filter((n) => n.type === "course" && n?.data?.groupId === node.id)
                    .map((n) => n?.data?.code)
                    .filter(Boolean);
                parkCourseCodes(codes);
                groupDragRef.current.delete(node.id);
                nodeDragStartPosRef.current.delete(node?.id);
                return;
            }
            setNodes((prev) => {
                const children = prev.filter((n) => n.type === "course" && n.data?.groupId === node.id);
                const clampedGroupY = Math.max(MIN_MODULE_GROUP_TOP_Y, snappedY);
                const dySnap = clampedGroupY - node.position.y;
                const moved = prev.map((n) => {
                    if (n.type === "course" && n.data?.groupId === node.id) {
                        const preferredLane = clampPlacementLane(laneIndexFromX(n.position.x, maxSemesterCount - 1));
                        const targetLane = firstAllowedLaneForCourse(n?.data?.code, preferredLane) ?? preferredLane;
                        if (!isCourseAllowedInLane(n?.data?.code, preferredLane) && targetLane !== preferredLane) {
                            invalidPlacementAttempted = true;
                        }
                        return {
                            ...n,
                            data: {
                                ...n.data,
                                status: "in_plan",
                            },
                            position: {
                                x: centerX(targetLane),
                                y: n.position.y + dySnap,
                            },
                        };
                    }
                    if (n.type === "moduleBg" && n.id === node.id) {
                        return {
                            ...n,
                            data: {
                                ...n.data,
                                status: "in_plan",
                                onToggleModuleDone: toggleModuleDoneCodes,
                                onRemoveGroup: removeModuleGroup,
                                onRemove: () => removeModuleGroup(node.id),
                            },
                        };
                    }
                    return n;
                });
                const sized = recomputeGroupFromChildren(moved, node.id);
                return resolveLaneCollisions(sized);
            });
            groupDragRef.current.delete(node.id);
            nodeDragStartPosRef.current.delete(node?.id);
            return;
        }

        // Course inside a group → snap only the course, then recompute the group bbox
        if (node?.type === "course" && node?.data?.groupId) {
            const span = LANE_WIDTH + LANE_GAP;
            const rawLane = Math.floor((Number(node?.position?.x || 0) + LANE_GAP * 0.5) / span);
            if (rawLane < 0) {
                parkCourseCodes([node?.data?.code]);
                nodeDragStartPosRef.current.delete(node?.id);
                return;
            }
            const groupId = node.data.groupId;
            const startPos = nodeDragStartPosRef.current.get(node?.id);
            const preferredLane = clampPlacementLane(laneIndexFromX(node.position.x, maxSemesterCount - 1));
            const invalidDrop = !isCourseAllowedInLane(node?.data?.code, preferredLane);
            if (invalidDrop && startPos) {
                setNodes((prev) => {
                    const reverted = prev.map((n) =>
                        n.id === node.id ? { ...n, position: { x: startPos.x, y: startPos.y } } : n
                    );
                    const stacked = resolveGroupCourseOverlaps(reverted, groupId);
                    return resolveLaneCollisions(recomputeGroupFromChildren(stacked, groupId));
                });
                setStickyViolation({
                    message: "This course is not offered in that semester.",
                    until: Date.now() + 3500,
                    tone: "error",
                });
                nodeDragStartPosRef.current.delete(node?.id);
                return;
            }
            setNodes((prev) => {
                const targetLane = firstAllowedLaneForCourse(node?.data?.code, preferredLane) ?? preferredLane;
                if (!isCourseAllowedInLane(node?.data?.code, preferredLane) && targetLane !== preferredLane) {
                    invalidPlacementAttempted = true;
                }
                const targetLaneX = centerX(targetLane);
                const snappedGroupChildY = Math.max(MIN_GROUP_CHILD_Y, snappedY);
                const updated = prev.map((n) =>
                    n.id === node.id ? { ...n, position: { x: targetLaneX, y: snappedGroupChildY } } : n
                );
                const stacked = resolveGroupCourseOverlaps(updated, groupId);
                return resolveLaneCollisions(recomputeGroupFromChildren(stacked, groupId));
            });
            nodeDragStartPosRef.current.delete(node?.id);
            return;
        }

        // All other nodes: normal snapping + collision resolution
        const span = LANE_WIDTH + LANE_GAP;
        const rawLane = Math.floor((Number(node?.position?.x || 0) + LANE_GAP * 0.5) / span);
        if (node?.type === "course" && rawLane < 0) {
            parkCourseCodes([node?.data?.code]);
            nodeDragStartPosRef.current.delete(node?.id);
            return;
        }
        const preferredLane = clampPlacementLane(laneIndexFromX(node.position.x, maxSemesterCount - 1));
        const startPos = nodeDragStartPosRef.current.get(node?.id);
        if (node?.type === "course" && !isCourseAllowedInLane(node?.data?.code, preferredLane) && startPos) {
            setNodes((prev) => {
                const next = prev.map((n) => (
                    n.id === node.id ? { ...n, position: { x: startPos.x, y: startPos.y } } : n
                ));
                return resolveLaneCollisions(next);
            });
            setStickyViolation({
                message: "This course is not offered in that semester.",
                until: Date.now() + 3500,
                tone: "error",
            });
            nodeDragStartPosRef.current.delete(node?.id);
            return;
        }
        const li = node?.type === "course"
            ? (firstAllowedLaneForCourse(node?.data?.code, preferredLane) ?? preferredLane)
            : preferredLane;
        if (node?.type === "course" && !isCourseAllowedInLane(node?.data?.code, preferredLane) && li !== preferredLane) {
            invalidPlacementAttempted = true;
        }
        const snappedX = centerX(li);
        setNodes((prev) => {
            const next = prev.map((n) => {
                if (n.id !== node.id) return n;
                if (n?.type === "course" && String(n?.data?.status || "") === "parked") {
                    setCourseDone(String(n?.data?.code || ""), false);
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            status: "in_plan",
                            groupId: null,
                            moduleMeta: null,
                        },
                        position: { x: snappedX, y: snappedY },
                    };
                }
                return { ...n, position: { x: snappedX, y: snappedY } };
            });
            return resolveLaneCollisions(next);
        });
        if (invalidPlacementAttempted) {
            setStickyViolation({
                message: "This course is not offered in that semester.",
                until: Date.now() + 3500,
                tone: "error",
            });
        }
        nodeDragStartPosRef.current.delete(node?.id);
    }, [MIN_GROUP_CHILD_Y, MIN_MODULE_GROUP_TOP_Y, clampPlacementLane, firstAllowedLaneForCourse, isCourseAllowedInLane, laneIndexFromX, maxSemesterCount, parkCourseCodes, removeModuleGroup, setCourseDone, setNodes, setStickyViolation, toggleModuleDoneCodes]);

    // Merge: run drag-stop logic, then schedule a persist
    const onNodeDragStopMerged = useCallback((evt, node) => {
        onNodeDragStop(evt, node);
        schedulePersist();
    }, [onNodeDragStop, schedulePersist]);

    // Strict policy: keep plan always term-valid.
    // If start term or course-term flags change, auto-shift invalid courses/modules
    // to the next valid semester immediately.
    useEffect(() => {
        if (!plannerHydrated) return;
        if (nodeDragInProgressRef.current) return;
        if (!Array.isArray(nodes) || nodes.length === 0) return;
        let shiftedCount = 0;
        const maxLane = Math.max(0, maxSemesterCount - 1);
        const next = nodes.map((node) => ({ ...node, position: { ...(node?.position || {}) } }));
        const byId = new Map(next.map((node) => [node.id, node]));

        const findAnyAllowedLane = (code, preferredLane) => {
            const forward = firstAllowedLaneForCourse(code, preferredLane);
            if (forward != null) return forward;
            const term = termAvailabilityForCode(code);
            const preferred = Math.max(0, Math.min(Number(preferredLane) || 0, maxLane));
            for (let idx = preferred - 1; idx >= 0; idx -= 1) {
                if (isLaneAllowedForTerm(term, startTermSeason, idx)) return idx;
            }
            return null;
        };

        const groupIds = [...new Set(
            next
                .filter((node) => node?.type === "course" && node?.data?.groupId)
                .map((node) => node.data.groupId)
        )];
        const movedGroups = new Set();

        for (const groupId of groupIds) {
            const children = next.filter((node) => node?.type === "course" && node?.data?.groupId === groupId);
            if (!children.length) continue;
            let movedAnyChildInGroup = false;
            for (const child of children) {
                if (String(child?.data?.status || "") === "parked") continue;
                const code = child?.data?.code;
                if (!code) continue;
                const currentLane = Math.max(0, Math.min(laneIndexFromX(child?.position?.x ?? 0, maxLane), maxLane));
                if (isCourseAllowedInLane(code, currentLane)) continue;
                const targetLane = findAnyAllowedLane(code, currentLane);
                if (targetLane == null || targetLane === currentLane) continue;
                const target = byId.get(child.id);
                if (!target) continue;
                target.position.x = centerX(targetLane);
                shiftedCount += 1;
                movedAnyChildInGroup = true;
            }
            if (movedAnyChildInGroup) movedGroups.add(groupId);
        }

        for (const node of next) {
            if (node?.type !== "course") continue;
            if (String(node?.data?.status || "") === "parked") continue;
            if (node?.data?.groupId) continue;
            const code = node?.data?.code;
            if (!code) continue;
            const currentLane = Math.max(0, Math.min(laneIndexFromX(node?.position?.x ?? 0, maxLane), maxLane));
            if (isCourseAllowedInLane(code, currentLane)) continue;
            const targetLane = findAnyAllowedLane(code, currentLane);
            if (targetLane == null || targetLane === currentLane) continue;
            node.position.x = centerX(targetLane);
            shiftedCount += 1;
        }

        let resolved = next;
        for (const groupId of movedGroups) {
            resolved = recomputeGroupFromChildren(resolved, groupId);
        }
        resolved = resolveLaneCollisions(resolved);

        const changed = resolved.some((node, idx) => {
            const before = nodes[idx];
            if (!before) return true;
            return Number(before?.position?.x ?? 0) !== Number(node?.position?.x ?? 0);
        });
        if (!changed) return;

        setNodes(resolved);
        setCoursesFromNodes(resolved.filter((node) => node.type !== "lane"));
        setNeedsPersist(false);
        if (shiftedCount > 0) {
            setStickyViolation({
                message: `Auto-shifted ${shiftedCount} course${shiftedCount === 1 ? "" : "s"} to valid semesters.`,
                until: Date.now() + 3200,
                tone: "success",
            });
        }
    }, [
        centerX,
        laneIndexFromX,
        nodes,
        plannerHydrated,
        startTermSeason,
        effectiveCourseTermByCode,
        firstAllowedLaneForCourse,
        isLaneAllowedForTerm,
        isCourseAllowedInLane,
        maxSemesterCount,
        recomputeGroupFromChildren,
        resolveLaneCollisions,
        setCoursesFromNodes,
        setNeedsPersist,
        setNodes,
        setStickyViolation,
        termAvailabilityForCode,
    ]);

    // When dragging a multi-selection, ensure all affected module backgrounds follow
    // moved child courses as a final reconciliation step.
    const onSelectionDragStopMerged = useCallback((_, draggedNodes) => {
        const draggedIds = new Set(
            (Array.isArray(draggedNodes) ? draggedNodes : [])
                .map((n) => n?.id)
                .filter(Boolean)
        );
        setNodes((prev) => {
            const affectedGroupIds = new Set();
            for (const n of prev) {
                const isDragged = draggedIds.has(n.id) || Boolean(n?.selected);
                if (!isDragged) continue;
                if (n?.type !== "course" || !n?.data?.groupId) continue;
                affectedGroupIds.add(n.data.groupId);
            }
            if (!affectedGroupIds.size) return prev;
            let next = prev;
            for (const groupId of affectedGroupIds) {
                next = recomputeGroupFromChildren(next, groupId);
            }
            return resolveLaneCollisions(next);
        });
        schedulePersist();
    }, [schedulePersist, setNodes, resolveLaneCollisions]);

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

            const { x } = projectToLaneAndSnap({
                evt,
                wrapperEl: wrapperRef.current,
                rfInstance: rfRef.current,
                maxLaneIndex: Math.min(maxSemesterCount - 1, activeSemesterCount),
            });
            const bounds = wrapperRef.current?.getBoundingClientRect?.();
            const viewport = rfRef.current?.getViewport?.() || { x: 0, y: 0, zoom: 1 };
            const flowX = (Number(evt?.clientX || 0) - Number(bounds?.left || 0) - Number(viewport?.x || 0)) / (Number(viewport?.zoom || 1) || 1);
            const dropInParking = flowX < laneX(0);
            const dropLaneIndex = Math.max(0, Math.min(laneIndexFromX(x, maxSemesterCount - 1), maxSemesterCount - 1));

            // A) Module with >= 2 courses
            if (payload?.kind === "module" && Array.isArray(payload.courses) && payload.courses.length >= 2) {
                const variantResolution = resolveModuleVariantCourses(payload, payload?.variantId ?? null);
                const moduleCourses = Array.isArray(variantResolution?.selectedCourses) ? variantResolution.selectedCourses : payload.courses;
                if (!moduleCourses.length) return;
                if (dropInParking) {
                    parkCourseCodes(moduleCourses.map((course) => course?.code).filter(Boolean));
                    schedulePersist();
                    return;
                }
                const added = addGraphModuleToPlan(payload, dropLaneIndex, {
                    allowDirectLaneSelection: true,
                    variantId: payload?.variantId ?? null,
                });
                if (!added) {
                    setStickyViolation({
                        message: "At least one module course could not be placed in a valid semester.",
                        until: Date.now() + 3500,
                        tone: "error",
                    });
                }
                schedulePersist();
                return;
            }

            // B) Single course card (or module with a single course treated as course)
            if (dropInParking) {
                parkCourseCodes([payload.code]);
                schedulePersist();
                return;
            }
            const added = addGraphCourseToPlan({
                code: payload.code,
                name: payload.name,
                type: payload?.type ?? getCourseTypeForCode(catalog, payload?.code),
                ects: payload.ects ?? null,
                moduleMeta: payload?.moduleMeta ?? null,
                category: payload.category ?? "unknown",
                subjectColor: payload.subjectColor ?? null,
            }, dropLaneIndex, { allowDirectLaneSelection: true });
            if (!added) {
                setStickyViolation({
                    message: "This course is not offered in that semester.",
                    until: Date.now() + 3500,
                    tone: "error",
                });
            }
            schedulePersist();
        },
        [activeSemesterCount, addGraphCourseToPlan, addGraphModuleToPlan, catalog, laneIndexFromX, maxSemesterCount, parkCourseCodes, schedulePersist, setStickyViolation]
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

        const parkingX = centerX(-1);
        const parkedEntries = [];
        (Array.isArray(parkedCourseCodes) ? parkedCourseCodes : []).forEach((code, idx) => {
            const normalizedCode = String(code || "").trim();
            if (!normalizedCode) return;
            const fromCatalog = catalogCourseByCode.get(normalizedCode) || {};
            const examSubject = fromCatalog?.examSubject || getExamSubjectForCode(catalog, normalizedCode) || null;
            const subjectColor =
                (examSubject ? subjectColors?.[examSubject] : null) ||
                "#2563eb";
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
                position: { x: parkingX, y: 96 + idx * (COURSE_LAYOUT_HEIGHT + COLLISION_GAP) },
                sourcePosition: "right",
                targetPosition: "left",
                zIndex: 1,
            });
        });

        const parkedCodeSet = new Set(
            parkedEntries
                .map((node) => String(node?.data?.code || "").trim())
                .filter(Boolean)
        );
        const eligibleParkedGroups = new Map();
        for (const node of parkedEntries) {
            const modMeta = node?.data?.moduleMeta;
            if (!modMeta || !Array.isArray(modMeta?.courseCodes) || modMeta.courseCodes.length < 2) continue;
            const allParked = modMeta.courseCodes.every((courseCode) => parkedCodeSet.has(String(courseCode || "").trim()));
            if (!allParked) continue;
            const groupId = `parked-group-${String(modMeta.id || modMeta.code || modMeta.title || "module").replace(/[^a-zA-Z0-9_-]/g, "_")}`;
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
            const groupId = `parked-group-${String(modMeta.id || modMeta.code || modMeta.title || "module").replace(/[^a-zA-Z0-9_-]/g, "_")}`;
            if (!eligibleParkedGroups.has(groupId)) return;
            node.data.groupId = groupId;
        });
        rebuilt.push(...parkedEntries);

        for (const { groupId, moduleMeta } of eligibleParkedGroups.values()) {
            const moduleCourses = (Array.isArray(moduleMeta?.courseCodes) ? moduleMeta.courseCodes : [])
                .map((courseCode) => {
                    const normalizedCode = String(courseCode || "").trim();
                    const courseCatalog = catalogCourseByCode.get(normalizedCode) || {};
                    return {
                        code: normalizedCode,
                        name: courseCatalog?.name || normalizedCode,
                        ects: courseCatalog?.ects ?? null,
                        type: courseCatalog?.type ?? null,
                    };
                })
                .filter((course) => Boolean(course?.code));
            const modulePayload = {
                kind: "module",
                code: moduleMeta?.code ?? null,
                name: moduleMeta?.title || "Module",
                category: moduleMeta?.category ?? "unknown",
                subjectColor: (moduleMeta?.examSubject ? subjectColors?.[moduleMeta.examSubject] : null) || "#2563eb",
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
                    moduleCourseCodes: moduleCourses.map((c) => c?.code).filter(Boolean),
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
                    subjectColor: (moduleMeta?.examSubject ? subjectColors?.[moduleMeta.examSubject] : null) || "#2563eb",
                },
                position: { x: parkingX, y: MIN_GROUP_CHILD_Y },
                draggable: true,
                dragHandle: ".module-bg-drag-handle",
                selectable: false,
                zIndex: 0,
            });
            groupIds.push(groupId);
        }

        let withGroups = rebuilt;
        for (const groupId of groupIds) {
            withGroups = resolveGroupCourseOverlaps(withGroups, groupId);
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

    /***************************************
     * Sidebar expand/collapse (per subject)
     ***************************************/
    const [expandedPf, setExpandedPf] = useState(new Set());
    const catalogCourseRows = useMemo(() => {
        const rows = [];
        const seen = new Set();
        for (const subject of Array.isArray(catalog) ? catalog : []) {
            const subjectName = subject?.pruefungsfach ?? null;
            for (const module of Array.isArray(subject?.modules) ? subject.modules : []) {
                for (const course of Array.isArray(module?.courses) ? module.courses : []) {
                    const code = String(course?.code || "").trim();
                    if (!code || seen.has(code)) continue;
                    seen.add(code);
                    rows.push({
                        code,
                        title: course?.name || code,
                        type: course?.type || "-",
                        examSubject: subjectName,
                    });
                }
            }
        }
        rows.sort((a, b) => a.code.localeCompare(b.code));
        return rows;
    }, [catalog]);
    const filteredCatalogCourseRows = useMemo(() => {
        const needle = String(profileSearch || "").trim().toLowerCase();
        if (!needle) return catalogCourseRows;
        return catalogCourseRows.filter((row) =>
            String(row?.code || "").toLowerCase().includes(needle) ||
            String(row?.title || "").toLowerCase().includes(needle)
        );
    }, [catalogCourseRows, profileSearch]);
    const pendingTermForCode = useCallback((courseCode) => {
        const code = String(courseCode || "").trim();
        if (!code) return TERM_BOTH;
        if (pendingCourseTermUpdateByCode?.[code]) {
            return normalizeTermAvailability(pendingCourseTermUpdateByCode[code]);
        }
        return termAvailabilityForCode(code);
    }, [pendingCourseTermUpdateByCode, termAvailabilityForCode]);
    const setPendingTermForCode = useCallback((courseCode, termAvailability) => {
        const code = String(courseCode || "").trim();
        if (!code) return;
        const normalized = normalizeTermAvailability(termAvailability);
        setPendingCourseTermUpdateByCode((prev) => ({
            ...(prev || {}),
            [code]: normalized,
        }));
    }, []);
    const saveStartTermSetting = useCallback(async (season, year) => {
        if (isStartTermLocked) return;
        const normalizedSeason = normalizeStartSeason(season);
        const normalizedYear = Number(year) || new Date().getFullYear();
        setIsSavingProfileSettings(true);
        try {
            await saveStartTerm({
                programCode,
                season: normalizedSeason,
                year: normalizedYear,
            });
            setProfileSettingsByProgram((prev) => ({
                ...(prev || {}),
                [programCode]: {
                    ...(prev?.[programCode] || {}),
                    startTerm: { season: normalizedSeason, year: normalizedYear },
                    startTermLocked: true,
                    courseTermOverrides: prev?.[programCode]?.courseTermOverrides || {},
                },
            }));
        } catch (error) {
            console.error("Failed to save start term", error);
            setStickyViolation({
                message: String(error?.message || "").includes("409")
                    ? "Start semester is locked and cannot be changed anymore."
                    : "Could not save start term settings.",
                until: Date.now() + 4000,
                tone: "error",
            });
        } finally {
            setIsSavingProfileSettings(false);
        }
    }, [isStartTermLocked, programCode]);
    const saveSignupSetup = useCallback(async () => {
        const selectedProgramCode = String(signupSetupProgramCode || "").trim();
        if (!selectedProgramCode) return;
        const normalizedSeason = normalizeStartSeason(signupSetupStartSeason);
        const normalizedYear = Number(signupSetupStartYear) || new Date().getFullYear();
        setIsSavingSignupSetup(true);
        try {
            await saveStartTerm({
                programCode: selectedProgramCode,
                season: normalizedSeason,
                year: normalizedYear,
            });
            setLockedProgramCode(selectedProgramCode);
            setProgramCode?.(selectedProgramCode);
            if (selectedProgramCode === BACHELOR_PROGRAM_CODE) {
                setSelectedFocusForProgram?.(selectedProgramCode, signupSetupFocus || "");
            } else {
                setSelectedFocusForProgram?.(selectedProgramCode, "");
            }
            setProfileSettingsByProgram((prev) => ({
                ...(prev || {}),
                [selectedProgramCode]: {
                    ...(prev?.[selectedProgramCode] || {}),
                    startTerm: { season: normalizedSeason, year: normalizedYear },
                    startTermLocked: true,
                    courseTermOverrides: prev?.[selectedProgramCode]?.courseTermOverrides || {},
                },
            }));
            const snapshot = buildPersistSnapshot();
            const nextSnapshot = {
                ...(snapshot || {}),
                programCode: selectedProgramCode,
                selectedFocusByProgram: {
                    ...((snapshot && snapshot.selectedFocusByProgram) || {}),
                    [selectedProgramCode]: selectedProgramCode === BACHELOR_PROGRAM_CODE ? (signupSetupFocus || "") : "",
                },
            };
            await savePlannerState(nextSnapshot);
            setIsSignupSetupOpen(false);
        } catch (error) {
            console.error("Failed to save signup setup", error);
            setStickyViolation({
                message: String(error?.message || "").includes("409")
                    ? "Program/start are already locked and cannot be changed."
                    : "Could not save signup setup.",
                until: Date.now() + 4000,
                tone: "error",
            });
        } finally {
            setIsSavingSignupSetup(false);
        }
    }, [
        buildPersistSnapshot,
        setProgramCode,
        setSelectedFocusForProgram,
        setStickyViolation,
        signupSetupFocus,
        signupSetupProgramCode,
        signupSetupStartSeason,
        signupSetupStartYear,
    ]);
    const resetSignupSetupDraft = useCallback(() => {
        const defaultProgram = String(PROGRAM_OPTIONS?.[0]?.code || "066 937").trim();
        setSignupSetupProgramCode(defaultProgram);
        setSignupSetupStartSeason(TERM_WINTER);
        setSignupSetupStartYear(new Date().getFullYear());
        setSignupSetupFocus("");
    }, []);
    const savePendingCourseTerms = useCallback(async () => {
        const updates = Object.entries(pendingCourseTermUpdateByCode || {})
            .map(([courseCode, termAvailability]) => ({
                courseCode,
                termAvailability: normalizeTermAvailability(termAvailability),
            }))
            .filter((item) => Boolean(item.courseCode));
        if (!updates.length) return;
        setIsSavingProfileSettings(true);
        try {
            await saveCourseTerms({
                programCode,
                updates,
            });
            setProfileSettingsByProgram((prev) => {
                const current = prev?.[programCode] || {};
                const nextOverrides = { ...(current?.courseTermOverrides || {}) };
                for (const update of updates) {
                    nextOverrides[update.courseCode] = update.termAvailability;
                }
                return {
                    ...(prev || {}),
                    [programCode]: {
                        ...current,
                        courseTermOverrides: nextOverrides,
                    },
                };
            });
            setPendingCourseTermUpdateByCode({});
        } catch (error) {
            console.error("Failed to save course term settings", error);
            setStickyViolation({
                message: "Could not save course term settings.",
                until: Date.now() + 4000,
                tone: "error",
            });
        } finally {
            setIsSavingProfileSettings(false);
        }
    }, [pendingCourseTermUpdateByCode, programCode]);
    const saveProfileChanges = useCallback(async () => {
        if (isSavingProfileSettings) return;
        setIsSavingProfileSettings(true);
        try {
            const normalizedSeason = normalizeStartSeason(profileDraftStartSeason);
            const normalizedYear = Number(profileDraftStartYear) || new Date().getFullYear();
            const shouldSaveStartTerm = !isStartTermLocked;
            if (shouldSaveStartTerm) {
                await saveStartTerm({
                    programCode,
                    season: normalizedSeason,
                    year: normalizedYear,
                });
                setProfileSettingsByProgram((prev) => ({
                    ...(prev || {}),
                    [programCode]: {
                        ...(prev?.[programCode] || {}),
                        startTerm: { season: normalizedSeason, year: normalizedYear },
                        startTermLocked: true,
                        courseTermOverrides: prev?.[programCode]?.courseTermOverrides || {},
                    },
                }));
            }

            const updates = Object.entries(pendingCourseTermUpdateByCode || {})
                .map(([courseCode, termAvailability]) => ({
                    courseCode,
                    termAvailability: normalizeTermAvailability(termAvailability),
                }))
                .filter((item) => Boolean(item.courseCode));
            if (updates.length > 0) {
                await saveCourseTerms({
                    programCode,
                    updates,
                });
                setProfileSettingsByProgram((prev) => {
                    const current = prev?.[programCode] || {};
                    const nextOverrides = { ...(current?.courseTermOverrides || {}) };
                    for (const update of updates) {
                        nextOverrides[update.courseCode] = update.termAvailability;
                    }
                    return {
                        ...(prev || {}),
                        [programCode]: {
                            ...current,
                            courseTermOverrides: nextOverrides,
                        },
                    };
                });
                setPendingCourseTermUpdateByCode({});
            }

            // Save Recommendation Profile (interests, career).
            const parsedInterests = profileDraftInterests.split(",").map(i => i.trim()).filter(Boolean);
            await saveRecommendationProfile({
                programCode,
                interests: parsedInterests,
                careerDirection: profileDraftCareer,
                recommendationToggles: profileSettingsForProgram?.recommendation_toggles || {},
            });
            setProfileSettingsByProgram((prev) => ({
                ...(prev || {}),
                [programCode]: {
                    ...(prev?.[programCode] || {}),
                    interests: parsedInterests,
                    careerDirection: profileDraftCareer,
                },
            }));

            if ((selectedFocus || "") !== (profileDraftFocus || "")) {
                setSelectedFocus?.(profileDraftFocus || "");
            }
            setSemesterLoadLimits?.({
                maxEctsPerSemester: Number(profileDraftMaxEcts) || 42,
                recommendedEctsPerSemester: Number(profileDraftRecommendedEcts) || 30,
                maxWeekHoursPerSemester: Number(profileDraftMaxWeekHours) || 50,
                recommendedWeekHoursPerSemester: Number(profileDraftRecommendedWeekHours) || 40,
            });
            setIsProfileOpen(false);

            // Refetch recommendations to reflect newly saved interests/career
            const doneSet = new Set(doneCourseCodes || []);
            const allCourses = Object.values(coursesBySemester || {})
                .flat()
                .map((course) => normalizeRulecheckCategoryForProgram(course, programCode));
            const doneCoursesList = allCourses.filter((c) => c?.code && doneSet.has(c.code));
            const plannedCoursesList = allCourses.filter((c) => c?.code && !doneSet.has(c.code));
            const response = await fetchRecommendations({ 
                programCode, 
                plannedCourses: plannedCoursesList, 
                doneCourses: doneCoursesList,
                parkedCourses: parkedCourseCodes
            });
            if (response?.ok && response?.recommendations) {
                setRecommendations(response.recommendations);
            } else {
                setRecommendations([]);
            }
        } catch (error) {
            console.error("Failed to save profile settings", error);
            setStickyViolation({
                message: String(error?.message || "").includes("409")
                    ? "Start semester is locked and cannot be changed anymore."
                    : "Could not save profile settings.",
                until: Date.now() + 4000,
                tone: "error",
            });
        } finally {
            setIsSavingProfileSettings(false);
        }
    }, [
        isSavingProfileSettings,
        isStartTermLocked,
        startTermSeason,
        startTermYear,
        programCode,
        pendingCourseTermUpdateByCode,
        selectedFocus,
        profileDraftFocus,
        profileDraftStartSeason,
        profileDraftStartYear,
        profileDraftMaxEcts,
        profileDraftRecommendedEcts,
        profileDraftMaxWeekHours,
        profileDraftRecommendedWeekHours,
        profileDraftInterests,
        profileDraftCareer,
        profileSettingsForProgram,
        doneCourseCodes,
        coursesBySemester,
        parkedCourseCodes,
        setRecommendations,
        setSemesterLoadLimits,
        setIsProfileOpen,
        setStickyViolation,
        setIsSavingProfileSettings,
        setSelectedFocus,
    ]);
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
        semesterLoadLimits,
        resolveDashboardCategoryForProgram,
        getExamSubjectForCode,
    });
    const hasSelectedFocusArea = Boolean(String(selectedFocus || bachelorFocus?.selected || "").trim());

    // ── Recommendation state derived data ────────────────────────────────────
    const dismissRecommendation = useCallback((id) => {
        setRecommendations((prev) => prev.filter((r) => r.id !== id));
    }, []);
    const parkRecommendation = useCallback((payload) => {
        addGraphCourseToPlan(payload, -1);
    }, [addGraphCourseToPlan]);
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

    const isRuleSuccessFeedback =
        !stickyActive &&
        !ruleCheckState?.sending &&
        !ruleCheckState?.error &&
        Boolean(ruleCheckState?.response?.ok);
    useEffect(() => {
        if (!isRuleSuccessFeedback) {
            setShowTransientSuccessFeedback(true);
            return;
        }
        const signature = `${programCode}:${ruleCheckState?.lastUpdatedAt ?? ""}:${ruleCheckState?.response?.message ?? ""}`;
        if (successFeedbackSignatureRef.current !== signature) {
            successFeedbackSignatureRef.current = signature;
            setShowTransientSuccessFeedback(true);
        }
        const t = window.setTimeout(() => setShowTransientSuccessFeedback(false), 3000);
        return () => window.clearTimeout(t);
    }, [
        programCode,
        isRuleSuccessFeedback,
        ruleCheckState?.lastUpdatedAt,
        ruleCheckState?.response?.message,
    ]);

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
            tourCompleted={tourCompleted}
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
    const topActionsNode = (
        <div
            style={{
                position: "fixed",
                top: 12,
                right: 12,
                zIndex: 30,
                display: "flex",
                gap: 8,
            }}
        >
            <style>{`
                @keyframes helpPulse {
                    0% {
                        box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.6);
                    }
                    70% {
                        box-shadow: 0 0 0 8px rgba(79, 70, 229, 0);
                    }
                    100% {
                        box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
                    }
                }
            `}</style>
            <div style={{ position: "relative", display: "inline-block" }}>
                <button
                    id="open-tour-btn"
                    onClick={() => setActiveTourStep(viewMode === "graph" ? 13 : 0)}
                    style={{
                        border: "1px solid rgba(79, 70, 229, 0.3)",
                        background: "rgba(79, 70, 229, 0.08)",
                        color: "#4f46e5",
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        animation: (!tourCompleted && !(shouldOfferInitialBachelorPrefill || shouldOfferInitialMasterPrefill)) ? "helpPulse 2s infinite" : "none",
                    }}
                    title="Start interactive planner tour"
                >
                    ❓ Help
                </button>
                {!tourCompleted && !(shouldOfferInitialBachelorPrefill || shouldOfferInitialMasterPrefill) && (
                    <div
                        style={{
                            position: "absolute",
                            top: "calc(100% + 8px)",
                            left: "50%",
                            transform: "translateX(-50%)",
                            background: "#4f46e5",
                            color: "#ffffff",
                            padding: "5px 9px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            boxShadow: "0 4px 12px rgba(79, 70, 229, 0.35)",
                            pointerEvents: "none",
                            zIndex: 35,
                        }}
                    >
                        <div style={{
                            position: "absolute",
                            top: -4,
                            left: "50%",
                            transform: "translateX(-50%) rotate(45deg)",
                            width: 8,
                            height: 8,
                            background: "#4f46e5",
                        }} />
                        Start Tour! ⚡️
                    </div>
                )}
            </div>
            <button
                id="open-dashboard-btn"
                onClick={() => setIsRuleDashboardOpen((v) => !v)}
                style={{
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontWeight: 700,
                    cursor: "pointer",
                }}
                title={isRuleDashboardOpen ? "Close dashboard" : "Open dashboard"}
            >
                {isRuleDashboardOpen ? "▦ Close Dashboard" : "▦ Open Dashboard"}
            </button>
            <button
                id="open-profile-btn"
                onClick={() => setIsProfileOpen(true)}
                style={{
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontWeight: 700,
                    cursor: "pointer",
                }}
                title="Open profile settings"
            >
                Profile
            </button>
            <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                style={{
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
                {isSigningOut ? "⏻ Signing Out..." : "⏻ Sign Out"}
            </button>
        </div>
    );
    const signupSetupModalNode = isSignupSetupOpen ? (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 45,
                background: "rgba(15, 23, 42, 0.32)",
                display: "grid",
                placeItems: "center",
                padding: 16,
            }}
        >
            <div
                style={{
                    width: 420,
                    maxWidth: "100%",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    borderRadius: 10,
                    padding: 12,
                    display: "grid",
                    gap: 10,
                    boxShadow: "0 20px 42px rgba(15, 23, 42, 0.2)",
                }}
            >
                <div style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>Complete Signup Setup</div>
                <div style={{ fontSize: 13, color: "#111827" }}>
                    Name: <strong>{currentUser?.username || "user"}</strong>
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                    <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Study Program</label>
                    <select
                        value={signupSetupProgramCode}
                        onChange={(e) => setSignupSetupProgramCode(e.target.value)}
                        disabled={isSavingSignupSetup}
                        style={{
                            border: "1px solid #d1d5db",
                            background: "#ffffff",
                            borderRadius: 8,
                            padding: "8px 10px",
                            fontWeight: 600,
                            width: "100%",
                            boxSizing: "border-box",
                        }}
                    >
                        {(PROGRAM_OPTIONS || []).map((opt) => (
                            <option key={opt.code} value={opt.code}>
                                {opt.label} ({opt.code})
                            </option>
                        ))}
                    </select>
                </div>
                {signupSetupProgramCode === BACHELOR_PROGRAM_CODE && (
                    <div style={{ display: "grid", gap: 4 }}>
                        <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Focus Area</label>
                        <select
                            value={signupSetupFocus || ""}
                            onChange={(e) => setSignupSetupFocus(e.target.value)}
                            disabled={isSavingSignupSetup}
                            style={{
                                border: "1px solid #d1d5db",
                                background: "#ffffff",
                                borderRadius: 8,
                                padding: "8px 10px",
                                fontWeight: 600,
                                width: "100%",
                                boxSizing: "border-box",
                            }}
                        >
                            <option value="">Select focus area</option>
                            {(BACHELOR_FOCUS_OPTIONS || []).map((focus) => (
                                <option key={focus} value={focus}>
                                    {focus}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                <div style={{ display: "grid", gap: 8, borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Start Semester</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
                        <select
                            value={signupSetupStartSeason}
                            onChange={(e) => setSignupSetupStartSeason(normalizeStartSeason(e.target.value))}
                            disabled={isSavingSignupSetup}
                            style={{
                                border: "1px solid #d1d5db",
                                background: "#ffffff",
                                borderRadius: 8,
                                padding: "8px 10px",
                                fontWeight: 600,
                                width: "100%",
                                boxSizing: "border-box",
                            }}
                        >
                            <option value={TERM_WINTER}>Winter</option>
                            <option value={TERM_SUMMER}>Summer</option>
                        </select>
                        <input
                            type="number"
                            min={1900}
                            max={2600}
                            value={signupSetupStartYear ?? ""}
                            onChange={(e) => setSignupSetupStartYear(e.target.value)}
                            disabled={isSavingSignupSetup}
                            style={{
                                border: "1px solid #d1d5db",
                                background: "#ffffff",
                                borderRadius: 8,
                                padding: "8px 10px",
                                fontWeight: 600,
                                width: "100%",
                                boxSizing: "border-box",
                            }}
                        />
                        <div style={{ alignSelf: "center", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                            S1: {laneSeason(signupSetupStartSeason, 0)}
                        </div>
                    </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <button
                        type="button"
                        onClick={resetSignupSetupDraft}
                        disabled={isSavingSignupSetup}
                        style={{
                            border: "1px solid #d1d5db",
                            background: "#ffffff",
                            color: "#111827",
                            borderRadius: 8,
                            padding: "8px 10px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={saveSignupSetup}
                        disabled={isSavingSignupSetup}
                        style={{
                            border: "1px solid #1d4ed8",
                            background: isSavingSignupSetup ? "#93c5fd" : "#2563eb",
                            color: "#ffffff",
                            borderRadius: 8,
                            padding: "8px 10px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        {isSavingSignupSetup ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    const profileModalNode = isProfileOpen ? (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 40,
                background: "rgba(15, 23, 42, 0.32)",
                display: "grid",
                placeItems: "center",
                padding: 16,
            }}
        >
            <div
                id="profile-modal-container"
                style={{
                    width: 420,
                    maxWidth: "100%",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    borderRadius: 10,
                    padding: 12,
                    display: "grid",
                    gap: 10,
                    boxShadow: "0 20px 42px rgba(15, 23, 42, 0.2)",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>Profile</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <button
                            onClick={() => setIsCurriculumSettingsOpen((v) => !v)}
                            style={{
                                border: "1px solid #d1d5db",
                                background: "#ffffff",
                                borderRadius: 8,
                                padding: "6px 10px",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            Course availability
                        </button>
                        <button
                            onClick={() => setIsProfileOpen(false)}
                            title="Close"
                            aria-label="Close"
                            style={{
                                border: "1px solid #fca5a5",
                                background: "#fef2f2",
                                color: "#b91c1c",
                                borderRadius: 8,
                                fontSize: 12,
                                width: 24,
                                height: 22,
                                lineHeight: 1,
                                cursor: "pointer",
                                fontWeight: 700,
                            }}
                        >
                            ×
                        </button>
                    </div>
                </div>
                {!isCurriculumSettingsOpen && (
                    <div style={{ fontSize: 13, color: "#111827" }}>
                        Name: <strong>{currentUser?.username || "user"}</strong>
                    </div>
                )}
                {!isCurriculumSettingsOpen && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", userSelect: "none", marginTop: 4 }}>
                        <input
                            type="checkbox"
                            checked={profileDisableGraphView}
                            onChange={(e) => {
                                const val = e.target.checked;
                                setProfileDisableGraphView(val);
                                if (val) {
                                    localStorage.setItem("disable-graph-view-" + currentUser?.username, "true");
                                } else {
                                    localStorage.removeItem("disable-graph-view-" + currentUser?.username);
                                }
                            }}
                            style={{ cursor: "pointer", width: 16, height: 16 }}
                        />
                        Disable Graph View (User Study Persona 1)
                    </label>
                )}
                {!isCurriculumSettingsOpen && (
                    <div style={{ display: "grid", gap: 4 }}>
                    <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Study Program</label>
                    <select
                        value={programCode}
                        onChange={(e) => setProgramCode?.(e.target.value)}
                        disabled={isProgramLocked}
                        style={{
                            border: "1px solid #d1d5db",
                            background: isProgramLocked ? "#f3f4f6" : "#ffffff",
                            color: isProgramLocked ? "#6b7280" : "#111827",
                            borderRadius: 8,
                            padding: "8px 10px",
                            fontWeight: 600,
                            width: "100%",
                            boxSizing: "border-box",
                            cursor: isProgramLocked ? "not-allowed" : "default",
                        }}
                    >
                        {(PROGRAM_OPTIONS || []).map((opt) => (
                            <option key={opt.code} value={opt.code}>
                                {opt.label} ({opt.code})
                            </option>
                        ))}
                    </select>
                    {isProgramLocked && (
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                            Study program is locked after signup setup.
                        </div>
                    )}
                    </div>
                )}
                {!isCurriculumSettingsOpen && programCode === BACHELOR_PROGRAM_CODE && (
                    <div style={{ display: "grid", gap: 4 }}>
                        <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Focus Area</label>
                        <select
                            value={profileDraftFocus || ""}
                            onChange={(e) => setProfileDraftFocus(e.target.value)}
                            style={{
                                border: "1px solid #d1d5db",
                                background: "#ffffff",
                                borderRadius: 8,
                                padding: "8px 10px",
                                fontWeight: 600,
                                width: "100%",
                                boxSizing: "border-box",
                            }}
                        >
                            <option value="">Select focus area</option>
                            {(BACHELOR_FOCUS_OPTIONS || []).map((focus) => (
                                <option key={focus} value={focus}>
                                    {focus}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {!isCurriculumSettingsOpen && (
                    <div style={{ display: "grid", gap: 8, borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Start Semester</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
                        <select
                            value={profileDraftStartSeason}
                            onChange={(e) => setProfileDraftStartSeason(normalizeStartSeason(e.target.value))}
                            disabled={isSavingProfileSettings || isStartTermLocked}
                            style={{
                                border: "1px solid #d1d5db",
                                background: (isSavingProfileSettings || isStartTermLocked) ? "#f3f4f6" : "#ffffff",
                                color: (isSavingProfileSettings || isStartTermLocked) ? "#6b7280" : "#111827",
                                borderRadius: 8,
                                padding: "8px 10px",
                                fontWeight: 600,
                                width: "100%",
                                boxSizing: "border-box",
                                cursor: (isSavingProfileSettings || isStartTermLocked) ? "not-allowed" : "default",
                            }}
                        >
                            <option value={TERM_WINTER}>Winter</option>
                            <option value={TERM_SUMMER}>Summer</option>
                        </select>
                        <input
                            type="number"
                            min={1900}
                            max={2600}
                            value={profileDraftStartYear ?? ""}
                            onChange={(e) => setProfileDraftStartYear(e.target.value)}
                            disabled={isSavingProfileSettings || isStartTermLocked}
                            style={{
                                border: "1px solid #d1d5db",
                                background: (isSavingProfileSettings || isStartTermLocked) ? "#f3f4f6" : "#ffffff",
                                color: (isSavingProfileSettings || isStartTermLocked) ? "#6b7280" : "#111827",
                                borderRadius: 8,
                                padding: "8px 10px",
                                fontWeight: 600,
                                width: "100%",
                                boxSizing: "border-box",
                                cursor: (isSavingProfileSettings || isStartTermLocked) ? "not-allowed" : "default",
                            }}
                        />
                        <div style={{ alignSelf: "center", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                            S1: {laneSeason(profileDraftStartSeason, 0)}
                        </div>
                    </div>
                    {isStartTermLocked && (
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                            Start semester is locked after initial setup.
                        </div>
                    )}
                    </div>
                )}
                {!isCurriculumSettingsOpen && (
                    <div style={{ display: "grid", gap: 8, borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Recommendation Preferences</div>
                        <div style={{ display: "grid", gap: 4 }}>
                            <label style={{ fontSize: 11, color: "#374151" }}>Interests (comma separated)</label>
                            <input
                                type="text"
                                value={profileDraftInterests}
                                placeholder="e.g. machine learning, react, robotics"
                                onChange={(e) => setProfileDraftInterests(e.target.value)}
                                disabled={isSavingProfileSettings}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: isSavingProfileSettings ? "#f3f4f6" : "#ffffff",
                                    color: isSavingProfileSettings ? "#6b7280" : "#111827",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 12,
                                    width: "100%",
                                    boxSizing: "border-box",
                                }}
                            />
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                            <label style={{ fontSize: 11, color: "#374151" }}>Career Direction / Internship Target</label>
                            <input
                                type="text"
                                value={profileDraftCareer}
                                placeholder="e.g. Data Scientist, Security Analyst"
                                onChange={(e) => setProfileDraftCareer(e.target.value)}
                                disabled={isSavingProfileSettings}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: isSavingProfileSettings ? "#f3f4f6" : "#ffffff",
                                    color: isSavingProfileSettings ? "#6b7280" : "#111827",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 12,
                                    width: "100%",
                                    boxSizing: "border-box",
                                }}
                            />
                        </div>
                    </div>
                )}
                <div style={{ display: "grid", gap: 8, borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                    {isCurriculumSettingsOpen && (
                        <>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Course Semester Availability</div>
                            <input
                                type="text"
                                placeholder="Search by code/title..."
                                value={profileSearch}
                                onChange={(e) => setProfileSearch(e.target.value)}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 12,
                                }}
                            />
                            <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                    <thead>
                                        <tr style={{ background: "#f9fafb" }}>
                                            <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e5e7eb" }}>Title</th>
                                            <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e5e7eb" }}>Type</th>
                                            <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e5e7eb" }}>Term</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredCatalogCourseRows.map((row) => (
                                            <tr key={`profile-course-${row.code}`}>
                                                <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>
                                                    <div style={{ color: "#6b7280" }}>{row.title}</div>
                                                </td>
                                                <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6", color: "#6b7280", whiteSpace: "nowrap" }}>
                                                    {row.type || "-"}
                                                </td>
                                                <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>
                                                    <select
                                                        value={pendingTermForCode(row.code)}
                                                        onChange={(e) => setPendingTermForCode(row.code, e.target.value)}
                                                        style={{
                                                            border: "1px solid #d1d5db",
                                                            borderRadius: 6,
                                                            padding: "4px 6px",
                                                            background: "#ffffff",
                                                        }}
                                                    >
                                                        <option value={TERM_BOTH}>Both</option>
                                                        <option value={TERM_WINTER}>Winter</option>
                                                        <option value={TERM_SUMMER}>Summer</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredCatalogCourseRows.length === 0 && (
                                            <tr>
                                                <td colSpan={3} style={{ padding: "8px", color: "#6b7280" }}>No courses found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
                {!isCurriculumSettingsOpen && (
                    <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div style={{ display: "grid", gap: 4 }}>
                            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Max ECTS / semester</label>
                            <input
                                type="number"
                                min={1}
                                step={0.5}
                                value={profileDraftMaxEcts ?? ""}
                                onChange={(e) => setProfileDraftMaxEcts(e.target.value)}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontWeight: 600,
                                    width: "100%",
                                    boxSizing: "border-box",
                                }}
                            />
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Max Week-Hours / semester</label>
                            <input
                                type="number"
                                min={1}
                                step={0.5}
                                value={profileDraftMaxWeekHours ?? ""}
                                onChange={(e) => setProfileDraftMaxWeekHours(e.target.value)}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontWeight: 600,
                                    width: "100%",
                                    boxSizing: "border-box",
                                }}
                            />
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Recommended ECTS</label>
                            <input
                                type="number"
                                min={1}
                                step={0.5}
                                value={profileDraftRecommendedEcts ?? ""}
                                onChange={(e) => setProfileDraftRecommendedEcts(e.target.value)}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontWeight: 600,
                                    width: "100%",
                                    boxSizing: "border-box",
                                }}
                            />
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Recommended Week-Hours</label>
                            <input
                                type="number"
                                min={1}
                                step={0.5}
                                value={profileDraftRecommendedWeekHours ?? ""}
                                onChange={(e) => setProfileDraftRecommendedWeekHours(e.target.value)}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontWeight: 600,
                                    width: "100%",
                                    boxSizing: "border-box",
                                }}
                            />
                        </div>
                    </div>
                    </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                    <button
                        onClick={saveProfileChanges}
                        disabled={isSavingProfileSettings}
                        style={{
                            border: "1px solid #15803d",
                            background: isSavingProfileSettings ? "#86efac" : "#16a34a",
                            color: "#ffffff",
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        {isSavingProfileSettings ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    const ruleDashboardAside = isRuleDashboardOpen && (
        <aside
            id="planner-dashboard-container"
            style={{
                width: 420,
                borderLeft: "1px solid #e5e7eb",
                background: "#ffffff",
                marginTop: PANEL_TOP_MARGIN,
                marginBottom: PANEL_BOTTOM_MARGIN,
                height: `calc(100vh - ${PANEL_TOP_MARGIN + PANEL_BOTTOM_MARGIN}px)`,
                padding: 12,
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
                alignSelf: "flex-start",
            }}
        >
            {/* ── Right-panel tab bar ───────────────────────────────────── */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                    gap: 8,
                }}
            >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", padding: "5px 0" }}>
                    Planner Dashboard
                </div>
                <button
                    onClick={() => setIsRuleDashboardOpen(false)}
                    style={{
                        border: "1px solid #d1d5db",
                        background: "#ffffff",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontSize: 12,
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
                    id="dashboard-planned-tab"
                    onClick={() => setDashboardViewMode("planning")}
                    style={getDashboardModeButtonStyle("planning")}
                >
                    Planned
                </button>
                <button
                    id="dashboard-done-tab"
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
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Per Exam Subject (ECTS)</div>
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
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Per Semester (ECTS)</div>
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
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Per Category (ECTS)</div>
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

            {dashboardViewMode === "planning" && (
                <div
                    draggable
                    onDragStart={() => handlePlannedSectionDragStart("planned_hours")}
                    onDragOver={(event) => handlePlannedSectionDragOver(event, "planned_hours")}
                    onDrop={() => handlePlannedSectionDrop("planned_hours")}
                    onDragEnd={handlePlannedSectionDragEnd}
                    style={plannedSectionStyle("planned_hours", { marginBottom: 12 })}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Estimated Week-Hours per Semester</div>
                        <button
                            onClick={() => setIsPlannedEstimatedHoursOpen((v) => !v)}
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
                            {isPlannedEstimatedHoursOpen ? "Collapse" : "Expand"}
                        </button>
                    </div>
                    <div style={{ fontSize: 12, color: "#374151", marginBottom: isPlannedEstimatedHoursOpen ? 6 : 0 }}>
                        {plannedEstimatedHoursPerSemesterRows.length === 0
                            ? "No estimated week-hours data yet."
                            : `Estimated average week-hours ${plannedEstimatedHoursAverage.toFixed(1)} h across ${plannedEstimatedHoursPerSemesterRows.length} semester${plannedEstimatedHoursPerSemesterRows.length === 1 ? "" : "s"}.`}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: isPlannedEstimatedHoursOpen ? 6 : 0 }}>
                        Target ~ {recommendedWeekHoursPerSemester.toFixed(1)} h / week / semester
                    </div>
                    <div style={{ fontSize: 12, color: plannedWeekHoursWithinDesiredWorkload ? "#166534" : "#991b1b", marginBottom: isPlannedEstimatedHoursOpen ? 6 : 0 }}>
                        {plannedEstimatedHoursPerSemesterRows.length === 0
                            ? "No estimated week-hours data yet."
                            : (plannedWeekHoursWithinDesiredWorkload
                                ? "You are under your desired week-hours workload in every semester."
                                : "At least one semester is above your desired week-hours workload.")}
                    </div>
                    {isPlannedEstimatedHoursOpen && (
                        <div style={{ display: "grid", gap: 8 }}>
                            {plannedEstimatedHoursPerSemesterRows.length === 0 && (
                                <div style={{ fontSize: 12, color: "#6b7280" }}>No estimated week-hours data yet.</div>
                            )}
                            {plannedEstimatedHoursPerSemesterRows.map((row) => {
                                const rowPct = Math.max(0, Math.min(100, (Number(row?.hours || 0) / maxWeekHoursForScale) * 100));
                                const targetPct = Math.max(0, Math.min(100, (recommendedWeekHoursPerSemester / maxWeekHoursForScale) * 100));
                                const greenPct = Math.max(0, Math.min(rowPct, targetPct));
                                const redPct = Math.max(0, rowPct - targetPct);
                                return (
                                    <div key={`planned-hours-semester-${row.sem}`} style={{ display: "grid", gap: 4 }}>
                                        <div style={{ fontSize: 12, color: "#374151", display: "flex", justifyContent: "space-between" }}>
                                            <span>Semester {row.sem}</span>
                                            <strong>{Number(row.hours).toFixed(1)} h</strong>
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
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Per Exam Subject (ECTS)</div>
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
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Per Semester (ECTS)</div>
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
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Per Category (ECTS)</div>
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

            {dashboardViewMode === "progress" && (
                <div
                    draggable
                    onDragStart={() => handleDoneSectionDragStart("done_grade")}
                    onDragOver={(event) => handleDoneSectionDragOver(event, "done_grade")}
                    onDrop={() => handleDoneSectionDrop("done_grade")}
                    onDragEnd={handleDoneSectionDragEnd}
                    style={doneSectionStyle("done_grade", { marginBottom: 12 })}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Grade per Semester</div>
                        <button
                            onClick={() => setIsDoneGradePerSemesterOpen((v) => !v)}
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
                            {isDoneGradePerSemesterOpen ? "Collapse" : "Expand"}
                        </button>
                    </div>
                    <div style={{ fontSize: 12, color: "#374151", marginBottom: isDoneGradePerSemesterOpen ? 6 : 0 }}>
                        {doneGradeOverall == null
                            ? "No done grades with ECTS weighting yet."
                            : (
                                <>
                                    Overall ECTS-weighted grade: <strong>{doneGradeOverall.toFixed(2)}</strong> across {doneGradePerSemesterRows.length} semester{doneGradePerSemesterRows.length === 1 ? "" : "s"}.
                                </>
                            )}
                    </div>
                    <div style={{ fontSize: 12, color: missingDoneGradesCount === 0 ? "#166534" : "#991b1b", marginBottom: isDoneGradePerSemesterOpen ? 6 : 0 }}>
                        {missingDoneGradesCount === 0
                            ? "All done courses have a grade."
                            : `Missing grades for ${missingDoneGradesCount} done course${missingDoneGradesCount === 1 ? "" : "s"}.`}
                    </div>
                    {isDoneGradePerSemesterOpen && (
                        <div style={{ display: "grid", gap: 8 }}>
                            {doneGradePerSemesterRows.length === 0 && (
                                <div style={{ fontSize: 12, color: "#6b7280" }}>No done grades with ECTS weighting yet.</div>
                            )}
                            {doneGradePerSemesterRows.map((row) => {
                                const normalized = Math.max(0, Math.min(100, ((5 - Number(row.grade || 0)) / 4) * 100));
                                return (
                                    <div key={`done-grade-semester-${row.sem}`} style={{ display: "grid", gap: 4 }}>
                                        <div style={{ fontSize: 12, color: "#374151", display: "flex", justifyContent: "space-between" }}>
                                            <span>Semester {row.sem}</span>
                                            <strong>{Number(row.grade).toFixed(2)}</strong>
                                        </div>
                                        <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                                            <div style={{ width: `${normalized}%`, height: "100%", background: "#16a34a" }} />
                                        </div>
                                    </div>
                                );
                            })}
                            {missingDoneGradesCount > 0 && (
                                <div style={{ display: "grid", gap: 6, marginTop: 2 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#991b1b" }}>Missing grade entries</div>
                                    {missingDoneGradesBySemester.map((row) => (
                                        <div key={`missing-grade-sem-${row.sem}`} style={{ border: "1px solid #fecaca", borderRadius: 8, padding: 8, background: "#fef2f2" }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: "#7f1d1d", marginBottom: 4 }}>
                                                Semester {row.sem}
                                            </div>
                                            <div style={{ display: "grid", gap: 3 }}>
                                                {row.missingCourses.map((course, idx) => (
                                                    <div key={`missing-grade-course-${row.sem}-${idx}`} style={{ fontSize: 12, color: "#991b1b" }}>
                                                        {course?.code || "-"}{course?.name ? ` · ${course.name}` : ""}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
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
            <div style={{ display: "flex", height: "100vh", width: "100vw", background: "#f9fafb", overflow: "hidden" }}>
                {plannerNotificationsNode}
                {topActionsNode}
                {profileModalNode}
                {signupSetupModalNode}
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
                        getCourseMeta={getCourseMeta}
                        onUpdateCourseMeta={updateCourseMeta}
                        semesterOptions={sidebarSemesters}
                        getValidSemestersForCourse={validSemestersForCourse}
                        getValidSemestersForModule={validSemestersForModule}
                        termAvailabilityForCode={termAvailabilityForCode}
                        graphViewState={graphViewState}
                        setGraphViewState={setGraphViewState}
                        graphStateReady={plannerHydrated && plannerLoadOk}
                        onGraphViewSnapshot={(snapshot) => {
                            latestGraphSnapshotRef.current = snapshot;
                        }}
                        isRuleDashboardOpen={isRuleDashboardOpen}
                        onToggleRuleDashboard={() => setIsRuleDashboardOpen((v) => !v)}
                        isRecPanelOpen={isRecPanelOpen}
                        onToggleRecPanel={() => setIsRecPanelOpen((v) => !v)}
                        recommendations={recommendations}
                        setRecommendations={setRecommendations}
                        recommendationToggles={profileSettingsByProgram?.[programCode]?.recommendation_toggles || {}}
                        onRecommendationToggleChange={handleRecommendationToggle}
                        onDragStart={handleDragStart}
                        recommendedCourseMap={recommendedCourseMap}
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

                {activeTourStep !== null && (
                    <OnboardingTour
                        activeStep={activeTourStep}
                        setActiveStep={setActiveTourStep}
                        viewMode={viewMode}
                        setViewMode={setViewMode}
                        disableGraphView={profileDisableGraphView}
                        username={currentUser?.username}
                        onClose={() => setActiveTourStep(null)}
                    />
                )}
            </div>
        );
    }

    return (
        <div style={{ display: "flex", height: "100vh", width: "100vw", background: "#f9fafb", position: "relative", overflow: "hidden" }}>
            {plannerNotificationsNode}
            {topActionsNode}
            {profileModalNode}
            {signupSetupModalNode}
            <div
                style={{
                    position: "absolute",
                    top: TABLE_TOP_CONTROLS_TOP,
                    left: SIDEBAR_LEFT_OFFSET,
                    zIndex: 7,
                    display: "grid",
                    gap: 6,
                    gridTemplateColumns: "1fr 1fr",
                    width: SIDEBAR_VISUAL_WIDTH,
                    boxSizing: "border-box",
                }}
            >
                {!profileDisableGraphView && (
                    <button
                        id="toggle-view-mode-btn"
                        onClick={() => setViewMode("graph")}
                        style={{
                            border: "1px solid #d1d5db",
                            background: "#ffffff",
                            borderRadius: 8,
                            padding: "6px 8px",
                            textAlign: "center",
                            whiteSpace: "nowrap",
                            fontWeight: 600,
                            cursor: "pointer",
                            gridColumn: "1 / -1",
                        }}
                    >
                        ⇆ Graph View
                    </button>
                )}
                <button
                    id="show-all-catalog-btn"
                    onClick={() => setIsSidebarOpen((v) => !v)}
                    style={{
                        border: "1px solid #d1d5db",
                        background: "#ffffff",
                        borderRadius: 8,
                        padding: "6px 8px",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        fontWeight: 600,
                        cursor: "pointer",
                    }}
                >
                    {isSidebarOpen ? "☰ Hide Sidebar" : "☰ Show Sidebar"}
                </button>
                <button
                    id="open-recommendations-btn"
                    onClick={() => setIsRecPanelOpen((v) => !v)}
                    style={{
                        border: "1px solid #d1d5db",
                        background: "#ffffff",
                        borderRadius: 8,
                        padding: "6px 8px",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        fontWeight: 600,
                        cursor: "pointer",
                    }}
                >
                    {isRecPanelOpen ? "★ Hide Recs" : "★ Show Recs"}
                </button>
            </div>
            {isSidebarOpen && (
                <Sidebar
                    programCode={programCode}
                    catalog={catalog}
                    loading={loadingCatalog}
                    error={catalogError}
                    expandedSet={expandedPf}
                    togglePf={togglePf}
                    onDragStart={handleDragStart}
                    subjectColors={subjectColors}
                    getCourseStatus={getCourseStatus}
                    onAddCourseToPlan={addGraphCourseToPlan}
                    onAddModuleToPlan={addGraphModuleToPlan}
                    onToggleCourseDone={toggleGraphCourseDone}
                    onToggleModuleDone={toggleGraphModuleDone}
                    onRemoveCourseFromPlan={removeGraphCourseFromPlan}
                    onRemoveModuleFromPlan={removeGraphModuleFromPlan}
                    getCourseMeta={getCourseMeta}
                    onUpdateCourseMeta={updateCourseMeta}
                    semesterOptions={sidebarSemesters}
                    getValidSemestersForCourse={validSemestersForCourse}
                    getValidSemestersForModule={validSemestersForModule}
                    width={SIDEBAR_WIDTH}
                    leftOffset={SIDEBAR_LEFT_OFFSET}
                    topOffset={TABLE_SIDEBAR_TOP_OFFSET}
                    bottomOffset={TABLE_SIDEBAR_BOTTOM_OFFSET}
                    recommendations={recommendations}
                />
            )}

            {isRecPanelOpen && (
                <RecommendationPanel
                    recommendations={recommendations}
                    onDismiss={(id) => setRecommendations((prev) => prev.filter((r) => r.id !== id))}
                    onAddToPlan={(payload, laneIndex) => {
                        addGraphCourseToPlan(payload, laneIndex, { allowDirectLaneSelection: true });
                    }}
                    semesterOptions={sidebarSemesters}
                    getValidSemestersForCourse={validSemestersForCourse}
                    toggles={profileSettingsByProgram?.[programCode]?.recommendation_toggles || {}}
                    onToggleChange={handleRecommendationToggle}
                    width={REC_PANEL_WIDTH}
                    leftOffset={isSidebarOpen ? (SIDEBAR_VISUAL_WIDTH + SIDEBAR_LEFT_OFFSET + 8) : SIDEBAR_LEFT_OFFSET}
                    topOffset={TABLE_SIDEBAR_TOP_OFFSET}
                    bottomOffset={TABLE_SIDEBAR_BOTTOM_OFFSET}
                    programCode={programCode}
                    getCourseStatus={getCourseStatus}
                    onDragStart={handleDragStart}
                    subjectColors={subjectColors}
                    onToggleCourseDone={toggleGraphCourseDone}
                    onRemoveCourseFromPlan={removeGraphCourseFromPlan}
                    getCourseMeta={getCourseMeta}
                    onUpdateCourseMeta={updateCourseMeta}
                />
            )}

            <div style={{ flex: 1, display: "flex", minWidth: 0 }}>
                <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
                    {(!isRuleSuccessFeedback || showTransientSuccessFeedback) && (
                        <div
                            style={{
                                position: "absolute",
                                top: 12,
                                left: "50%",
                                transform: "translateX(-50%)",
                                zIndex: 5,
                                border: `1px solid ${feedbackBorder}`,
                                background: feedbackBg,
                                color: feedbackColor,
                                borderRadius: 8,
                                padding: "8px 10px",
                                fontSize: 12,
                                fontWeight: 600,
                                maxWidth: 520,
                            }}
                        >
                            {feedbackText}
                        </div>
                    )}

                    <div className="rf-wrapper" ref={wrapperRef} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} style={{ position: "absolute", inset: 0 }}>
                        <ReactFlow
                            onInit={(inst) => (rfRef.current = inst)}
                            nodes={renderNodes}
                            onNodesChange={onNodesChange}
                            onNodeDragStart={onNodeDragStart}
                            onNodeDrag={onNodeDrag}
                            onNodeDragStop={onNodeDragStopMerged}
                            onSelectionDragStop={onSelectionDragStopMerged}
                            nodeTypes={NODE_TYPES}
                            fitView
                            snapToGrid
                            snapGrid={[GRID_SIZE, GRID_SIZE]}
                            selectNodesOnDrag={tableInteractionMode === "select"}
                            selectionOnDrag={tableInteractionMode === "select"}
                            panOnDrag={tableInteractionMode === "pan"}
                            proOptions={{ hideAttribution: true }}
                        >
                            <MiniMap pannable zoomable />
                            <Controls position="bottom-left">
                                <ControlButton
                                    onClick={() => setTableInteractionMode((m) => (m === "pan" ? "select" : "pan"))}
                                    title={`Mode: ${tableInteractionMode === "select" ? "Select" : "Pan"}`}
                                    aria-label={`Mode: ${tableInteractionMode === "select" ? "Select" : "Pan"}`}
                                >
                                    <span style={{ fontSize: 13, lineHeight: 1 }}>{tableInteractionMode === "select" ? "▣" : "✋"}</span>
                                </ControlButton>
                                <ControlButton
                                    onClick={() => setIsLegendOpen((v) => !v)}
                                    title={isLegendOpen ? "Close Legend" : "Show Legend"}
                                    aria-label={isLegendOpen ? "Close Legend" : "Show Legend"}
                                >
                                    <span style={{ fontSize: 14, lineHeight: 1 }}>ℹ</span>
                                </ControlButton>
                            </Controls>
                            <Background gap={GRID_SIZE} />
                        </ReactFlow>

                        {/* Layout Semantics Pill */}
                        <div
                            style={{
                                position: "absolute",
                                bottom: 16,
                                left: "50%",
                                transform: "translateX(-50%)",
                                zIndex: 10,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                background: "rgba(255, 255, 255, 0.9)",
                                backdropFilter: "blur(8px)",
                                border: "1px solid #e5e7eb",
                                borderRadius: 9999,
                                padding: "6px 14px",
                                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
                                fontSize: 11,
                                fontWeight: 500,
                                color: "#374151",
                            }}
                        >
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <span style={{ color: "#4f46e5", fontWeight: 700 }}>↔ Horizontal:</span> Semesters (Chronological)
                            </span>
                            <span style={{ color: "#d1d5db" }}>|</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <span style={{ color: "#4f46e5", fontWeight: 700 }}>↕ Vertical:</span> 
                                {tableVerticalSemantics === "no_meaning" && (
                                    <span style={{ color: "#9ca3af", fontStyle: "italic" }}>
                                        no meaning
                                    </span>
                                )}
                                {tableVerticalSemantics === "alphabetical" && <span>Alphabetical (A-Z)</span>}
                                {tableVerticalSemantics === "ects" && <span>ECTS (descending)</span>}
                                {tableVerticalSemantics === "custom" && (
                                    <span style={{ fontWeight: 600, color: "#1f2937" }}>{tableVerticalCustomText || "Custom meaning"}</span>
                                )}
                            </span>
                            <button
                                id="table-semantics-edit-btn"
                                onClick={() => setIsTableSemanticsPopupOpen(true)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    padding: 0,
                                    cursor: "pointer",
                                    color: "#4f46e5",
                                    fontWeight: 700,
                                    fontSize: 11,
                                    marginLeft: 6,
                                    textDecoration: "underline",
                                }}
                            >
                                Edit
                            </button>
                        </div>

                        {isTableSemanticsPopupOpen && (
                            <div
                                style={{
                                    position: "absolute",
                                    bottom: 50,
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    zIndex: 11,
                                    width: 320,
                                    background: "#ffffff",
                                    border: "1px solid #d1d5db",
                                    borderRadius: 12,
                                    padding: 14,
                                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                                    display: "grid",
                                    gap: 10,
                                }}
                            >
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>Configure Layout Axis Semantics</div>
                                
                                {/* Horizontal Axis */}
                                <div style={{ display: "grid", gap: 4 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#4b5563" }}>Horizontal Axis Semantics</div>
                                    <div style={{ fontSize: 11, color: "#6b7280", fontStyle: "italic" }}>
                                        Semesters (fixed by layout)
                                    </div>
                                </div>

                                <hr style={{ border: "0", borderTop: "1px solid #e5e7eb", margin: "4px 0" }} />

                                {/* Vertical Axis */}
                                <div style={{ display: "grid", gap: 6 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#4b5563" }}>Vertical Axis Semantics</div>
                                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#374151", cursor: "pointer" }}>
                                        <input
                                            type="radio"
                                            name="tableVerticalSemantics"
                                            checked={tableVerticalSemantics === "no_meaning"}
                                            onChange={() => setTableVerticalSemantics("no_meaning")}
                                        />
                                        No meaning
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#374151", cursor: "pointer" }}>
                                        <input
                                            type="radio"
                                            name="tableVerticalSemantics"
                                            checked={tableVerticalSemantics === "alphabetical"}
                                            onChange={() => setTableVerticalSemantics("alphabetical")}
                                        />
                                        Alphabetical (A-Z)
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#374151", cursor: "pointer" }}>
                                        <input
                                            type="radio"
                                            name="tableVerticalSemantics"
                                            checked={tableVerticalSemantics === "ects"}
                                            onChange={() => setTableVerticalSemantics("ects")}
                                        />
                                        ECTS (descending)
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#374151", cursor: "pointer" }}>
                                        <input
                                            type="radio"
                                            name="tableVerticalSemantics"
                                            checked={tableVerticalSemantics === "custom"}
                                            onChange={() => setTableVerticalSemantics("custom")}
                                        />
                                        Custom meaning...
                                    </label>
                                </div>

                                {tableVerticalSemantics === "custom" && (
                                    <input
                                        type="text"
                                        placeholder="Enter custom vertical ordering meaning"
                                        value={tableVerticalCustomText}
                                        onChange={(e) => setTableVerticalCustomText(e.target.value)}
                                        style={{
                                            border: "1px solid #d1d5db",
                                            borderRadius: 6,
                                            padding: "4px 8px",
                                            fontSize: 11,
                                            width: "100%",
                                            boxSizing: "border-box",
                                        }}
                                    />
                                )}

                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
                                    <button
                                        onClick={() => setIsTableSemanticsPopupOpen(false)}
                                        style={{
                                            background: "#4f46e5",
                                            color: "#ffffff",
                                            border: "none",
                                            borderRadius: 6,
                                            padding: "4px 10px",
                                            fontSize: 11,
                                            fontWeight: 600,
                                            cursor: "pointer",
                                        }}
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    {isLegendOpen && (
                        <div style={{ position: "absolute", right: 12, bottom: 12, zIndex: 6 }}>
                            <VisualLegend programCode={programCode} />
                        </div>
                    )}
                </div>

                {ruleDashboardAside}
            </div>

            {activeTourStep !== null && (
                <OnboardingTour
                    activeStep={activeTourStep}
                    setActiveStep={setActiveTourStep}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    disableGraphView={profileDisableGraphView}
                    username={currentUser?.username}
                    onClose={() => setActiveTourStep(null)}
                />
            )}
        </div>
    );
}
