/**
 * The prebuilt bachelor plan.
 *
 * The plan is a template of course aliases rather than of course codes, because
 * the catalogue renames courses between curriculum versions far more often than
 * it renumbers them, and a template that misses is worse than useless: it
 * silently drops a course from a student's plan. Every alias that finds nothing
 * is therefore reported back rather than skipped quietly.
 *
 * A summer start mirrors the plan across the winter/summer pairs of semesters,
 * except where a course is only ever taught in one of them. Those exceptions are
 * listed explicitly below, since nothing in the catalogue records them.
 */

import type {
    BachelorPlannedCourse,
    Catalogue,
    FlattenedCourse,
    PrefillTemplateItem,
} from "../types.ts";

/** The focus areas the plan knows how to specialise for. */
export type FocusKey =
    | "ai_ml"
    | "cybersecurity"
    | "digital_health"
    | "human_centered_computing"
    | "software_engineering"
    | "theoretical_cs_logic"
    | "visual_computing"
    | "general";

export interface BachelorPrefillOptions {
    startSeason?: string | null | undefined;
}

export interface BachelorPrefillPlan {
    focusKey: FocusKey;
    plannedCourses: BachelorPlannedCourse[];
    missingAliases: string[];
}

const BASELINE_PLAN: PrefillTemplateItem[] = [
    { semester: 1, aliases: ["Einführung in die Programmierung 1"] },
    { semester: 1, aliases: ["Grundzüge digitaler Systeme"] },
    { semester: 1, aliases: ["Denkweisen der Informatik"] },
    { semester: 1, aliases: ["Orientierung Informatik und Wirtschaftsinformatik", "Orientierung Informatik"] },
    { semester: 1, aliases: ["Algebra und Diskrete Mathematik für Informatik und Wirtschaftsinformatik (VU)", "Algebra und Diskrete Mathematik (VU)", "Algebra und Diskrete Mathematik"], ects: 9.0 },
    { semester: 1, aliases: ["Mathematisches Arbeiten"] },

    { semester: 2, aliases: ["Algorithmen und Datenstrukturen"] },
    { semester: 2, aliases: ["Einführung in die Programmierung 2"] },
    { semester: 2, aliases: ["Computersysteme"] },
    { semester: 2, aliases: ["Datenbanksysteme"] },
    { semester: 2, aliases: ["Analysis für Informatik und Wirtschaftsinformatik (VU)", "Analysis (VU)", "Analysis"], ects: 6.0 },

    { semester: 3, aliases: ["Programmierparadigmen"] },
    { semester: 3, aliases: ["Betriebssysteme"] },
    { semester: 3, aliases: ["Statistik und Wahrscheinlichkeitstheorie", "Statistik und Wahrscheinlichkeitstheorie (VU)"], ects: 6.0 },
    { semester: 3, aliases: ["Software Engineering"] },
    { semester: 3, aliases: ["Theoretische Informatik"] },

    { semester: 4, aliases: ["Interface und Interaction Design"] },
    { semester: 4, aliases: ["Einführung in Artificial Intelligence"] },
    { semester: 4, aliases: ["Logic and Reasoning in Computer Science"] },
    { semester: 4, aliases: ["Einführung in Security"] },
    { semester: 4, aliases: ["Software Engineering Projekt"] },

    { semester: 5, aliases: ["Verteilte Systeme"] },
    { semester: 5, aliases: ["Wissenschaftliches Arbeiten"] },

    { semester: 6, aliases: ["Bachelorarbeit"] },
    { semester: 6, aliases: ["Einführung in Visual Computing"] },
    { semester: 6, aliases: ["Daten- und Informatikrecht"] },
];

const FOCUS_ADDITIONS: Record<FocusKey, PrefillTemplateItem[]> = {
    ai_ml: [
        { semester: 5, aliases: ["Einführung in Machine Learning"] },
    ],
    digital_health: [
        { semester: 5, aliases: ["Einführung in Visual Computing"], prefillFixedSemester: true },
        { semester: 5, aliases: ["Methods for Data Generation and Analytics in Medicine and Life Sciences"], prefillFixedSemester: true },
    ],
    human_centered_computing: [
        { semester: 5, aliases: ["Einführung in Visual Computing"], prefillFixedSemester: true },
    ],
    software_engineering: [
        { semester: 5, aliases: ["Software-Qualitätssicherung"] },
    ],
    visual_computing: [
        { semester: 5, aliases: ["Einführung in Visual Computing"], prefillFixedSemester: true },
        { semester: 5, aliases: ["Grundlagen der Computergraphik"] },
        { semester: 5, aliases: ["Grundlagen der Computer Vision"] },
    ],
    cybersecurity: [],
    theoretical_cs_logic: [],
    general: [],
};

/**
 * Courses the baseline plan drops for a given focus. A focus adds depth in one
 * area at the cost of breadth elsewhere, and the plan has to stay within the
 * ECTS a semester can hold.
 */
const FOCUS_EXCLUSIONS: Record<FocusKey, string[]> = {
    general: [
        "Einführung in Visual Computing",
        "Daten- und Informatikrecht",
        "Verteilte Systeme",
        "Interface und Interaction Design",
        "Logic and Reasoning in Computer Science",
        "Einführung in Artificial Intelligence",
        "Software Engineering Projekt",
        "Computersysteme",
        "Betriebssysteme",
        "Software Engineering",
    ],
    ai_ml: [
        "Verteilte Systeme",
        "Einführung in Visual Computing",
        "Interface und Interaction Design",
        "Daten- und Informatikrecht",
        "Logic and Reasoning in Computer Science",
        "Software Engineering Projekt",
        "Software Engineering",
        "Computersysteme",
    ],
    cybersecurity: [
        "Verteilte Systeme",
        "Logic and Reasoning in Computer Science",
        "Einführung in Visual Computing",
        "Daten- und Informatikrecht",
        "Interface und Interaction Design",
        "Software Engineering",
        "Software Engineering Projekt",
        "Computersysteme",
    ],
    digital_health: [
        "Einführung in Visual Computing",
        "Verteilte Systeme",
        "Einführung in Artificial Intelligence",
        "Logic and Reasoning in Computer Science",
        "Software Engineering Projekt",
        "Betriebssysteme",
        "Computersysteme",
    ],
    human_centered_computing: [
        "Einführung in Visual Computing",
        "Daten- und Informatikrecht",
        "Methods for Data Generation and Analytics in Medicine and Life Sciences",
        "Verteilte Systeme",
        "Einführung in Artificial Intelligence",
        "Logic and Reasoning in Computer Science",
        "Betriebssysteme",
        "Computersysteme",
        "Software Engineering Projekt",
    ],
    software_engineering: [
        "Einführung in Visual Computing",
        "Daten- und Informatikrecht",
        "Einführung in Artificial Intelligence",
        "Logic and Reasoning in Computer Science",
        "Betriebssysteme",
        "Computersysteme",
    ],
    theoretical_cs_logic: [
        "Einführung in Visual Computing",
        "Daten- und Informatikrecht",
        "Interface und Interaction Design",
        "Verteilte Systeme",
        "Einführung in Artificial Intelligence",
        "Software Engineering Projekt",
        "Software Engineering",
        "Betriebssysteme",
        "Computersysteme",
    ],
    visual_computing: [
        "Einführung in Visual Computing",
        "Daten- und Informatikrecht",
        "Verteilte Systeme",
        "Software Engineering Projekt",
        "Logic and Reasoning in Computer Science",
        "Interface und Interaction Design",
        "Einführung in Artificial Intelligence",
        "Betriebssysteme",
        "Computersysteme",
    ],
};

/** Winter and summer semesters swap places when the student starts in summer. */
const SUMMER_SWAP_MAP: Record<number, number> = {
    1: 2,
    2: 1,
    3: 4,
    4: 3,
    5: 6,
    6: 5,
};

function normalizeText(value: unknown): string {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/** Thesis work stays at the end of the degree whichever season it started in. */
const SUMMER_LOCKED_ALIAS_SET = new Set([
    "Wissenschaftliches Arbeiten",
    "Bachelorarbeit",
    "Bachelorarbeit für Informatik und Wirtschaftsinformatik",
].map((entry) => normalizeText(entry)));

/** The programming sequence is taught in a fixed order regardless of season. */
const STRICT_FIXED_ALIAS_SEMESTER = new Map<string, number>([
    [normalizeText("Einführung in die Programmierung 1"), 1],
    [normalizeText("Einführung in die Programmierung 2"), 2],
]);

const SUMMER_FIRST_SEMESTER_ALIAS_SET = new Set([
    "Algebra und Diskrete Mathematik für Informatik und Wirtschaftsinformatik (VU)",
    "Algebra und Diskrete Mathematik (VU)",
    "Algebra und Diskrete Mathematik",
].map((entry) => normalizeText(entry)));

function resolveFocusKey(selectedFocus: string | null | undefined): FocusKey {
    const key = normalizeText(selectedFocus);
    if (!key) return "general";
    if (key.includes("artificial intelligence") && key.includes("machine learning")) return "ai_ml";
    if (key.includes("cybersecurity")) return "cybersecurity";
    if (key.includes("digital health")) return "digital_health";
    if (key.includes("human centered computing") || key.includes("human centred computing")) return "human_centered_computing";
    if (key.includes("software engineering")) return "software_engineering";
    if (key.includes("visual computing")) return "visual_computing";
    if (key.includes("theoretische informatik") || key.includes("logic") || key.includes("logik")) return "theoretical_cs_logic";
    return "general";
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
            const moduleName = moduleEntry?.name ?? null;
            const category = moduleEntry?.category ?? "unknown";
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
                        moduleName,
                        moduleCode: moduleEntry?.code ?? null,
                        moduleEcts: Number(moduleEntry?.ects ?? 0) || null,
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
                moduleName,
                moduleCode: moduleEntry?.code ?? null,
                moduleEcts: Number(moduleEntry?.ects ?? 0) || null,
                _normCode: normalizeText(moduleEntry.code),
                _normName: normalizeText(moduleEntry.name),
                _normModule: normalizeText(moduleName),
            });
        }
    }
    return out;
}

/**
 * How well a catalogue entry answers an alias. A code match outranks a name
 * match, which outranks a module match, and a matching ECTS value breaks ties
 * between the split variants of a module that share a name.
 */
function scoreMatch(entry: FlattenedCourse, aliasNorm: string, desiredEcts: number | null = null): number {
    let score = 0;
    if (entry._normCode === aliasNorm) score += 120;
    if (entry._normName === aliasNorm) score += 100;
    if (entry._normModule === aliasNorm) score += 80;
    if (desiredEcts != null && Number.isFinite(entry.ects) && Math.abs(Number(entry.ects) - desiredEcts) < 1e-6) score += 25;
    return score;
}

function findBestCourse(
    catalogEntries: FlattenedCourse[],
    aliases: string[],
    desiredEcts: number | null,
    usedCodes: Set<string>
): FlattenedCourse | null {
    let best: FlattenedCourse | null = null;
    let bestScore = -1;
    for (const alias of aliases) {
        const aliasNorm = normalizeText(alias);
        if (!aliasNorm) continue;
        for (const entry of catalogEntries) {
            if (!entry?.code || usedCodes.has(entry.code)) continue;
            const score = scoreMatch(entry, aliasNorm, desiredEcts);
            if (score <= 0) continue;
            if (score > bestScore) {
                best = entry;
                bestScore = score;
            }
        }
    }
    return best;
}

function isSummerStart(startSeason: string | null | undefined): boolean {
    return normalizeText(startSeason) === "summer";
}

function isSummerSwapLocked(aliases: string[]): boolean {
    const list = Array.isArray(aliases) ? aliases : [];
    return list.some((alias) => SUMMER_LOCKED_ALIAS_SET.has(normalizeText(alias)));
}

function resolveStrictFixedSemester(aliases: string[]): number | null {
    const list = Array.isArray(aliases) ? aliases : [];
    for (const alias of list) {
        const fixed = STRICT_FIXED_ALIAS_SEMESTER.get(normalizeText(alias));
        if (Number.isInteger(fixed)) return Number(fixed);
    }
    return null;
}

function isSummerFirstSemesterLocked(aliases: string[]): boolean {
    const list = Array.isArray(aliases) ? aliases : [];
    return list.some((alias) => SUMMER_FIRST_SEMESTER_ALIAS_SET.has(normalizeText(alias)));
}

function remapSemesterForStart(
    semester: number,
    aliases: string[],
    startSeason: string | null | undefined
): number {
    const sem = Number(semester);
    if (!Number.isInteger(sem) || sem < 1) return sem;
    const strictFixed = resolveStrictFixedSemester(aliases);
    if (Number.isInteger(strictFixed)) return Number(strictFixed);
    if (!isSummerStart(startSeason)) return sem;
    if (isSummerFirstSemesterLocked(aliases)) return 1;
    if (isSummerSwapLocked(aliases)) return sem;
    return SUMMER_SWAP_MAP[sem] || sem;
}

export function buildBachelorPrefillPlan(
    catalog: Catalogue | null | undefined,
    selectedFocus: string | null | undefined,
    options: BachelorPrefillOptions = {}
): BachelorPrefillPlan {
    const startSeason = options?.startSeason;
    const focusKey = resolveFocusKey(selectedFocus);
    const additions = FOCUS_ADDITIONS[focusKey] || FOCUS_ADDITIONS.general;
    const exclusions = new Set((FOCUS_EXCLUSIONS[focusKey] || []).map(normalizeText));
    const baseTemplate = BASELINE_PLAN.filter((item) => {
        const aliases = Array.isArray(item?.aliases) ? item.aliases : [];
        return !aliases.some((alias) => exclusions.has(normalizeText(alias)));
    });
    const template = [...baseTemplate, ...additions]
        .map((item) => {
            const aliases = Array.isArray(item?.aliases) ? item.aliases : [];
            return {
                ...item,
                semester: item?.prefillFixedSemester
                    ? Number(item?.semester)
                    : remapSemesterForStart(item?.semester, aliases, startSeason),
            };
        });
    const catalogEntries = flattenCatalogCourses(catalog);
    const usedCodes = new Set<string>();
    const plannedCourses: BachelorPlannedCourse[] = [];
    const missingAliases: string[] = [];

    for (const item of template) {
        const aliases = Array.isArray(item?.aliases) ? item.aliases : [];
        const strictFixedSemester = resolveStrictFixedSemester(aliases);
        const ects = Number(item?.ects);
        const desiredEcts = Number.isFinite(ects) ? ects : null;
        const match = findBestCourse(catalogEntries, aliases, desiredEcts, usedCodes);
        if (!match) {
            missingAliases.push(aliases[0] || "unknown");
            continue;
        }
        usedCodes.add(match.code);
        plannedCourses.push({
            semester: Number(item.semester),
            prefillFixedSemester: Boolean(item?.prefillFixedSemester) || Number.isInteger(strictFixedSemester),
            code: match.code,
            name: match.name,
            ects: match.ects,
            category: match.category,
            examSubject: match.examSubject,
            module: {
                key: match._normModule || `code:${normalizeText(match.code)}`,
                title: match.moduleName || match.name || match.code,
                code: match.moduleCode || null,
                ects: match.moduleEcts ?? null,
                category: match.category,
            },
        });
    }

    return {
        focusKey,
        plannedCourses,
        missingAliases,
    };
}
