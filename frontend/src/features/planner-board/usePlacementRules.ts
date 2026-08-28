/**
 * Which lane a course may go in, and which lanes the placement menus offer.
 *
 * A lane's season alternates with its index, so a course taught only in winter
 * fits every second lane. The searches below therefore look forward first and
 * only then backwards: a course that cannot stay where the student asked for it
 * should move later in the plan rather than earlier, since moving it earlier
 * would silently bring work forward that they had put off.
 */

import { useCallback } from "react";

import {
    firstAllowedLaneAtOrAfter,
    isLaneAllowedForTerm,
} from "../../domain/terms.ts";
import type { TermAvailability } from "../../domain/terms.ts";
import type { CourseLike, SemesterOption } from "./types.ts";

/** The parking stage, which every menu offers and no term rule applies to. */
const parkingOption = (): SemesterOption => ({ id: 0, title: "Parking Stage", isParking: true });

export interface UsePlacementRulesInput {
    maxSemesterCount: number;
    activeSemesterCount: number;
    startTermSeason: string;
    sidebarSemesters: SemesterOption[];
    termAvailabilityForCode: (courseCode: string) => TermAvailability;
}

export interface UsePlacementRulesResult {
    isCourseAllowedInLane: (courseCode: string | null | undefined, laneIndex: number) => boolean;
    /** The lane to place this course in, or null when the plan has none for it. */
    firstAllowedLaneForCourse: (
        courseCode: string | null | undefined,
        preferredLane: number
    ) => number | null;
    /**
     * Keeps a placement inside the plan, allowing exactly one lane past its end
     * so that dropping a card there is what lengthens the plan.
     */
    clampPlacementLane: (requestedLaneIndex: number) => number;
    validSemestersForCourse: (courseCode: string | null | undefined) => SemesterOption[];
    validSemestersForModule: (courses: readonly CourseLike[] | null | undefined) => SemesterOption[];
}

export function usePlacementRules({
    maxSemesterCount,
    activeSemesterCount,
    startTermSeason,
    sidebarSemesters,
    termAvailabilityForCode,
}: UsePlacementRulesInput): UsePlacementRulesResult {
    const isCourseAllowedInLane = useCallback((courseCode: string | null | undefined, laneIndex: number) => {
        const term = termAvailabilityForCode(courseCode ?? "");
        return isLaneAllowedForTerm(term, startTermSeason, laneIndex);
    }, [startTermSeason, termAvailabilityForCode]);

    const firstAllowedLaneForCourse = useCallback((
        courseCode: string | null | undefined,
        preferredLane: number
    ): number | null => {
        const preferred = Math.max(0, Math.min(Number(preferredLane) || 0, maxSemesterCount - 1));
        const term = termAvailabilityForCode(courseCode ?? "");
        const forward = firstAllowedLaneAtOrAfter(
            term,
            startTermSeason,
            preferred,
            maxSemesterCount - 1
        );
        if (forward != null) return forward;
        for (let idx = preferred - 1; idx >= 0; idx -= 1) {
            if (isLaneAllowedForTerm(term, startTermSeason, idx)) return idx;
        }
        return null;
    }, [maxSemesterCount, startTermSeason, termAvailabilityForCode]);

    const clampPlacementLane = useCallback((requestedLaneIndex: number) => {
        const raw = Math.max(0, Math.floor(Number(requestedLaneIndex) || 0));
        const highestActive = Math.max(0, activeSemesterCount - 1);
        const nextAllowed = activeSemesterCount < maxSemesterCount ? activeSemesterCount : highestActive;
        return Math.max(0, Math.min(raw, nextAllowed));
    }, [activeSemesterCount, maxSemesterCount]);

    const validSemestersForCourse = useCallback((courseCode: string | null | undefined) => {
        const allowed = sidebarSemesters.filter((semester) => {
            const laneIndex = (Number(semester?.id) || 1) - 1;
            return isCourseAllowedInLane(courseCode, laneIndex);
        });
        return [parkingOption(), ...allowed];
    }, [isCourseAllowedInLane, sidebarSemesters]);

    const validSemestersForModule = useCallback((courses: readonly CourseLike[] | null | undefined) => {
        const codes = (Array.isArray(courses) ? courses : [])
            .map((course) => course?.code)
            .filter((code): code is string => Boolean(code));
        if (!codes.length) return [parkingOption()];
        const allowed = sidebarSemesters.filter((semester) => {
            const laneIndex = (Number(semester?.id) || 1) - 1;
            return codes.every((code) => isCourseAllowedInLane(code, laneIndex));
        });
        if (allowed.length > 0) {
            return [parkingOption(), ...allowed];
        }
        // No single lane suits every course of the module, so the menu offers
        // pairs of neighbouring lanes instead: the module is still one thing to
        // plan, but its courses are taken over two consecutive semesters.
        const pairOptions: SemesterOption[] = [];
        for (let idx = 0; idx < sidebarSemesters.length - 1; idx += 1) {
            const first = sidebarSemesters[idx];
            const second = sidebarSemesters[idx + 1];
            const firstLane = (Number(first?.id) || 1) - 1;
            const secondLane = (Number(second?.id) || 1) - 1;
            const canPlaceInWindow = codes.every((code) =>
                isCourseAllowedInLane(code, firstLane) || isCourseAllowedInLane(code, secondLane)
            );
            if (!canPlaceInWindow) continue;
            pairOptions.push({
                id: `pair-${first?.id}-${second?.id}`,
                laneIndex: firstLane,
                windowEndLaneIndex: secondLane,
                isPlus: Boolean(first?.isPlus || second?.isPlus),
                title: `${first?.title ?? `Semester ${first?.id}`} & ${second?.title ?? `Semester ${second?.id}`}`,
            });
        }
        if (pairOptions.length > 0) {
            return [parkingOption(), ...pairOptions];
        }
        const fallbackAllowed = sidebarSemesters.filter((semester) => {
            const laneIndex = (Number(semester?.id) || 1) - 1;
            return codes.some((code) => isCourseAllowedInLane(code, laneIndex));
        });
        return [parkingOption(), ...fallbackAllowed];
    }, [isCourseAllowedInLane, sidebarSemesters]);

    return {
        isCourseAllowedInLane,
        firstAllowedLaneForCourse,
        clampPlacementLane,
        validSemestersForCourse,
        validSemestersForModule,
    };
}
