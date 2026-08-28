/**
 * The prebuilt plans, and the two moments they are offered.
 *
 * Applying one replaces the whole plan, which is why the offers are kept apart
 * from the appliers: an offer has to know whether there is anything to replace,
 * and that is a question about the plan the dashboard has already answered.
 */

export { default as PrefillNotifications } from "./PrefillNotifications.tsx";
export type { PrefillNotificationsProps } from "./PrefillNotifications.tsx";

export { useFocusPrefillOffer, usePrefillPrompts } from "./usePrefillPrompts.ts";
export type {
    FocusPrefillPrompt,
    UseFocusPrefillOfferInput,
    UsePrefillPromptsResult,
} from "./usePrefillPrompts.ts";

export { usePrefilledPlans } from "./usePrefilledPlans.ts";
export type {
    PrefillNode,
    PrefillNodeData,
    UsePrefilledPlansInput,
    UsePrefilledPlansResult,
} from "./usePrefilledPlans.ts";
