/**
 * The compliance loop: the plan goes to the rule checker, and a change the rule
 * checker refuses is taken back off the canvas.
 *
 * The parts are exported separately because they belong at different points of
 * the planner's render. The order they are called in is the order their effects
 * run in, and the loop depends on it: the rollbacks must exist before the check
 * that may call them, and the check must be sent before the banner that reports
 * what it said is allowed to expire.
 */

export { useRuleCheckState } from "./useRuleCheckState.ts";
export type {
    RuleCheckStateUpdate,
    SetProgramRuleCheckState,
    UseRuleCheckStateInput,
    UseRuleCheckStateResult,
} from "./useRuleCheckState.ts";

export {
    useProgressMilestone,
    useStickyViolation,
    useStickyViolationExpiry,
    useTransientSuccessFeedback,
} from "./useRuleCheckFeedback.ts";
export type {
    StickyViolation,
    UseProgressMilestoneInput,
    UseProgressMilestoneResult,
    UseStickyViolationResult,
    UseTransientSuccessFeedbackInput,
    UseTransientSuccessFeedbackResult,
} from "./useRuleCheckFeedback.ts";

export { useRuleCheckRollbacks } from "./useRuleCheckRollbacks.ts";
export type {
    RolledBackChange,
    UseRuleCheckRollbacksInput,
    UseRuleCheckRollbacksResult,
} from "./useRuleCheckRollbacks.ts";

export { useRuleCheckSync } from "./useRuleCheckSync.ts";
export type { UseRuleCheckSyncInput } from "./useRuleCheckSync.ts";
