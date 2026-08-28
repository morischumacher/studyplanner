/**
 * Modules a student satisfies in more than one way.
 *
 * A few bachelor modules are taught twice over: as a single combined course, or
 * as a lecture paired with an exercise. Both routes carry the same credit and
 * only one may be planned, so the module has to resolve to a set of courses
 * before anything can be placed on the canvas.
 *
 * The modules are recognised by name, and Computational Statistics also by the
 * course codes it is made of, because that module reaches the planner under
 * several names while its courses keep their codes.
 */

import type { CatalogueCourse, CatalogueModule } from "../types.ts";

/** One way of satisfying a split module. */
export interface VariantOption {
    id: string;
    label: string;
}

export interface VariantMeta {
    moduleKey: string;
    variants: VariantOption[];
}

export interface ModuleVariantResolution {
    isSplitModule: boolean;
    activeVariantId: string | null;
    /** The courses the chosen variant puts in the plan. */
    selectedCourses: CatalogueCourse[];
    /** Every course of the module, deduplicated, whichever variant is chosen. */
    allVariantCourses: CatalogueCourse[];
    variantMeta: VariantMeta | null;
    variantOptions?: VariantOption[];
}

interface CourseVariantOption extends VariantOption {
    courses: CatalogueCourse[];
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

const SPLIT_MODULES: Record<string, boolean> = {
    "algebra und diskrete mathematik": true,
    analysis: true,
    "statistik und wahrscheinlichkeitstheorie": true,
};
const COMPUTATIONAL_STATISTICS_MODULE_KEY = "computational statistics";

/** Which half of a lecture-plus-exercise module a course belongs to. */
function detectVariantPart(course: CatalogueCourse | null | undefined): "vu" | "vo" | "ue" | null {
    const code = normalizeText(course?.code);
    const name = normalizeText(course?.name);
    const type = normalizeText(course?.type);
    const full = `${code} ${name} ${type}`;
    if (/(^|\s)vu(\s|$)/.test(full) || code.includes("-vu") || type === "vu") return "vu";
    if (/(^|\s)vo(\s|$)/.test(full) || code.includes("-vo") || type === "vo") return "vo";
    if (/(^|\s)ue(\s|$)/.test(full) || code.includes("-ue") || type === "ue") return "ue";
    return null;
}

export function getSplitModuleVariantMeta(moduleName: string | null | undefined): VariantMeta | null {
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

/**
 * Computational Statistics is satisfied by any two of its three courses, so its
 * variants are the pairs rather than a lecture-and-exercise split.
 */
function buildComputationalStatisticsOptions(courses: CatalogueCourse[]): CourseVariantOption[] {
    const byCode = new Map((courses || []).map((c) => [normalizeText(c?.code), c]));
    const byName = new Map((courses || []).map((c) => [normalizeText(c?.name), c]));
    const resolve = (...aliases: string[]): CatalogueCourse | null => {
        for (const alias of aliases) {
            const k = normalizeText(alias);
            const byCodeMatch = byCode.get(k);
            if (byCodeMatch) return byCodeMatch;
            const byNameMatch = byName.get(k);
            if (byNameMatch) return byNameMatch;
        }
        return null;
    };

    const cstat = resolve("CSTAT-VU", "Computerstatistik");
    const scomp = resolve("SCOMP-VU", "Statistical Computing");
    const sim = resolve("SIM-VU", "Statistische Simulation und computerintensive Methoden");

    const variants: CourseVariantOption[] = [];
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

function hasComputationalStatisticsSignature(courses: CatalogueCourse[]): boolean {
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

export function resolveModuleVariantCourses(
    modulePayload: Pick<CatalogueModule, "name" | "courses"> | null | undefined,
    requestedVariantId: string | null = null
): ModuleVariantResolution {
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
        const selectedCourses = chosen && Array.isArray(chosen.courses) ? chosen.courses : [];
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
    // A module can be listed as split while the catalogue carries only one of
    // the two routes, and an empty selection would leave nothing to place.
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
