/**
 * A plan document written by an earlier client.
 *
 * The document on the server outlives any one version of the code that reads
 * it, and a student whose plan fails to load has lost their work whether or not
 * the failure is loud. What is fixed here is the shape already stored for every
 * participant of the study, so this reads it exactly as it stands rather than
 * as the current writer happens to emit it.
 */
import { describe, expect, it } from "vitest";
import { plannerStateFromSnapshot } from "../../src/domain/plan/snapshot.ts";
import { initialPlannerState } from "../../src/domain/plan/state.ts";

// The nine maps, and the two dashboard keys the planner appends alongside them.
const legacy = {
    version: 1,
    programCode: "033 521",
    coursesByProgram: { "033 521": { 1: [{ id: "n1", code: "ALGO", ects: 6, laneIndex: 0 }] } },
    doneByProgram: { "033 521": ["ALGO"] },
    parkedByProgram: { "033 521": ["AET"] },
    courseMetaByProgram: { "033 521": { ALGO: { notes: "n", estimatedHours: "4", grade: "2" } } },
    semesterNotesByProgram: { "033 521": { 1: "note" } },
    selectedFocusByProgram: { "033 521": "Software Engineering" },
    graphViewByProgram: { "033 521": { collapsedIds: ["x"], nodePosById: { a: { x: 1, y: 2 } } } },
    semesterLoadLimitsByProgram: { "033 521": { maxEctsPerSemester: 40 } },
    dashboardUiByProgram: { "033 521": { isMissingRequirementsOpen: true } },
    dashboardUiGlobal: { isRuleDashboardOpen: true },
};

describe("a stored plan document", () => {
    it("is read back whole", () => {
        const state = plannerStateFromSnapshot(initialPlannerState(), legacy);
        const plan = state.byProgramme["033 521"];
        expect(state.programCode).toBe("033 521");
        expect(plan?.coursesBySemester[1]?.[0]?.code).toBe("ALGO");
        expect(plan?.doneCourseCodes).toEqual(["ALGO"]);
        expect(plan?.parkedCourseCodes).toEqual(["AET"]);
        expect(plan?.courseMetaByCode["ALGO"]?.grade).toBe("2");
        expect(plan?.semesterNotes[1]).toBe("note");
        expect(plan?.selectedFocus).toBe("Software Engineering");
        expect(plan?.loadLimits.maxEctsPerSemester).toBe(40);
    });

    it("ignores the keys it does not own rather than failing on them", () => {
        expect(() => plannerStateFromSnapshot(initialPlannerState(), legacy)).not.toThrow();
    });
});
