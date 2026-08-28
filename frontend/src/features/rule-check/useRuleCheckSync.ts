/**
 * Asking the backend whether the plan still obeys the curriculum, and undoing
 * the change when it does not.
 *
 * `latestRuleCheckChangeIdRef` is what makes that safe. A check is sent for
 * every plan change, several can be in flight at once, and an answer is acted
 * on only while the identifier it was asked about is still the newest one for
 * that programme. Were the identifiers to stop matching, a late refusal would
 * roll back a change the student has since replaced.
 */

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";

import { normalizeRulecheckCategoryForProgram } from "../../domain/catalogue.ts";
import type { CoursesBySemester, PlanChange, SemesterLoadLimits } from "../../domain/plan/state.ts";
import { BACHELOR_PROGRAM_CODE } from "../../domain/programmes.ts";
import { sendRuleCheckUpdate } from "../../lib/api.js";
import type { StickyViolation } from "./useRuleCheckFeedback.ts";
import type { RolledBackChange } from "./useRuleCheckRollbacks.ts";
import type { SetProgramRuleCheckState } from "./useRuleCheckState.ts";

/** The identifier of the change a programme's last check was asked about. */
type RuleCheckRequestId = number | null;

export interface UseRuleCheckSyncInput {
    programCode: string;
    plannerHydrated: boolean;
    lastPlanChange: PlanChange | null | undefined;
    coursesBySemester: CoursesBySemester | null | undefined;
    doneCourseCodes: readonly string[] | null | undefined;
    selectedFocus: string;
    semesterLoadLimits: SemesterLoadLimits | null | undefined;
    setProgramRuleCheckState: SetProgramRuleCheckState;
    setStickyViolation: (violation: StickyViolation) => void;
    rollbackAddedCourses: (change: RolledBackChange | null | undefined) => void;
    rollbackMovedCourses: (change: RolledBackChange | null | undefined) => void;
    rollbackCourseStatusToggle: (change: RolledBackChange | null | undefined) => void;
    /**
     * The programme whose one-off opening check is still owed, or null once it
     * has been sent. The planner writes it on every programme switch and after
     * every rebuild of the canvas, so the check is owed again each time.
     */
    pendingInitialSyncProgramRef: MutableRefObject<string | null>;
}

export function useRuleCheckSync({
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
}: UseRuleCheckSyncInput): void {
    const latestRuleCheckChangeIdRef = useRef<Record<string, RuleCheckRequestId>>({});

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
                // The rollbacks below are the reason this guard is not merely an
                // optimisation: acting on an answer to a superseded question
                // would undo a change nobody has objected to.
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

    // The dashboard is built from the rule checker's answer, and a student who
    // has only opened their planner has made no change to prompt one. This is
    // the check that gives them a dashboard anyway. It carries no change
    // identifier and cannot be rolled back, which is why it is guarded by the
    // ref rather than by the staleness test above.
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
}
