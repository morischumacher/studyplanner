// @vitest-environment jsdom
/**
 * Parking a course.
 *
 * The parking stage is addressed by course code, and a caller may name a course
 * either by its code or by handing over the whole card. What it must never do
 * is park something the plan cannot name again, because a stage entry nothing
 * matches cannot be dragged back out.
 */
import { describe, expect, it } from "vitest";

import { useCoursePlacement } from "../../src/features/planner-board/useCoursePlacement.ts";
import type { UseCoursePlacementInput } from "../../src/features/planner-board/useCoursePlacement.ts";
import type { BoardNode } from "../../src/features/planner-board/types.ts";
import { renderHook } from "./support/render-hook.ts";

const MASTER = "066 937";

interface Board {
    nodes: BoardNode[];
    input: UseCoursePlacementInput;
}

/** A canvas with nothing on it, and the stubs a placement needs around one. */
function emptyBoard(): Board {
    const board: Board = { nodes: [], input: null as unknown as UseCoursePlacementInput };
    board.input = {
        programCode: MASTER,
        catalog: [],
        catalogCourseByCode: new Map(),
        subjectColors: {},
        nodes: board.nodes,
        setNodes: (update) => {
            board.nodes = update(board.nodes);
        },
        setNeedsPersist: () => {},
        setCoursesFromNodes: () => {},
        rfRef: { current: null },
        minGroupChildY: 144,
        maxSemesterCount: 8,
        getCourseStatus: () => "todo",
        setCourseDone: () => {},
        termAvailabilityForCode: () => "both",
        isCourseAllowedInLane: () => true,
        firstAllowedLaneForCourse: (_code, preferredLane) => preferredLane,
        clampPlacementLane: (requestedLaneIndex) => requestedLaneIndex,
        validSemestersForModule: () => [],
        resolveLaneCollisions: (nodes) => nodes,
        removeCourseNode: () => {},
        removeModuleGroup: () => {},
        toggleCourseDone: () => {},
        toggleModuleDoneCodes: () => {},
        updateCourseEcts: () => {},
    };
    return board;
}

function parkedCodes(nodes: BoardNode[]): (string | null | undefined)[] {
    return nodes
        .filter((node) => node?.type === "course" && node?.data?.status === "parked")
        .map((node) => node?.data?.code);
}

describe("parking a course named by its card", () => {
    it("parks it under its code", () => {
        const board = emptyBoard();
        const harness = renderHook((input: UseCoursePlacementInput) => useCoursePlacement(input), board.input);

        expect(harness.current.parkCourseCodes([{ code: "MAS-1", name: "Advanced Software Engineering" }])).toBe(true);
        expect(parkedCodes(board.nodes)).toEqual(["MAS-1"]);

        harness.unmount();
    });

    it("refuses a card with no code rather than parking one called undefined", () => {
        const board = emptyBoard();
        const harness = renderHook((input: UseCoursePlacementInput) => useCoursePlacement(input), board.input);

        expect(harness.current.parkCourseCodes([{ name: "Advanced Software Engineering" }])).toBe(false);
        expect(board.nodes).toEqual([]);

        harness.unmount();
    });
});
