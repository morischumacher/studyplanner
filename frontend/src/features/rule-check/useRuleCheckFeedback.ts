/**
 * The three banners the compliance loop puts on screen: the refusal, the
 * milestone, and the confirmation that fades.
 *
 * All three carry their own expiry rather than being cleared by whoever raised
 * them, because the events that raise them arrive from the network and can
 * arrive twice. A banner therefore states when it should come down, and the
 * effect that watches it re-arms on every new banner.
 */

import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { RuleCheckState } from "../../domain/programmes.ts";

/** A banner shown until its moment passes. */
export interface StickyViolation {
    message: string;
    /** When the banner should come down, as a timestamp. */
    until: number;
    /** "error" or "success"; the dashboard turns it into colours. */
    tone: string;
}

const NO_STICKY_VIOLATION: StickyViolation = { message: "", until: 0, tone: "" };

export interface UseStickyViolationResult {
    stickyViolation: StickyViolation;
    setStickyViolation: Dispatch<SetStateAction<StickyViolation>>;
}

/**
 * The banner a refused change raises. It is held apart from the effect that
 * clears it because the planner raises it from a dozen places, most of them
 * long before the compliance loop is reached.
 */
export function useStickyViolation(): UseStickyViolationResult {
    const [stickyViolation, setStickyViolation] = useState<StickyViolation>(NO_STICKY_VIOLATION);
    return { stickyViolation, setStickyViolation };
}

/** Takes the banner down at the moment it asked to be taken down. */
export function useStickyViolationExpiry(
    stickyViolation: StickyViolation,
    setStickyViolation: Dispatch<SetStateAction<StickyViolation>>
): void {
    useEffect(() => {
        if (!stickyViolation?.message) return;
        const waitMs = Math.max(0, (stickyViolation.until || 0) - Date.now());
        const t = window.setTimeout(() => {
            setStickyViolation({ message: "", until: 0, tone: "" });
        }, waitMs);
        return () => window.clearTimeout(t);
    }, [stickyViolation]);
}

/** The completion percentages worth congratulating a student on. */
const MILESTONES = [25, 50, 75, 100];

export interface UseProgressMilestoneInput {
    plannerHydrated: boolean;
    programCode: string;
    targetEctsKpi: number;
    totalEctsKpi: number;
    totalPctKpi: number;
}

export interface UseProgressMilestoneResult {
    /** Empty when there is nothing to congratulate. */
    progressMilestoneText: string;
}

/**
 * Congratulates the student the first time their plan crosses a milestone.
 *
 * The percentage last seen is remembered per programme, and a programme the
 * student has just switched to only records its figure: switching from a
 * half-finished bachelor to an untouched master is not a crossing, and neither
 * is switching back.
 */
export function useProgressMilestone({
    plannerHydrated,
    programCode,
    targetEctsKpi,
    totalEctsKpi,
    totalPctKpi,
}: UseProgressMilestoneInput): UseProgressMilestoneResult {
    const [progressMilestone, setProgressMilestone] = useState<{ text: string; until: number }>({
        text: "",
        until: 0,
    });
    const progressMilestoneRef = useRef<{ programCode: string | null; pct: number }>({
        programCode: null,
        pct: 0,
    });

    useEffect(() => {
        if (!plannerHydrated) return;
        const last = progressMilestoneRef.current;
        const roundedPct = Math.round(totalPctKpi);
        if (last?.programCode !== programCode) {
            progressMilestoneRef.current = { programCode, pct: roundedPct };
            return;
        }
        const crossed = MILESTONES.find((m) => last.pct < m && roundedPct >= m);
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

    return { progressMilestoneText: progressMilestone?.text || "" };
}

/** The two fields of the rule checker's reply this banner reads. */
interface RuleCheckReply {
    ok?: boolean;
    message?: string;
}

export interface UseTransientSuccessFeedbackInput {
    programCode: string;
    /** True while a refusal is on screen; a refusal outranks a confirmation. */
    stickyActive: boolean;
    ruleCheckState: RuleCheckState;
}

export interface UseTransientSuccessFeedbackResult {
    isRuleSuccessFeedback: boolean;
    showTransientSuccessFeedback: boolean;
}

/**
 * Hides the "all rules met" banner three seconds after it appears, and brings
 * it back whenever the rule checker answers again.
 *
 * A fresh answer is recognised by programme, time and message together rather
 * than by the state object, because the state is replaced on every check and an
 * answer identical to the last one should still be shown.
 */
export function useTransientSuccessFeedback({
    programCode,
    stickyActive,
    ruleCheckState,
}: UseTransientSuccessFeedbackInput): UseTransientSuccessFeedbackResult {
    const [showTransientSuccessFeedback, setShowTransientSuccessFeedback] = useState(true);
    const successFeedbackSignatureRef = useRef("");

    const response = ruleCheckState?.response as RuleCheckReply | null | undefined;
    const isRuleSuccessFeedback =
        !stickyActive &&
        !ruleCheckState?.sending &&
        !ruleCheckState?.error &&
        Boolean(response?.ok);

    useEffect(() => {
        if (!isRuleSuccessFeedback) {
            setShowTransientSuccessFeedback(true);
            return;
        }
        const signature = `${programCode}:${ruleCheckState?.lastUpdatedAt ?? ""}:${response?.message ?? ""}`;
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
        response?.message,
    ]);

    return { isRuleSuccessFeedback, showTransientSuccessFeedback };
}
