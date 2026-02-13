export default class GraphFilterEngine {
    static BACHELOR_PROGRAM_CODE = "033 521";

    static BROAD_ELECTIVE_SUBJECT_RE = /(free|frei|transferable|wahlf[aä]cher|free[\s-]?choice)/i;

    static DEFAULT_FILTERS = {
        obligationTypes: [],
        ectsRange: null,
        courseTypes: [],
        examSubjects: [],
        progressStates: ["todo", "in_plan", "done"],
    };

    static isBachelorProgram(programCode) {
        return String(programCode || "").trim() === this.BACHELOR_PROGRAM_CODE;
    }

    static obligationOptionsForProgram(programCode) {
        if (this.isBachelorProgram(programCode)) {
            return [
                { value: "mandatory", label: "Mandatory" },
                { value: "elective_narrow", label: "Elective (Enge Wahl)" },
                { value: "elective_broad", label: "Elective (Breite Wahl)" },
            ];
        }
        return [
            { value: "mandatory", label: "Mandatory" },
            { value: "core", label: "Core" },
            { value: "elective", label: "Elective" },
        ];
    }

    static defaultObligationTypes(programCode) {
        return [];
    }

    static normalizeFilters(filters, bounds = null, programCode = "") {
        const source = filters && typeof filters === "object" ? filters : {};
        const defaultObligationTypes = this.defaultObligationTypes(programCode);
        const obligationTypeSet = new Set(this.obligationOptionsForProgram(programCode).map((x) => x.value));
        const normalizedObligationTypes = Array.isArray(source.obligationTypes)
            ? source.obligationTypes.filter((x) => obligationTypeSet.has(x))
            : [];
        const minBound = Number(bounds?.min);
        const maxBound = Number(bounds?.max);
        const rawRange = source?.ectsRange;
        let ectsRange = null;
        if (rawRange && Number.isFinite(Number(rawRange.min)) && Number.isFinite(Number(rawRange.max))) {
            const min = Number(rawRange.min);
            const max = Number(rawRange.max);
            ectsRange = min <= max ? { min, max } : { min: max, max: min };
        } else if (Number.isFinite(minBound) && Number.isFinite(maxBound)) {
            ectsRange = { min: minBound, max: maxBound };
        }
        if (Number.isFinite(minBound) && Number.isFinite(maxBound) && ectsRange) {
            ectsRange = {
                min: Math.max(minBound, Math.min(maxBound, Number(ectsRange.min))),
                max: Math.max(minBound, Math.min(maxBound, Number(ectsRange.max))),
            };
            if (ectsRange.min > ectsRange.max) {
                ectsRange = { min: ectsRange.max, max: ectsRange.min };
            }
        }
        return {
            obligationTypes: normalizedObligationTypes.length ? normalizedObligationTypes : defaultObligationTypes,
            ectsRange,
            courseTypes: Array.isArray(source.courseTypes) ? source.courseTypes : this.DEFAULT_FILTERS.courseTypes,
            examSubjects: Array.isArray(source.examSubjects) ? source.examSubjects : this.DEFAULT_FILTERS.examSubjects,
            progressStates: Array.isArray(source.progressStates) ? source.progressStates : this.DEFAULT_FILTERS.progressStates,
        };
    }

    static normalizeCourseType(type, code = "") {
        const raw = String(type || "").trim();
        if (raw) return raw.toUpperCase();
        const codePrefix = String(code || "").trim().split("-")[0] || "";
        const token = codePrefix.match(/^[A-Za-z]{2,4}/)?.[0] || "";
        return token ? token.toUpperCase() : null;
    }

    static isBroadElective(examSubject) {
        return this.BROAD_ELECTIVE_SUBJECT_RE.test(String(examSubject || ""));
    }

    static obligationForNodeData(data, programCode = "") {
        const category = String(data?.category || "").trim().toLowerCase();
        const isBachelor = this.isBachelorProgram(programCode);
        if (isBachelor) {
            if (category === "mandatory") return "mandatory";
            if (!category && data?.isMandatory) return "mandatory";
            if (this.isBroadElective(data?.examSubject)) return "elective_broad";
            return "elective_narrow";
        }
        if (category === "mandatory") return "mandatory";
        if (category === "core") return "core";
        if (category === "elective") return "elective";
        if (!category && data?.isMandatory) return "mandatory";
        return null;
    }

    static nodeMatchesFilters(node, filters, programCode = "") {
        const level = node?.data?.level;
        if (!level || level === "root") return true;
        const data = node?.data || {};

        if (!Array.isArray(filters.examSubjects) || filters.examSubjects.length === 0) return false;
        if (level === "subject") {
            const subjectName = data?.subjectName ?? data?.label ?? null;
            if (!subjectName || !filters.examSubjects.includes(subjectName)) return false;
            return true;
        }
        if (!data?.examSubject || !filters.examSubjects.includes(data.examSubject)) return false;

        const selectedObligationTypes = Array.isArray(filters.obligationTypes) ? filters.obligationTypes : [];
        if (selectedObligationTypes.length > 0) {
            const obligation = this.obligationForNodeData(data, programCode);
            // Keep nodes with unknown obligation metadata visible.
            if (obligation && !selectedObligationTypes.includes(obligation)) return false;
        }

        if (!Array.isArray(filters.progressStates) || filters.progressStates.length === 0) return false;
        {
            const status = String(data?.status || "todo");
            if (!filters.progressStates.includes(status)) return false;
        }

        const range = filters?.ectsRange;
        if (range && Number.isFinite(Number(range.min)) && Number.isFinite(Number(range.max))) {
            const min = Number(range.min);
            const max = Number(range.max);
            if (level === "module") {
                const childEcts = Array.isArray(data?.moduleCourseEcts)
                    ? data.moduleCourseEcts.map((x) => Number(x)).filter((x) => Number.isFinite(x))
                    : [];
                if (!childEcts.some((ects) => ects >= min && ects <= max)) return false;
            } else {
                const ects = Number(data?.ects ?? data?.moduleEcts);
                if (!Number.isFinite(ects) || ects < min || ects > max) return false;
            }
        }

        if (!Array.isArray(filters.courseTypes) || filters.courseTypes.length === 0) return false;
        if (level === "module") {
            const moduleTypes = Array.isArray(data?.moduleCourseTypes) ? data.moduleCourseTypes : [];
            if (!moduleTypes.some((t) => filters.courseTypes.includes(t))) return false;
        } else {
            const courseType = this.normalizeCourseType(data?.courseType, data?.courseCode);
            if (!courseType || !filters.courseTypes.includes(courseType)) return false;
        }

        return true;
    }

    static computeVisibleNodeIds(nodes, edges, filters, programCode = "") {
        const allNodes = Array.isArray(nodes) ? nodes : [];
        const allEdges = Array.isArray(edges) ? edges : [];
        const parentByChild = new Map();
        const childrenByParent = new Map();
        for (const e of allEdges) {
            if (!e?.source || !e?.target) continue;
            parentByChild.set(e.target, e.source);
            if (!childrenByParent.has(e.source)) childrenByParent.set(e.source, []);
            childrenByParent.get(e.source).push(e.target);
        }

        const baseMatchById = new Map();
        for (const node of allNodes) {
            baseMatchById.set(node.id, this.nodeMatchesFilters(node, filters, programCode));
        }

        const visible = new Set();
        for (const node of allNodes) {
            if (!baseMatchById.get(node.id)) continue;
            visible.add(node.id);
            let cursor = node.id;
            while (parentByChild.has(cursor)) {
                cursor = parentByChild.get(cursor);
                visible.add(cursor);
            }
        }

        let unresolved = true;
        while (unresolved) {
            unresolved = false;
            for (const node of allNodes) {
                if (visible.has(node.id)) continue;
                const children = childrenByParent.get(node.id) || [];
                if (children.some((id) => visible.has(id))) {
                    visible.add(node.id);
                    unresolved = true;
                }
            }
        }

        if (allNodes.some((n) => n.id === "curriculum-root")) {
            visible.add("curriculum-root");
        }
        return visible;
    }

    static collectCatalogFilterOptions(catalog) {
        const examSubjects = new Set();
        const courseTypes = new Set();
        const ectsValues = [];
        for (const subject of catalog || []) {
            if (subject?.pruefungsfach) examSubjects.add(subject.pruefungsfach);
            for (const mod of subject?.modules || []) {
                const moduleEcts = Number(mod?.ects);
                if (Number.isFinite(moduleEcts)) ectsValues.push(moduleEcts);
                for (const course of mod?.courses || []) {
                    const type = this.normalizeCourseType(course?.type, course?.code);
                    if (type) courseTypes.add(type);
                    const courseEcts = Number(course?.ects);
                    if (Number.isFinite(courseEcts)) ectsValues.push(courseEcts);
                }
            }
        }
        return {
            examSubjects: [...examSubjects].sort((a, b) => a.localeCompare(b)),
            courseTypes: [...courseTypes].sort((a, b) => a.localeCompare(b)),
            ectsBounds: ectsValues.length
                ? { min: Math.min(...ectsValues), max: Math.max(...ectsValues) }
                : null,
        };
    }
}
