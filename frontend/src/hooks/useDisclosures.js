import { useState } from "react";

/**
 * Open/closed state for the planner's informational popovers and dashboard
 * disclosure sections (legend, STEOP and focus info/checklists, and the
 * per-section dashboard expanders).
 *
 * Extracted verbatim from App.jsx as part of the incremental decomposition of
 * that component. Each field is an independent boolean that defaults to closed,
 * returned under its original name so existing call sites are unchanged. This
 * groups a large, cohesive slice of pure UI-visibility state that previously
 * sat inline among the component's domain state.
 */
export function useDisclosures() {
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

    return {
        isLegendOpen, setIsLegendOpen,
        isSteopInfoOpen, setIsSteopInfoOpen,
        isSteopChecklistOpen, setIsSteopChecklistOpen,
        isFocusInfoOpen, setIsFocusInfoOpen,
        isFocusChecklistOpen, setIsFocusChecklistOpen,
        isExamSubjectProgressOpen, setIsExamSubjectProgressOpen,
        isPerSemesterEctsOpen, setIsPerSemesterEctsOpen,
        isPlannedEstimatedHoursOpen, setIsPlannedEstimatedHoursOpen,
        isDonePerSemesterEctsOpen, setIsDonePerSemesterEctsOpen,
        isDoneGradePerSemesterOpen, setIsDoneGradePerSemesterOpen,
        isPlannedExamSubjectOpen, setIsPlannedExamSubjectOpen,
        isByCategoryOpen, setIsByCategoryOpen,
        isDoneByCategoryOpen, setIsDoneByCategoryOpen,
        isMissingRequirementsOpen, setIsMissingRequirementsOpen,
        isWarningsOpen, setIsWarningsOpen,
    };
}
