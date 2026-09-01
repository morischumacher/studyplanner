/**
 * Tests for resolving prerequisite relations onto graph nodes.
 *
 * No browser and no framework: the module under test is pure, which is the
 * reason it is a module rather than logic inside the view. Run with
 * `npm test` from the frontend directory.
 */

import { test } from "vitest";
import assert from "node:assert/strict";

import {
    buildPrerequisiteEdges,
    indexCourseNodes,
    countRecommendedByNode,
    isPrerequisiteEdge,
    normaliseCourseKey,
} from "../../src/utils/prerequisiteEdges.js";

const courseNode = (id, courseCode, courseName, level = "course") => ({
    id,
    data: { level, courseCode, courseName, label: courseName },
});

const NODES = [
    { id: "root", data: { level: "root", label: "Curriculum" } },
    { id: "subject-1", data: { level: "subject", label: "Software Engineering" } },
    courseNode("c-eidi1", "EIDI1", "Einführung in die Programmierung 1"),
    courseNode("c-eidi2", "EIDI2", "Einführung in die Programmierung 2"),
    courseNode("c-se", "SE", "Software Engineering"),
    courseNode("c-sep", "SEP", "Software Engineering Projekt"),
];

const BACHELOR_RELATIONS = [
    {
        source: "Einführung in die Programmierung 1",
        target: "Einführung in die Programmierung 2",
        kind: "soft",
    },
    { source: "Software Engineering", target: "Software Engineering Projekt", kind: "soft" },
];

test("accents and case do not prevent a match", () => {
    assert.equal(normaliseCourseKey("Einführung  in DIE Programmierung 1"), "einfuhrung in die programmierung 1");
});

test("course and module nodes are indexed, the root is not", () => {
    const index = indexCourseNodes(NODES);
    assert.equal(index.get("einfuhrung in die programmierung 1"), "c-eidi1");
    assert.equal(index.get("eidi1"), "c-eidi1");
    assert.equal(index.get("curriculum"), undefined);
});

test("a subject node sharing a course's name does not capture the relation", () => {
    // "Software Engineering" is both an exam subject and a course; the relation
    // is between courses, so the course node must win.
    const edges = buildPrerequisiteEdges(BACHELOR_RELATIONS, NODES);
    const seEdge = edges.find((e) => e.target === "c-sep");
    assert.equal(seEdge.source, "c-se");
});

test("both bachelor relations resolve to edges between the right nodes", () => {
    const edges = buildPrerequisiteEdges(BACHELOR_RELATIONS, NODES);
    assert.equal(edges.length, 2);
    assert.deepEqual(
        edges.map((e) => [e.source, e.target]).sort(),
        [["c-eidi1", "c-eidi2"], ["c-se", "c-sep"]].sort()
    );
    assert.ok(edges.every((e) => isPrerequisiteEdge(e)));
    assert.ok(edges.every((e) => e.style.strokeDasharray === "6 4"), "soft relations are dashed");
});

test("a hard relation is drawn solid and labelled as required", () => {
    const nodes = [courseNode("c-mth", "MTH", "Master Thesis"), courseNode("c-foe", "FOE", "Final Oral Exam / Defense")];
    const [edge] = buildPrerequisiteEdges(
        [{ source: "Master Thesis", target: "Final Oral Exam / Defense", kind: "hard" }],
        nodes
    );
    assert.equal(edge.style.strokeDasharray, undefined);
    assert.equal(edge.label, "required before");
});

test("a relation whose course is not on the canvas is not drawn", () => {
    // A course inside a collapsed module has no node. Attaching its relation to
    // the module standing in for it would assert a relation the curriculum does
    // not hold, so the edge is dropped instead.
    const collapsed = NODES.filter((n) => n.id !== "c-eidi2");
    const edges = buildPrerequisiteEdges(BACHELOR_RELATIONS, collapsed);
    assert.equal(edges.length, 1);
    assert.equal(edges[0].target, "c-sep");
});

test("a filtered-out endpoint removes the edge", () => {
    const visible = new Set(["c-eidi1", "c-eidi2", "c-se"]);
    const edges = buildPrerequisiteEdges(BACHELOR_RELATIONS, NODES, visible);
    assert.equal(edges.length, 1);
    assert.deepEqual([edges[0].source, edges[0].target], ["c-eidi1", "c-eidi2"]);
});

test("an empty relation list draws nothing, which is a curriculum's real answer", () => {
    assert.deepEqual(buildPrerequisiteEdges([], NODES), []);
    assert.deepEqual(buildPrerequisiteEdges(null, NODES), []);
});

test("duplicate relations produce one edge", () => {
    const edges = buildPrerequisiteEdges([...BACHELOR_RELATIONS, ...BACHELOR_RELATIONS], NODES);
    assert.equal(edges.length, 2);
});

test("edge ids are stable across rebuilds, so the canvas does not remount them", () => {
    const first = buildPrerequisiteEdges(BACHELOR_RELATIONS, NODES).map((e) => e.id);
    const second = buildPrerequisiteEdges(BACHELOR_RELATIONS, NODES).map((e) => e.id);
    assert.deepEqual(first, second);
});

// --- Expected knowledge: module-level relations, revealed one node at a time ---

const moduleNode = (id, label) => ({ id, data: { level: "module", label, moduleCode: null } });

const MODULE_NODES = [
    { id: "root", data: { level: "root", label: "Curriculum" } },
    moduleNode("m-am", "▶ Abstrakte Maschinen"),
    moduleNode("m-eidi", "▼ Einführung in die Programmierung"),
    moduleNode("m-ppar", "Programmierparadigmen"),
    moduleNode("m-ub", "Übersetzerbau"),
    moduleNode("m-other", "Datenbanksysteme"),
];

const EXPECTED = [
    { source: "Einführung in die Programmierung", target: "Abstrakte Maschinen", kind: "recommended" },
    { source: "Programmierparadigmen", target: "Abstrakte Maschinen", kind: "recommended" },
    { source: "Übersetzerbau", target: "Abstrakte Maschinen", kind: "recommended" },
];

test("a relation naming modules resolves to module nodes, disclosure marker and all", () => {
    const edges = buildPrerequisiteEdges(EXPECTED, MODULE_NODES, null, { kinds: ["recommended"] });
    assert.equal(edges.length, 3);
    assert.deepEqual(
        edges.map((e) => [e.source, e.target]).sort(),
        [["m-eidi", "m-am"], ["m-ppar", "m-am"], ["m-ub", "m-am"]].sort()
    );
});

test("the sidebar's kinds and the per-node kind do not draw each other", () => {
    const mixed = [...EXPECTED, ...BACHELOR_RELATIONS];
    const global = buildPrerequisiteEdges(mixed, [...MODULE_NODES, ...NODES], null, {
        kinds: ["soft", "hard"],
    });
    assert.equal(global.every((e) => e.data.kind !== "recommended"), true);
    const perNode = buildPrerequisiteEdges(mixed, [...MODULE_NODES, ...NODES], null, {
        kinds: ["recommended"],
    });
    assert.equal(perNode.every((e) => e.data.kind === "recommended"), true);
});

test("an anchor draws only the relations that touch it", () => {
    const edges = buildPrerequisiteEdges(EXPECTED, MODULE_NODES, null, {
        kinds: ["recommended"],
        anchorIds: ["m-ub"],
    });
    assert.equal(edges.length, 1);
    assert.deepEqual([edges[0].source, edges[0].target], ["m-ub", "m-am"]);
});

test("an anchor with nothing to reveal draws nothing", () => {
    const edges = buildPrerequisiteEdges(EXPECTED, MODULE_NODES, null, {
        kinds: ["recommended"],
        anchorIds: ["m-other"],
    });
    assert.deepEqual(edges, []);
});

test("the per-node count is over relations whose other end is on the canvas", () => {
    const counts = countRecommendedByNode(EXPECTED, MODULE_NODES);
    assert.equal(counts.get("m-am"), 3);
    assert.equal(counts.get("m-ub"), 1);
    assert.equal(counts.has("m-other"), false);

    const withoutTarget = MODULE_NODES.filter((n) => n.id !== "m-am");
    assert.equal(countRecommendedByNode(EXPECTED, withoutTarget).size, 0);
});

test("a course and a module of the same name resolve to the course", () => {
    const nodes = [
        { id: "c-se", data: { level: "course", courseCode: "SE", courseName: "Software Engineering" } },
        moduleNode("m-se", "Software Engineering"),
        moduleNode("m-sep", "Software Engineering Projekt"),
    ];
    const edges = buildPrerequisiteEdges(
        [{ source: "Software Engineering", target: "Software Engineering Projekt", kind: "recommended" }],
        nodes,
        null,
        { kinds: ["recommended"] }
    );
    assert.equal(edges.length, 1);
    assert.equal(edges[0].source, "c-se");
});
