/**
 * The plan state machine.
 *
 * These are the transitions the evaluation chapter describes: a course placed,
 * moved, ticked off, parked, a plan loaded and cleared. They are checked here
 * by calling the reducer, which is the point of it being one.
 *
 * Two properties are load-bearing beyond the individual transitions. A silent
 * action must leave the recorded change alone, because that is what stops a
 * rejected rule check and its rollback from answering each other for ever; and
 * an unchanged part of a plan must keep its identity, because the view decides
 * what to redraw by comparing those parts.
 */
import { describe, expect, it } from "vitest";

import { laneX } from "../../src/domain/layout.ts";
import type { PlanNode } from "../../src/domain/types.ts";
import {
    DEFAULT_SEMESTER_LOAD_LIMITS,
    EMPTY_GRAPH_VIEW_STATE,
    initialPlannerState,
    plannerReducer,
    programmePlan,
    snapshotFromPlannerState,
} from "../../src/domain/plan/index.ts";
import type {
    PlanAction,
    PlanChange,
    PlanDiff,
    PlannerState,
    ProgrammePlan,
} from "../../src/domain/plan/index.ts";

const MASTER = "066 937";
const BACHELOR = "033 521";

interface CourseNodeOptions {
    y?: number;
    ects?: number;
    status?: string;
    groupId?: string;
}

function courseNode(id: string, code: string, laneIndex: number, options: CourseNodeOptions = {}): PlanNode {
    return {
        id,
        type: "course",
        position: { x: laneX(laneIndex), y: options.y ?? 0 },
        data: {
            code,
            name: `Course ${code}`,
            ects: options.ects ?? 6,
            ...(options.status === undefined ? {} : { status: options.status }),
            ...(options.groupId === undefined ? {} : { groupId: options.groupId }),
        },
    };
}

function run(state: PlannerState, ...actions: PlanAction[]): PlannerState {
    return actions.reduce(plannerReducer, state);
}

function planOf(state: PlannerState, programmeCode = MASTER): ProgrammePlan {
    return programmePlan(state, programmeCode);
}

function changeOf(state: PlannerState): PlanChange {
    if (!state.lastChange) throw new Error("no change was recorded");
    return state.lastChange;
}

function diffOf(state: PlannerState): PlanDiff & { id: number } {
    const change = changeOf(state);
    if (change.type !== "plan_updated") throw new Error(`expected a plan change, got ${change.type}`);
    return change;
}

/** A master plan holding two courses, in semesters one and two. */
function stateWithTwoCourses(): PlannerState {
    return run(initialPlannerState(MASTER), {
        type: "plan/replacedFromNodes",
        nodes: [courseNode("n1", "VU 1", 0), courseNode("n2", "VU 2", 1)],
    });
}

describe("initialPlannerState", () => {
    it("starts on the programme it is given, with no plans and no change", () => {
        const state = initialPlannerState(BACHELOR);
        expect(state).toEqual({
            programCode: BACHELOR,
            byProgramme: {},
            lastChange: null,
            changeCounter: 0,
        });
    });

    it("falls back to the master programme when it is given nothing usable", () => {
        for (const code of [undefined, null, "", "   "]) {
            expect(initialPlannerState(code).programCode).toBe(MASTER);
        }
        expect(initialPlannerState("  033 521  ").programCode).toBe(BACHELOR);
    });
});

describe("unknown actions", () => {
    it("return the state they were given, object for object", () => {
        const state = stateWithTwoCourses();
        const next = plannerReducer(state, { type: "nothing/happened" } as unknown as PlanAction);
        expect(next).toBe(state);
    });
});

describe("programme/selected", () => {
    it("switches the programme on screen", () => {
        const next = plannerReducer(initialPlannerState(MASTER), {
            type: "programme/selected",
            programCode: BACHELOR,
        });
        expect(next.programCode).toBe(BACHELOR);
    });

    it("returns the same state when the programme is already selected", () => {
        const state = initialPlannerState(MASTER);
        expect(plannerReducer(state, { type: "programme/selected", programCode: MASTER })).toBe(state);
    });

    it("leaves each programme's plan intact across a switch", () => {
        const state = run(
            stateWithTwoCourses(),
            { type: "course/doneChanged", courseCode: "VU 1", done: true },
            { type: "programme/selected", programCode: BACHELOR },
            {
                type: "plan/replacedFromNodes",
                nodes: [courseNode("b1", "VO 1", 2)],
            },
            { type: "semester/noteChanged", semesterId: 3, note: "abroad" },
            { type: "programme/selected", programCode: MASTER }
        );

        const master = planOf(state, MASTER);
        expect(Object.keys(master.coursesBySemester)).toHaveLength(4);
        expect(master.coursesBySemester[1]?.map((c) => c.code)).toEqual(["VU 1"]);
        expect(master.doneCourseCodes).toEqual(["VU 1"]);
        expect(master.semesterNotes).toEqual({});

        const bachelor = planOf(state, BACHELOR);
        // The bachelor is designed to take six semesters, the master four.
        expect(Object.keys(bachelor.coursesBySemester)).toHaveLength(6);
        expect(bachelor.coursesBySemester[3]?.map((c) => c.code)).toEqual(["VO 1"]);
        expect(bachelor.doneCourseCodes).toEqual([]);
        expect(bachelor.semesterNotes).toEqual({ 3: "abroad" });
    });
});

describe("plan/replacedFromNodes", () => {
    it("files courses under the semester their card sits in, in vertical order", () => {
        const state = run(initialPlannerState(MASTER), {
            type: "plan/replacedFromNodes",
            nodes: [
                courseNode("n2", "VU 2", 1, { y: 400 }),
                courseNode("n3", "VU 3", 1, { y: 100 }),
                courseNode("n1", "VU 1", 0),
            ],
        });
        const plan = planOf(state);
        expect(plan.coursesBySemester[1]?.map((c) => c.code)).toEqual(["VU 1"]);
        expect(plan.coursesBySemester[2]?.map((c) => c.code)).toEqual(["VU 3", "VU 2"]);
        expect(plan.coursesBySemester[1]?.[0]?.laneIndex).toBe(0);
    });

    it("keeps parked courses out of the plan and records their codes once", () => {
        const state = run(initialPlannerState(MASTER), {
            type: "plan/replacedFromNodes",
            nodes: [
                courseNode("n1", "VU 1", 0),
                courseNode("n2", "VU 2", 0, { status: "parked" }),
                courseNode("n3", "VU 2", 1, { status: "parked" }),
            ],
        });
        const plan = planOf(state);
        expect(plan.parkedCourseCodes).toEqual(["VU 2"]);
        expect(plan.coursesBySemester[1]?.map((c) => c.code)).toEqual(["VU 1"]);
    });

    it("reports a placed course as added", () => {
        const state = stateWithTwoCourses();
        const diff = diffOf(state);
        expect(diff.added).toEqual([
            { id: "n1", code: "VU 1", toSemester: 1, toLaneIndex: 0, toSemesterNumber: 1 },
            { id: "n2", code: "VU 2", toSemester: 2, toLaneIndex: 1, toSemesterNumber: 2 },
        ]);
        expect(diff.removed).toEqual([]);
        expect(diff.moved).toEqual([]);
        expect(diff.updated).toEqual([]);
    });

    it("reports a dragged course as moved, and by node rather than by code", () => {
        const state = run(stateWithTwoCourses(), {
            type: "plan/replacedFromNodes",
            nodes: [courseNode("n1", "VU 1", 3), courseNode("n2", "VU 2", 1)],
        });
        const diff = diffOf(state);
        expect(diff.moved).toEqual([
            {
                id: "n1",
                code: "VU 1",
                fromSemester: 1,
                toSemester: 4,
                fromLaneIndex: 0,
                toLaneIndex: 3,
                fromSemesterNumber: 1,
                toSemesterNumber: 4,
            },
        ]);
        expect(diff.added).toEqual([]);
    });

    it("reports a course taken off the canvas as removed", () => {
        const state = run(stateWithTwoCourses(), {
            type: "plan/replacedFromNodes",
            nodes: [courseNode("n1", "VU 1", 0)],
        });
        const diff = diffOf(state);
        expect(diff.removed).toEqual([
            { id: "n2", code: "VU 2", fromSemester: 2, fromLaneIndex: 1, fromSemesterNumber: 2 },
        ]);
    });

    it("reports a course that stayed put with different ECTS as updated", () => {
        const state = run(stateWithTwoCourses(), {
            type: "plan/replacedFromNodes",
            nodes: [courseNode("n1", "VU 1", 0, { ects: 9 }), courseNode("n2", "VU 2", 1)],
        });
        const diff = diffOf(state);
        expect(diff.updated).toEqual([
            {
                id: "n1",
                code: "VU 1",
                fromEcts: 6,
                toEcts: 9,
                laneIndex: 0,
                semesterId: 1,
                semesterNumber: 1,
            },
        ]);
    });

    it("records no change when the canvas says the same as before", () => {
        const state = stateWithTwoCourses();
        const next = run(state, {
            type: "plan/replacedFromNodes",
            nodes: [courseNode("n1", "VU 1", 0), courseNode("n2", "VU 2", 1)],
        });
        expect(next.lastChange).toBe(state.lastChange);
        expect(next.changeCounter).toBe(state.changeCounter);
    });

    it("drops a done course that has left the plan, and its mark with it", () => {
        const state = run(
            stateWithTwoCourses(),
            { type: "course/doneChanged", courseCode: "VU 1", done: true },
            { type: "course/metaChanged", courseCode: "VU 1", patch: { grade: "2", notes: "kept" } },
            { type: "course/doneChanged", courseCode: "VU 2", done: true },
            { type: "plan/replacedFromNodes", nodes: [courseNode("n2", "VU 2", 1)] }
        );
        const plan = planOf(state);
        expect(plan.doneCourseCodes).toEqual(["VU 2"]);
        expect(plan.courseMetaByCode["VU 1"]).toEqual({ notes: "kept", estimatedHours: "", grade: "" });
    });

    it("leaves the done list alone when nothing was pruned", () => {
        const state = run(stateWithTwoCourses(), {
            type: "course/doneChanged",
            courseCode: "VU 1",
            done: true,
        });
        const next = run(state, {
            type: "plan/replacedFromNodes",
            nodes: [courseNode("n1", "VU 1", 1), courseNode("n2", "VU 2", 1)],
        });
        expect(planOf(next).doneCourseCodes).toBe(planOf(state).doneCourseCodes);
    });

    it("reads an empty plan out of anything that is not a list of nodes", () => {
        const state = run(initialPlannerState(MASTER), {
            type: "plan/replacedFromNodes",
            nodes: null,
        });
        const plan = planOf(state);
        expect(plan.coursesBySemester).toEqual({ 1: [], 2: [], 3: [], 4: [] });
        expect(state.lastChange).toBeNull();
    });
});

describe("course/doneChanged", () => {
    it("ticks a course off and reports where its card is", () => {
        const state = run(stateWithTwoCourses(), {
            type: "course/doneChanged",
            courseCode: "VU 2",
            done: true,
        });
        expect(planOf(state).doneCourseCodes).toEqual(["VU 2"]);
        expect(changeOf(state)).toMatchObject({
            type: "course_status_toggled",
            courseCode: "VU 2",
            toStatus: "done",
            laneIndex: 1,
            semesterId: 2,
            semesterNumber: 2,
        });
    });

    it("reports no lane for a course that is not on the canvas", () => {
        const state = run(stateWithTwoCourses(), {
            type: "course/doneChanged",
            courseCode: "VU 9",
            done: true,
        });
        expect(changeOf(state)).toMatchObject({ laneIndex: null, semesterId: null, semesterNumber: null });
    });

    it("un-ticks a course and clears the mark it was given", () => {
        const state = run(
            stateWithTwoCourses(),
            { type: "course/doneChanged", courseCode: "VU 1", done: true },
            { type: "course/metaChanged", courseCode: "VU 1", patch: { grade: "1", estimatedHours: "40" } },
            { type: "course/doneChanged", courseCode: "VU 1", done: false }
        );
        const plan = planOf(state);
        expect(plan.doneCourseCodes).toEqual([]);
        expect(plan.courseMetaByCode["VU 1"]).toEqual({ notes: "", estimatedHours: "40", grade: "" });
        expect(changeOf(state)).toMatchObject({ toStatus: "in_plan" });
    });

    it("ignores a call without a course code", () => {
        const state = stateWithTwoCourses();
        expect(plannerReducer(state, { type: "course/doneChanged", courseCode: "", done: true })).toBe(state);
    });

    it("records the change even when the course was already done", () => {
        const first = run(stateWithTwoCourses(), {
            type: "course/doneChanged",
            courseCode: "VU 1",
            done: true,
        });
        const second = plannerReducer(first, { type: "course/doneChanged", courseCode: "VU 1", done: true });
        expect(planOf(second).doneCourseCodes).toBe(planOf(first).doneCourseCodes);
        expect(second.lastChange).not.toBe(first.lastChange);
        expect(second.changeCounter).toBe(first.changeCounter + 1);
    });
});

describe("a silent action", () => {
    it("changes the plan and leaves the recorded change alone", () => {
        const state = run(stateWithTwoCourses(), {
            type: "course/doneChanged",
            courseCode: "VU 1",
            done: true,
        });
        const rolledBack = plannerReducer(state, {
            type: "course/doneChanged",
            courseCode: "VU 1",
            done: false,
            meta: { silent: true },
        });
        expect(planOf(rolledBack).doneCourseCodes).toEqual([]);
        expect(rolledBack.lastChange).toBe(state.lastChange);
        expect(rolledBack.changeCounter).toBe(state.changeCounter);
    });

    it("still returns the same state when it changes nothing", () => {
        const state = stateWithTwoCourses();
        const next = plannerReducer(state, {
            type: "course/doneChanged",
            courseCode: "VU 1",
            done: false,
            meta: { silent: true },
        });
        expect(next).toBe(state);
    });
});

describe("courses/doneChanged", () => {
    it("ticks off a whole module at once", () => {
        const state = run(stateWithTwoCourses(), {
            type: "courses/doneChanged",
            courseCodes: ["VU 1", "VU 2"],
            done: true,
        });
        expect(planOf(state).doneCourseCodes).toEqual(["VU 1", "VU 2"]);
        expect(changeOf(state)).toMatchObject({
            type: "course_status_toggled",
            courseCodes: ["VU 1", "VU 2"],
            toStatus: "done",
        });
    });

    it("adds only what is missing and removes only what is there", () => {
        const state = run(
            stateWithTwoCourses(),
            { type: "course/doneChanged", courseCode: "VU 1", done: true },
            { type: "courses/doneChanged", courseCodes: ["VU 1", "VU 2"], done: true }
        );
        expect(planOf(state).doneCourseCodes).toEqual(["VU 1", "VU 2"]);

        const undone = run(state, {
            type: "courses/doneChanged",
            courseCodes: ["VU 1", "VU 9"],
            done: false,
        });
        expect(planOf(undone).doneCourseCodes).toEqual(["VU 2"]);
    });

    it("clears the marks of every course it un-ticks", () => {
        const state = run(
            stateWithTwoCourses(),
            { type: "courses/doneChanged", courseCodes: ["VU 1", "VU 2"], done: true },
            { type: "course/metaChanged", courseCode: "VU 1", patch: { grade: "3" } },
            { type: "course/metaChanged", courseCode: "VU 2", patch: { grade: "2", notes: "hard" } },
            { type: "courses/doneChanged", courseCodes: ["VU 1", "VU 2"], done: false }
        );
        const plan = planOf(state);
        expect(plan.courseMetaByCode["VU 1"]?.grade).toBe("");
        expect(plan.courseMetaByCode["VU 2"]).toEqual({ notes: "hard", estimatedHours: "", grade: "" });
    });

    it("ignores an empty or missing list of codes", () => {
        const state = stateWithTwoCourses();
        expect(plannerReducer(state, { type: "courses/doneChanged", courseCodes: [], done: true })).toBe(state);
        expect(plannerReducer(state, { type: "courses/doneChanged", courseCodes: null, done: true })).toBe(state);
        expect(plannerReducer(state, { type: "courses/doneChanged", courseCodes: [""], done: true })).toBe(state);
    });
});

describe("course/metaChanged", () => {
    it("takes a patch and merges it into what is already recorded", () => {
        const state = run(
            initialPlannerState(MASTER),
            { type: "course/metaChanged", courseCode: "VU 1", patch: { notes: "first" } },
            { type: "course/metaChanged", courseCode: "VU 1", patch: { estimatedHours: "30" } }
        );
        expect(planOf(state).courseMetaByCode["VU 1"]).toEqual({
            notes: "first",
            estimatedHours: "30",
            grade: "",
        });
    });

    it("takes a function of what is already recorded", () => {
        const state = run(
            initialPlannerState(MASTER),
            { type: "course/metaChanged", courseCode: "VU 1", patch: { notes: "first" } },
            {
                type: "course/metaChanged",
                courseCode: "VU 1",
                patch: (current) => ({ notes: `${current.notes} and second` }),
            }
        );
        expect(planOf(state).courseMetaByCode["VU 1"]?.notes).toBe("first and second");
    });

    it("caps a mark worse than five, and reads a comma as a decimal point", () => {
        const state = run(initialPlannerState(MASTER), {
            type: "course/metaChanged",
            courseCode: "VU 1",
            patch: { grade: "5,5" },
        });
        expect(planOf(state).courseMetaByCode["VU 1"]?.grade).toBe("5");
    });

    it("returns the same state for a patch that changes nothing", () => {
        const state = run(initialPlannerState(MASTER), {
            type: "course/metaChanged",
            courseCode: "VU 1",
            patch: { notes: "first" },
        });
        expect(plannerReducer(state, {
            type: "course/metaChanged",
            courseCode: "VU 1",
            patch: { notes: "first" },
        })).toBe(state);
        expect(plannerReducer(state, {
            type: "course/metaChanged",
            courseCode: "   ",
            patch: { notes: "anything" },
        })).toBe(state);
    });

    it("records no change: notes are the student's own and no rule reads them", () => {
        const state = run(initialPlannerState(MASTER), {
            type: "course/metaChanged",
            courseCode: "VU 1",
            patch: { notes: "first" },
        });
        expect(state.lastChange).toBeNull();
        expect(state.changeCounter).toBe(0);
    });
});

describe("semester/noteChanged", () => {
    it("keeps one note per semester", () => {
        const state = run(
            initialPlannerState(MASTER),
            { type: "semester/noteChanged", semesterId: 2, note: "internship" },
            { type: "semester/noteChanged", semesterId: 3, note: "abroad" }
        );
        expect(planOf(state).semesterNotes).toEqual({ 2: "internship", 3: "abroad" });
    });

    it("refuses a semester that cannot exist", () => {
        const state = initialPlannerState(MASTER);
        for (const semesterId of [0, -1, 1.5, Number.NaN]) {
            expect(plannerReducer(state, { type: "semester/noteChanged", semesterId, note: "x" })).toBe(state);
        }
    });

    it("returns the same state when the note is unchanged", () => {
        const state = run(initialPlannerState(MASTER), {
            type: "semester/noteChanged",
            semesterId: 2,
            note: "internship",
        });
        expect(plannerReducer(state, {
            type: "semester/noteChanged",
            semesterId: 2,
            note: "internship",
        })).toBe(state);
    });
});

describe("focus/selected", () => {
    it("records the choice, and tells the rule set about it for the bachelor", () => {
        const state = run(initialPlannerState(BACHELOR), {
            type: "focus/selected",
            focus: "Software Engineering",
        });
        expect(planOf(state, BACHELOR).selectedFocus).toBe("Software Engineering");
        expect(changeOf(state)).toMatchObject({
            type: "focus_updated",
            selectedFocus: "Software Engineering",
        });
    });

    it("records nothing for the master, which has no focus areas", () => {
        const state = run(initialPlannerState(MASTER), { type: "focus/selected", focus: "anything" });
        expect(planOf(state, MASTER).selectedFocus).toBe("anything");
        expect(state.lastChange).toBeNull();
    });

    it("reports a cleared focus as none, and still reports it", () => {
        const state = run(
            initialPlannerState(BACHELOR),
            { type: "focus/selected", focus: "Software Engineering" },
            { type: "focus/selected", focus: "" }
        );
        expect(planOf(state, BACHELOR).selectedFocus).toBe("");
        expect(changeOf(state)).toMatchObject({ type: "focus_updated", selectedFocus: null });
    });
});

describe("focus/selectedForProgramme", () => {
    it("chooses a focus for a programme that is not the one on screen", () => {
        const state = run(initialPlannerState(MASTER), {
            type: "focus/selectedForProgramme",
            programmeCode: BACHELOR,
            focus: "Media Informatics",
        });
        expect(state.programCode).toBe(MASTER);
        expect(planOf(state, BACHELOR).selectedFocus).toBe("Media Informatics");
        expect(changeOf(state)).toMatchObject({ selectedFocus: "Media Informatics" });
    });

    it("ignores a blank programme code", () => {
        const state = initialPlannerState(MASTER);
        expect(plannerReducer(state, {
            type: "focus/selectedForProgramme",
            programmeCode: "   ",
            focus: "x",
        })).toBe(state);
    });
});

describe("loadLimits/changed", () => {
    it("takes new limits and reports them", () => {
        const state = run(initialPlannerState(MASTER), {
            type: "loadLimits/changed",
            patch: {
                maxEctsPerSemester: 36,
                recommendedEctsPerSemester: 24,
                maxWeekHoursPerSemester: 45,
                recommendedWeekHoursPerSemester: 35,
            },
        });
        expect(planOf(state).loadLimits).toEqual({
            maxEctsPerSemester: 36,
            recommendedEctsPerSemester: 24,
            maxWeekHoursPerSemester: 45,
            recommendedWeekHoursPerSemester: 35,
        });
        expect(changeOf(state)).toMatchObject({
            type: "semester_load_limits_updated",
            maxEctsPerSemester: 36,
            recommendedEctsPerSemester: 24,
        });
    });

    it("holds the recommendation at or below the maximum", () => {
        const state = run(initialPlannerState(MASTER), {
            type: "loadLimits/changed",
            patch: { maxEctsPerSemester: 20, recommendedEctsPerSemester: 30 },
        });
        expect(planOf(state).loadLimits.recommendedEctsPerSemester).toBe(20);
    });

    it("falls back to the defaults for values that make no sense", () => {
        const state = run(initialPlannerState(MASTER), {
            type: "loadLimits/changed",
            patch: { maxEctsPerSemester: -4, maxWeekHoursPerSemester: 60 },
        });
        expect(planOf(state).loadLimits).toEqual({
            ...DEFAULT_SEMESTER_LOAD_LIMITS,
            maxWeekHoursPerSemester: 60,
        });
    });

    it("takes a function of the current limits", () => {
        const state = run(initialPlannerState(MASTER), {
            type: "loadLimits/changed",
            patch: (current) => ({ ...current, maxEctsPerSemester: current.maxEctsPerSemester + 3 }),
        });
        expect(planOf(state).loadLimits.maxEctsPerSemester).toBe(45);
    });

    it("returns the same state, and records nothing, when the limits are unchanged", () => {
        const state = initialPlannerState(MASTER);
        expect(plannerReducer(state, {
            type: "loadLimits/changed",
            patch: DEFAULT_SEMESTER_LOAD_LIMITS,
        })).toBe(state);
    });
});

describe("graphView/changed", () => {
    it("remembers what the student collapsed and where they dragged a node", () => {
        const state = run(
            initialPlannerState(MASTER),
            { type: "graphView/changed", patch: { collapsedIds: ["subject-1"] } },
            {
                type: "graphView/changed",
                patch: (current) => ({ ...current, nodePosById: { "course-1": { x: 40, y: 12 } } }),
            }
        );
        const graphView = planOf(state).graphView;
        expect(graphView.collapsedIds).toEqual(["subject-1"]);
        expect(graphView.nodePosById).toEqual({ "course-1": { x: 40, y: 12 } });
        expect(state.lastChange).toBeNull();
    });

    it("lifts a position kept as an x coordinate alone into a full one", () => {
        const state = run(initialPlannerState(MASTER), {
            type: "graphView/changed",
            patch: { nodeXById: { "course-1": 80, "course-2": Number.NaN } },
        });
        expect(planOf(state).graphView.nodePosById).toEqual({ "course-1": { x: 80, y: 0 } });
    });

    it("keeps the filter set it holds when an equal one is offered", () => {
        const state = run(initialPlannerState(MASTER), {
            type: "graphView/changed",
            patch: { filtersConfigured: true },
        });
        const filters = planOf(state).graphView.filters;
        const next = plannerReducer(state, {
            type: "graphView/changed",
            patch: { filters: { ...filters, courseTypes: [...filters.courseTypes] } },
        });
        expect(planOf(next).graphView.filters).toBe(filters);
    });

    it("returns the same state when the updater hands back what it was given", () => {
        const state = run(initialPlannerState(MASTER), {
            type: "graphView/changed",
            patch: { collapsedIds: ["subject-1"] },
        });
        expect(plannerReducer(state, {
            type: "graphView/changed",
            patch: (current) => current,
        })).toBe(state);
    });
});

describe("plan/imported", () => {
    it("reads back a plan this application wrote", () => {
        const before = run(
            stateWithTwoCourses(),
            { type: "course/doneChanged", courseCode: "VU 1", done: true },
            { type: "course/metaChanged", courseCode: "VU 1", patch: { grade: "2" } },
            { type: "semester/noteChanged", semesterId: 2, note: "internship" },
            { type: "focus/selectedForProgramme", programmeCode: BACHELOR, focus: "Software Engineering" }
        );
        const snapshot = snapshotFromPlannerState(before);

        const after = plannerReducer(initialPlannerState(BACHELOR), {
            type: "plan/imported",
            snapshot,
        });
        expect(after.programCode).toBe(MASTER);
        expect(planOf(after, MASTER)).toEqual(planOf(before, MASTER));
        expect(planOf(after, BACHELOR).selectedFocus).toBe("Software Engineering");
    });

    it("keeps a programme that is mentioned in only one of the stored maps", () => {
        const state = plannerReducer(initialPlannerState(MASTER), {
            type: "plan/imported",
            snapshot: { doneByProgram: { [BACHELOR]: ["VO 1"] } },
        });
        const plan = planOf(state, BACHELOR);
        expect(plan.doneCourseCodes).toEqual(["VO 1"]);
        expect(plan.graphView).toBe(EMPTY_GRAPH_VIEW_STATE);
        expect(plan.loadLimits).toBe(DEFAULT_SEMESTER_LOAD_LIMITS);
    });

    it("pads a stored plan out to the semesters the programme is designed to take", () => {
        const state = plannerReducer(initialPlannerState(MASTER), {
            type: "plan/imported",
            snapshot: { coursesByProgram: { [BACHELOR]: { 2: [], 99: [] } } },
        });
        // Semester ninety-nine is past the programme's maximum and is dropped.
        expect(Object.keys(planOf(state, BACHELOR).coursesBySemester)).toEqual(["1", "2", "3", "4", "5", "6"]);
    });

    it("sanitises marks, parked codes and limits on the way in", () => {
        const state = plannerReducer(initialPlannerState(MASTER), {
            type: "plan/imported",
            snapshot: {
                courseMetaByProgram: { [MASTER]: { "VU 1": { grade: 9, notes: 4 } } },
                parkedByProgram: { [MASTER]: ["VU 2", "VU 2", "  ", " VU 3 "] },
                semesterLoadLimitsByProgram: { [MASTER]: { maxEctsPerSemester: "nonsense" } },
            },
        });
        const plan = planOf(state, MASTER);
        expect(plan.courseMetaByCode["VU 1"]).toEqual({ notes: "", estimatedHours: "", grade: "5" });
        expect(plan.parkedCourseCodes).toEqual(["VU 2", "VU 3"]);
        expect(plan.loadLimits).toEqual(DEFAULT_SEMESTER_LOAD_LIMITS);
    });

    it("does not hand out an identifier that has already been seen", () => {
        const before = run(stateWithTwoCourses(), {
            type: "course/doneChanged",
            courseCode: "VU 1",
            done: true,
        });
        const after = plannerReducer(before, { type: "plan/imported", snapshot: {} });
        expect(after.changeCounter).toBe(before.changeCounter);
        expect(after.lastChange).toBe(before.lastChange);
        expect(after.byProgramme).toEqual({});
    });

    it("ignores anything that is not a stored document", () => {
        const state = stateWithTwoCourses();
        for (const snapshot of [null, undefined, "", 7]) {
            expect(plannerReducer(state, { type: "plan/imported", snapshot })).toBe(state);
        }
    });
});

describe("plan/cleared", () => {
    it("goes back to an empty planner on the master programme", () => {
        const state = run(
            stateWithTwoCourses(),
            { type: "course/doneChanged", courseCode: "VU 1", done: true },
            { type: "programme/selected", programCode: BACHELOR },
            { type: "plan/cleared" }
        );
        expect(state.programCode).toBe(MASTER);
        expect(state.byProgramme).toEqual({});
        expect(state.lastChange).toBeNull();
    });

    it("carries the change counter over, so no identifier comes round twice", () => {
        const before = run(stateWithTwoCourses(), {
            type: "course/doneChanged",
            courseCode: "VU 1",
            done: true,
        });
        const after = run(plannerReducer(before, { type: "plan/cleared" }), {
            type: "course/doneChanged",
            courseCode: "VU 1",
            done: true,
        });
        expect(changeOf(after).id).toBeGreaterThan(changeOf(before).id);
    });
});

describe("the change counter", () => {
    it("rises by one for each change recorded, and not otherwise", () => {
        let state = initialPlannerState(BACHELOR);
        const ids: number[] = [];
        const actions: PlanAction[] = [
            { type: "plan/replacedFromNodes", nodes: [courseNode("n1", "VU 1", 0)] },
            { type: "course/doneChanged", courseCode: "VU 1", done: true },
            { type: "course/doneChanged", courseCode: "VU 1", done: false, meta: { silent: true } },
            { type: "course/metaChanged", courseCode: "VU 1", patch: { notes: "n" } },
            { type: "semester/noteChanged", semesterId: 1, note: "note" },
            { type: "focus/selected", focus: "Software Engineering" },
            { type: "courses/doneChanged", courseCodes: ["VU 1"], done: true },
            { type: "loadLimits/changed", patch: { maxEctsPerSemester: 33 } },
        ];
        for (const action of actions) {
            state = plannerReducer(state, action);
            if (state.lastChange) ids.push(state.lastChange.id);
        }
        expect(state.changeCounter).toBe(5);
        // The silent rollback, the note and the mark leave the identifier where
        // it was; the placement, the tick, the focus, the bulk tick and the
        // limits each move it on by one.
        expect(ids).toEqual([1, 2, 2, 2, 2, 3, 4, 5]);
        for (let i = 1; i < ids.length; i += 1) {
            expect(ids[i]).toBeGreaterThanOrEqual(ids[i - 1] as number);
        }
    });
});

describe("the reducer", () => {
    const actions: PlanAction[] = [
        { type: "programme/selected", programCode: BACHELOR },
        { type: "plan/replacedFromNodes", nodes: [courseNode("n1", "VU 1", 2)] },
        { type: "plan/replacedFromNodes", nodes: [] },
        { type: "course/doneChanged", courseCode: "VU 1", done: true },
        { type: "course/doneChanged", courseCode: "VU 1", done: false },
        { type: "courses/doneChanged", courseCodes: ["VU 1", "VU 2"], done: true },
        { type: "courses/doneChanged", courseCodes: ["VU 1"], done: false },
        { type: "course/metaChanged", courseCode: "VU 1", patch: { grade: "1" } },
        { type: "semester/noteChanged", semesterId: 1, note: "note" },
        { type: "focus/selected", focus: "Software Engineering" },
        { type: "focus/selectedForProgramme", programmeCode: BACHELOR, focus: "" },
        { type: "loadLimits/changed", patch: { maxEctsPerSemester: 33 } },
        { type: "graphView/changed", patch: { collapsedIds: ["subject-1"] } },
        { type: "plan/imported", snapshot: { doneByProgram: { [MASTER]: ["VU 4"] } } },
        { type: "plan/cleared" },
    ];

    it("never changes the state it was given", () => {
        const state = run(
            stateWithTwoCourses(),
            { type: "course/doneChanged", courseCode: "VU 1", done: true },
            { type: "course/metaChanged", courseCode: "VU 1", patch: { grade: "2", notes: "note" } },
            { type: "semester/noteChanged", semesterId: 1, note: "note" },
            { type: "graphView/changed", patch: { collapsedIds: ["subject-1"] } }
        );
        const before = structuredClone(state);
        for (const action of actions) {
            plannerReducer(state, action);
        }
        expect(state).toEqual(before);
    });

    it("leaves the parts of a plan it did not touch as they were", () => {
        const state = run(
            stateWithTwoCourses(),
            { type: "course/metaChanged", courseCode: "VU 1", patch: { notes: "note" } },
            { type: "graphView/changed", patch: { collapsedIds: ["subject-1"] } }
        );
        const before = planOf(state);
        const after = planOf(run(state, { type: "semester/noteChanged", semesterId: 1, note: "abroad" }));
        expect(after.coursesBySemester).toBe(before.coursesBySemester);
        expect(after.doneCourseCodes).toBe(before.doneCourseCodes);
        expect(after.courseMetaByCode).toBe(before.courseMetaByCode);
        expect(after.graphView).toBe(before.graphView);
        expect(after.semesterNotes).not.toBe(before.semesterNotes);
    });
});
