/**
 * Keeping the nodes on the planning canvas from overlapping.
 *
 * Every function here takes the whole node list and returns a new one, because
 * moving a course can move the module panel behind it, which can in turn push
 * another course; there is no local edit that is safe to apply on its own.
 *
 * A module panel is not a parent in React Flow's sense. It is a sibling node
 * drawn behind its courses, and its position and size are recomputed from those
 * courses rather than the other way round, which is why a panel with no courses
 * left is removed instead of resized.
 */

import {
    CARD_WIDTH,
    COLLISION_GAP,
    COURSE_LAYOUT_HEIGHT,
    COURSE_VERTICAL_GAP,
    GROUP_EXTRA_RIGHT,
    GROUP_PADDING_X,
    GROUP_PADDING_Y,
    LANE_GAP,
    LANE_WIDTH,
    MODULE_BOTTOM_PADDING,
    MODULE_HEADER_HEIGHT,
} from "./layout.ts";
import type { PlanNode } from "./types.ts";

/** What the vertical order of a lane is meant to mean to the reader. */
export type VerticalSemantics = "no_meaning" | "alphabetical" | "ects" | "custom";

export interface LaneLayoutOptions {
    maxSemesterCount: number;
    minModuleGroupTopY: number;
    verticalSemantics?: VerticalSemantics | undefined;
}

/**
 * The lane geometry a whole-canvas compaction needs. Compaction settles cards
 * against each other and against the module headers above them, which is a
 * question about pixels rather than about how many semesters the plan has.
 */
export interface PrefillLayoutOptions {
    minModuleGroupTopY: number;
}

/** The rectangle a node occupies, plus its height. */
interface BoundingBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    h: number;
}

/** The topmost row courses are allowed to occupy, below the lane headers. */
const MIN_COURSE_Y = 96;

export function laneIdx(node: PlanNode | null | undefined): number {
    const span = LANE_WIDTH + LANE_GAP;
    const idx = Math.floor((Number(node?.position?.x || 0) + LANE_GAP * 0.5) / span);
    // Minus one is the parking lane, which sits to the left of semester one.
    return Math.max(-1, idx);
}

/**
 * Resizes a module panel around the courses it holds. A panel whose last course
 * has been moved out is dropped, since an empty panel labels nothing.
 */
export function recomputeGroupFromChildren(nodes: PlanNode[], groupId: string): PlanNode[] {
    const children = nodes.filter((n) => n.type === "course" && n.data?.groupId === groupId);
    const group = nodes.find((n) => n.type === "moduleBg" && n.id === groupId);
    if (!group) return nodes;
    if (children.length === 0) return nodes.filter((n) => n.id !== groupId);

    const minX = Math.min(...children.map((c) => c.position.x));
    const minY = Math.min(...children.map((c) => c.position.y));
    const maxX = Math.max(...children.map((c) => c.position.x + CARD_WIDTH));
    const maxY = Math.max(...children.map((c) => c.position.y + COURSE_LAYOUT_HEIGHT));

    const extraLeft = GROUP_EXTRA_RIGHT * 0.35;
    const width = maxX - minX + GROUP_PADDING_X * 2 + GROUP_EXTRA_RIGHT;
    const statuses = children.map((c) => c?.data?.status ?? "in_plan");
    const groupStatus = statuses.every((s) => s === "done")
        ? "done"
        : (
            statuses.every((s) => s === "parked")
                ? "parked"
                : (statuses.some((s) => s === "in_plan" || s === "done") ? "in_plan" : "todo")
        );
    const moduleEctsFromChildren = children.reduce((sum, c) => sum + Number(c?.data?.ects || 0), 0);
    const moduleCourseCodes = children
        .map((c) => c?.data?.code)
        .filter((code): code is string => Boolean(code));
    const height = maxY - minY + GROUP_PADDING_Y + MODULE_HEADER_HEIGHT + MODULE_BOTTOM_PADDING;

    return nodes.map((n) =>
        n.id === groupId
            ? {
                ...n,
                position: {
                    x: minX - GROUP_PADDING_X - extraLeft,
                    y: minY - GROUP_PADDING_Y - MODULE_HEADER_HEIGHT,
                },
                data: {
                    ...n.data,
                    width,
                    height,
                    moduleCourseCount: children.length,
                    // The catalogue's own figure wins, because a module can be
                    // worth fewer credits than its courses add up to.
                    moduleEcts: Number(n?.data?.moduleEcts ?? 0) || moduleEctsFromChildren || null,
                    moduleCourseCodes,
                    status: groupStatus,
                },
            }
            : n
    );
}

/** Stacks the courses of one module so that none covers another. */
export function resolveGroupCourseOverlaps(nodes: PlanNode[], groupId: string): PlanNode[] {
    const children = nodes
        .filter((n) => n.type === "course" && n.data?.groupId === groupId)
        .sort((a, b) => a.position.y - b.position.y);
    if (children.length <= 1) return nodes;

    let next = nodes.slice();
    const placed: PlanNode[] = [];
    for (const child of children) {
        const current = next.find((n) => n.id === child.id) || child;
        let minY = current.position.y;
        for (const prior of placed) {
            const xOverlap =
                current.position.x < prior.position.x + CARD_WIDTH + COLLISION_GAP &&
                current.position.x + CARD_WIDTH + COLLISION_GAP > prior.position.x;
            if (!xOverlap) continue;
            minY = Math.max(minY, prior.position.y + COURSE_LAYOUT_HEIGHT + COURSE_VERTICAL_GAP);
        }
        if (current.position.y < minY) {
            next = next.map((n) => (
                n.id === child.id ? { ...n, position: { x: n.position.x, y: minY } } : n
            ));
        }
        placed.push(next.find((n) => n.id === child.id) || current);
    }
    return next;
}

function nodeBBox(n: PlanNode): BoundingBox {
    if (n.type === "course") {
        return {
            x1: n.position.x,
            y1: n.position.y,
            x2: n.position.x + CARD_WIDTH,
            y2: n.position.y + COURSE_LAYOUT_HEIGHT,
            h: COURSE_LAYOUT_HEIGHT,
        };
    }
    if (n.type === "moduleBg") {
        const w = Number(n?.data?.width) || CARD_WIDTH + 2 * GROUP_PADDING_X;
        const h = Number(n?.data?.height) || COURSE_LAYOUT_HEIGHT + MODULE_HEADER_HEIGHT + 2 * GROUP_PADDING_Y;
        return { x1: n.position.x, y1: n.position.y, x2: n.position.x + w, y2: n.position.y + h, h };
    }
    return { x1: n.position.x, y1: n.position.y, x2: n.position.x, y2: n.position.y, h: 0 };
}

/** The lanes a node reaches into. Only a module panel can span more than one. */
function coveredLaneIndicesForNode(n: PlanNode, maxSemesterCount: number): number[] {
    if (n?.type !== "moduleBg") return [laneIdx(n)];
    const box = nodeBBox(n);
    const laneFromX = (x: number) => {
        const span = LANE_WIDTH + LANE_GAP;
        const idx = Math.floor((Number(x) + LANE_GAP * 0.5) / span);
        return Math.max(-1, Math.min(maxSemesterCount - 1, idx));
    };
    const start = laneFromX(box.x1);
    const end = laneFromX(Math.max(box.x1, box.x2 - 1));
    const out: number[] = [];
    for (let li = start; li <= end; li += 1) out.push(li);
    return out.length ? out : [start];
}

function applyDeltaToGroupChildren(
    nodes: PlanNode[],
    groupId: string | undefined,
    dx: number,
    dy: number
): PlanNode[] {
    if (!groupId || (dx === 0 && dy === 0)) return nodes;
    return nodes.map((n) =>
        n.type === "course" && n.data?.groupId === groupId
            ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
            : n
    );
}

/** Keeps a module panel low enough that its header is not cut off by the lane header. */
function enforceModuleHeaderClearance(allNodes: PlanNode[], minModuleGroupTopY: number): PlanNode[] {
    let nodes = allNodes.slice();
    const groups = nodes.filter((n) => n?.type === "moduleBg");
    for (const group of groups) {
        const groupTop = Number(group?.position?.y || 0);
        if (groupTop >= minModuleGroupTopY) continue;
        const dy = minModuleGroupTopY - groupTop;
        nodes = nodes.map((n) =>
            n.id === group.id
                ? { ...n, position: { x: n.position.x, y: n.position.y + dy } }
                : n
        );
        nodes = applyDeltaToGroupChildren(nodes, group.id, 0, dy);
    }
    return nodes;
}

/**
 * Lane backgrounds sit behind module panels, which sit behind course cards. The
 * order is set here rather than in the components because React Flow paints by
 * `zIndex` alone and a node added later would otherwise land on top.
 */
function enforceStackingOrder(allNodes: PlanNode[]): PlanNode[] {
    return allNodes.map((node) => {
        if (node?.type === "lane") {
            if (node?.zIndex === 0) return node;
            return { ...node, zIndex: 0 };
        }
        if (node?.type === "moduleBg") {
            if (node?.zIndex === 1) return node;
            return { ...node, zIndex: 1 };
        }
        if (node?.type === "course") {
            if (node?.zIndex === 10) return node;
            return { ...node, zIndex: 10 };
        }
        return node;
    });
}

function resizeAllGroups(nodes: PlanNode[]): PlanNode[] {
    const groupIds = [...new Set(
        nodes
            .filter((n) => n.type === "course" && n.data?.groupId)
            .map((n) => n.data?.groupId)
            .filter((id): id is string => Boolean(id))
    )];
    let resolved = nodes;
    for (const gId of groupIds) {
        resolved = recomputeGroupFromChildren(resolved, gId);
    }
    return resolved;
}

/**
 * Pulls a freshly prefilled plan upwards until nothing overlaps. Courses are
 * settled top to bottom so that each one only ever has to clear what is already
 * placed above it.
 */
export function compactPrefillLayout(
    allNodes: PlanNode[],
    { minModuleGroupTopY }: PrefillLayoutOptions
): PlanNode[] {
    let nodes = enforceModuleHeaderClearance(allNodes, minModuleGroupTopY);
    const candidates = nodes
        .filter((n) => n.type === "course")
        .sort((a, b) => {
            const ay = Number(a?.position?.y || 0);
            const by = Number(b?.position?.y || 0);
            if (ay !== by) return ay - by;
            const ax = Number(a?.position?.x || 0);
            const bx = Number(b?.position?.x || 0);
            return ax - bx;
        });

    const placed: string[] = [];
    for (const candidate of candidates) {
        const current = nodes.find((n) => n.id === candidate.id);
        if (!current) continue;
        const cBox = nodeBBox(current);
        let minAllowedY = MIN_COURSE_Y;

        for (const placedId of placed) {
            const prior = nodes.find((n) => n.id === placedId);
            if (!prior) continue;
            const pBox = nodeBBox(prior);
            const xOverlap =
                cBox.x1 < pBox.x2 + COLLISION_GAP &&
                cBox.x2 + COLLISION_GAP > pBox.x1;
            if (!xOverlap) continue;
            minAllowedY = Math.max(minAllowedY, pBox.y2 + COLLISION_GAP);
        }

        if (cBox.y1 > minAllowedY) {
            const dy = minAllowedY - cBox.y1;
            nodes = nodes.map((n) =>
                n.id === current.id
                    ? { ...n, position: { x: n.position.x, y: n.position.y + dy } }
                    : n
            );
        }
        placed.push(candidate.id);
    }

    const headerSafe = enforceModuleHeaderClearance(nodes, minModuleGroupTopY);
    return enforceStackingOrder(resizeAllGroups(headerSafe));
}

/**
 * Settles every lane after a drag. Where the vertical order carries a meaning
 * the student chose, the lane is laid out from the top in that order; otherwise
 * courses keep the positions they were dropped at and are only pushed apart.
 */
export function resolveLaneCollisions(
    allNodes: PlanNode[],
    { maxSemesterCount, minModuleGroupTopY, verticalSemantics }: LaneLayoutOptions
): PlanNode[] {
    let nodes = enforceModuleHeaderClearance(allNodes, minModuleGroupTopY);

    const lanes = new Map<number, string[]>();
    for (const n of nodes) {
        if (n.type !== "course") continue;
        const laneIndices = coveredLaneIndicesForNode(n, maxSemesterCount);
        for (const li of laneIndices) {
            const members = lanes.get(li);
            if (members) members.push(n.id);
            else lanes.set(li, [n.id]);
        }
    }

    for (const ids of lanes.values()) {
        const laneNodes = ids
            .map((id) => nodes.find((n) => n.id === id))
            .filter((n): n is PlanNode => Boolean(n))
            .sort((a, b) => {
                if (verticalSemantics === "alphabetical") {
                    const nameA = (a.data?.name || "").toLowerCase();
                    const nameB = (b.data?.name || "").toLowerCase();
                    return nameA.localeCompare(nameB);
                }
                if (verticalSemantics === "ects") {
                    const ectsA = Number(a.data?.ects || 0);
                    const ectsB = Number(b.data?.ects || 0);
                    return ectsB - ectsA;
                }
                return a.position.y - b.position.y;
            });

        let prev: PlanNode | null = null;
        let currentY = MIN_COURSE_Y;
        for (const curr of laneNodes) {
            if (verticalSemantics === "alphabetical" || verticalSemantics === "ects") {
                const dy = currentY - curr.position.y;
                if (dy !== 0) {
                    nodes = nodes.map((n) => (n.id === curr.id ? { ...n, position: { x: n.position.x, y: currentY } } : n));
                    const idx = laneNodes.findIndex((ln) => ln.id === curr.id);
                    if (idx !== -1) laneNodes[idx] = { ...curr, position: { ...curr.position, y: currentY } };
                }
                const curB = nodeBBox(laneNodes.find((ln) => ln.id === curr.id) || curr);
                currentY = curB.y2 + COLLISION_GAP;
            } else {
                if (!prev) {
                    prev = curr;
                    continue;
                }
                const prevB = nodeBBox(prev);
                const curB = nodeBBox(curr);
                const minY = prevB.y2 + COLLISION_GAP;
                if (curB.y1 < minY) {
                    const dy = minY - curB.y1;
                    nodes = nodes.map((n) => (n.id === curr.id ? { ...n, position: { x: n.position.x, y: n.position.y + dy } } : n));
                    const idx = laneNodes.findIndex((ln) => ln.id === curr.id);
                    if (idx !== -1) laneNodes[idx] = { ...curr, position: { x: curr.position.x, y: curr.position.y + dy } };
                }
                prev = laneNodes.find((ln) => ln.id === curr.id) || curr;
            }
        }
    }

    const headerSafe = enforceModuleHeaderClearance(nodes, minModuleGroupTopY);
    return enforceStackingOrder(resizeAllGroups(headerSafe));
}
