export function useDashboardMetrics({
    ruleCheckState,
    programCode,
    bachelorProgramCode,
    masterProgramCode,
    coursesBySemester,
    doneCourseCodes,
    plannerHydrated,
    dismissedInitialPrefillPrompt,
    minSemesterCount,
    selectedFocus,
    catalog,
    dashboardViewMode,
    stickyViolation,
    semesterLoadLimits,
    resolveDashboardCategoryForProgram,
    getExamSubjectForCode,
}) {
    const ruleOk = Boolean(ruleCheckState.response?.ok);
    const ruleStats = ruleCheckState.response?.stats ?? {};
    const isBachelorDashboard = programCode === bachelorProgramCode;
    const ectsStats = ruleStats?.ects ?? {};
    const allPlannedCourses = Object.values(coursesBySemester || {}).flat();
    const hasAnyPlannedOrDoneCourses = allPlannedCourses.length > 0 || (doneCourseCodes || []).length > 0;
    const shouldOfferInitialBachelorPrefill =
        plannerHydrated &&
        programCode === bachelorProgramCode &&
        !hasAnyPlannedOrDoneCourses &&
        !dismissedInitialPrefillPrompt;
    const shouldOfferInitialMasterPrefill =
        plannerHydrated &&
        programCode === masterProgramCode &&
        !hasAnyPlannedOrDoneCourses &&
        !dismissedInitialPrefillPrompt;
    const doneCodesSet = new Set(doneCourseCodes || []);
    const doneEctsKpi = allPlannedCourses
        .filter((c) => c?.code && doneCodesSet.has(c.code))
        .reduce((sum, c) => sum + Number(c?.ects || 0), 0);
    const remainingPlannedEctsKpi = allPlannedCourses
        .filter((c) => c?.code && !doneCodesSet.has(c.code))
        .reduce((sum, c) => sum + Number(c?.ects || 0), 0);
    // Planned dashboard should show all selected courses, even after marking some as done.
    const plannedEctsKpi = allPlannedCourses.reduce((sum, c) => sum + Number(c?.ects || 0), 0);
    const totalEctsKpi = plannedEctsKpi;
    const targetEctsKpi = isBachelorDashboard ? 180 : Number(ectsStats?.target_total ?? 120);
    const buckets = ruleStats?.buckets ?? {};
    const perSemester = isBachelorDashboard ? (ruleStats?.ectsPerSemester ?? {}) : (ruleStats?.per_semester ?? {});
    const byCategory = isBachelorDashboard ? (ruleStats?.ectsByCategory ?? {}) : (ruleStats?.by_category ?? {});
    const byExamSubject = isBachelorDashboard ? (ruleStats?.ectsByExamSubject ?? {}) : (ruleStats?.by_exam_subject ?? {});
    const bachelorTotalEcts = Number(ruleStats?.totalEcts ?? 0);
    const bachelorMissingTo180 = Number(ruleStats?.ectsMissingTo180 ?? 0);
    const bachelorNarrow = ruleStats?.narrowElectives ?? {};
    const bachelorFocus = ruleStats?.focus ?? {};
    const bachelorTransferableEcts = Number(byCategory?.transferable_skills ?? 0);
    const bachelorNarrowCompleted = Number(bachelorNarrow?.completedCount ?? 0);
    const bachelorNarrowRequired = Number(bachelorNarrow?.requiredCount ?? 7);
    const donePctKpi = targetEctsKpi > 0 ? Math.max(0, Math.min(100, (doneEctsKpi / targetEctsKpi) * 100)) : 0;
    const totalPctKpi = targetEctsKpi > 0 ? Math.max(0, Math.min(100, (totalEctsKpi / targetEctsKpi) * 100)) : 0;
    const renderKpiProgress = (pct, color) => (
        <div style={{ marginTop: 6, height: 6, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
            <div style={{ width: `${Math.max(0, Math.min(100, Number(pct) || 0))}%`, height: "100%", background: color }} />
        </div>
    );

    const normalizeSteopKey = (value) =>
        String(value || "")
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    const steopMandatoryTagByKey = {
        [normalizeSteopKey("Einführung in die Programmierung 1")]: "eidi1",
        [normalizeSteopKey("EIDI1-VU")]: "eidi1",
        [normalizeSteopKey("Mathematisches Arbeiten")]: "ma",
        [normalizeSteopKey("MA-VU")]: "ma",
        [normalizeSteopKey("Orientierung Informatik und Wirtschaftsinformatik")]: "ori",
        [normalizeSteopKey("ORI-VU")]: "ori",
    };

    const steopPoolKeys = new Set([
        "Algebra und Diskrete Mathematik",
        "Algebra und Diskrete Mathematik für Informatik und Wirtschaftsinformatik",
        "Algebra und Diskrete Mathematik für Informatik und Wirtschaftsinformatik (UE)",
        "Algebra und Diskrete Mathematik für Informatik und Wirtschaftsinformatik (VU)",
        "Analysis",
        "Analysis für Informatik und Wirtschaftsinformatik",
        "Analysis für Informatik und Wirtschaftsinformatik (UE)",
        "Analysis für Informatik und Wirtschaftsinformatik (VU)",
        "Denkweisen der Informatik",
        "Grundzüge digitaler Systeme",
        "ADM-VO",
        "ADM-UE",
        "ADM-VU",
        "ANL-VO",
        "ANL-UE",
        "ANL-VU",
        "DWI-VU",
        "GDS-VU",
    ].map(normalizeSteopKey));

    const steopMandatoryEctsByTag = { eidi1: 5.5, ma: 2.0, ori: 1.0 };
    const steopMandatoryRequiredEcts = 8.5;
    const steopPoolRequiredEcts = 8.0;
    const steopRequiredEcts = steopMandatoryRequiredEcts + steopPoolRequiredEcts;

    const steopCourseKeys = (course) => {
        const keys = new Set();
        const codeKey = normalizeSteopKey(course?.code);
        const nameKey = normalizeSteopKey(course?.name || course?.title);
        if (codeKey) keys.add(codeKey);
        if (nameKey) keys.add(nameKey);
        return keys;
    };

    const steopTagOfCourse = (course) => {
        for (const key of steopCourseKeys(course)) {
            const tag = steopMandatoryTagByKey[key];
            if (tag) return tag;
        }
        return null;
    };

    const isSteopPoolCourse = (course) => {
        for (const key of steopCourseKeys(course)) {
            if (steopPoolKeys.has(key)) return true;
        }
        return false;
    };

    const computeSteopProgress = (courses) => {
        const tags = new Set();
        let pool = 0;
        for (const c of courses || []) {
            const tag = steopTagOfCourse(c);
            if (tag) tags.add(tag);
            if (isSteopPoolCourse(c)) pool += Number(c?.ects || 0);
        }
        const mandatoryEcts = [...tags].reduce((sum, tag) => sum + Number(steopMandatoryEctsByTag[tag] ?? 0), 0);
        return {
            mandatoryEcts,
            poolEcts: pool,
            totalEcts: mandatoryEcts + pool,
            tags,
        };
    };

    const doneCoursesLocal = allPlannedCourses.filter((c) => c?.code && doneCodesSet.has(c.code));
    const steopDoneProgress = computeSteopProgress(doneCoursesLocal);
    const steopPlannedProgress = computeSteopProgress(allPlannedCourses);
    const steopMandatoryDoneEcts = steopDoneProgress.mandatoryEcts;
    const steopPoolDoneEcts = steopDoneProgress.poolEcts;
    const steopDoneEcts = steopMandatoryDoneEcts + steopPoolDoneEcts;
    const steopMandatoryPlannedEcts = steopPlannedProgress.mandatoryEcts;
    const steopPoolPlannedEcts = steopPlannedProgress.poolEcts;
    const steopPlannedEcts = steopMandatoryPlannedEcts + steopPoolPlannedEcts;
    const steopDonePct = steopRequiredEcts > 0 ? Math.max(0, Math.min(100, (steopDoneEcts / steopRequiredEcts) * 100)) : 0;
    const steopPlannedPct = steopRequiredEcts > 0 ? Math.max(0, Math.min(100, (steopPlannedEcts / steopRequiredEcts) * 100)) : 0;
    const bachelorSteopComplete =
        steopDoneProgress.tags.has("eidi1") &&
        steopDoneProgress.tags.has("ma") &&
        steopDoneProgress.tags.has("ori") &&
        steopPoolDoneEcts >= steopPoolRequiredEcts - 1e-6;
    const bachelorSteopPlannedComplete =
        steopPlannedProgress.tags.has("eidi1") &&
        steopPlannedProgress.tags.has("ma") &&
        steopPlannedProgress.tags.has("ori") &&
        steopPoolPlannedEcts >= steopPoolRequiredEcts - 1e-6;

    const doneSteopKeySet = (() => {
        const out = new Set();
        for (const c of doneCoursesLocal) {
            for (const key of steopCourseKeys(c)) out.add(key);
        }
        return out;
    })();

    const steopMandatoryChecklist = [
        { key: "eidi1", label: "Einführung in die Programmierung 1 (5.5 ECTS)" },
        { key: "ma", label: "Mathematisches Arbeiten (2.0 ECTS)" },
        { key: "ori", label: "Orientierung Informatik und Wirtschaftsinformatik (1.0 ECTS)" },
    ].map((row) => ({ ...row, done: steopDoneProgress.tags.has(row.key) }));
    const steopMandatoryChecklistPlanned = [
        { key: "eidi1", label: "Einführung in die Programmierung 1 (5.5 ECTS)" },
        { key: "ma", label: "Mathematisches Arbeiten (2.0 ECTS)" },
        { key: "ori", label: "Orientierung Informatik und Wirtschaftsinformatik (1.0 ECTS)" },
    ].map((row) => ({ ...row, done: steopPlannedProgress.tags.has(row.key) }));

    const steopPoolChecklist = [
        {
            label: "Algebra und Diskrete Mathematik",
            keys: [
                "Algebra und Diskrete Mathematik",
                "Algebra und Diskrete Mathematik für Informatik und Wirtschaftsinformatik",
                "Algebra und Diskrete Mathematik für Informatik und Wirtschaftsinformatik (UE)",
                "Algebra und Diskrete Mathematik für Informatik und Wirtschaftsinformatik (VU)",
                "ADM-VO",
                "ADM-UE",
                "ADM-VU",
            ],
        },
        {
            label: "Analysis",
            keys: [
                "Analysis",
                "Analysis für Informatik und Wirtschaftsinformatik",
                "Analysis für Informatik und Wirtschaftsinformatik (UE)",
                "Analysis für Informatik und Wirtschaftsinformatik (VU)",
                "ANL-VO",
                "ANL-UE",
                "ANL-VU",
            ],
        },
        { label: "Denkweisen der Informatik", keys: ["Denkweisen der Informatik", "DWI-VU"] },
        { label: "Grundzüge digitaler Systeme", keys: ["Grundzüge digitaler Systeme", "GDS-VU"] },
    ].map((row) => ({
        ...row,
        done: row.keys.some((k) => doneSteopKeySet.has(normalizeSteopKey(k))),
    }));
    const plannedSteopKeySet = (() => {
        const out = new Set();
        for (const c of allPlannedCourses) {
            for (const key of steopCourseKeys(c)) out.add(key);
        }
        return out;
    })();
    const steopPoolChecklistPlanned = [
        {
            label: "Algebra und Diskrete Mathematik",
            keys: [
                "Algebra und Diskrete Mathematik",
                "Algebra und Diskrete Mathematik für Informatik und Wirtschaftsinformatik",
                "Algebra und Diskrete Mathematik für Informatik und Wirtschaftsinformatik (UE)",
                "Algebra und Diskrete Mathematik für Informatik und Wirtschaftsinformatik (VU)",
                "ADM-VO",
                "ADM-UE",
                "ADM-VU",
            ],
        },
        {
            label: "Analysis",
            keys: [
                "Analysis",
                "Analysis für Informatik und Wirtschaftsinformatik",
                "Analysis für Informatik und Wirtschaftsinformatik (UE)",
                "Analysis für Informatik und Wirtschaftsinformatik (VU)",
                "ANL-VO",
                "ANL-UE",
                "ANL-VU",
            ],
        },
        { label: "Denkweisen der Informatik", keys: ["Denkweisen der Informatik", "DWI-VU"] },
        { label: "Grundzüge digitaler Systeme", keys: ["Grundzüge digitaler Systeme", "GDS-VU"] },
    ].map((row) => ({
        ...row,
        done: row.keys.some((k) => plannedSteopKeySet.has(normalizeSteopKey(k))),
    }));

    let bachelorSteopLane = null;
    if (doneCoursesLocal.length > 0) {
        const doneByLane = new Map();
        for (const c of doneCoursesLocal) {
            const li = Number.isFinite(c?.laneIndex) ? c.laneIndex : 0;
            if (!doneByLane.has(li)) doneByLane.set(li, []);
            doneByLane.get(li).push(c);
        }
        const cumTags = new Set();
        let cumPool = 0;
        for (const li of [...doneByLane.keys()].sort((a, b) => a - b)) {
            for (const c of doneByLane.get(li)) {
                const tag = steopTagOfCourse(c);
                if (tag) cumTags.add(tag);
                if (isSteopPoolCourse(c)) cumPool += Number(c?.ects || 0);
            }
            if (cumTags.has("eidi1") && cumTags.has("ma") && cumTags.has("ori") && cumPool >= steopPoolRequiredEcts - 1e-6) {
                bachelorSteopLane = li;
                break;
            }
        }
    }
    let bachelorSteopPlannedLane = null;
    if (allPlannedCourses.length > 0) {
        const plannedByLane = new Map();
        for (const c of allPlannedCourses) {
            const li = Number.isFinite(c?.laneIndex) ? c.laneIndex : 0;
            if (!plannedByLane.has(li)) plannedByLane.set(li, []);
            plannedByLane.get(li).push(c);
        }
        const cumTags = new Set();
        let cumPool = 0;
        for (const li of [...plannedByLane.keys()].sort((a, b) => a - b)) {
            for (const c of plannedByLane.get(li)) {
                const tag = steopTagOfCourse(c);
                if (tag) cumTags.add(tag);
                if (isSteopPoolCourse(c)) cumPool += Number(c?.ects || 0);
            }
            if (cumTags.has("eidi1") && cumTags.has("ma") && cumTags.has("ori") && cumPool >= steopPoolRequiredEcts - 1e-6) {
                bachelorSteopPlannedLane = li;
                break;
            }
        }
    }

    const examSubjectProgress = (() => {
        const rows = new Map();
        for (const c of allPlannedCourses || []) {
            const subject =
                c?.examSubject ||
                c?.module?.examSubject ||
                getExamSubjectForCode(catalog, c?.code) ||
                "(none)";
            if (!rows.has(subject)) {
                rows.set(subject, { subject, doneCount: 0, plannedCount: 0, doneEcts: 0, plannedEcts: 0 });
            }
            const row = rows.get(subject);
            const ects = Number(c?.ects || 0);
            if (c?.code && doneCodesSet.has(c.code)) {
                row.doneCount += 1;
                row.doneEcts += ects;
            } else {
                row.plannedCount += 1;
                row.plannedEcts += ects;
            }
        }
        return [...rows.values()]
            .map((row) => ({ ...row, totalCount: row.doneCount + row.plannedCount, totalEcts: row.doneEcts + row.plannedEcts }))
            .sort((a, b) => String(a?.subject || "").localeCompare(String(b?.subject || "")));
    })();

    const examSubjectDoneEctsTotal = examSubjectProgress.reduce((sum, row) => sum + Number(row?.doneEcts || 0), 0);
    const examSubjectTotalEctsTotal = examSubjectProgress.reduce((sum, row) => sum + Number(row?.totalEcts || 0), 0);
    const examSubjectTotalDoneCount = examSubjectProgress.reduce((sum, row) => sum + Number(row?.doneCount || 0), 0);
    const examSubjectTotalCourseCount = examSubjectProgress.reduce((sum, row) => sum + Number(row?.totalCount || 0), 0);
    const examSubjectAggregatePct = examSubjectTotalEctsTotal > 0
        ? Math.max(0, Math.min(100, (examSubjectDoneEctsTotal / examSubjectTotalEctsTotal) * 100))
        : 0;

    const perSemesterRows = (() => {
        const bySemester = new Map();
        const bySem = coursesBySemester && typeof coursesBySemester === "object" ? coursesBySemester : {};
        for (const [semesterKey, list] of Object.entries(bySem)) {
            const sem = Number(semesterKey);
            if (!Number.isFinite(sem) || sem < 1) continue;
            const safeList = Array.isArray(list) ? list : [];
            const ects = safeList.reduce((sum, c) => sum + Number(c?.ects || 0), 0);
            if (ects <= 0) continue;
            bySemester.set(sem, ects);
        }
        return [...bySemester.entries()]
            .map(([sem, ects]) => ({ sem: Number(sem), ects: Number(ects || 0) }))
            .sort((a, b) => a.sem - b.sem);
    })();

    const donePerSemesterRows = (() => {
        const bySemester = new Map();
        const bySem = coursesBySemester && typeof coursesBySemester === "object" ? coursesBySemester : {};
        for (const [semesterKey, list] of Object.entries(bySem)) {
            const sem = Number(semesterKey);
            if (!Number.isFinite(sem) || sem < 1) continue;
            const safeList = Array.isArray(list) ? list : [];
            const doneEcts = safeList.reduce((sum, c) => {
                const code = c?.code;
                if (!code || !doneCodesSet.has(code)) return sum;
                return sum + Number(c?.ects || 0);
            }, 0);
            if (doneEcts <= 0) continue;
            bySemester.set(sem, doneEcts);
        }
        return [...bySemester.entries()]
            .map(([sem, ects]) => ({ sem: Number(sem), ects: Number(ects || 0) }))
            .sort((a, b) => a.sem - b.sem);
    })();

    const donePerSemesterTotal = donePerSemesterRows.reduce((sum, row) => sum + Number(row?.ects || 0), 0);
    const perSemesterPlannedTotal = perSemesterRows.reduce((sum, row) => sum + Number(row?.ects || 0), 0);
    const maxSemesterEcts = (() => {
        const parsed = Number(semesterLoadLimits?.maxEctsPerSemester);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
        const fallbackFromStats = Number(ruleStats?.maxEctsPerSemester);
        if (Number.isFinite(fallbackFromStats) && fallbackFromStats > 0) return fallbackFromStats;
        return 42;
    })();
    const workloadTargetPerSemester = (() => {
        const parsed = Number(semesterLoadLimits?.recommendedEctsPerSemester);
        if (Number.isFinite(parsed) && parsed > 0) return Math.min(parsed, maxSemesterEcts);
        const fallbackFromStats = Number(ruleStats?.recommendedEctsPerSemester);
        if (Number.isFinite(fallbackFromStats) && fallbackFromStats > 0) return Math.min(fallbackFromStats, maxSemesterEcts);
        return 30;
    })();
    const perSemesterWithinDesiredWorkload = perSemesterRows.every(
        (row) => Number(row?.ects || 0) <= workloadTargetPerSemester + 1e-6
    );
    const baselineWorkloadScale = maxSemesterEcts;
    const maxSemesterWorkloadForScale = Math.max(maxSemesterEcts, 1);
    const donePerSemesterWithinDesiredWorkload = donePerSemesterRows.every(
        (row) => Number(row?.ects || 0) <= workloadTargetPerSemester + 1e-6
    );
    const maxDoneSemesterWorkloadForScale = Math.max(maxSemesterEcts, 1);

    const byCategoryRows = (() => {
        const byCategoryMap = new Map();
        for (const c of allPlannedCourses || []) {
            const category = resolveDashboardCategoryForProgram(c, programCode);
            const prev = Number(byCategoryMap.get(category) || 0);
            byCategoryMap.set(category, prev + Number(c?.ects || 0));
        }
        return [...byCategoryMap.entries()]
            .map(([category, ects]) => ({ category, ects: Number(ects || 0) }))
            .filter((row) => row.ects > 0)
            .sort((a, b) => b.ects - a.ects);
    })();
    const byCategoryTotalEcts = byCategoryRows.reduce((sum, row) => sum + row.ects, 0);
    const topByCategoryRow = byCategoryRows.length > 0 ? byCategoryRows[0] : null;

    const donePerCategoryProgressRows = (() => {
        const plannedMap = new Map();
        for (const c of allPlannedCourses || []) {
            const category = resolveDashboardCategoryForProgram(c, programCode);
            const prev = Number(plannedMap.get(category) || 0);
            plannedMap.set(category, prev + Number(c?.ects || 0));
        }
        const doneMap = new Map();
        for (const c of doneCoursesLocal || []) {
            const category = resolveDashboardCategoryForProgram(c, programCode);
            const prev = Number(doneMap.get(category) || 0);
            doneMap.set(category, prev + Number(c?.ects || 0));
        }
        const keys = new Set([...plannedMap.keys(), ...doneMap.keys()]);
        return [...keys]
            .map((category) => {
                const plannedEcts = Number(plannedMap.get(category) || 0);
                const doneEcts = Number(doneMap.get(category) || 0);
                const pct = plannedEcts > 0
                    ? Math.max(0, Math.min(100, (doneEcts / plannedEcts) * 100))
                    : 0;
                return { category, plannedEcts, doneEcts, pct };
            })
            .filter((row) => row.plannedEcts > 0 || row.doneEcts > 0)
            .sort((a, b) => {
                if (b.plannedEcts !== a.plannedEcts) return b.plannedEcts - a.plannedEcts;
                if (b.doneEcts !== a.doneEcts) return b.doneEcts - a.doneEcts;
                return String(a.category).localeCompare(String(b.category));
            });
    })();

    const donePerCategoryPlannedTotalEcts = donePerCategoryProgressRows.reduce((sum, row) => sum + Number(row?.plannedEcts || 0), 0);
    const donePerCategoryDoneTotalEcts = donePerCategoryProgressRows.reduce((sum, row) => sum + Number(row?.doneEcts || 0), 0);
    const donePerCategoryCompleteCount = donePerCategoryProgressRows.filter(
        (row) => Number(row?.plannedEcts || 0) > 0 && Number(row?.doneEcts || 0) >= Number(row?.plannedEcts || 0) - 1e-6
    ).length;

    const warnings = Array.isArray(ruleStats?.warnings) ? ruleStats.warnings : [];
    const normalizeFocusKey = (value) =>
        String(value || "")
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    const moduleTitleByCourseCodeForFocus = (() => {
        const out = new Map();
        for (const pf of catalog || []) {
            for (const mod of pf?.modules || []) {
                const moduleTitle = mod?.name || mod?.code || null;
                if (!moduleTitle) continue;
                for (const c of mod?.courses || []) {
                    if (c?.code) out.set(c.code, moduleTitle);
                }
            }
        }
        return out;
    })();

    const doneModuleTitleSetForFocus = (() => {
        const out = new Set();
        for (const course of doneCoursesLocal || []) {
            const moduleTitle =
                course?.module?.title ||
                course?.moduleMeta?.title ||
                course?.moduleMeta?.name ||
                moduleTitleByCourseCodeForFocus.get(course?.code) ||
                null;
            if (!moduleTitle) continue;
            out.add(normalizeFocusKey(moduleTitle));
        }
        return out;
    })();
    const plannedModuleTitleSetForFocus = (() => {
        const out = new Set();
        for (const course of allPlannedCourses || []) {
            const moduleTitle =
                course?.module?.title ||
                course?.moduleMeta?.title ||
                course?.moduleMeta?.name ||
                moduleTitleByCourseCodeForFocus.get(course?.code) ||
                null;
            if (!moduleTitle) continue;
            out.add(normalizeFocusKey(moduleTitle));
        }
        return out;
    })();

    const focusChecklistRaw = Array.isArray(bachelorFocus?.checklist) ? bachelorFocus.checklist : [];
    const focusChecklist = focusChecklistRaw.map((item) => ({
        ...item,
        // Done dashboard should reflect actually completed modules only.
        done: doneModuleTitleSetForFocus.has(normalizeFocusKey(item?.label)),
    }));
    const focusChecklistPlanned = focusChecklistRaw.map((item) => ({
        ...item,
        done: plannedModuleTitleSetForFocus.has(normalizeFocusKey(item?.label)),
    }));
    const focusChecklistDoneCount = focusChecklist.filter((item) => Boolean(item?.done)).length;
    const focusChecklistTotalCount = focusChecklist.length;
    const focusRequiredItems = focusChecklist.filter((item) => item?.kind === "required");
    const focusChooseItems = focusChecklist.filter((item) => item?.kind === "choose");
    const focusChooseSummaryRaw = bachelorFocus?.choose ?? null;
    const focusChooseSummary = focusChooseSummaryRaw
        ? {
            ...focusChooseSummaryRaw,
            done: focusChooseItems.filter((item) => Boolean(item?.done)).length,
        }
        : null;
    const focusChooseGroupsSummaryRaw = Array.isArray(bachelorFocus?.chooseGroups) ? bachelorFocus.chooseGroups : [];
    const focusChooseGroupsSummary = focusChooseGroupsSummaryRaw.map((row) => {
        const groupLabel = String(row?.label || "");
        const done = focusChecklist.filter(
            (item) =>
                item?.kind === "choose_group" &&
                String(item?.group || "") === groupLabel &&
                Boolean(item?.done)
        ).length;
        return { ...row, done };
    });
    const focusChooseSummaryPlanned = focusChooseSummaryRaw
        ? {
            ...focusChooseSummaryRaw,
            done: focusChecklistPlanned.filter((item) => item?.kind === "choose" && Boolean(item?.done)).length,
        }
        : null;
    const focusChooseGroupsSummaryPlanned = focusChooseGroupsSummaryRaw.map((row) => {
        const groupLabel = String(row?.label || "");
        const done = focusChecklistPlanned.filter(
            (item) =>
                item?.kind === "choose_group" &&
                String(item?.group || "") === groupLabel &&
                Boolean(item?.done)
        ).length;
        return { ...row, done };
    });

    const focusChooseGroupRows = (() => {
        const byGroup = new Map();
        for (const item of focusChecklist) {
            if (item?.kind !== "choose_group") continue;
            const label = String(item?.group || "Option group");
            if (!byGroup.has(label)) byGroup.set(label, []);
            byGroup.get(label).push(item);
        }
        return [...byGroup.entries()].map(([groupLabel, items]) => {
            const summary = focusChooseGroupsSummary.find((row) => String(row?.label || "") === groupLabel) || null;
            return { groupLabel, items, summary };
        });
    })();

    const focusRequiredDoneCount = focusRequiredItems.filter((item) => Boolean(item?.done)).length;
    const focusRequiredNeedCount = focusRequiredItems.length;
    const focusChooseNeedCount = Number(focusChooseSummary?.min || 0);
    const focusChooseDoneCount = Math.min(Number(focusChooseSummary?.done || 0), focusChooseNeedCount);
    const focusChooseGroupsNeedCount = focusChooseGroupsSummary.reduce((sum, row) => sum + Number(row?.min || 0), 0);
    const focusChooseGroupsDoneCount = focusChooseGroupsSummary.reduce(
        (sum, row) => sum + Math.min(Number(row?.done || 0), Number(row?.min || 0)),
        0
    );
    const focusRequirementDoneCount = focusRequiredDoneCount + focusChooseDoneCount + focusChooseGroupsDoneCount;
    const focusRequirementTotalCount = focusRequiredNeedCount + focusChooseNeedCount + focusChooseGroupsNeedCount;
    const focusChecklistPct = focusRequirementTotalCount > 0
        ? Math.max(0, Math.min(100, (focusRequirementDoneCount / focusRequirementTotalCount) * 100))
        : 0;
    const focusRequiredItemsPlanned = focusChecklistPlanned.filter((item) => item?.kind === "required");
    const focusChooseItemsPlanned = focusChecklistPlanned.filter((item) => item?.kind === "choose");
    const focusChooseGroupRowsPlanned = (() => {
        const byGroup = new Map();
        for (const item of focusChecklistPlanned) {
            if (item?.kind !== "choose_group") continue;
            const label = String(item?.group || "Option group");
            if (!byGroup.has(label)) byGroup.set(label, []);
            byGroup.get(label).push(item);
        }
        return [...byGroup.entries()].map(([groupLabel, items]) => {
            const summary = focusChooseGroupsSummaryPlanned.find((row) => String(row?.label || "") === groupLabel) || null;
            return { groupLabel, items, summary };
        });
    })();
    const focusRequiredDoneCountPlanned = focusRequiredItemsPlanned.filter((item) => Boolean(item?.done)).length;
    const focusRequiredNeedCountPlanned = focusRequiredItemsPlanned.length;
    const focusChooseNeedCountPlanned = Number(focusChooseSummaryPlanned?.min || 0);
    const focusChooseDoneCountPlanned = Math.min(Number(focusChooseSummaryPlanned?.done || 0), focusChooseNeedCountPlanned);
    const focusChooseGroupsNeedCountPlanned = focusChooseGroupsSummaryPlanned.reduce((sum, row) => sum + Number(row?.min || 0), 0);
    const focusChooseGroupsDoneCountPlanned = focusChooseGroupsSummaryPlanned.reduce(
        (sum, row) => sum + Math.min(Number(row?.done || 0), Number(row?.min || 0)),
        0
    );
    const focusRequirementDoneCountPlanned = focusRequiredDoneCountPlanned + focusChooseDoneCountPlanned + focusChooseGroupsDoneCountPlanned;
    const focusRequirementTotalCountPlanned = focusRequiredNeedCountPlanned + focusChooseNeedCountPlanned + focusChooseGroupsNeedCountPlanned;
    const focusChecklistPctPlanned = focusRequirementTotalCountPlanned > 0
        ? Math.max(0, Math.min(100, (focusRequirementDoneCountPlanned / focusRequirementTotalCountPlanned) * 100))
        : 0;
    const bachelorFocusMissingCount = Math.max(0, focusRequirementTotalCount - focusRequirementDoneCount);
    const bachelorFocusComplete =
        Boolean(selectedFocus) &&
        Boolean(bachelorFocus?.recognized) &&
        focusRequirementTotalCount > 0 &&
        bachelorFocusMissingCount === 0;
    const bachelorFocusMissingCountPlanned = Math.max(0, focusRequirementTotalCountPlanned - focusRequirementDoneCountPlanned);
    const bachelorFocusCompletePlanned =
        Boolean(selectedFocus) &&
        Boolean(bachelorFocus?.recognized) &&
        focusRequirementTotalCountPlanned > 0 &&
        bachelorFocusMissingCountPlanned === 0;

    const bachelorModuleProgress = Array.isArray(ruleStats?.moduleProgress) ? ruleStats.moduleProgress : [];
    const bachelorThesisHave = Number(
        (
            bachelorModuleProgress.find((m) => normalizeSteopKey(m?.title) === normalizeSteopKey("Bachelorarbeit"))
                ?.haveEcts
        ) ?? 0
    );

    const masterModuleProgress = (() => {
        if (isBachelorDashboard) return [];
        const moduleTitleByCourseCode = new Map();
        const requiredEctsByModuleTitle = new Map();
        for (const pf of catalog || []) {
            for (const mod of pf?.modules || []) {
                const title = mod?.name || mod?.code;
                if (!title) continue;
                const req = Number(mod?.ects);
                if (Number.isFinite(req) && req > 0 && !requiredEctsByModuleTitle.has(title)) {
                    requiredEctsByModuleTitle.set(title, req);
                }
                for (const c of mod?.courses || []) {
                    if (c?.code) moduleTitleByCourseCode.set(c.code, title);
                }
            }
        }
        const haveByModuleTitle = new Map();
        for (const c of allPlannedCourses || []) {
            const title = c?.module?.title || moduleTitleByCourseCode.get(c?.code) || null;
            if (!title) continue;
            const prev = haveByModuleTitle.get(title) || 0;
            haveByModuleTitle.set(title, prev + Number(c?.ects || 0));
        }
        return [...haveByModuleTitle.entries()]
            .map(([title, have]) => ({
                title,
                requiredEcts: Number(requiredEctsByModuleTitle.get(title) || 0),
                haveEcts: Number(have || 0),
                complete: Number(requiredEctsByModuleTitle.get(title) || 0) > 0
                    ? Number(have || 0) >= Number(requiredEctsByModuleTitle.get(title)) - 1e-6
                    : false,
            }))
            .sort((a, b) => String(a?.title || "").localeCompare(String(b?.title || "")));
    })();

    const moduleProgressForDashboard = isBachelorDashboard
        ? bachelorModuleProgress
            .filter((m) => Number(m?.haveEcts || 0) > 0)
            .map((m) => ({
                title: m?.title || "Module",
                requiredEcts: Number(m?.requiredEcts || 0),
                haveEcts: Number(m?.haveEcts || 0),
                complete: Boolean(m?.complete),
            }))
        : masterModuleProgress.filter((m) => Number(m?.haveEcts || 0) > 0);

    const requirementItems = isBachelorDashboard
        ? [
            {
                label: "Total ECTS",
                have: Number(bachelorTotalEcts || totalEctsKpi),
                need: 180,
                fulfilled: Number(bachelorTotalEcts || totalEctsKpi) >= 180 - 1e-6,
            },
            {
                label: "Transferable Skills ECTS",
                have: Number(bachelorTransferableEcts || 0),
                need: 6,
                fulfilled: Number(bachelorTransferableEcts || 0) >= 6 - 1e-6,
            },
            {
                label: "Narrow Elective Modules",
                have: Number(bachelorNarrowCompleted || 0),
                need: Number(bachelorNarrowRequired || 7),
                fulfilled: Number(bachelorNarrowCompleted || 0) >= Number(bachelorNarrowRequired || 7),
            },
            {
                label: "Bachelor Thesis ECTS",
                have: Number(bachelorThesisHave || 0),
                need: 13,
                fulfilled: Number(bachelorThesisHave || 0) >= 13 - 1e-6,
            },
            ...(selectedFocus
                ? [{
                    label: "Selected Focus Area",
                    have: bachelorFocusComplete ? 1 : 0,
                    need: 1,
                    fulfilled: Boolean(bachelorFocusComplete),
                }]
                : []),
        ]
        : [
            {
                label: "Total ECTS",
                have: Number(totalEctsKpi || 0),
                need: 120,
                fulfilled: Number(totalEctsKpi || 0) >= 120 - 1e-6,
            },
            {
                label: "Subject Modules (excl. free)",
                have: Number(buckets?.subject_modules_excl_free ?? 0),
                need: 81,
                fulfilled: Number(buckets?.subject_modules_excl_free ?? 0) >= 81 - 1e-6,
            },
            {
                label: "Transferable Skills ECTS",
                have: Number(buckets?.transferable_skills ?? 0),
                need: 4.5,
                fulfilled: Number(buckets?.transferable_skills ?? 0) >= 4.5 - 1e-6,
            },
            {
                label: "Diploma ECTS",
                have: Number(buckets?.diploma_total ?? 0),
                need: 30,
                fulfilled: Number(buckets?.diploma_total ?? 0) >= 30 - 1e-6,
            },
        ];

    const fulfilledRequirementsCount = requirementItems.filter((r) => r?.fulfilled).length;
    const totalRequirementsCount = requirementItems.length;
    const requirementsPct = totalRequirementsCount > 0
        ? (fulfilledRequirementsCount / totalRequirementsCount) * 100
        : 0;

    const plannedEctsByExamSubjectRows = (() => {
        const bySubject = new Map();
        for (const c of allPlannedCourses || []) {
            if (!c?.code) continue;
            const subject =
                c?.examSubject ||
                c?.module?.examSubject ||
                getExamSubjectForCode(catalog, c?.code) ||
                "(none)";
            const prev = bySubject.get(subject) || 0;
            bySubject.set(subject, prev + Number(c?.ects || 0));
        }
        return [...bySubject.entries()]
            .map(([subject, ects]) => ({ subject, ects: Number(ects || 0) }))
            .sort((a, b) => String(a?.subject || "").localeCompare(String(b?.subject || "")));
    })();

    const plannedEctsByExamSubjectTotal = plannedEctsByExamSubjectRows.reduce((sum, row) => sum + Number(row?.ects || 0), 0);
    const violations = Array.isArray(ruleStats?.violations) ? ruleStats.violations : [];
    const missingItems = Array.isArray(ruleCheckState.response?.missing) ? ruleCheckState.response.missing : [];
    const hasMissingRequirements = missingItems.length > 0;
    const hasWarnings = warnings.length > 0;
    const plannedChecklistComplete = missingItems.length === 0;
    const doneChecklistComplete = plannedChecklistComplete && remainingPlannedEctsKpi <= 0.0001 && donePctKpi >= 100 - 1e-6;

    const getDashboardModeButtonStyle = (mode) => {
        const isActive = dashboardViewMode === mode;
        const isComplete = mode === "planning" ? plannedChecklistComplete : doneChecklistComplete;
        const borderColor = isComplete ? "#16a34a" : "#dc2626";
        const activeBg = isComplete ? "#16a34a" : "#dc2626";
        const inactiveBg = isComplete ? "#dcfce7" : "#fee2e2";
        const inactiveText = isComplete ? "#166534" : "#991b1b";
        return {
            border: `1px solid ${borderColor}`,
            background: isActive ? activeBg : inactiveBg,
            color: isActive ? "#ffffff" : inactiveText,
            borderRadius: 8,
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isActive ? 1 : 0.68,
            boxShadow: isActive ? `0 0 0 2px ${isComplete ? "rgba(22,163,74,0.2)" : "rgba(220,38,38,0.2)"}` : "none",
            transition: "all 140ms ease",
        };
    };

    const stickyActive = Boolean(stickyViolation?.message) && Date.now() < (stickyViolation?.until || 0);
    const feedbackText = stickyActive
        ? stickyViolation.message
        : (ruleCheckState.sending
        ? "Checking rules..."
        : (ruleCheckState.error
            ? `Rule check error: ${ruleCheckState.error}`
            : (ruleCheckState.response
                ? (ruleCheckState.response?.message ?? "Rule check updated")
                : "No rule check response yet")));
    const feedbackBg = stickyActive
        ? (stickyViolation?.tone === "success" ? "#dcfce7" : "#fee2e2")
        : (ruleCheckState.sending ? "#dbeafe" : (ruleCheckState.error ? "#fee2e2" : (ruleOk ? "#dcfce7" : "#f3f4f6")));
    const feedbackBorder = stickyActive
        ? (stickyViolation?.tone === "success" ? "#86efac" : "#fca5a5")
        : (ruleCheckState.sending ? "#93c5fd" : (ruleCheckState.error ? "#fca5a5" : (ruleOk ? "#86efac" : "#d1d5db")));
    const feedbackColor = stickyActive
        ? (stickyViolation?.tone === "success" ? "#166534" : "#991b1b")
        : (ruleCheckState.sending ? "#1d4ed8" : (ruleCheckState.error ? "#991b1b" : (ruleOk ? "#166534" : "#374151")));

    return {
        ruleOk,
        ruleStats,
        isBachelorDashboard,
        ectsStats,
        allPlannedCourses,
        hasAnyPlannedOrDoneCourses,
        shouldOfferInitialBachelorPrefill,
        shouldOfferInitialMasterPrefill,
        doneCodesSet,
        doneEctsKpi,
        plannedEctsKpi,
        totalEctsKpi,
        targetEctsKpi,
        buckets,
        perSemester,
        byCategory,
        byExamSubject,
        bachelorTotalEcts,
        bachelorMissingTo180,
        bachelorNarrow,
        bachelorFocus,
        bachelorTransferableEcts,
        bachelorNarrowCompleted,
        bachelorNarrowRequired,
        donePctKpi,
        totalPctKpi,
        renderKpiProgress,
        steopMandatoryRequiredEcts,
        steopPoolRequiredEcts,
        steopRequiredEcts,
        doneCoursesLocal,
        steopDoneProgress,
        steopMandatoryDoneEcts,
        steopPoolDoneEcts,
        steopDoneEcts,
        steopDonePct,
        steopMandatoryPlannedEcts,
        steopPoolPlannedEcts,
        steopPlannedEcts,
        steopPlannedPct,
        bachelorSteopComplete,
        bachelorSteopPlannedComplete,
        steopMandatoryChecklist,
        steopPoolChecklist,
        steopMandatoryChecklistPlanned,
        steopPoolChecklistPlanned,
        bachelorSteopLane,
        bachelorSteopPlannedLane,
        examSubjectProgress,
        examSubjectDoneEctsTotal,
        examSubjectTotalEctsTotal,
        examSubjectTotalDoneCount,
        examSubjectTotalCourseCount,
        examSubjectAggregatePct,
        perSemesterRows,
        donePerSemesterRows,
        donePerSemesterTotal,
        perSemesterPlannedTotal,
        workloadTargetPerSemester,
        perSemesterWithinDesiredWorkload,
        baselineWorkloadScale,
        maxSemesterWorkloadForScale,
        donePerSemesterWithinDesiredWorkload,
        maxDoneSemesterWorkloadForScale,
        byCategoryRows,
        byCategoryTotalEcts,
        topByCategoryRow,
        donePerCategoryProgressRows,
        donePerCategoryPlannedTotalEcts,
        donePerCategoryDoneTotalEcts,
        donePerCategoryCompleteCount,
        warnings,
        bachelorFocusMissingCount,
        bachelorFocusComplete,
        bachelorFocusMissingCountPlanned,
        bachelorFocusCompletePlanned,
        focusChecklist,
        focusChecklistPlanned,
        focusChecklistDoneCount,
        focusChecklistTotalCount,
        focusRequiredItems,
        focusChooseItems,
        focusChooseSummary,
        focusChooseGroupsSummary,
        focusChooseGroupRows,
        focusRequiredItemsPlanned,
        focusChooseItemsPlanned,
        focusChooseSummaryPlanned,
        focusChooseGroupsSummaryPlanned,
        focusChooseGroupRowsPlanned,
        focusRequiredDoneCount,
        focusRequiredNeedCount,
        focusChooseNeedCount,
        focusChooseDoneCount,
        focusChooseGroupsNeedCount,
        focusChooseGroupsDoneCount,
        focusRequiredDoneCountPlanned,
        focusRequiredNeedCountPlanned,
        focusChooseNeedCountPlanned,
        focusChooseDoneCountPlanned,
        focusChooseGroupsNeedCountPlanned,
        focusChooseGroupsDoneCountPlanned,
        focusRequirementDoneCount,
        focusRequirementTotalCount,
        focusChecklistPct,
        focusRequirementDoneCountPlanned,
        focusRequirementTotalCountPlanned,
        focusChecklistPctPlanned,
        bachelorModuleProgress,
        bachelorThesisHave,
        masterModuleProgress,
        moduleProgressForDashboard,
        requirementItems,
        fulfilledRequirementsCount,
        totalRequirementsCount,
        requirementsPct,
        plannedEctsByExamSubjectRows,
        plannedEctsByExamSubjectTotal,
        violations,
        missingItems,
        hasMissingRequirements,
        hasWarnings,
        plannedChecklistComplete,
        doneChecklistComplete,
        getDashboardModeButtonStyle,
        stickyActive,
        feedbackText,
        feedbackBg,
        feedbackBorder,
        feedbackColor,
    };
}
