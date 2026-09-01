/**
 * Turning the curriculum's prerequisite relations into graph edges.
 *
 * The relations name courses; the graph addresses nodes. This module resolves
 * the first to the second and nothing else: it holds no relations of its own,
 * reads no state, and touches no framework, so it can be exercised directly.
 *
 * A relation is drawn only when both of its endpoints are nodes currently on the
 * canvas. A course inside a collapsed module has no node, so its relation is not
 * drawn rather than being attached to the module standing in for it, which would
 * assert a relation the curriculum does not hold.
 */

const PREREQUISITE_EDGE_PREFIX = "prereq-";

const SOFT_EDGE_COLOUR = "#b45309";
const HARD_EDGE_COLOUR = "#b91c1c";

/** Fold case, strip accents and collapse whitespace, so "Einführung" matches "einfuhrung". */
export function normaliseCourseKey(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Index the course-bearing nodes by every name a relation might use: the course
 * code and the course name. Later nodes do not displace earlier ones, so the
 * first node carrying a given key wins and the mapping is stable.
 */
export function indexCourseNodes(nodes) {
    const byKey = new Map();
    for (const node of nodes || []) {
        const level = node?.data?.level;
        if (level !== "course" && level !== "courseDirect") continue;
        for (const candidate of [node?.data?.courseCode, node?.data?.courseName, node?.data?.label]) {
            const key = normaliseCourseKey(candidate);
            if (!key || byKey.has(key)) continue;
            byKey.set(key, node.id);
        }
    }
    return byKey;
}

export function isPrerequisiteEdge(edge) {
    return typeof edge?.id === "string" && edge.id.startsWith(PREREQUISITE_EDGE_PREFIX);
}

/**
 * Build the prerequisite edges for the nodes currently laid out.
 *
 * `relations` is the service's list of { source, target, kind }. `visibleNodeIds`
 * is optional; when given, an edge is emitted only if both endpoints are visible,
 * so a filtered-out course does not leave an edge hanging in space.
 */
export function buildPrerequisiteEdges(relations, nodes, visibleNodeIds = null) {
    const byKey = indexCourseNodes(nodes);
    const edges = [];
    const seen = new Set();

    for (const relation of relations || []) {
        const sourceId = byKey.get(normaliseCourseKey(relation?.source));
        const targetId = byKey.get(normaliseCourseKey(relation?.target));
        if (!sourceId || !targetId || sourceId === targetId) continue;
        if (visibleNodeIds && (!visibleNodeIds.has(sourceId) || !visibleNodeIds.has(targetId))) continue;

        const id = `${PREREQUISITE_EDGE_PREFIX}${sourceId}-${targetId}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const isHard = relation?.kind === "hard";
        const colour = isHard ? HARD_EDGE_COLOUR : SOFT_EDGE_COLOUR;
        edges.push({
            id,
            source: sourceId,
            target: targetId,
            type: "smoothstep",
            zIndex: 1,
            animated: false,
            style: {
                stroke: colour,
                strokeWidth: 2,
                strokeDasharray: isHard ? undefined : "6 4",
            },
            markerEnd: { type: "arrowclosed", color: colour, width: 16, height: 16 },
            label: isHard ? "required before" : "recommended before",
            labelStyle: { fill: colour, fontSize: 10, fontWeight: 700 },
            labelBgStyle: { fill: "#ffffff", fillOpacity: 0.85 },
            labelBgPadding: [3, 2],
            labelBgBorderRadius: 3,
            data: { kind: isHard ? "hard" : "soft", relation: "prerequisite" },
        });
    }

    return edges;
}

export const PREREQUISITE_EDGE_COLOURS = { soft: SOFT_EDGE_COLOUR, hard: HARD_EDGE_COLOUR };
