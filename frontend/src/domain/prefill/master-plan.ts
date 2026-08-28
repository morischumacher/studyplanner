/**
 * The prebuilt master plan.
 *
 * The master curriculum leaves almost everything to the student, so the
 * template holds only the two courses the programme itself sequences. A summer
 * start moves both into the second semester rather than mirroring the plan the
 * way the bachelor does, because there is no second half to mirror against.
 */

import type { Catalogue, FlattenedCourse, PlannedCourse, PrefillTemplateItem } from "../types.ts";

export interface MasterPrefillOptions {
    startSeason?: string | null | undefined;
}

export interface MasterPrefillPlan {
    plannedCourses: PlannedCourse[];
    missingAliases: string[];
}

function normalizeText(value: unknown): string {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const MASTER_TEMPLATE: PrefillTemplateItem[] = [
    {
        semester: 1,
        aliases: ["Advanced Software Engineering"],
    },
    {
        semester: 1,
        aliases: ["Advanced Software Engineering Project"],
    },
];

function templateForStartSeason(startSeason: string | null | undefined): PrefillTemplateItem[] {
    const normalized = normalizeText(startSeason);
    if (normalized !== "summer") return MASTER_TEMPLATE;
    return MASTER_TEMPLATE.map((item) => ({
        ...item,
        semester: 2,
    }));
}

/**
 * Every course the catalogue offers, one entry each. A module with no courses
 * of its own still yields an entry, because some requirements are stated at
 * module level and the plan has to be able to name them.
 */
function flattenCatalogCourses(catalog: Catalogue | null | undefined): FlattenedCourse[] {
    const out: FlattenedCourse[] = [];
    for (const subject of Array.isArray(catalog) ? catalog : []) {
        const examSubject = subject?.pruefungsfach ?? null;
        for (const moduleEntry of Array.isArray(subject?.modules) ? subject.modules : []) {
            const category = moduleEntry?.category ?? "unknown";
            const moduleName = moduleEntry?.name ?? null;
            const moduleCourses = Array.isArray(moduleEntry?.courses) ? moduleEntry.courses : [];
            if (moduleCourses.length > 0) {
                for (const course of moduleCourses) {
                    if (!course?.code) continue;
                    out.push({
                        code: course.code,
                        name: course.name ?? moduleName ?? course.code,
                        ects: Number(course?.ects ?? moduleEntry?.ects ?? 0) || null,
                        category,
                        examSubject,
                        _normCode: normalizeText(course.code),
                        _normName: normalizeText(course.name),
                        _normModule: normalizeText(moduleName),
                    });
                }
                continue;
            }
            if (!moduleEntry?.code) continue;
            out.push({
                code: moduleEntry.code,
                name: moduleEntry.name ?? moduleEntry.code,
                ects: Number(moduleEntry?.ects ?? 0) || null,
                category,
                examSubject,
                _normCode: normalizeText(moduleEntry.code),
                _normName: normalizeText(moduleEntry.name),
                _normModule: normalizeText(moduleName),
            });
        }
    }
    return out;
}

function findBestCourse(
    catalogEntries: FlattenedCourse[],
    aliases: string[],
    usedCodes: Set<string>
): FlattenedCourse | null {
    let best: FlattenedCourse | null = null;
    let bestScore = -1;
    for (const alias of aliases) {
        const aliasNorm = normalizeText(alias);
        if (!aliasNorm) continue;
        for (const entry of catalogEntries) {
            if (!entry?.code || usedCodes.has(entry.code)) continue;
            let score = 0;
            if (entry._normCode === aliasNorm) score += 120;
            if (entry._normName === aliasNorm) score += 100;
            if (entry._normModule === aliasNorm) score += 80;
            // A score of zero still beats the starting score, so the first
            // unused entry in the catalogue is returned when nothing matches.
            if (score > bestScore) {
                best = entry;
                bestScore = score;
            }
        }
    }
    return best;
}

export function buildMasterPrefillPlan(
    catalog: Catalogue | null | undefined,
    options: MasterPrefillOptions = {}
): MasterPrefillPlan {
    const startSeason = options?.startSeason;
    const template = templateForStartSeason(startSeason);
    const catalogEntries = flattenCatalogCourses(catalog);
    const usedCodes = new Set<string>();
    const plannedCourses: PlannedCourse[] = [];
    const missingAliases: string[] = [];

    for (const item of template) {
        const aliases = Array.isArray(item?.aliases) ? item.aliases : [];
        const match = findBestCourse(catalogEntries, aliases, usedCodes);
        if (!match) {
            missingAliases.push(aliases[0] || "unknown");
            continue;
        }
        usedCodes.add(match.code);
        plannedCourses.push({
            semester: Number(item.semester),
            code: match.code,
            name: match.name,
            ects: match.ects,
            category: match.category,
            examSubject: match.examSubject,
        });
    }

    return {
        plannedCourses,
        missingAliases,
    };
}
