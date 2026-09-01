/**
 * The catalogue feature: the courses a programme offers, and the term each of
 * them is offered in.
 *
 * The two hooks are deliberately not one. The fetch has to be the planner's
 * first request, while the term answers need the overrides the student stores
 * in their profile, so the term hook is called only once the profile has been
 * read.
 */

export { useCatalogue } from "./useCatalogue.ts";
export type {
    CatalogueCourseEntry,
    CatalogueModuleMeta,
    UseCatalogueInput,
    UseCatalogueResult,
} from "./useCatalogue.ts";
export { useEffectiveCourseTerms } from "./useEffectiveCourseTerms.ts";
export type {
    UseEffectiveCourseTermsInput,
    UseEffectiveCourseTermsResult,
} from "./useEffectiveCourseTerms.ts";
