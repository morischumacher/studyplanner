/**
 * The recommendations currently on offer, and the lookup the course cards read
 * them through.
 *
 * The list is whatever the last answer from the backend contained, so a course
 * dismissed here is dismissed only until the next answer replaces the list.
 */

import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

/**
 * One recommendation. Every field is optional and the rest is left open,
 * because the backend decides what a recommendation carries and the planner
 * only reads the few fields it shows.
 */
export interface Recommendation {
    id?: string | number;
    courseCode?: string;
    type?: string;
    content?: unknown[];
    [key: string]: unknown;
}

/** What a course card shows when a recommendation names it. */
export interface RecommendedCourse {
    type: string;
    content: unknown[];
}

export interface UseRecommendationListResult {
    recommendations: Recommendation[];
    setRecommendations: Dispatch<SetStateAction<Recommendation[]>>;
    recommendedCourseMap: Map<string, RecommendedCourse>;
}

export function useRecommendationList(): UseRecommendationListResult {
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

    const recommendedCourseMap = useMemo(() => {
        const map = new Map<string, RecommendedCourse>();
        for (const rec of Array.isArray(recommendations) ? recommendations : []) {
            if (rec?.courseCode) {
                map.set(String(rec.courseCode), { type: rec.type || "interest", content: rec.content || [] });
            }
        }
        return map;
    }, [recommendations]);

    return { recommendations, setRecommendations, recommendedCourseMap };
}
