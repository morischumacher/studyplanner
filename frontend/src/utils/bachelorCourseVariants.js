function normalizeText(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const SPLIT_MODULES = {
    "algebra und diskrete mathematik": true,
    analysis: true,
    "statistik und wahrscheinlichkeitstheorie": true,
};

function detectVariantPart(course) {
    const code = normalizeText(course?.code);
    const name = normalizeText(course?.name);
    const type = normalizeText(course?.type);
    const full = `${code} ${name} ${type}`;
    if (/(^|\s)vu(\s|$)/.test(full) || code.includes("-vu") || type === "vu") return "vu";
    if (/(^|\s)vo(\s|$)/.test(full) || code.includes("-vo") || type === "vo") return "vo";
    if (/(^|\s)ue(\s|$)/.test(full) || code.includes("-ue") || type === "ue") return "ue";
    return null;
}

export function getSplitModuleVariantMeta(moduleName) {
    const moduleKey = normalizeText(moduleName);
    if (!SPLIT_MODULES[moduleKey]) return null;
    return {
        moduleKey,
        variants: [
            { id: "vu", label: "VU" },
            { id: "vo_ue", label: "VO + UE" },
        ],
    };
}

export function resolveModuleVariantCourses(modulePayload, requestedVariantId = null) {
    const courses = Array.isArray(modulePayload?.courses) ? modulePayload.courses.filter((c) => c?.code) : [];
    const moduleName = modulePayload?.name || "";
    const variantMeta = getSplitModuleVariantMeta(moduleName);
    if (!variantMeta) {
        return {
            isSplitModule: false,
            activeVariantId: null,
            selectedCourses: courses,
            allVariantCourses: courses,
            variantMeta: null,
        };
    }

    const vuCourses = courses.filter((c) => detectVariantPart(c) === "vu");
    const voCourses = courses.filter((c) => detectVariantPart(c) === "vo");
    const ueCourses = courses.filter((c) => detectVariantPart(c) === "ue");
    const voUeCourses = [...voCourses, ...ueCourses];

    let activeVariantId = requestedVariantId;
    if (activeVariantId !== "vu" && activeVariantId !== "vo_ue") {
        activeVariantId = vuCourses.length > 0 ? "vu" : "vo_ue";
    }

    const selectedCourses = activeVariantId === "vo_ue" ? voUeCourses : vuCourses;
    const fallbackSelected = selectedCourses.length > 0
        ? selectedCourses
        : (activeVariantId === "vu" ? voUeCourses : vuCourses);

    return {
        isSplitModule: true,
        activeVariantId,
        selectedCourses: fallbackSelected,
        allVariantCourses: [...new Map(courses.map((c) => [c.code, c])).values()],
        variantMeta,
    };
}
