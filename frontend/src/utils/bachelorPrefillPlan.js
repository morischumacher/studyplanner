const BASELINE_PLAN = [
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

const FOCUS_ADDITIONS = {
    ai_ml: [
        { semester: 5, aliases: ["Einführung in Machine Learning"] },
    ],
    digital_health: [
        { semester: 5, aliases: ["Einführung in Visual Computing"], prefillFixedSemester: true },
        // Keep this in semester 5 for the prebuilt plan.
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

const FOCUS_EXCLUSIONS = {
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

const SUMMER_SWAP_MAP = {
    1: 2,
    2: 1,
    3: 4,
    4: 3,
    5: 6,
    6: 5,
};

const SUMMER_LOCKED_ALIAS_SET = new Set([
    "Wissenschaftliches Arbeiten",
    "Bachelorarbeit",
    "Bachelorarbeit für Informatik und Wirtschaftsinformatik",
].map((entry) => normalizeText(entry)));

const STRICT_FIXED_ALIAS_SEMESTER = new Map([
    [normalizeText("Einführung in die Programmierung 1"), 1],
    [normalizeText("Einführung in die Programmierung 2"), 2],
]);

const SUMMER_FIRST_SEMESTER_ALIAS_SET = new Set([
    "Algebra und Diskrete Mathematik für Informatik und Wirtschaftsinformatik (VU)",
    "Algebra und Diskrete Mathematik (VU)",
    "Algebra und Diskrete Mathematik",
].map((entry) => normalizeText(entry)));

function normalizeText(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function resolveFocusKey(selectedFocus) {
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

function flattenCatalogCourses(catalog) {
    const out = [];
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

function scoreMatch(entry, aliasNorm, desiredEcts = null) {
    let score = 0;
    if (entry._normCode === aliasNorm) score += 120;
    if (entry._normName === aliasNorm) score += 100;
    if (entry._normModule === aliasNorm) score += 80;
    if (desiredEcts != null && Number.isFinite(entry.ects) && Math.abs(entry.ects - desiredEcts) < 1e-6) score += 25;
    return score;
}

function findBestCourse(catalogEntries, aliases, desiredEcts, usedCodes) {
    let best = null;
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

function isSummerStart(startSeason) {
    return normalizeText(startSeason) === "summer";
}

function isSummerSwapLocked(aliases) {
    const list = Array.isArray(aliases) ? aliases : [];
    return list.some((alias) => SUMMER_LOCKED_ALIAS_SET.has(normalizeText(alias)));
}

function resolveStrictFixedSemester(aliases) {
    const list = Array.isArray(aliases) ? aliases : [];
    for (const alias of list) {
        const fixed = STRICT_FIXED_ALIAS_SEMESTER.get(normalizeText(alias));
        if (Number.isInteger(fixed)) return fixed;
    }
    return null;
}

function isSummerFirstSemesterLocked(aliases) {
    const list = Array.isArray(aliases) ? aliases : [];
    return list.some((alias) => SUMMER_FIRST_SEMESTER_ALIAS_SET.has(normalizeText(alias)));
}

function remapSemesterForStart(semester, aliases, startSeason) {
    const sem = Number(semester);
    if (!Number.isInteger(sem) || sem < 1) return sem;
    const strictFixed = resolveStrictFixedSemester(aliases);
    if (Number.isInteger(strictFixed)) return strictFixed;
    if (!isSummerStart(startSeason)) return sem;
    if (isSummerFirstSemesterLocked(aliases)) return 1;
    if (isSummerSwapLocked(aliases)) return sem;
    return SUMMER_SWAP_MAP[sem] || sem;
}

export function buildBachelorPrefillPlan(catalog, selectedFocus, options = {}) {
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
    const usedCodes = new Set();
    const plannedCourses = [];
    const missingAliases = [];

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
                ects: match.moduleEcts,
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
