/**
 * Graph filter engine.
 *
 * The evaluation found that the filter set is what students actually valued in
 * the graph view, and that the graph took over from the catalogue as the place
 * where a requirement becomes a list of candidate courses. Whatever happens to
 * the surrounding component, these rules have to survive intact.
 *
 * Filtering is also where a subtle regression hides most easily: an empty filter
 * array means "no constraint", not "match nothing", and getting that backwards
 * empties the canvas without throwing anything.
 */
import { describe, expect, it } from "vitest";

import GraphFilterEngine from "../../src/domain/filters.ts";

const BACHELOR = "033 521";
const MASTER = "066 937";

// The engine keys off `data.level`; a node without one is always visible, which
// is how root and synthetic nodes stay on the canvas.
const courseNode = (over = {}) => ({
    id: over.id ?? "c1",
    type: "course",
    data: {
        level: "course",
        courseCode: "VU 1.1",
        courseName: "Test Course",
        ects: 6,
        examSubject: "Software Engineering",
        courseType: "VU",
        status: "todo",
        termAvailability: "winter",
        ...over.data,
    },
});

describe("programme awareness", () => {
    it("recognises the bachelor programme by its spaced code", () => {
        expect(GraphFilterEngine.isBachelorProgram(BACHELOR)).toBe(true);
        expect(GraphFilterEngine.isBachelorProgram("  033 521 ")).toBe(true);
        expect(GraphFilterEngine.isBachelorProgram("033521")).toBe(false);
        expect(GraphFilterEngine.isBachelorProgram(MASTER)).toBe(false);
        expect(GraphFilterEngine.isBachelorProgram(undefined)).toBe(false);
    });

    it("offers the elective vocabulary that matches the programme", () => {
        const bachelor = GraphFilterEngine.obligationOptionsForProgram(BACHELOR);
        const master = GraphFilterEngine.obligationOptionsForProgram(MASTER);

        // The bachelor curriculum distinguishes narrow from broad electives, and
        // students in the study consistently searched using exactly those words.
        expect(bachelor.map((o) => o.value)).toEqual([
            "mandatory", "elective_narrow", "elective_broad",
        ]);
        expect(master.map((o) => o.value)).toEqual(["mandatory", "core", "elective"]);
    });
});

describe("normalizeFilters", () => {
    it("returns every default key regardless of what it is given", () => {
        for (const input of [undefined, null, {}, "not an object", 7]) {
            const filters = GraphFilterEngine.normalizeFilters(input);
            expect(Object.keys(filters).sort()).toEqual(
                Object.keys(GraphFilterEngine.DEFAULT_FILTERS).sort()
            );
        }
    });

    it("starts with no obligation constraint, so nothing is hidden by default", () => {
        expect(GraphFilterEngine.normalizeFilters({}).obligationTypes).toEqual([]);
        expect(GraphFilterEngine.defaultObligationTypes(BACHELOR)).toEqual([]);
    });

    it("is idempotent", () => {
        const once = GraphFilterEngine.normalizeFilters({ courseTypes: ["VU"] }, null, BACHELOR);
        const twice = GraphFilterEngine.normalizeFilters(once, null, BACHELOR);
        expect(twice).toEqual(once);
    });
});

describe("nodeMatchesFilters", () => {
    const empty = GraphFilterEngine.normalizeFilters({});

    it("matches everything when no constraint is set", () => {
        // The regression that matters: treating an empty array as "match nothing"
        // silently blanks the canvas, which is far harder to notice than a crash.
        expect(GraphFilterEngine.nodeMatchesFilters(courseNode(), empty, BACHELOR)).toBe(true);
    });

    it("keeps a node with no level, which is how root nodes stay visible", () => {
        expect(GraphFilterEngine.nodeMatchesFilters({ data: {} }, empty, BACHELOR)).toBe(true);
        expect(
            GraphFilterEngine.nodeMatchesFilters({ data: { level: "root" } }, empty, BACHELOR)
        ).toBe(true);
    });

    it("filters by course type", () => {
        const filters = GraphFilterEngine.normalizeFilters({ courseTypes: ["VO"] });
        expect(GraphFilterEngine.nodeMatchesFilters(courseNode(), filters, BACHELOR)).toBe(false);
        const vo = courseNode({ data: { courseType: "VO" } });
        expect(GraphFilterEngine.nodeMatchesFilters(vo, filters, BACHELOR)).toBe(true);
    });

    it("filters by exam subject", () => {
        const filters = GraphFilterEngine.normalizeFilters({ examSubjects: ["Security"] });
        expect(GraphFilterEngine.nodeMatchesFilters(courseNode(), filters, BACHELOR)).toBe(false);
        const security = courseNode({ data: { examSubject: "Security" } });
        expect(GraphFilterEngine.nodeMatchesFilters(security, filters, BACHELOR)).toBe(true);
    });

    it("filters by term availability", () => {
        const summerOnly = GraphFilterEngine.normalizeFilters({ termAvailabilities: ["summer"] });
        expect(GraphFilterEngine.nodeMatchesFilters(courseNode(), summerOnly, BACHELOR)).toBe(false);
        const summer = courseNode({ data: { termAvailability: "summer" } });
        expect(GraphFilterEngine.nodeMatchesFilters(summer, summerOnly, BACHELOR)).toBe(true);
    });

    it("filters by ECTS range inclusively at both ends", () => {
        const range = GraphFilterEngine.normalizeFilters({ ectsRange: { min: 6, max: 9 } });
        expect(GraphFilterEngine.nodeMatchesFilters(courseNode({ data: { ects: 6 } }), range, BACHELOR)).toBe(true);
        expect(GraphFilterEngine.nodeMatchesFilters(courseNode({ data: { ects: 9 } }), range, BACHELOR)).toBe(true);
        expect(GraphFilterEngine.nodeMatchesFilters(courseNode({ data: { ects: 3 } }), range, BACHELOR)).toBe(false);
        expect(GraphFilterEngine.nodeMatchesFilters(courseNode({ data: { ects: 12 } }), range, BACHELOR)).toBe(false);
    });

    it("combines constraints conjunctively", () => {
        const filters = GraphFilterEngine.normalizeFilters({
            courseTypes: ["VU"],
            examSubjects: ["Security"],
        });
        // Matching one constraint is not enough.
        expect(GraphFilterEngine.nodeMatchesFilters(courseNode(), filters, BACHELOR)).toBe(false);
        const both = courseNode({ data: { examSubject: "Security" } });
        expect(GraphFilterEngine.nodeMatchesFilters(both, filters, BACHELOR)).toBe(true);
    });
});

describe("broad elective recognition", () => {
    it("recognises the free-choice and transferable-skills subjects", () => {
        for (const subject of [
            "Freie Wahlfächer und Transferable Skills",
            "Free Choice",
            "Transferable Skills",
            "Wahlfächer",
        ]) {
            expect(GraphFilterEngine.isBroadElective(subject)).toBeTruthy();
        }
    });

    it("does not treat an ordinary exam subject as a broad elective", () => {
        for (const subject of ["Software Engineering", "Security", "Theoretische Informatik"]) {
            expect(GraphFilterEngine.isBroadElective(subject)).toBeFalsy();
        }
    });
});

describe("computeVisibleNodeIds", () => {
    it("keeps a matching node and drops a non-matching one", () => {
        const nodes = [
            courseNode({ id: "a", data: { courseType: "VU" } }),
            courseNode({ id: "b", data: { courseType: "VO" } }),
        ];
        const filters = GraphFilterEngine.normalizeFilters({ courseTypes: ["VU"] });
        const visible = GraphFilterEngine.computeVisibleNodeIds(nodes, [], filters, BACHELOR);
        expect([...visible]).toContain("a");
        expect([...visible]).not.toContain("b");
    });

    it("returns every node when nothing is constrained", () => {
        const nodes = [courseNode({ id: "a" }), courseNode({ id: "b" })];
        const visible = GraphFilterEngine.computeVisibleNodeIds(
            nodes, [], GraphFilterEngine.normalizeFilters({}), BACHELOR
        );
        expect([...visible].sort()).toEqual(["a", "b"]);
    });

    it("survives an empty graph", () => {
        const visible = GraphFilterEngine.computeVisibleNodeIds(
            [], [], GraphFilterEngine.normalizeFilters({}), BACHELOR
        );
        expect([...visible]).toEqual([]);
    });
});
