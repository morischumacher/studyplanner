/**
 * The prebuilt plans a student can start from.
 *
 * Each programme has its own builder because the two curricula prescribe
 * different amounts: the bachelor sequences almost the whole degree, the master
 * barely any of it. Both answer with the courses they placed and the aliases
 * they could not find, so the caller can say what went missing.
 */

export { buildBachelorPrefillPlan } from "./bachelor-plan.ts";
export type {
    BachelorPrefillOptions,
    BachelorPrefillPlan,
    FocusKey,
} from "./bachelor-plan.ts";

export { buildMasterPrefillPlan } from "./master-plan.ts";
export type { MasterPrefillOptions, MasterPrefillPlan } from "./master-plan.ts";

export { getSplitModuleVariantMeta, resolveModuleVariantCourses } from "./course-variants.ts";
export type {
    ModuleVariantResolution,
    VariantMeta,
    VariantOption,
} from "./course-variants.ts";
