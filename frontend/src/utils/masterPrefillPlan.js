function normalizeText(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const MASTER_TEMPLATE = [
    {
        semester: 1,
        aliases: ["Advanced Software Engineering"],
    },
    {
        semester: 1,
        aliases: ["Advanced Software Engineering Project"],
    },
];

function flattenCatalogCourses(catalog) {
    const out = [];
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

function findBestCourse(catalogEntries, aliases, usedCodes) {
    let best = null;
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
            if (score > bestScore) {
                best = entry;
                bestScore = score;
            }
        }
    }
    return best;
}

export function buildMasterPrefillPlan(catalog) {
    const catalogEntries = flattenCatalogCourses(catalog);
    const usedCodes = new Set();
    const plannedCourses = [];
    const missingAliases = [];

    for (const item of MASTER_TEMPLATE) {
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
