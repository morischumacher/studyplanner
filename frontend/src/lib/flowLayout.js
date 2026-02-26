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
} from "../utils/constants.js";

export function laneIdx(node) {
    const span = LANE_WIDTH + LANE_GAP;
    const idx = Math.floor((Number(node?.position?.x || 0) + LANE_GAP * 0.5) / span);
    return Math.max(-1, idx);
}

export function recomputeGroupFromChildren(nodes, groupId) {
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
    const moduleCourseCodes = children.map((c) => c?.data?.code).filter(Boolean);
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
                    moduleEcts: Number(n?.data?.moduleEcts ?? 0) || moduleEctsFromChildren || null,
                    moduleCourseCodes,
                    status: groupStatus,
                },
            }
            : n
    );
}

export function resolveGroupCourseOverlaps(nodes, groupId) {
    const children = nodes
        .filter((n) => n.type === "course" && n.data?.groupId === groupId)
        .sort((a, b) => a.position.y - b.position.y);
    if (children.length <= 1) return nodes;

    let next = nodes.slice();
    const placed = [];
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

function nodeBBox(n) {
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

function isRelevantForCollision(n) {
    return n.type === "moduleBg" || (n.type === "course" && !n.data?.groupId);
}

function coveredLaneIndicesForNode(n, maxSemesterCount) {
    if (n?.type !== "moduleBg") return [laneIdx(n)];
    const box = nodeBBox(n);
    const laneFromX = (x) => {
        const span = LANE_WIDTH + LANE_GAP;
        const idx = Math.floor((Number(x) + LANE_GAP * 0.5) / span);
        return Math.max(-1, Math.min(maxSemesterCount - 1, idx));
    };
    const start = laneFromX(box.x1);
    const end = laneFromX(Math.max(box.x1, box.x2 - 1));
    const out = [];
    for (let li = start; li <= end; li += 1) out.push(li);
    return out.length ? out : [start];
}

function applyDeltaToGroupChildren(nodes, groupId, dx, dy) {
    if (!groupId || (dx === 0 && dy === 0)) return nodes;
    return nodes.map((n) =>
        n.type === "course" && n.data?.groupId === groupId
            ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
            : n
    );
}

function enforceModuleHeaderClearance(allNodes, minModuleGroupTopY) {
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

function pushStandaloneCoursesBelowModuleBackgrounds(allNodes) {
    let nodes = allNodes.slice();
    const maxPasses = 8;
    for (let pass = 0; pass < maxPasses; pass += 1) {
        let changed = false;
        const moduleNodes = nodes.filter((n) => n?.type === "moduleBg");
        const standaloneCourses = nodes.filter((n) => n?.type === "course" && !n?.data?.groupId);

        for (const courseNode of standaloneCourses) {
            const currentCourse = nodes.find((n) => n.id === courseNode.id) || courseNode;
            const cBox = nodeBBox(currentCourse);
            let minAllowedY = cBox.y1;

            for (const moduleNode of moduleNodes) {
                const mBox = nodeBBox(moduleNode);
                const xOverlap = cBox.x1 < mBox.x2 && cBox.x2 > mBox.x1;
                if (!xOverlap) continue;
                const yOverlap = cBox.y1 < (mBox.y2 + COLLISION_GAP) && cBox.y2 > (mBox.y1 - COLLISION_GAP);
                if (!yOverlap) continue;
                minAllowedY = Math.max(minAllowedY, mBox.y2 + COLLISION_GAP);
            }

            if (minAllowedY > cBox.y1) {
                changed = true;
                nodes = nodes.map((n) => (
                    n.id === currentCourse.id
                        ? { ...n, position: { x: n.position.x, y: minAllowedY } }
                        : n
                ));
            }
        }

        if (!changed) break;
    }
    return nodes;
}

function enforceStackingOrder(allNodes) {
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

export function compactPrefillLayout(allNodes, { maxSemesterCount, minModuleGroupTopY }) {
    let nodes = enforceModuleHeaderClearance(allNodes, minModuleGroupTopY);
    const candidates = nodes
        .filter((n) => isRelevantForCollision(n))
        .sort((a, b) => {
            const ay = Number(a?.position?.y || 0);
            const by = Number(b?.position?.y || 0);
            if (ay !== by) return ay - by;
            const ax = Number(a?.position?.x || 0);
            const bx = Number(b?.position?.x || 0);
            return ax - bx;
        });

    const placed = [];
    for (const candidate of candidates) {
        const current = nodes.find((n) => n.id === candidate.id);
        if (!current) continue;
        const cBox = nodeBBox(current);
        let minAllowedY = current.type === "moduleBg" ? minModuleGroupTopY : 96;

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
            if (current.type === "moduleBg") {
                nodes = applyDeltaToGroupChildren(nodes, current.id, 0, dy);
            }
        }
        placed.push(candidate.id);
    }

    return enforceStackingOrder(enforceModuleHeaderClearance(nodes, minModuleGroupTopY));
}

export function resolveLaneCollisions(allNodes, { maxSemesterCount, minModuleGroupTopY }) {
    let nodes = enforceModuleHeaderClearance(allNodes, minModuleGroupTopY);

    const lanes = new Map();
    for (const n of nodes) {
        if (!isRelevantForCollision(n)) continue;
        const laneIndices = coveredLaneIndicesForNode(n, maxSemesterCount);
        for (const li of laneIndices) {
            if (!lanes.has(li)) lanes.set(li, []);
            lanes.get(li).push(n.id);
        }
    }

    for (const ids of lanes.values()) {
        const laneNodes = ids
            .map((id) => nodes.find((n) => n.id === id))
            .filter(Boolean)
            .sort((a, b) => a.position.y - b.position.y);

        let prev = null;
        for (const curr of laneNodes) {
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
                if (curr.type === "moduleBg") nodes = applyDeltaToGroupChildren(nodes, curr.id, 0, dy);
                const idx = laneNodes.findIndex((ln) => ln.id === curr.id);
                if (idx !== -1) laneNodes[idx] = { ...curr, position: { x: curr.position.x, y: curr.position.y + dy } };
            }
            prev = laneNodes.find((ln) => ln.id === curr.id) || curr;
        }
    }

    const headerSafe = enforceModuleHeaderClearance(nodes, minModuleGroupTopY);
    return enforceStackingOrder(pushStandaloneCoursesBelowModuleBackgrounds(headerSafe));
}
