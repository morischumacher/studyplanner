// @vitest-environment jsdom
/**
 * Undoing a move the rule engine refused.
 *
 * A rollback is driven by the diff the refused change carried, and that diff
 * names node ids because the plan may hold the same course twice: two entries
 * with one code between them, and only one of them moved. Putting the other one
 * back is not a smaller mistake than leaving the move standing, it is a second
 * move nobody asked for, recorded silently so that nothing checks it.
 *
 * The change is built here as the diff really is, rather than as the fields the
 * rollback happens to read, so that a rollback shown to ignore something is
 * shown to ignore it in the presence of the real thing.
 */
import { describe, expect, it } from "vitest";

import { centerX } from "../../src/domain/layout.ts";
import type { PlanDiff } from "../../src/domain/plan/index.ts";
import type { PlanNode } from "../../src/domain/types.ts";
import { useRuleCheckRollbacks } from "../../src/features/rule-check/useRuleCheckRollbacks.ts";
import type { UseRuleCheckRollbacksInput } from "../../src/features/rule-check/useRuleCheckRollbacks.ts";
import { renderHook } from "./support/render-hook.ts";

interface Board {
    nodes: PlanNode[];
    input: UseRuleCheckRollbacksInput;
}

function courseNode(id: string, code: string, laneIndex: number): PlanNode {
    return {
        id,
        type: "course",
        position: { x: centerX(laneIndex), y: 96 },
        data: { code, name: code },
    };
}

function board(nodes: PlanNode[]): Board {
    const state: Board = { nodes, input: null as unknown as UseRuleCheckRollbacksInput };
    state.input = {
        setNodes: (updater) => {
            state.nodes = updater(state.nodes);
        },
        setNeedsPersist: () => {},
        resolveLaneCollisions: (next) => next,
        rollbackCourseDone: () => {},
    };
    return state;
}

/** One course dragged from one lane to another, as the plan diff reports it. */
function moveOf(id: string, code: string, fromLaneIndex: number, toLaneIndex: number): PlanDiff {
    return {
        type: "plan_updated",
        added: [],
        removed: [],
        updated: [],
        moved: [{
            id,
            code,
            fromSemester: fromLaneIndex + 1,
            toSemester: toLaneIndex + 1,
            fromLaneIndex,
            toLaneIndex,
            fromSemesterNumber: fromLaneIndex + 1,
            toSemesterNumber: toLaneIndex + 1,
        }],
    };
}

function laneOf(state: Board, id: string): number | null {
    const node = state.nodes.find((candidate) => candidate.id === id);
    if (!node) return null;
    for (let laneIndex = 0; laneIndex <= 9; laneIndex += 1) {
        if (node.position.x === centerX(laneIndex)) return laneIndex;
    }
    return null;
}

function rollback(state: Board, change: PlanDiff): void {
    const harness = renderHook(
        (input: UseRuleCheckRollbacksInput) => useRuleCheckRollbacks(input),
        state.input
    );
    harness.current.rollbackMovedCourses(change);
    harness.unmount();
}

describe("a refused move of a course the plan holds twice", () => {
    it("puts back the copy the change names and leaves the other one alone", () => {
        const state = board([
            courseNode("moved-copy", "ASE", 3),
            courseNode("other-copy", "ASE", 5),
        ]);

        rollback(state, moveOf("moved-copy", "ASE", 1, 3));

        expect(laneOf(state, "moved-copy")).toBe(1);
        expect(laneOf(state, "other-copy")).toBe(5);
    });

    it("leaves the plan alone when the change names a card that is no longer drawn", () => {
        const state = board([courseNode("other-copy", "ASE", 5)]);

        rollback(state, moveOf("moved-copy", "ASE", 1, 3));

        expect(laneOf(state, "other-copy")).toBe(5);
    });
});
