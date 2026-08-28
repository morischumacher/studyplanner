/**
 * The recommendations feature: the list the planner shows, the requests that
 * fill it, and the switches that decide which kinds are asked for.
 *
 * The list is held apart from the requests because the two are wanted at
 * different points. The course cards read the list while they are being built,
 * whereas the requests are made alongside the rule check, and the order the two
 * of them reach the backend in is the order the planner establishes.
 */

export { useRecommendationList } from "./useRecommendationList.ts";
export type {
    Recommendation,
    RecommendedCourse,
    UseRecommendationListResult,
} from "./useRecommendationList.ts";
export { useRecommendationRequests } from "./useRecommendationRequests.ts";
export type {
    UseRecommendationRequestsInput,
    UseRecommendationRequestsResult,
} from "./useRecommendationRequests.ts";
