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

test("only course-bearing nodes are indexed", () => {
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
