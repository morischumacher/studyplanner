/**
 * The two moments the planner offers a prebuilt plan: when the planner is
 * empty, and when the student picks a different focus area for a bachelor plan
 * they have already started.
 *
 * The second offer is made only when the focus changed on its own. A programme
 * switch changes the focus as well, and the plan on screen after a switch is a
 * different plan, not one whose focus the student has just reconsidered.
 */

import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { BACHELOR_PROGRAM_CODE } from "../../domain/programmes.ts";

/** The focus the offer is about, or null when no offer is standing. */
export type FocusPrefillPrompt = { focus: string } | null;

export interface UsePrefillPromptsResult {
    focusPrefillPrompt: FocusPrefillPrompt;
    setFocusPrefillPrompt: Dispatch<SetStateAction<FocusPrefillPrompt>>;
    /** True once the student has answered the empty-planner offer either way. */
    dismissedInitialPrefillPrompt: boolean;
    setDismissedInitialPrefillPrompt: Dispatch<SetStateAction<boolean>>;
}

/**
 * Whether either offer is standing. It is held apart from the effect that
 * raises the focus offer because the dashboard reads it while working out
 * whether the empty-planner offer is due, and that happens first.
 */
export function usePrefillPrompts(): UsePrefillPromptsResult {
    const [focusPrefillPrompt, setFocusPrefillPrompt] = useState<FocusPrefillPrompt>(null);
    const [dismissedInitialPrefillPrompt, setDismissedInitialPrefillPrompt] = useState(false);

    return {
        focusPrefillPrompt,
        setFocusPrefillPrompt,
        dismissedInitialPrefillPrompt,
        setDismissedInitialPrefillPrompt,
    };
}

export interface UseFocusPrefillOfferInput {
    plannerHydrated: boolean;
    programCode: string;
    selectedFocus: string;
    /** Whether there is a plan to replace. An empty planner gets the other offer. */
    hasAnyPlannedOrDoneCourses: boolean;
    setFocusPrefillPrompt: Dispatch<SetStateAction<FocusPrefillPrompt>>;
    setDismissedInitialPrefillPrompt: Dispatch<SetStateAction<boolean>>;
}

export function useFocusPrefillOffer({
    plannerHydrated,
    programCode,
    selectedFocus,
    hasAnyPlannedOrDoneCourses,
    setFocusPrefillPrompt,
    setDismissedInitialPrefillPrompt,
}: UseFocusPrefillOfferInput): void {
    const focusSelectionTrackerRef = useRef({ programCode, selectedFocus });

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
}
