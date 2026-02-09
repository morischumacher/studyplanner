// src/utils/normalizeCatalog.js
/**
 * Normalize backend catalog payloads into:
 * {
 *   sections: [
 *     {
 *       exam_subject, exam_subject_code, modules: [
 *         {
 *           name, ects, category, is_mandatory,
 *           module_exam_subject, module_exam_subject_code,
 *           courses: [{ code, name, title, ects, type, language, course_id, is_core_to_module }]
 *         }
 *       ]
 *     }
 *   ]
 * }
 */
export function normalizeCatalog(raw) {
    // 1) Figure out where "sections" live
    let sections = [];
    if (Array.isArray(raw)) {
        sections = raw; // your backend format
    } else if (raw?.sections) {
        sections = raw.sections;
    } else if (raw?.program?.sections) {
        sections = raw.program.sections;
    } else if (raw?.catalog?.sections) {
        sections = raw.catalog.sections;
    } else {
        sections = [];
    }

    // 2) Ensure consistent field names / shapes
    const normSections = (sections || []).map((sec, sIdx) => {
        const modules = Array.isArray(sec?.modules) ? sec.modules : [];
        return {
            exam_subject: sec?.exam_subject ?? `Prüfungsfach ${sIdx + 1}`,
            exam_subject_code: sec?.exam_subject_code ?? null,
            exam_subject_id: sec?.exam_subject_id ?? null,
            modules: modules.map((m) => {
                const courses = Array.isArray(m?.courses) ? m.courses : [];
                return {
                    name: m?.name ?? "Ohne Titel",
                    ects: Number(m?.ects) || 0,
                    category: m?.category ?? null,
                    is_mandatory: !!m?.is_mandatory,
                    module_exam_subject: m?.module_exam_subject ?? sec?.exam_subject ?? null,
                    module_exam_subject_code: m?.module_exam_subject_code ?? sec?.exam_subject_code ?? null,
                    module_id: m?.module_id ?? null,
                    courses: courses.map((c, idx) => ({
                        code: c?.code ?? `C-${idx}`,
                        name: c?.name ?? c?.title ?? "Untitled",
                        title: c?.title ?? c?.name ?? "Untitled",
                        ects: Number(c?.ects) || 0,
                        type: c?.type ?? null,
                        language: c?.language ?? null,
                        course_id: c?.course_id ?? null,
                        is_core_to_module: !!c?.is_core_to_module,
                        tags: Array.isArray(c?.tags) ? c.tags : [],
                    })),
                };
            }),
        };
    });

    return { sections: normSections };
}
