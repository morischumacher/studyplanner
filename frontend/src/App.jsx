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

import { CourseCard, LaneColumn, ModuleGroupBackground, Sidebar, OnboardingTour } from "./components";
import VisualLegend from "./components/VisualLegend.jsx";
import CurriculumGraphView from "./components/CurriculumGraphView.jsx";
import {
    ProfileModal,
    SignupSetupModal,
    useProfileForm,
    useProfileSettings,
} from "./features/profile/index.ts";
import RecommendationPanel from "./components/RecommendationPanel.jsx";
import {
    useCatalogue,
    useEffectiveCourseTerms,
} from "./features/catalogue/index.ts";
import {
    useRecommendationList,
    useRecommendationRequests,
} from "./features/recommendations/index.ts";
import {
    PrefillNotifications,
    useFocusPrefillOffer,
    usePrefillPrompts,
    usePrefilledPlans,
} from "./features/prefill/index.ts";
import {
    useProgressMilestone,
    useRuleCheckRollbacks,
    useRuleCheckState,
    useRuleCheckSync,
    useStickyViolation,
    useStickyViolationExpiry,
    useTransientSuccessFeedback,
} from "./features/rule-check/index.ts";
import { useOnboardingTour } from "./features/tour/index.ts";
import { usePlannerPersistence } from "./app/persistence/index.ts";
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
    centerX,
    laneIndexFromX,
    laneX,
    projectToLaneAndSnap,
} from "./domain/layout.ts";
import {
    buildSemesterList,
    firstAllowedLaneAtOrAfter,
    isLaneAllowedForTerm,
    semesterBoundsForProgram,
} from "./domain/terms.ts";
import { resolveModuleVariantCourses } from "./domain/prefill/index.ts";
import {
    BACHELOR_FOCUS_OPTIONS,
    BACHELOR_PROGRAM_CODE,
    MASTER_PROGRAM_CODE,
    PROGRAM_OPTIONS,
} from "./domain/programmes.ts";
import {
    getCourseTypeForCode,
    getExamSubjectForCode,
} from "./domain/catalogue.ts";
import {
    compactPrefillLayout as compactPrefillLayoutBase,
    laneIdx,
    recomputeGroupFromChildren,
    resolveGroupCourseOverlaps,
    resolveLaneCollisions as resolveLaneCollisionsBase,
} from "./domain/nodes.ts";
import { useDashboardSectionOrdering } from "./hooks/useDashboardSectionOrdering.js";
import {
    PlannerDashboard,
    computeDashboardMetrics,
    useDashboardPanels,
    useEmptySectionAutoClose,
} from "./features/dashboard/index.ts";

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
        setMultipleCoursesDone,
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

    const { ruleCheckState, setProgramRuleCheckState } = useRuleCheckState({ programCode });
    const dashboardPanels = useDashboardPanels({ programCode });
    const {
        isRuleDashboardOpen,
        setIsRuleDashboardOpen,
        isLegendOpen,
        setIsLegendOpen,
        dashboardViewMode,
        plannedDashboardSectionOrder,
        setPlannedDashboardSectionOrder,
        doneDashboardSectionOrder,
        setDoneDashboardSectionOrder,
        dashboardUiForProgram,
        dashboardUiGlobal,
        restoreDashboardUiFromPlannerState,
    } = dashboardPanels;
    const {
        recommendations,
        setRecommendations,
        recommendedCourseMap,
    } = useRecommendationList();
    const { stickyViolation, setStickyViolation } = useStickyViolation();

    // React Flow refs
    const wrapperRef = useRef(null);
    const rfRef = useRef(null);
    const addGraphModuleToPlanRef = useRef(null);
    const groupDragRef = useRef(new Map()); // Map<groupId, { lastX, lastY }>
    const nodeDragStartPosRef = useRef(new Map()); // Map<nodeId, { x, y }>
    const nodeDragInProgressRef = useRef(false);
    const pendingInitialSyncProgramRef = useRef(programCode);
    const pendingDragPayloadRef = useRef(null);
    const hydratedProgramRef = useRef(null);
    const latestGraphSnapshotRef = useRef(null);
    const [isSigningOut, setIsSigningOut] = useState(false);
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

    const [isParkingCollapsed, setIsParkingCollapsed] = useState(false);
    const [tableInteractionMode, setTableInteractionMode] = useState("pan");
    const {
        focusPrefillPrompt,
        setFocusPrefillPrompt,
        dismissedInitialPrefillPrompt,
        setDismissedInitialPrefillPrompt,
    } = usePrefillPrompts();

    useEffect(() => {
        latestGraphSnapshotRef.current = null;
    }, [programCode, setProgramCode]);

    useEffect(() => {
        pendingInitialSyncProgramRef.current = programCode;
    }, [programCode]);

    useEffect(() => {
        setDragPreviewSemesterCount(null);
    }, [programCode]);

    const {
        catalog,
        loadingCatalog,
        catalogError,
        subjectColors,
        catalogCourseByCode,
    } = useCatalogue({ programCode });

    const {
        isProfileOpen,
        setIsProfileOpen,
        isSignupSetupOpen,
        setIsSignupSetupOpen,
        profileSettingsByProgram,
        setProfileSettingsByProgram,
        profileSettingsForProgram,
        setLockedProgramCode,
        startTermSeason,
        startTermYear,
        isStartTermLocked,
        isProgramLocked,
        courseTermOverrides,
    } = useProfileSettings({ programCode, setProgramCode });

    const { activeTourStep, setActiveTourStep, tourCompleted } = useOnboardingTour({
        currentUser,
        setIsSidebarOpen,
        setIsRecPanelOpen,
        setIsRuleDashboardOpen,
        setIsProfileOpen,
    });

    const {
        plannerHydrated,
        plannerLoadOk,
        buildPersistSnapshot,
        flushPlannerStateSave,
    } = usePlannerPersistence({
        programCode,
        exportPlannerStateSnapshot,
        importPlannerStateSnapshot,
        restoreDashboardUiFromPlannerState,
        dashboardUiForProgram,
        dashboardUiGlobal,
        latestGraphSnapshotRef,
        hydratedProgramRef,
    });

    const handleSignOut = useCallback(async () => {
        if (isSigningOut) return;
        setIsSigningOut(true);
        try {
            await flushPlannerStateSave();
            await onSignOut?.();
        } finally {
            setIsSigningOut(false);
        }
    }, [isSigningOut, flushPlannerStateSave, onSignOut]);

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
    const { effectiveCourseTermByCode, termAvailabilityForCode } = useEffectiveCourseTerms({
        catalog,
        courseTermOverrides,
    });

    const {
        signupSetupProgramCode,
        setSignupSetupProgramCode,
        signupSetupStartSeason,
        setSignupSetupStartSeason,
        signupSetupStartYear,
        setSignupSetupStartYear,
        signupSetupFocus,
        setSignupSetupFocus,
        isSavingSignupSetup,
        saveSignupSetup,
        resetSignupSetupDraft,
        isCurriculumSettingsOpen,
        setIsCurriculumSettingsOpen,
        profileSearch,
        setProfileSearch,
        filteredCatalogCourseRows,
        pendingTermForCode,
        setPendingTermForCode,
        profileDraftFocus,
        setProfileDraftFocus,
        profileDraftStartSeason,
        setProfileDraftStartSeason,
        profileDraftStartYear,
        setProfileDraftStartYear,
        profileDraftMaxEcts,
        setProfileDraftMaxEcts,
        profileDraftRecommendedEcts,
        setProfileDraftRecommendedEcts,
        profileDraftMaxWeekHours,
        setProfileDraftMaxWeekHours,
        profileDraftRecommendedWeekHours,
        setProfileDraftRecommendedWeekHours,
        profileDraftInterests,
        setProfileDraftInterests,
        profileDraftCareer,
        setProfileDraftCareer,
        isSavingProfileSettings,
        saveProfileChanges,
    } = useProfileForm({
        programCode,
        setProgramCode,
        catalog,
        termAvailabilityForCode,
        selectedFocus,
        setSelectedFocus,
        setSelectedFocusForProgram,
        semesterLoadLimits,
        setSemesterLoadLimits,
        coursesBySemester,
        doneCourseCodes,
        parkedCourseCodes,
        buildPersistSnapshot,
        setRecommendations,
        setStickyViolation,
        openSignupSetupOnEntry,
        onSignupSetupPromptConsumed,
        profileSettingsForProgram,
        setProfileSettingsByProgram,
        setLockedProgramCode,
        startTermSeason,
        startTermYear,
        isStartTermLocked,
        isProfileOpen,
        setIsProfileOpen,
        setIsSignupSetupOpen,
    });

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

    // What the dashboard adds from the student's own course notes.
    const dashboardLaneInsights = {
        plannedEstimatedHoursPerSemesterRows,
        plannedEstimatedHoursAverage,
        plannedWeekHoursWithinDesiredWorkload,
        recommendedWeekHoursPerSemester,
        maxWeekHoursForScale,
        doneGradePerSemesterRows,
        doneGradeOverall,
        missingDoneGradesBySemester,
        missingDoneGradesCount,
    };

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

    const dashboardSectionOrdering = useDashboardSectionOrdering({
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
    const {
        rollbackAddedCourses,
        rollbackMovedCourses,
        rollbackCourseStatusToggle,
    } = useRuleCheckRollbacks({
        setNodes,
        setNeedsPersist,
        resolveLaneCollisions,
        rollbackCourseDone,
    });

    const toggleCourseDone = useCallback((courseCode, nextDone, nodeId) => {
        setCourseDone(courseCode, nextDone);
        setNodes((prev) => {
            const updated = prev.map((n) => {
                if (n.type === "course" && n.data?.code === courseCode) {
                    return { ...n, data: { ...n.data, status: nextDone ? "done" : "in_plan" } };
                }
                return n;
            });
            const groupIds = prev
                .filter((n) => n.type === "course" && n.data?.code === courseCode)
                .map((n) => n.data?.groupId)
                .filter(Boolean);
            if (groupIds.length > 0) {
                let currentNodes = updated;
                for (const groupId of [...new Set(groupIds)]) {
                    const groupCourses = currentNodes.filter((n) => n.type === "course" && n.data?.groupId === groupId);
                    const allDone = groupCourses.length > 0 && groupCourses.every((n) => n.data?.status === "done");
                    currentNodes = currentNodes.map((n) => {
                        if (n.type === "moduleBg" && n.id === groupId) {
                            return { ...n, data: { ...n.data, status: allDone ? "done" : "in_plan" } };
                        }
                        return n;
                    });
                }
                return currentNodes;
            }
            return updated;
        });
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
        setMultipleCoursesDone(uniqueCodes, Boolean(nextDone));
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
    }, [nodes, setMultipleCoursesDone, setNodes]);

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
    }, [catalog, clampPlacementLane, firstAllowedLaneForCourse, getCourseStatus, isCourseAllowedInLane, maxSemesterCount, parkCourseCodes, removeCourseNode, setCoursesFromNodes, setNodes, subjectColors, toggleCourseDone, updateCourseEcts, termAvailabilityForCode]);

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
                const existingNodes = prev.filter((n) => n.type === "course" && codes.includes(n?.data?.code) && n?.data?.status !== "parked");
                const existingCodes = new Set(existingNodes.map((n) => n.data.code));
                if (existingCodes.size === codes.length) return prev;

                const affectedGroupIds = new Set();
                prev.forEach((n) => {
                    if (n.type === "course" && existingCodes.has(n?.data?.code) && n?.data?.groupId) {
                        affectedGroupIds.add(n.data.groupId);
                    }
                });

                const removeSet = new Set(conflictingVariantCodes);
                prev.forEach((n) => {
                    if (n.type === "course" && removeSet.has(n?.data?.code) && n?.data?.groupId) {
                        affectedGroupIds.add(n.data.groupId);
                    }
                });

                let next = prev.filter((n) => !(n.type === "course" && (removeSet.has(n?.data?.code) || (codes.includes(n?.data?.code) && n?.data?.status === "parked"))));
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
            });
            
            // Note: Since setNodes is async in React 18, we can't reliably read 'added' 
            // or 'persistedNodes' immediately after. The sync to coursesByProgram 
            // will happen via the useEffect listening to 'nodes'.
            setNeedsPersist(true);
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
            const existingNodes = prev.filter((n) => n.type === "course" && codes.includes(n?.data?.code) && n?.data?.status !== "parked");
            const existingCodes = new Set(existingNodes.map((n) => n.data.code));
            if (existingCodes.size === codes.length) return prev;

            const affectedGroupIds = new Set();
            prev.forEach((n) => {
                if (n.type === "course" && existingCodes.has(n?.data?.code) && n?.data?.groupId) {
                    affectedGroupIds.add(n.data.groupId);
                }
            });

            const removeSet = new Set(conflictingVariantCodes);
            prev.forEach((n) => {
                if (n.type === "course" && removeSet.has(n?.data?.code) && n?.data?.groupId) {
                    affectedGroupIds.add(n.data.groupId);
                }
            });

            let next = prev.filter((n) => !(n.type === "course" && (removeSet.has(n?.data?.code) || (codes.includes(n?.data?.code) && n?.data?.status === "parked"))));
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
        });

        setNeedsPersist(true);
        return true;
    }, [MIN_GROUP_CHILD_Y, addGraphCourseToPlan, catalog, catalogCourseByCode, clampPlacementLane, firstAllowedLaneForCourse, getCourseStatus, isCourseAllowedInLane, maxSemesterCount, removeCourseNode, removeModuleGroup, setCoursesFromNodes, setNodes, subjectColors, toggleCourseDone, toggleModuleDoneCodes, updateCourseEcts, termAvailabilityForCode]);

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
        setMultipleCoursesDone(uniqueCodes, Boolean(nextDone));
        setNodes((prev) => prev.map((n) => {
            if (n.type !== "course" || !uniqueCodes.includes(n?.data?.code)) return n;
            return { ...n, data: { ...n.data, status: nextDone ? "done" : "in_plan" } };
        }));
    }, [nodes, setMultipleCoursesDone, setNodes]);

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

    const { applyBachelorPrefilledPlan, applyMasterPrefilledPlan } = usePrefilledPlans({
        programCode,
        catalog,
        startTermSeason,
        doneCourseCodes,
        maxSemesterCount,
        subjectColors,
        laneNodes,
        minGroupChildY: MIN_GROUP_CHILD_Y,
        firstAllowedLaneForCourse,
        termAvailabilityForCode,
        resolveLaneCollisions,
        compactPrefillLayout,
        recomputeGroupFromChildren,
        setNodes,
        setCoursesFromNodes,
        setNeedsPersist,
        setDragPreviewSemesterCount,
        setStickyViolation,
        removeCourseNode,
        removeModuleGroup,
        toggleCourseDone,
        toggleModuleDoneCodes,
        updateCourseEcts,
    });

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

    useRuleCheckSync({
        programCode,
        plannerHydrated,
        lastPlanChange,
        coursesBySemester,
        doneCourseCodes,
        selectedFocus,
        semesterLoadLimits,
        setProgramRuleCheckState,
        setStickyViolation,
        rollbackAddedCourses,
        rollbackMovedCourses,
        rollbackCourseStatusToggle,
        pendingInitialSyncProgramRef,
    });

    const { handleRecommendationToggle } = useRecommendationRequests({
        programCode,
        plannerHydrated,
        lastPlanChange,
        coursesBySemester,
        doneCourseCodes,
        parkedCourseCodes,
        profileSettingsForProgram,
        setProfileSettingsByProgram,
        setRecommendations,
    });

    useStickyViolationExpiry(stickyViolation, setStickyViolation);

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
    const dashboardMetrics = computeDashboardMetrics({
        ruleCheckState,
        programCode,
        bachelorProgramCode: BACHELOR_PROGRAM_CODE,
        masterProgramCode: MASTER_PROGRAM_CODE,
        coursesBySemester,
        doneCourseCodes,
        plannerHydrated,
        dismissedInitialPrefillPrompt,
        selectedFocus,
        catalog,
        dashboardViewMode,
        stickyViolation,
        semesterLoadLimits,
    });
    const {
        hasAnyPlannedOrDoneCourses,
        shouldOfferInitialBachelorPrefill,
        shouldOfferInitialMasterPrefill,
        targetEctsKpi,
        totalEctsKpi,
        totalPctKpi,
        hasMissingRequirements,
        hasWarnings,
        stickyActive,
        feedbackText,
        feedbackBg,
        feedbackBorder,
        feedbackColor,
    } = dashboardMetrics;

    // ── Recommendation state derived data ────────────────────────────────────
    const dismissRecommendation = useCallback((id) => {
        setRecommendations((prev) => prev.filter((r) => r.id !== id));
    }, []);
    const parkRecommendation = useCallback((payload) => {
        addGraphCourseToPlan(payload, -1);
    }, [addGraphCourseToPlan]);
    useEmptySectionAutoClose(dashboardPanels, { hasMissingRequirements, hasWarnings });

    const { progressMilestoneText } = useProgressMilestone({
        plannerHydrated,
        programCode,
        targetEctsKpi,
        totalEctsKpi,
        totalPctKpi,
    });

    const { isRuleSuccessFeedback, showTransientSuccessFeedback } = useTransientSuccessFeedback({
        programCode,
        stickyActive,
        ruleCheckState,
    });

    useFocusPrefillOffer({
        plannerHydrated,
        programCode,
        selectedFocus,
        hasAnyPlannedOrDoneCourses,
        setFocusPrefillPrompt,
        setDismissedInitialPrefillPrompt,
    });

    const plannerNotificationsNode = (
        <PrefillNotifications
            focusPrefillPrompt={focusPrefillPrompt}
            setFocusPrefillPrompt={setFocusPrefillPrompt}
            setDismissedInitialPrefillPrompt={setDismissedInitialPrefillPrompt}
            shouldOfferInitialBachelorPrefill={shouldOfferInitialBachelorPrefill}
            shouldOfferInitialMasterPrefill={shouldOfferInitialMasterPrefill}
            programCode={programCode}
            selectedFocus={selectedFocus}
            tourCompleted={tourCompleted}
            applyBachelorPrefilledPlan={applyBachelorPrefilledPlan}
            applyMasterPrefilledPlan={applyMasterPrefilledPlan}
            progressMilestoneText={progressMilestoneText}
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
    const signupSetupModalNode = (
        <SignupSetupModal
            open={isSignupSetupOpen}
            username={currentUser?.username}
            programCode={signupSetupProgramCode}
            onProgramCodeChange={setSignupSetupProgramCode}
            focus={signupSetupFocus}
            onFocusChange={setSignupSetupFocus}
            startSeason={signupSetupStartSeason}
            onStartSeasonChange={setSignupSetupStartSeason}
            startYear={signupSetupStartYear}
            onStartYearChange={setSignupSetupStartYear}
            isSaving={isSavingSignupSetup}
            onReset={resetSignupSetupDraft}
            onSave={saveSignupSetup}
        />
    );

    const profileModalNode = (
        <ProfileModal
            open={isProfileOpen}
            username={currentUser?.username}
            onClose={() => setIsProfileOpen(false)}
            isCurriculumSettingsOpen={isCurriculumSettingsOpen}
            onToggleCurriculumSettings={() => setIsCurriculumSettingsOpen((v) => !v)}
            disableGraphView={profileDisableGraphView}
            onDisableGraphViewChange={(val) => {
                setProfileDisableGraphView(val);
                if (val) {
                    localStorage.setItem("disable-graph-view-" + currentUser?.username, "true");
                } else {
                    localStorage.removeItem("disable-graph-view-" + currentUser?.username);
                }
            }}
            programCode={programCode}
            onProgramCodeChange={(code) => setProgramCode?.(code)}
            isProgramLocked={isProgramLocked}
            focus={profileDraftFocus}
            onFocusChange={setProfileDraftFocus}
            startSeason={profileDraftStartSeason}
            onStartSeasonChange={setProfileDraftStartSeason}
            startYear={profileDraftStartYear}
            onStartYearChange={setProfileDraftStartYear}
            isStartTermLocked={isStartTermLocked}
            interests={profileDraftInterests}
            onInterestsChange={setProfileDraftInterests}
            career={profileDraftCareer}
            onCareerChange={setProfileDraftCareer}
            search={profileSearch}
            onSearchChange={setProfileSearch}
            courseRows={filteredCatalogCourseRows}
            termForCode={pendingTermForCode}
            onTermChange={setPendingTermForCode}
            maxEcts={profileDraftMaxEcts}
            onMaxEctsChange={setProfileDraftMaxEcts}
            maxWeekHours={profileDraftMaxWeekHours}
            onMaxWeekHoursChange={setProfileDraftMaxWeekHours}
            recommendedEcts={profileDraftRecommendedEcts}
            onRecommendedEctsChange={setProfileDraftRecommendedEcts}
            recommendedWeekHours={profileDraftRecommendedWeekHours}
            onRecommendedWeekHoursChange={setProfileDraftRecommendedWeekHours}
            isSaving={isSavingProfileSettings}
            onSave={saveProfileChanges}
        />
    );

    const ruleDashboardAside = isRuleDashboardOpen && (
        <PlannerDashboard
            panels={dashboardPanels}
            metrics={dashboardMetrics}
            ordering={dashboardSectionOrdering}
            laneInsights={dashboardLaneInsights}
            programCode={programCode}
            selectedFocus={selectedFocus}
            subjectColors={subjectColors}
            ruleCheckLastUpdatedAt={ruleCheckState.lastUpdatedAt}
            topMargin={PANEL_TOP_MARGIN}
            bottomMargin={PANEL_BOTTOM_MARGIN}
        />
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
                    termAvailabilityForCode={termAvailabilityForCode}
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
                    termAvailabilityForCode={termAvailabilityForCode}
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
                            data-testid="planner-feedback"
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
                            <VisualLegend programCode={programCode} onClose={() => setIsLegendOpen(false)} />
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
