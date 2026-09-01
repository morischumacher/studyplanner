/**
 * The curriculum catalogue: narrowing the backend payload, and looking things
 * up in the result.
 *
 * `normalizeCatalog` is the only boundary at which raw JSON becomes a
 * `Catalogue`, so it is also the only place that supplies fallbacks for fields
 * the backend may omit. The lookups below assume that has already happened.
 *
 * The one rule that is not a lookup is the bachelor thesis reclassification.
 * The rule checker reports thesis work under whichever category its module
 * happened to carry, and the dashboard needs it under "thesis"; that rewrite is
 * confined to the bachelor programme because no other programme names its
 * thesis this way.
 */

import { BACHELOR_PROGRAM_CODE } from "./programmes.ts";
import type { Catalogue, CatalogueModule, CatalogueSubject } from "./types.ts";

/**
 * What the backend sends. Nothing validates it before it arrives, so every
 * field is optional and `normalizeCatalog` decides what a missing one means.
 */
interface RawCourse {
    title?: string;
    name?: string;
    code?: string;
    ects?: number | string;
    type?: string;
    term_availability?: string;
}

interface RawModule {
    code?: string;
    name?: string;
    ects?: number | string;
    category?: string;
    is_mandatory?: boolean;
    module_exam_subject?: string;
    courses?: RawCourse[];
}

interface RawSubject {
    exam_subject?: string;
    modules?: RawModule[];
}

/**
 * A course as the rule checker reports it back. Its fields overlap the
 * catalogue's only loosely, which is why the thesis test looks at all of them.
 */
export interface RulecheckCourse {
    code?: string | null;
    name?: string | null;
    title?: string | null;
    category?: string | null;
    moduleMeta?: { name?: string | null; title?: string | null } | null;
}

export function getExamSubjectForCode(
    catalog: Catalogue | null | undefined,
    code: string | null | undefined
): string | null {
    if (!code) return null;
    for (const pf of catalog || []) {
        const pfName = pf.pruefungsfach ?? null;
        for (const mod of pf.modules || []) {
            if (mod.code === code) return mod.module_exam_subject || pfName || null;
            for (const c of mod.courses || []) {
                if (c.code === code) return mod.module_exam_subject || pfName || null;
            }
        }
    }
    return null;
}

export function getCourseTypeForCode(
    catalog: Catalogue | null | undefined,
    code: string | null | undefined
): string | null {
    if (!code) return null;
    for (const pf of catalog || []) {
        for (const mod of pf.modules || []) {
            for (const c of mod.courses || []) {
                if (c.code === code) return c.type ?? null;
            }
        }
    }
    return null;
}

export function normalizeRulecheckCategoryForProgram(
    course: RulecheckCourse | null | undefined,
    activeProgramCode: string | null | undefined
): RulecheckCourse | null | undefined {
    if (!course || activeProgramCode !== BACHELOR_PROGRAM_CODE) return course;
    const normalize = (value: string | null | undefined) =>
        String(value ?? "")
            .trim()
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "");

    const codeOrName = normalize(course?.code || course?.name || course?.title);
    const moduleName = normalize(course?.moduleMeta?.name || course?.moduleMeta?.title);
    const isThesisRelated =
        codeOrName === normalize("BA") ||
        codeOrName === normalize("WA") ||
        codeOrName === normalize("BA-PR") ||
        codeOrName === normalize("WISS-SE") ||
        codeOrName === normalize("Bachelorarbeit") ||
        codeOrName === normalize("Wissenschaftliches Arbeiten") ||
        moduleName === normalize("Bachelorarbeit");

    if (!isThesisRelated) return course;
    return { ...course, category: "thesis" };
}

export function resolveDashboardCategoryForProgram(
    course: RulecheckCourse | null | undefined,
    activeProgramCode: string | null | undefined
): string {
    const normalized = normalizeRulecheckCategoryForProgram(course, activeProgramCode);
    return String(normalized?.category || "unknown");
}

export function normalizeCatalog(raw: unknown): Catalogue {
    const subjects: RawSubject[] = Array.isArray(raw) ? raw : [];
    if (!subjects.length) return [];

    return subjects.map((s, sIdx): CatalogueSubject => {
        const modules = Array.isArray(s.modules) ? s.modules : [];
        return {
            pruefungsfach: s.exam_subject ?? `Prüfungsfach ${sIdx + 1}`,
            modules: modules.map((m): CatalogueModule => {
                const courses = Array.isArray(m.courses) ? m.courses : [];
                return {
                    // A module is addressed by its first course's code where it
                    // has one, because that is the code the rule checker uses.
                    code: courses[0]?.code ?? m.code ?? `M-${sIdx}`,
                    name: m.name ?? "Ohne Titel",
                    ects: Number(m.ects) || 0,
                    category: m.category ?? null,
                    is_mandatory: !!m.is_mandatory,
                    module_exam_subject: m.module_exam_subject ?? s.exam_subject ?? null,
                    courses: courses.map((c) => ({
                        name: c.title ?? c.name ?? "",
                        code: c.code ?? "",
                        ects: Number(c.ects) || null,
                        type: c.type ?? null,
                        termAvailability: c.term_availability ?? "both",
                    })),
                };
            }),
        };
    });
}
