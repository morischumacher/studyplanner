import { BACHELOR_PROGRAM_CODE } from "./constants.js";

export function getExamSubjectForCode(catalog, code) {
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

export function getCourseTypeForCode(catalog, code) {
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

export function normalizeRulecheckCategoryForProgram(course, activeProgramCode) {
    if (!course || activeProgramCode !== BACHELOR_PROGRAM_CODE) return course;
    const normalize = (value) =>
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

export function resolveDashboardCategoryForProgram(course, activeProgramCode) {
    const normalized = normalizeRulecheckCategoryForProgram(course, activeProgramCode);
    return String(normalized?.category || "unknown");
}

export function normalizeCatalog(raw) {
    const subjects = Array.isArray(raw) ? raw : [];
    if (!subjects.length) return [];

    return subjects.map((s, sIdx) => {
        const modules = Array.isArray(s.modules) ? s.modules : [];
        return {
            pruefungsfach: s.exam_subject ?? `Prüfungsfach ${sIdx + 1}`,
            modules: modules.map((m) => {
                const courses = Array.isArray(m.courses) ? m.courses : [];
                return {
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
