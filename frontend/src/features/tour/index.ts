/**
 * The onboarding tour feature: the step the student is on, and the panels each
 * step expects to find open.
 *
 * The hook is given the setters for those panels rather than owning them,
 * because they belong to the planner and go on being used once the tour has
 * finished.
 */

export { useOnboardingTour } from "./useOnboardingTour.ts";
export type {
    TourUser,
    UseOnboardingTourInput,
    UseOnboardingTourResult,
} from "./useOnboardingTour.ts";
