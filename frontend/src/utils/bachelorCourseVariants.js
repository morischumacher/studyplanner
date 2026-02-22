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
const COMPUTATIONAL_STATISTICS_MODULE_KEY = "computational statistics";

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

function buildComputationalStatisticsOptions(courses) {
    const byCode = new Map((courses || []).map((c) => [normalizeText(c?.code), c]));
    const byName = new Map((courses || []).map((c) => [normalizeText(c?.name), c]));
    const resolve = (...aliases) => {
        for (const alias of aliases) {
            const k = normalizeText(alias);
            if (byCode.has(k)) return byCode.get(k);
            if (byName.has(k)) return byName.get(k);
        }
        return null;
    };

    const cstat = resolve("CSTAT-VU", "Computerstatistik");
    const scomp = resolve("SCOMP-VU", "Statistical Computing");
    const sim = resolve("SIM-VU", "Statistische Simulation und computerintensive Methoden");

    const variants = [];
    if (cstat && scomp) variants.push({ id: "cstat_scomp", label: "Computerstatistik + Statistical Computing", courses: [cstat, scomp] });
    if (cstat && sim) variants.push({ id: "cstat_sim", label: "Computerstatistik + Simulation", courses: [cstat, sim] });
    if (scomp && sim) variants.push({ id: "scomp_sim", label: "Statistical Computing + Simulation", courses: [scomp, sim] });
    if (cstat && scomp && sim) {
        variants.push({
            id: "all_three",
            label: "All three courses",
            courses: [cstat, scomp, sim],
        });
    }
    return variants;
}

function hasComputationalStatisticsSignature(courses) {
    const normalizedCodes = (courses || [])
        .map((c) => normalizeText(c?.code))
        .filter(Boolean)
        .map((k) => k.replace(/\s+/g, " "));
    const signatureCodes = new Set(normalizedCodes);
    return (
        signatureCodes.has("cstat vu") ||
        signatureCodes.has("scomp vu") ||
        signatureCodes.has("sim vu")
    );
}

export function resolveModuleVariantCourses(modulePayload, requestedVariantId = null) {
    const courses = Array.isArray(modulePayload?.courses) ? modulePayload.courses.filter((c) => c?.code) : [];
    const moduleName = modulePayload?.name || "";
    const moduleKey = normalizeText(moduleName);
    if (moduleKey === COMPUTATIONAL_STATISTICS_MODULE_KEY || hasComputationalStatisticsSignature(courses)) {
        const variantOptions = buildComputationalStatisticsOptions(courses);
        if (!variantOptions.length) {
            return {
                isSplitModule: false,
                activeVariantId: null,
                selectedCourses: courses,
                allVariantCourses: courses,
                variantMeta: null,
                variantOptions: [],
            };
        }
        const chosen = variantOptions.find((opt) => opt.id === requestedVariantId) || variantOptions[0];
        const selectedCourses = Array.isArray(chosen?.courses) ? chosen.courses : [];
        return {
            isSplitModule: true,
            activeVariantId: chosen?.id || null,
            selectedCourses,
            allVariantCourses: [...new Map(courses.map((c) => [c.code, c])).values()],
            variantMeta: {
                moduleKey,
                variants: variantOptions.map((opt) => ({ id: opt.id, label: opt.label })),
            },
            variantOptions: variantOptions.map((opt) => ({ id: opt.id, label: opt.label })),
        };
    }

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
        variantOptions: variantMeta.variants,
    };
}
