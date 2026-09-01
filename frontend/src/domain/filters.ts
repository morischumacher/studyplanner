/**
 * Filtering the curriculum graph.
 *
 * An empty selection means "no constraint", never "match nothing". The same
 * applies one level down: a node whose metadata does not say what it is stays
 * visible, because the catalogue is incomplete in places and hiding a course
 * the planner cannot classify is worse than showing one the student did not
 * ask for.
 *
 * Visibility is not decided per node either. A course that matches keeps its
 * whole ancestry on screen, and a subject or module that has been collapsed is
 * judged by the descendants it carries with it, so collapsing a branch never
 * changes what the filters find.
 */

import { BACHELOR_PROGRAM_CODE } from "./terms.ts";
import type { Catalogue } from "./types.ts";

/** Where a node sits in the curriculum tree. */
export type GraphNodeLevel = "root" | "subject" | "module" | "course" | "courseDirect";

/**
 * How a course counts towards a degree. The bachelor curriculum splits its
 * electives into a narrow and a broad pool; the master does not, and calls its
 * middle tier "core" instead.
 */
export type ObligationType =
    | "mandatory"
    | "core"
    | "elective"
    | "elective_narrow"
    | "elective_broad";

export interface ObligationOption {
    value: ObligationType;
    label: string;
}

export interface EctsRange {
    min: number;
    max: number;
}

/** The facts about a course that a filter can test. */
export interface CourseFacts {
    courseCode?: string | undefined;
    courseName?: string | undefined;
    ects?: number | undefined;
    courseType?: string | undefined;
    category?: string | undefined;
    examSubject?: string | undefined;
    isMandatory?: boolean | undefined;
    status?: string | undefined;
    termAvailability?: string | undefined;
}

export interface GraphNodeData extends CourseFacts {
    level?: GraphNodeLevel | undefined;
    label?: string | undefined;
    subjectName?: string | undefined;
    moduleEcts?: number | null | undefined;
    /** Carried by a subject or module so that collapsing it hides no matches. */
    descendantCourses?: CourseFacts[] | undefined;
    moduleCourseEcts?: number[] | undefined;
    moduleCourseTypes?: string[] | undefined;
    moduleCourseTermAvailabilities?: string[] | undefined;
}

/** A node as the filters see it: only its data matters. */
export interface FilterableNode {
    data?: GraphNodeData | undefined;
}

export interface GraphNode extends FilterableNode {
    id: string;
}

export interface GraphEdge {
    source?: string | undefined;
    target?: string | undefined;
}

export interface GraphFilters {
    obligationTypes: ObligationType[];
    ectsRange: EctsRange | null;
    courseTypes: string[];
    examSubjects: string[];
    progressStates: string[];
    termAvailabilities: string[];
}

export interface CatalogFilterOptions {
    examSubjects: string[];
    courseTypes: string[];
    ectsBounds: EctsRange | null;
}

export default class GraphFilterEngine {
    static BACHELOR_PROGRAM_CODE = BACHELOR_PROGRAM_CODE;

    static BROAD_ELECTIVE_SUBJECT_RE = /(free|frei|transferable|wahlf[aä]cher|free[\s-]?choice)/i;

    static DEFAULT_FILTERS: GraphFilters = {
        obligationTypes: [],
        ectsRange: null,
        courseTypes: [],
        examSubjects: [],
        progressStates: ["todo", "in_plan", "done"],
        termAvailabilities: ["summer", "winter", "both"],
    };

    static isBachelorProgram(programCode: string | null | undefined): boolean {
        return String(programCode || "").trim() === this.BACHELOR_PROGRAM_CODE;
    }

    static obligationOptionsForProgram(programCode: string | null | undefined): ObligationOption[] {
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

    /**
     * No programme preselects an obligation type. The parameter stays because
     * the answer is a property of the programme, and an empty list is read
     * downstream as "no constraint" rather than as "nothing qualifies".
     */
    static defaultObligationTypes(programCode: string | null | undefined): ObligationType[] {
        void programCode;
        return [];
    }

    static normalizeFilters(
        filters: Partial<GraphFilters> | null | undefined,
        bounds: EctsRange | null = null,
        programCode: string | null | undefined = ""
    ): GraphFilters {
        const source = filters && typeof filters === "object" ? filters : {};
        const defaultObligationTypes = this.defaultObligationTypes(programCode);
        const obligationTypeSet = new Set(this.obligationOptionsForProgram(programCode).map((x) => x.value));
        const normalizedObligationTypes = Array.isArray(source.obligationTypes)
            ? source.obligationTypes.filter((x) => obligationTypeSet.has(x))
            : [];
        const minBound = Number(bounds?.min);
        const maxBound = Number(bounds?.max);
        const rawRange = source?.ectsRange;
        let ectsRange: EctsRange | null = null;
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
        const termAvailabilitySet = new Set(["summer", "winter", "both"]);
        const normalizedTermAvailabilities = Array.isArray(source.termAvailabilities)
            ? source.termAvailabilities.filter((x) => termAvailabilitySet.has(x))
            : ["summer", "winter", "both"];
        return {
            obligationTypes: normalizedObligationTypes.length ? normalizedObligationTypes : defaultObligationTypes,
            ectsRange,
            courseTypes: Array.isArray(source.courseTypes) ? source.courseTypes : this.DEFAULT_FILTERS.courseTypes,
            examSubjects: Array.isArray(source.examSubjects) ? source.examSubjects : this.DEFAULT_FILTERS.examSubjects,
            progressStates: Array.isArray(source.progressStates) ? source.progressStates : this.DEFAULT_FILTERS.progressStates,
            termAvailabilities: normalizedTermAvailabilities,
        };
    }

    /**
     * The teaching format of a course. Where the catalogue does not state one,
     * the leading letters of the course code stand in, because codes such as
     * "VU-1.1" carry the format even when the field is empty.
     */
    static normalizeCourseType(
        type: string | null | undefined,
        code: string | null | undefined = ""
    ): string | null {
        const raw = String(type || "").trim();
        if (raw) return raw.toUpperCase();
        const codePrefix = String(code || "").trim().split("-")[0] || "";
        const token = codePrefix.match(/^[A-Za-z]{2,4}/)?.[0] || "";
        return token ? token.toUpperCase() : null;
    }

    static isBroadElective(examSubject: string | null | undefined): boolean {
        return this.BROAD_ELECTIVE_SUBJECT_RE.test(String(examSubject || ""));
    }

    static obligationForNodeData(
        data: GraphNodeData | null | undefined,
        programCode: string | null | undefined = ""
    ): ObligationType | null {
        const category = String(data?.category || "").trim().toLowerCase();
        const isBachelor = this.isBachelorProgram(programCode);
        if (isBachelor) {
            if (category === "mandatory" || category === "pflicht" || category === "required") return "mandatory";
            if (!category && data?.isMandatory) return "mandatory";
            if (category === "core" || category === "narrow_elective" || category === "narrow" || category === "enge wahl") return "elective_narrow";
            if (category === "elective" || category === "broad_elective" || category === "broad" || category === "breite wahl") return "elective_broad";
            if (this.isBroadElective(data?.examSubject)) return "elective_broad";
            return "elective_narrow";
        }
        if (category === "mandatory" || category === "pflicht" || category === "required") return "mandatory";
        if (category === "core" || category === "narrow_elective" || category === "narrow" || category === "enge wahl") return "core";
        if (category === "elective" || category === "broad_elective" || category === "broad" || category === "breite wahl") return "elective";
        if (!category && data?.isMandatory) return "mandatory";
        return null;
    }

    static nodeMatchesFilters(
        node: FilterableNode | null | undefined,
        filters: GraphFilters,
        programCode: string | null | undefined = ""
    ): boolean {
        const level = node?.data?.level;
        if (!level || level === "root") return true;
        const data: GraphNodeData = node?.data || {};

        const selectedExamSubjects = Array.isArray(filters.examSubjects) ? filters.examSubjects : [];
        if (selectedExamSubjects.length > 0) {
            if (level === "subject") {
                const subjectName = data?.subjectName ?? data?.label ?? null;
                if (!subjectName || !selectedExamSubjects.includes(subjectName)) return false;
                return true;
            }
            if (!data?.examSubject || !selectedExamSubjects.includes(data.examSubject)) return false;
        }

        if (level === "subject" || level === "module") {
            const descendantCourses = Array.isArray(data?.descendantCourses) ? data.descendantCourses : [];
            if (descendantCourses.length > 0) {
                return descendantCourses.some((c) => {
                    const syntheticNode: FilterableNode = {
                        data: {
                            level: "course",
                            courseCode: c.courseCode,
                            courseName: c.courseName,
                            ects: c.ects,
                            courseType: c.courseType,
                            category: c.category,
                            examSubject: c.examSubject,
                            isMandatory: c.isMandatory,
                            status: c.status,
                            termAvailability: c.termAvailability,
                        }
                    };
                    return this.nodeMatchesFilters(syntheticNode, filters, programCode);
                });
            }
        }

        const selectedObligationTypes = Array.isArray(filters.obligationTypes) ? filters.obligationTypes : [];
        if (selectedObligationTypes.length > 0) {
            const obligation = this.obligationForNodeData(data, programCode);
            if (obligation && !selectedObligationTypes.includes(obligation)) return false;
        }

        const selectedProgressStates = Array.isArray(filters.progressStates) ? filters.progressStates : [];
        if (selectedProgressStates.length > 0) {
            const status = String(data?.status || "todo");
            if (!selectedProgressStates.includes(status)) return false;
        }

        const range = filters?.ectsRange;
        if (range && Number.isFinite(Number(range.min)) && Number.isFinite(Number(range.max))) {
            const min = Number(range.min);
            const max = Number(range.max);
            if (level === "module") {
                // A module is in range if any one of its courses is, because the
                // student enrols in courses and not in the module total.
                const childEcts = Array.isArray(data?.moduleCourseEcts)
                    ? data.moduleCourseEcts.map((x) => Number(x)).filter((x) => Number.isFinite(x))
                    : [];
                if (!childEcts.some((ects) => ects >= min && ects <= max)) return false;
            } else {
                const ects = Number(data?.ects ?? data?.moduleEcts);
                if (!Number.isFinite(ects) || ects < min || ects > max) return false;
            }
        }

        const selectedCourseTypes = Array.isArray(filters.courseTypes) ? filters.courseTypes : [];
        if (selectedCourseTypes.length > 0) {
            if (level === "module") {
                const moduleTypes = Array.isArray(data?.moduleCourseTypes) ? data.moduleCourseTypes : [];
                if (!moduleTypes.some((t) => selectedCourseTypes.includes(t))) return false;
            } else {
                const courseType = this.normalizeCourseType(data?.courseType, data?.courseCode);
                if (courseType && !selectedCourseTypes.includes(courseType)) return false;
            }
        }

        const selectedTerms = Array.isArray(filters.termAvailabilities) ? filters.termAvailabilities : [];
        if (selectedTerms.length > 0) {
            const allowed = new Set(selectedTerms);
            if (level === "module") {
                const moduleTerms = Array.isArray(data?.moduleCourseTermAvailabilities) ? data.moduleCourseTermAvailabilities : [];
                if (moduleTerms.length > 0 && !moduleTerms.some((t) => {
                    const normalizedTerm = String(t || "both").trim().toLowerCase();
                    return allowed.has(normalizedTerm);
                })) return false;
            } else if (level === "course" || level === "courseDirect") {
                const term = String(data?.termAvailability || "both").trim().toLowerCase();
                if (!allowed.has(term)) return false;
            }
        }

        return true;
    }

    /**
     * The nodes to draw. A match pulls its ancestors in so the path to it stays
     * on screen, and a parent survives as long as one child does; the root is
     * always kept, since a graph with no root is a graph with nothing to read.
     */
    static computeVisibleNodeIds(
        nodes: GraphNode[] | null | undefined,
        edges: GraphEdge[] | null | undefined,
        filters: GraphFilters,
        programCode: string | null | undefined = ""
    ): Set<string> {
        const allNodes = Array.isArray(nodes) ? nodes : [];
        const allEdges = Array.isArray(edges) ? edges : [];
        const parentByChild = new Map<string, string>();
        const childrenByParent = new Map<string, string[]>();
        for (const e of allEdges) {
            if (!e?.source || !e?.target) continue;
            parentByChild.set(e.target, e.source);
            const siblings = childrenByParent.get(e.source);
            if (siblings) siblings.push(e.target);
            else childrenByParent.set(e.source, [e.target]);
        }

        const baseMatchById = new Map<string, boolean>();
        for (const node of allNodes) {
            baseMatchById.set(node.id, this.nodeMatchesFilters(node, filters, programCode));
        }

        const visible = new Set<string>();
        for (const node of allNodes) {
            if (!baseMatchById.get(node.id)) continue;
            visible.add(node.id);
            let cursor = parentByChild.get(node.id);
            while (cursor !== undefined) {
                visible.add(cursor);
                cursor = parentByChild.get(cursor);
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

    /** The filter vocabulary a given catalogue can actually offer. */
    static collectCatalogFilterOptions(catalog: Catalogue | null | undefined): CatalogFilterOptions {
        const examSubjects = new Set<string>();
        const courseTypes = new Set<string>();
        const ectsValues: number[] = [];
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
