/**
 * The dashboard's own view state: which panels the student has open, and the
 * order they dragged their sections into.
 *
 * All of it is persisted with the plan, and it is restored from two different
 * places: once when the planner state arrives, and again every time the student
 * switches programme. Both go through `applyStoredDashboardUi`, so a value that
 * survives a reload also survives a programme switch. The two paths are not
 * quite symmetric, and deliberately so: a programme with no stored entry is
 * left showing whatever is on screen, while a first load with no stored entry
 * resets the section orders to their defaults.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { asRecord } from "../../domain/plan/sanitizers.ts";
import {
    DEFAULT_DONE_SECTION_ORDER,
    DEFAULT_PLANNED_SECTION_ORDER,
    sanitizeSectionOrder,
} from "../../domain/programmes.ts";

/**
 * Which half of the dashboard is showing. Held as a string rather than a union
 * because the stored value is whatever a previous version wrote, and the
 * sections test it for equality rather than switching on it.
 */
export type DashboardViewMode = string;

/** One programme's panel state, as `dashboardUiByProgram` stores it. */
export interface DashboardUiSnapshot {
    dashboardViewMode: DashboardViewMode;
    isSteopInfoOpen: boolean;
    isSteopChecklistOpen: boolean;
    isFocusInfoOpen: boolean;
    isFocusChecklistOpen: boolean;
    isExamSubjectProgressOpen: boolean;
    isPerSemesterEctsOpen: boolean;
    isPlannedEstimatedHoursOpen: boolean;
    isDonePerSemesterEctsOpen: boolean;
    isDoneGradePerSemesterOpen: boolean;
    isPlannedExamSubjectOpen: boolean;
    isByCategoryOpen: boolean;
    isDoneByCategoryOpen: boolean;
    isMissingRequirementsOpen: boolean;
    isWarningsOpen: boolean;
    plannedDashboardSectionOrder: string[];
    doneDashboardSectionOrder: string[];
}

/** The panel state that is not per programme, as `dashboardUiGlobal` stores it. */
export interface DashboardUiGlobalSnapshot {
    isRuleDashboardOpen: boolean;
    isLegendOpen: boolean;
}

export interface UseDashboardPanelsInput {
    programCode: string;
}

export interface DashboardPanels {
    isRuleDashboardOpen: boolean;
    setIsRuleDashboardOpen: Dispatch<SetStateAction<boolean>>;
    /** Which tab the right-hand panel shows. Nothing reads it yet. */
    rightPanelTab: string;
    setRightPanelTab: Dispatch<SetStateAction<string>>;
    dashboardViewMode: DashboardViewMode;
    setDashboardViewMode: Dispatch<SetStateAction<DashboardViewMode>>;
    isLegendOpen: boolean;
    setIsLegendOpen: Dispatch<SetStateAction<boolean>>;
    isSteopInfoOpen: boolean;
    setIsSteopInfoOpen: Dispatch<SetStateAction<boolean>>;
    isSteopChecklistOpen: boolean;
    setIsSteopChecklistOpen: Dispatch<SetStateAction<boolean>>;
    isFocusInfoOpen: boolean;
    setIsFocusInfoOpen: Dispatch<SetStateAction<boolean>>;
    isFocusChecklistOpen: boolean;
    setIsFocusChecklistOpen: Dispatch<SetStateAction<boolean>>;
    isExamSubjectProgressOpen: boolean;
    setIsExamSubjectProgressOpen: Dispatch<SetStateAction<boolean>>;
    isPerSemesterEctsOpen: boolean;
    setIsPerSemesterEctsOpen: Dispatch<SetStateAction<boolean>>;
    isPlannedEstimatedHoursOpen: boolean;
    setIsPlannedEstimatedHoursOpen: Dispatch<SetStateAction<boolean>>;
    isDonePerSemesterEctsOpen: boolean;
    setIsDonePerSemesterEctsOpen: Dispatch<SetStateAction<boolean>>;
    isDoneGradePerSemesterOpen: boolean;
    setIsDoneGradePerSemesterOpen: Dispatch<SetStateAction<boolean>>;
    isPlannedExamSubjectOpen: boolean;
    setIsPlannedExamSubjectOpen: Dispatch<SetStateAction<boolean>>;
    isByCategoryOpen: boolean;
    setIsByCategoryOpen: Dispatch<SetStateAction<boolean>>;
    isDoneByCategoryOpen: boolean;
    setIsDoneByCategoryOpen: Dispatch<SetStateAction<boolean>>;
    isMissingRequirementsOpen: boolean;
    setIsMissingRequirementsOpen: Dispatch<SetStateAction<boolean>>;
    isWarningsOpen: boolean;
    setIsWarningsOpen: Dispatch<SetStateAction<boolean>>;
    plannedDashboardSectionOrder: string[];
    setPlannedDashboardSectionOrder: Dispatch<SetStateAction<string[]>>;
    doneDashboardSectionOrder: string[];
    setDoneDashboardSectionOrder: Dispatch<SetStateAction<string[]>>;
    /** What the persist snapshot files under the current programme. */
    dashboardUiForProgram: DashboardUiSnapshot;
    dashboardUiGlobal: DashboardUiGlobalSnapshot;
    /** Takes the whole planner state document, not just its dashboard part. */
    restoreDashboardUiFromPlannerState: (state: unknown) => void;
}

export function useDashboardPanels({ programCode }: UseDashboardPanelsInput): DashboardPanels {
    const [isRuleDashboardOpen, setIsRuleDashboardOpen] = useState(false);
    const [rightPanelTab, setRightPanelTab] = useState("dashboard");
    const [dashboardViewMode, setDashboardViewMode] = useState<DashboardViewMode>("planning");
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
    const [plannedDashboardSectionOrder, setPlannedDashboardSectionOrder] = useState<string[]>(
        DEFAULT_PLANNED_SECTION_ORDER
    );
    const [doneDashboardSectionOrder, setDoneDashboardSectionOrder] = useState<string[]>(
        DEFAULT_DONE_SECTION_ORDER
    );

    // The stored panel state of every programme, kept so that a switch can
    // replay it without going back to the server.
    const loadedDashboardUiRef = useRef<{
        byProgram: Record<string, unknown>;
        global: Record<string, unknown>;
    }>({ byProgram: {}, global: {} });

    const applyStoredDashboardUi = useCallback((stored: unknown) => {
        const ui = asRecord(stored);
        if (typeof ui.dashboardViewMode === "string") setDashboardViewMode(ui.dashboardViewMode);
        if (typeof ui.isSteopInfoOpen === "boolean") setIsSteopInfoOpen(ui.isSteopInfoOpen);
        if (typeof ui.isSteopChecklistOpen === "boolean") setIsSteopChecklistOpen(ui.isSteopChecklistOpen);
        if (typeof ui.isFocusInfoOpen === "boolean") setIsFocusInfoOpen(ui.isFocusInfoOpen);
        if (typeof ui.isFocusChecklistOpen === "boolean") setIsFocusChecklistOpen(ui.isFocusChecklistOpen);
        if (typeof ui.isExamSubjectProgressOpen === "boolean") setIsExamSubjectProgressOpen(ui.isExamSubjectProgressOpen);
        if (typeof ui.isPerSemesterEctsOpen === "boolean") setIsPerSemesterEctsOpen(ui.isPerSemesterEctsOpen);
        if (typeof ui.isPlannedEstimatedHoursOpen === "boolean") setIsPlannedEstimatedHoursOpen(ui.isPlannedEstimatedHoursOpen);
        if (typeof ui.isDonePerSemesterEctsOpen === "boolean") setIsDonePerSemesterEctsOpen(ui.isDonePerSemesterEctsOpen);
        if (typeof ui.isDoneGradePerSemesterOpen === "boolean") setIsDoneGradePerSemesterOpen(ui.isDoneGradePerSemesterOpen);
        if (typeof ui.isPlannedExamSubjectOpen === "boolean") setIsPlannedExamSubjectOpen(ui.isPlannedExamSubjectOpen);
        if (typeof ui.isByCategoryOpen === "boolean") setIsByCategoryOpen(ui.isByCategoryOpen);
        if (typeof ui.isDoneByCategoryOpen === "boolean") setIsDoneByCategoryOpen(ui.isDoneByCategoryOpen);
        if (typeof ui.isMissingRequirementsOpen === "boolean") setIsMissingRequirementsOpen(ui.isMissingRequirementsOpen);
        if (typeof ui.isWarningsOpen === "boolean") setIsWarningsOpen(ui.isWarningsOpen);
        setPlannedDashboardSectionOrder(
            sanitizeSectionOrder(ui.plannedDashboardSectionOrder, DEFAULT_PLANNED_SECTION_ORDER)
        );
        setDoneDashboardSectionOrder(
            sanitizeSectionOrder(ui.doneDashboardSectionOrder, DEFAULT_DONE_SECTION_ORDER)
        );
    }, []);

    const restoreDashboardUiFromPlannerState = useCallback((state: unknown) => {
        const document = asRecord(state);
        loadedDashboardUiRef.current = {
            byProgram: asRecord(document.dashboardUiByProgram),
            global: asRecord(document.dashboardUiGlobal),
        };
        applyStoredDashboardUi(loadedDashboardUiRef.current.byProgram[programCode]);
        const global = loadedDashboardUiRef.current.global;
        if (typeof global.isRuleDashboardOpen === "boolean") setIsRuleDashboardOpen(global.isRuleDashboardOpen);
        if (typeof global.isLegendOpen === "boolean") setIsLegendOpen(global.isLegendOpen);
    }, [applyStoredDashboardUi, programCode]);

    useEffect(() => {
        const stored = loadedDashboardUiRef.current?.byProgram?.[programCode] || null;
        if (!stored || typeof stored !== "object") return;
        applyStoredDashboardUi(stored);
    }, [programCode]);

    const dashboardUiForProgram = useMemo<DashboardUiSnapshot>(() => ({
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
    }), [
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
    ]);

    const dashboardUiGlobal = useMemo<DashboardUiGlobalSnapshot>(() => ({
        isRuleDashboardOpen,
        isLegendOpen,
    }), [isRuleDashboardOpen, isLegendOpen]);

    return {
        isRuleDashboardOpen,
        setIsRuleDashboardOpen,
        rightPanelTab,
        setRightPanelTab,
        dashboardViewMode,
        setDashboardViewMode,
        isLegendOpen,
        setIsLegendOpen,
        isSteopInfoOpen,
        setIsSteopInfoOpen,
        isSteopChecklistOpen,
        setIsSteopChecklistOpen,
        isFocusInfoOpen,
        setIsFocusInfoOpen,
        isFocusChecklistOpen,
        setIsFocusChecklistOpen,
        isExamSubjectProgressOpen,
        setIsExamSubjectProgressOpen,
        isPerSemesterEctsOpen,
        setIsPerSemesterEctsOpen,
        isPlannedEstimatedHoursOpen,
        setIsPlannedEstimatedHoursOpen,
        isDonePerSemesterEctsOpen,
        setIsDonePerSemesterEctsOpen,
        isDoneGradePerSemesterOpen,
        setIsDoneGradePerSemesterOpen,
        isPlannedExamSubjectOpen,
        setIsPlannedExamSubjectOpen,
        isByCategoryOpen,
        setIsByCategoryOpen,
        isDoneByCategoryOpen,
        setIsDoneByCategoryOpen,
        isMissingRequirementsOpen,
        setIsMissingRequirementsOpen,
        isWarningsOpen,
        setIsWarningsOpen,
        plannedDashboardSectionOrder,
        setPlannedDashboardSectionOrder,
        doneDashboardSectionOrder,
        setDoneDashboardSectionOrder,
        dashboardUiForProgram,
        dashboardUiGlobal,
        restoreDashboardUiFromPlannerState,
    };
}

/**
 * Closes the two sections that would otherwise sit open with nothing under
 * them. It runs whether or not the dashboard is on screen, because the panel
 * state it corrects is persisted either way.
 */
export function useEmptySectionAutoClose(
    panels: DashboardPanels,
    { hasMissingRequirements, hasWarnings }: { hasMissingRequirements: boolean; hasWarnings: boolean }
): void {
    const { isMissingRequirementsOpen, setIsMissingRequirementsOpen, isWarningsOpen, setIsWarningsOpen } = panels;

    useEffect(() => {
        if (!hasMissingRequirements && isMissingRequirementsOpen) setIsMissingRequirementsOpen(false);
    }, [hasMissingRequirements, isMissingRequirementsOpen]);

    useEffect(() => {
        if (!hasWarnings && isWarningsOpen) setIsWarningsOpen(false);
    }, [hasWarnings, isWarningsOpen]);
}
