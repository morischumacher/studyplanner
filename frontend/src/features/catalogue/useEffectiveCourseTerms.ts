/**
 * When each course is offered, once the student's own corrections are applied
 * over what the catalogue says.
 *
 * An override wins over the catalogue even where the catalogue is right, and a
 * course named by neither reads as offered in both terms. That is the lenient
 * answer on purpose: a course nobody can place is a worse failure than a course
 * placed too freely.
 */

import { useCallback, useMemo } from "react";

import { normalizeTermAvailability, TERM_BOTH, type TermAvailability } from "../../domain/terms.ts";
import type { Catalogue } from "../../domain/types.ts";

export interface UseEffectiveCourseTermsInput {
    catalog: Catalogue | null | undefined;
    courseTermOverrides: Record<string, TermAvailability> | null | undefined;
}

export interface UseEffectiveCourseTermsResult {
    effectiveCourseTermByCode: Record<string, TermAvailability>;
    termAvailabilityForCode: (courseCode: string) => TermAvailability;
}

export function useEffectiveCourseTerms({
    catalog,
    courseTermOverrides,
}: UseEffectiveCourseTermsInput): UseEffectiveCourseTermsResult {
    const effectiveCourseTermByCode = useMemo(() => {
        const map: Record<string, TermAvailability> = {};
        for (const subject of Array.isArray(catalog) ? catalog : []) {
            for (const module of Array.isArray(subject?.modules) ? subject.modules : []) {
                for (const course of Array.isArray(module?.courses) ? module.courses : []) {
                    const code = String(course?.code || "").trim();
                    if (!code) continue;
                    map[code] = normalizeTermAvailability(course?.termAvailability ?? TERM_BOTH);
                }
            }
        }
        for (const [code, term] of Object.entries(courseTermOverrides || {})) {
            const normalizedCode = String(code || "").trim();
            if (!normalizedCode) continue;
            map[normalizedCode] = normalizeTermAvailability(term);
        }
        return map;
    }, [catalog, courseTermOverrides]);

    const termAvailabilityForCode = useCallback((courseCode: string): TermAvailability => {
        const code = String(courseCode || "").trim();
        if (!code) return TERM_BOTH;
        return normalizeTermAvailability(effectiveCourseTermByCode?.[code] ?? TERM_BOTH);
    }, [effectiveCourseTermByCode]);

    return { effectiveCourseTermByCode, termAvailabilityForCode };
}
