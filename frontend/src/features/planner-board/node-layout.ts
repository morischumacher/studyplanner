/**
 * The canvas's view of the layout functions in `domain/nodes`.
 *
 * The domain describes a node by the fields it reasons about: a position, a
 * kind, and the handful of `data` entries that decide how big a module panel
 * has to be. The canvas describes the same node by everything it stores on it,
 * handlers included. Neither description is wrong and neither is a subtype of
 * the other, so the conversion happens here and nowhere else. It is sound
 * because every function below copies the fields it does not reason about
 * through untouched.
 */

import { useCallback, useMemo } from "react";

import {
    compactPrefillLayout as compactPrefillLayoutBase,
    laneIdx as laneIdxBase,
    recomputeGroupFromChildren as recomputeGroupFromChildrenBase,
    resolveGroupCourseOverlaps as resolveGroupCourseOverlapsBase,
    resolveLaneCollisions as resolveLaneCollisionsBase,
} from "../../domain/nodes.ts";
import type { LaneLayoutOptions, VerticalSemantics } from "../../domain/nodes.ts";
import type { PlanNode } from "../../domain/types.ts";
import type { BoardNode } from "./types.ts";

function asPlanNodes(nodes: readonly BoardNode[]): PlanNode[] {
    return nodes as unknown as PlanNode[];
}

function asBoardNodes(nodes: readonly PlanNode[]): BoardNode[] {
    return nodes as unknown as BoardNode[];
}

/** The lane a node sits in, with minus one standing for the parking stage. */
export function laneIdx(node: BoardNode | null | undefined): number {
    return laneIdxBase(node as PlanNode | null | undefined);
}

/** Resizes a module panel around the cards it holds, or drops an emptied one. */
export function recomputeGroupFromChildren(nodes: readonly BoardNode[], groupId: string): BoardNode[] {
    return asBoardNodes(recomputeGroupFromChildrenBase(asPlanNodes(nodes), groupId));
}

/** Stacks one module's cards so that none covers another. */
export function resolveGroupCourseOverlaps(nodes: readonly BoardNode[], groupId: string): BoardNode[] {
    return asBoardNodes(resolveGroupCourseOverlapsBase(asPlanNodes(nodes), groupId));
}

export interface UseBoardLayoutInput {
    maxSemesterCount: number;
    minModuleGroupTopY: number;
    /** What the student has said the vertical order of a lane means. */
    verticalSemantics: VerticalSemantics;
}

export interface UseBoardLayoutResult {
    compactPrefillLayout: (nodes: BoardNode[]) => BoardNode[];
    resolveLaneCollisions: (nodes: BoardNode[]) => BoardNode[];
}

/**
 * Binds the two whole-canvas layout passes to the current lane geometry.
 *
 * Both are handed on to callers that hold them in dependency lists, so they are
 * memoised on the options object rather than rebuilt each render.
 */
export function useBoardLayout({
    maxSemesterCount,
    minModuleGroupTopY,
    verticalSemantics,
}: UseBoardLayoutInput): UseBoardLayoutResult {
    const flowLayoutOptions = useMemo<LaneLayoutOptions>(() => ({
        maxSemesterCount,
        minModuleGroupTopY,
        verticalSemantics,
    }), [maxSemesterCount, minModuleGroupTopY, verticalSemantics]);

    const compactPrefillLayout = useCallback(
        (allNodes: BoardNode[]) => asBoardNodes(compactPrefillLayoutBase(asPlanNodes(allNodes), flowLayoutOptions)),
        [flowLayoutOptions]
    );

    const resolveLaneCollisions = useCallback(
        (allNodes: BoardNode[]) => asBoardNodes(resolveLaneCollisionsBase(asPlanNodes(allNodes), flowLayoutOptions)),
        [flowLayoutOptions]
    );

    return { compactPrefillLayout, resolveLaneCollisions };
}
