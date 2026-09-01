/**
 * The offers of a prebuilt plan, wired to the banner strip that shows them.
 *
 * The strip also carries the progress milestone, which belongs to the rule
 * check rather than to the prefill. It is passed through here because the three
 * banners share one fixed corner of the screen and only one of them may occupy
 * it at a time.
 */

import PlannerNotifications from "../../components/app/PlannerNotifications.jsx";
import { BACHELOR_PROGRAM_CODE } from "../../domain/programmes.ts";
import type { FocusPrefillPrompt } from "./usePrefillPrompts.ts";

export interface PrefillNotificationsProps {
    focusPrefillPrompt: FocusPrefillPrompt;
    setFocusPrefillPrompt: (prompt: FocusPrefillPrompt) => void;
    setDismissedInitialPrefillPrompt: (dismissed: boolean) => void;
    shouldOfferInitialBachelorPrefill: boolean;
    shouldOfferInitialMasterPrefill: boolean;
    programCode: string;
    selectedFocus: string;
    tourCompleted: boolean;
    applyBachelorPrefilledPlan: (focusName: string | null | undefined) => boolean;
    applyMasterPrefilledPlan: () => boolean;
    progressMilestoneText: string;
}

export default function PrefillNotifications({
    focusPrefillPrompt,
    setFocusPrefillPrompt,
    setDismissedInitialPrefillPrompt,
    shouldOfferInitialBachelorPrefill,
    shouldOfferInitialMasterPrefill,
    programCode,
    selectedFocus,
    tourCompleted,
    applyBachelorPrefilledPlan,
    applyMasterPrefilledPlan,
    progressMilestoneText,
}: PrefillNotificationsProps) {
    return (
        <PlannerNotifications
            focusPrefillPrompt={focusPrefillPrompt}
            onApplyFocusPrefill={(focus: string) => {
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
            onApplyInitialPrefill={(focus: string | null) => {
                // Only the offer for the programme on screen is ever shown, so
                // the applier that refuses the other one cannot be reached.
                const applied = programCode === BACHELOR_PROGRAM_CODE
                    ? applyBachelorPrefilledPlan(focus)
                    : applyMasterPrefilledPlan();
                if (applied) setDismissedInitialPrefillPrompt(true);
            }}
            onDismissInitialPrefill={() => setDismissedInitialPrefillPrompt(true)}
            progressMilestoneText={progressMilestoneText}
        />
    );
}
