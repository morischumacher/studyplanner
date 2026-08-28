/**
 * The planner screen: the feature hooks it is assembled from, and the order it
 * assembles them in.
 *
 * That order is the whole of what this file decides. Hooks run their effects in
 * the order they are called, and the planner depends on it throughout: the
 * canvas is built before anything reads it, the rollbacks exist before the rule
 * check that may call them, and the rebuild from a stored plan comes last so
 * that every handler it wires onto a card already exists. Moving a call up or
 * down this list changes when the plan is written and what the rule checker is
 * asked about, so the sequence below is deliberate.
 */

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { currentProgram } from "./ProgramContext.jsx";

import { Sidebar, OnboardingTour } from "./components";
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
    GROUP_PADDING_Y,
    MODULE_HEADER_HEIGHT,
} from "./domain/layout.ts";
import {
    BACHELOR_FOCUS_OPTIONS,
    BACHELOR_PROGRAM_CODE,
    MASTER_PROGRAM_CODE,
    PROGRAM_OPTIONS,
} from "./domain/programmes.ts";
import { recomputeGroupFromChildren } from "./domain/nodes.ts";
import { useDashboardSectionOrdering } from "./hooks/useDashboardSectionOrdering.js";
import {
    PlannerDashboard,
    computeDashboardMetrics,
    useDashboardPanels,
    useEmptySectionAutoClose,
} from "./features/dashboard/index.ts";
import {
    PlannerBoard,
    useBoardHydration,
    useBoardDragHandlers,
    useBoardLayout,
    useBoardNodes,
    useBoardSemesters,
    useCatalogueActions,
    useCourseCardActions,
    useCourseNodeData,
    useCoursePlacement,
    useNodeStatusSync,
    usePlacementRules,
    useTermAutoShift,
} from "./features/planner-board/index.ts";

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
        storedDashboardUiRef,
        restoreDashboardUiFromPlannerState,
    } = dashboardPanels;
    const {
        recommendations,
        setRecommendations,
        recommendedCourseMap,
    } = useRecommendationList();
    const { stickyViolation, setStickyViolation } = useStickyViolation();

    const pendingInitialSyncProgramRef = useRef(programCode);
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
        storedDashboardUiRef,
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

    const {
        maxSemesterCount,
        activeSemesterCount,
        semesters,
        semesterIdsFromPlan,
        sidebarSemesters,
        setDragPreviewSemesterCount,
    } = useBoardSemesters({ programCode, coursesBySemester });
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

    const {
        isCourseAllowedInLane,
        firstAllowedLaneForCourse,
        clampPlacementLane,
        validSemestersForCourse,
        validSemestersForModule,
    } = usePlacementRules({
        maxSemesterCount,
        activeSemesterCount,
        startTermSeason,
        sidebarSemesters,
        termAvailabilityForCode,
    });

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

    const { compactPrefillLayout, resolveLaneCollisions } = useBoardLayout({
        maxSemesterCount,
        minModuleGroupTopY: MIN_MODULE_GROUP_TOP_Y,
        verticalSemantics: tableVerticalSemantics,
    });

    const {
        nodes,
        setNodes,
        onNodesChange,
        renderNodes,
        laneNodes,
        needsPersist,
        setNeedsPersist,
        wrapperRef,
        rfRef,
    } = useBoardNodes({
        semesters,
        coursesBySemester,
        parkedCourseCodes,
        catalogCourseByCode,
        laneInsightsBySemester,
        setSemesterNote,
        viewMode,
        verticalSemantics: tableVerticalSemantics,
        resolveLaneCollisions,
    });

    const dashboardSectionOrdering = useDashboardSectionOrdering({
        plannedDashboardSectionOrder,
        setPlannedDashboardSectionOrder,
        doneDashboardSectionOrder,
        setDoneDashboardSectionOrder,
    });

    const {
        removeCourseNode,
        removeModuleGroup,
        toggleCourseDone,
        updateCourseEcts,
        toggleModuleDoneCodes,
    } = useCourseCardActions({
        nodes,
        setNodes,
        setNeedsPersist,
        rfRef,
        setCourseDone,
        setMultipleCoursesDone,
    });
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

    const {
        parkCourseCodes,
        addGraphCourseToPlan,
        addGraphModuleToPlan,
    } = useCoursePlacement({
        programCode,
        catalog,
        catalogCourseByCode,
        subjectColors,
        nodes,
        setNodes,
        setNeedsPersist,
        setCoursesFromNodes,
        rfRef,
        minGroupChildY: MIN_GROUP_CHILD_Y,
        maxSemesterCount,
        getCourseStatus,
        setCourseDone,
        termAvailabilityForCode,
        isCourseAllowedInLane,
        firstAllowedLaneForCourse,
        clampPlacementLane,
        validSemestersForModule,
        resolveLaneCollisions,
        removeCourseNode,
        removeModuleGroup,
        toggleCourseDone,
        toggleModuleDoneCodes,
        updateCourseEcts,
    });

    const {
        toggleGraphCourseDone,
        toggleGraphModuleDone,
        updateCourseMeta,
        removeGraphCourseFromPlan,
        removeGraphModuleFromPlan,
    } = useCatalogueActions({
        nodes,
        setNodes,
        setNeedsPersist,
        setCoursesFromNodes,
        rfRef,
        getCourseStatus,
        setCourseDone,
        setMultipleCoursesDone,
        setCourseMeta,
    });

    useCourseNodeData({
        nodes,
        setNodes,
        courseMetaByCode,
        getCourseMeta,
        updateCourseMeta,
        addGraphCourseToPlan,
        addGraphModuleToPlan,
        validSemestersForCourse,
        recommendedCourseMap,
        termAvailabilityForCode,
    });

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

    const {
        handleDragStart,
        onDragOver,
        onDragLeave,
        onDrop,
        onNodeDragStart,
        onNodeDrag,
        onNodeDragStopMerged,
        onSelectionDragStopMerged,
        nodeDragInProgressRef,
    } = useBoardDragHandlers({
        nodes,
        setNodes,
        needsPersist,
        setNeedsPersist,
        setCoursesFromNodes,
        wrapperRef,
        rfRef,
        catalog,
        minGroupChildY: MIN_GROUP_CHILD_Y,
        minModuleGroupTopY: MIN_MODULE_GROUP_TOP_Y,
        maxSemesterCount,
        activeSemesterCount,
        setDragPreviewSemesterCount,
        isCourseAllowedInLane,
        firstAllowedLaneForCourse,
        clampPlacementLane,
        resolveLaneCollisions,
        setCourseDone,
        setStickyViolation,
        parkCourseCodes,
        addGraphCourseToPlan,
        addGraphModuleToPlan,
        removeModuleGroup,
        toggleModuleDoneCodes,
    });

    useNodeStatusSync({ doneCourseCodes, parkedCourseCodes, setNodes });

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

    useTermAutoShift({
        plannerHydrated,
        nodes,
        setNodes,
        setNeedsPersist,
        setCoursesFromNodes,
        setStickyViolation,
        nodeDragInProgressRef,
        maxSemesterCount,
        startTermSeason,
        effectiveCourseTermByCode,
        termAvailabilityForCode,
        isCourseAllowedInLane,
        firstAllowedLaneForCourse,
        resolveLaneCollisions,
    });

    useBoardHydration({
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
        minGroupChildY: MIN_GROUP_CHILD_Y,
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
    });

    const [expandedPf, setExpandedPf] = useState(new Set());
    const togglePf = useCallback((name) => {
        setExpandedPf((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    }, []);

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

                    <PlannerBoard
                        wrapperRef={wrapperRef}
                        rfRef={rfRef}
                        renderNodes={renderNodes}
                        onNodesChange={onNodesChange}
                        onNodeDragStart={onNodeDragStart}
                        onNodeDrag={onNodeDrag}
                        onNodeDragStop={onNodeDragStopMerged}
                        onSelectionDragStop={onSelectionDragStopMerged}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        tableInteractionMode={tableInteractionMode}
                        onToggleInteractionMode={() => setTableInteractionMode((m) => (m === "pan" ? "select" : "pan"))}
                        isLegendOpen={isLegendOpen}
                        onToggleLegend={() => setIsLegendOpen((v) => !v)}
                        verticalSemantics={tableVerticalSemantics}
                        onVerticalSemanticsChange={setTableVerticalSemantics}
                        verticalCustomText={tableVerticalCustomText}
                        onVerticalCustomTextChange={setTableVerticalCustomText}
                        isSemanticsPopupOpen={isTableSemanticsPopupOpen}
                        onSemanticsPopupOpenChange={setIsTableSemanticsPopupOpen}
                    />
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
