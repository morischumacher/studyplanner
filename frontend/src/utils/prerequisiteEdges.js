/**
 * Turning the curriculum's prerequisite relations into graph edges.
 *
 * The relations name courses and modules; the graph addresses nodes. This module
 * resolves the first to the second and nothing else: it holds no relations of its
 * own, reads no state, and touches no framework, so it can be exercised directly.
 *
 * A relation is drawn only when both of its endpoints are nodes currently on the
 * canvas. A course inside a collapsed module has no node, so its relation is not
 * drawn rather than being attached to the module standing in for it, which would
 * assert a relation the curriculum does not hold.
 *
 * Two kinds are drawn differently because they answer different questions. The
 * enforced and advisory relations are few and belong to the whole graph, so the
 * sidebar switches them on together. The recommended relations are the
 * curriculum's "Erwartete Vorkenntnisse", one entry per module, and there are
 * potentially as many of them as there are modules: drawn together they would be
 * a thicket rather than a reading. They are therefore revealed one node at a
 * time, from the node itself.
 */

const PREREQUISITE_EDGE_PREFIX = "prereq-";

const SOFT_EDGE_COLOUR = "#b45309";
const HARD_EDGE_COLOUR = "#b91c1c";
const RECOMMENDED_EDGE_COLOUR = "#4338ca";

/** The kinds the sidebar's single switch is responsible for. */
export const GLOBAL_PREREQUISITE_KINDS = ["soft", "hard"];

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
 * Index the nodes a relation might name, by every name it might use.
 *
 * Courses are indexed by code and by name. Modules are indexed too, because the
 * curriculum states its expected prior knowledge in terms of modules ("Diese
 * Voraussetzungen werden in folgenden Modulen vermittelt: ..."), not courses.
 * Later nodes do not displace earlier ones, so the first node carrying a given
 * key wins and the mapping is stable; courses are indexed before modules so that
 * a course and a module sharing a name resolve to the course, which is the more
 * specific of the two.
 */
export function indexCourseNodes(nodes) {
    const byKey = new Map();
    const add = (candidate, id) => {
        const key = normaliseCourseKey(candidate);
        if (!key || byKey.has(key)) return;
        byKey.set(key, id);
    };
    const all = Array.isArray(nodes) ? nodes : [];
    for (const node of all) {
        const level = node?.data?.level;
        if (level !== "course" && level !== "courseDirect") continue;
        add(node?.data?.courseCode, node.id);
        add(node?.data?.courseName, node.id);
        add(node?.data?.label, node.id);
    }
    for (const node of all) {
        if (node?.data?.level !== "module") continue;
        add(node?.data?.moduleCode, node.id);
        add(stripDisclosureMarker(node?.data?.label), node.id);
    }
    return byKey;
}

/** A collapsible node's label carries a "▶ " or "▼ " marker the curriculum does not. */
function stripDisclosureMarker(label) {
    return String(label ?? "").replace(/^[▶▼]\s*/, "");
}

export function isPrerequisiteEdge(edge) {
    return typeof edge?.id === "string" && edge.id.startsWith(PREREQUISITE_EDGE_PREFIX);
}

/**
 * How many recommended relations each node is an endpoint of, by node id.
 *
 * The node uses this to decide whether to offer the control at all: a node with
 * nothing to reveal should not carry a button that reveals nothing. Counted over
 * the laid-out nodes rather than the relations, so a relation whose other end is
 * not on the canvas is not counted.
 */
export function countRecommendedByNode(relations, nodes) {
    const byKey = indexCourseNodes(nodes);
    const counts = new Map();
    const bump = (id) => counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const relation of relations || []) {
        if (relation?.kind !== "recommended") continue;
        const sourceId = byKey.get(normaliseCourseKey(relation?.source));
        const targetId = byKey.get(normaliseCourseKey(relation?.target));
        if (!sourceId || !targetId || sourceId === targetId) continue;
        bump(sourceId);
        bump(targetId);
    }
    return counts;
}

const STYLE_BY_KIND = {
    hard: { colour: HARD_EDGE_COLOUR, dash: undefined, label: "required before", width: 2 },
    soft: { colour: SOFT_EDGE_COLOUR, dash: "6 4", label: "recommended before", width: 2 },
    recommended: { colour: RECOMMENDED_EDGE_COLOUR, dash: "2 4", label: "expected knowledge", width: 1.5 },
};

/**
 * Build the prerequisite edges for the nodes currently laid out.
 *
 * `relations` is the service's list of { source, target, kind }. `visibleNodeIds`
 * is optional; when given, an edge is emitted only if both endpoints are visible,
 * so a filtered-out course does not leave an edge hanging in space.
 *
 * `options.kinds` restricts which kinds are drawn. `options.anchorIds` restricts
 * the drawing further to relations touching one of those nodes, which is how a
 * single node reveals its own expected knowledge without the rest of the graph's.
 */
export function buildPrerequisiteEdges(relations, nodes, visibleNodeIds = null, options = {}) {
    const kinds = options.kinds ? new Set(options.kinds) : null;
    const anchorIds = options.anchorIds ? new Set(options.anchorIds) : null;
    const byKey = indexCourseNodes(nodes);
    const edges = [];
    const seen = new Set();

    for (const relation of relations || []) {
        const kind = relation?.kind === "hard" ? "hard" : (relation?.kind === "recommended" ? "recommended" : "soft");
        if (kinds && !kinds.has(kind)) continue;

        const sourceId = byKey.get(normaliseCourseKey(relation?.source));
        const targetId = byKey.get(normaliseCourseKey(relation?.target));
        if (!sourceId || !targetId || sourceId === targetId) continue;
        if (visibleNodeIds && (!visibleNodeIds.has(sourceId) || !visibleNodeIds.has(targetId))) continue;
        if (anchorIds && !anchorIds.has(sourceId) && !anchorIds.has(targetId)) continue;

        const id = `${PREREQUISITE_EDGE_PREFIX}${kind}-${sourceId}-${targetId}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const style = STYLE_BY_KIND[kind];
        edges.push({
            id,
            source: sourceId,
            target: targetId,
            type: "smoothstep",
            zIndex: 1,
            animated: false,
            style: {
                stroke: style.colour,
                strokeWidth: style.width,
                strokeDasharray: style.dash,
            },
            markerEnd: { type: "arrowclosed", color: style.colour, width: 16, height: 16 },
            label: style.label,
            labelStyle: { fill: style.colour, fontSize: 10, fontWeight: 700 },
            labelBgStyle: { fill: "#ffffff", fillOpacity: 0.85 },
            labelBgPadding: [3, 2],
            labelBgBorderRadius: 3,
            data: { kind, relation: "prerequisite" },
        });
    }

    return edges;
}

export const PREREQUISITE_EDGE_COLOURS = {
    soft: SOFT_EDGE_COLOUR,
    hard: HARD_EDGE_COLOUR,
    recommended: RECOMMENDED_EDGE_COLOUR,
};
