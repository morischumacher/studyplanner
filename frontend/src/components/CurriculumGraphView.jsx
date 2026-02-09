import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, MarkerType, MiniMap, useNodesState } from "reactflow";
import "reactflow/dist/style.css";
import { hexToRgba, MODULE_GROUP_COLOR_ALPHA } from "../utils/examSubjectColors.js";
import { CARD_WIDTH, NODE_HEIGHT } from "../utils/constants.js";

const X_BY_LEVEL = {
    root: 40,
    subject: 340,
    module: 660,
    course: 980,
};

const GRAPH_NODE_WIDTH = CARD_WIDTH;
const GRAPH_NODE_HEIGHT = NODE_HEIGHT;
const LEAF_VERTICAL_SPACING = 92;
const NODE_COLLISION_GAP = 12;

function styleForNode(level, baseColor) {
    const subjectColor = baseColor || "#4b5563";
    const baseCard = {
        width: GRAPH_NODE_WIDTH,
        height: GRAPH_NODE_HEIGHT,
        borderRadius: 10,
        boxSizing: "border-box",
        display: "-webkit-box",
        padding: "8px 12px",
        overflow: "hidden",
        overflowWrap: "anywhere",
        lineHeight: 1.25,
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: 2,
        textOverflow: "ellipsis",
        whiteSpace: "normal",
    };

    switch (level) {
        case "root":
            return {
                ...baseCard,
                background: "#111827",
                color: "#ffffff",
                border: "2px solid #111827",
                fontWeight: 700,
                fontSize: 14,
            };
        case "subject":
            return {
                ...baseCard,
                background: subjectColor,
                color: "#ffffff",
                border: `2px solid ${subjectColor}`,
                fontWeight: 700,
                fontSize: 13,
            };
        case "module":
            return {
                ...baseCard,
                background: hexToRgba(subjectColor, MODULE_GROUP_COLOR_ALPHA),
                color: "#111827",
                border: `2px solid ${subjectColor}`,
                fontWeight: 600,
                fontSize: 12,
            };
        case "course":
        default:
            return {
                ...baseCard,
                background: "#ffffff",
                color: "#111827",
                border: `1px solid ${subjectColor}`,
                borderLeft: `6px solid ${subjectColor}`,
                boxShadow: "0 1px 1px rgba(0,0,0,0.03)",
                fontWeight: 600,
                fontSize: 12,
            };
    }
}

function buildTree(catalog, subjectColors) {
    const subjects = (catalog || []).map((pf, pfIdx) => {
        const subjectName = pf?.pruefungsfach ?? `Pruefungsfach ${pfIdx + 1}`;
        const subjectColor = subjectColors?.[subjectName] ?? "#4b5563";
        return {
            id: `subject-${pfIdx}-${subjectName}`,
            label: subjectName,
            level: "subject",
            color: subjectColor,
            children: (pf?.modules || []).map((mod, modIdx) => ({
                id: `module-${pfIdx}-${modIdx}-${mod?.code || mod?.name || "module"}`,
                label: `${mod?.code ? `${mod.code} · ` : ""}${mod?.name || "Module"}`,
                level: "module",
                color: subjectColor,
                children: (mod?.courses || []).map((course, courseIdx) => ({
                    id: `course-${pfIdx}-${modIdx}-${courseIdx}-${course?.code || "course"}`,
                    label: `${course?.code ? `${course.code} · ` : ""}${course?.name || "Course"}`,
                    level: "course",
                    color: subjectColor,
                    children: [],
                })),
            })),
        };
    });

    return {
        id: "curriculum-root",
        label: "Curriculum",
        level: "root",
        color: "#111827",
        children: subjects,
    };
}

function collectCollapsibleIds(node, out = new Set()) {
    const children = Array.isArray(node?.children) ? node.children : [];
    if (node?.level !== "root" && children.length > 0) out.add(node.id);
    for (const child of children) collectCollapsibleIds(child, out);
    return out;
}

function layoutTree(root, collapsedIds) {
    const nodes = [];
    const edges = [];
    let leafIndex = 0;

    const visit = (node, parentId = null, depth = 0, currentSubjectId = null) => {
        const canExpand = Array.isArray(node.children) && node.children.length > 0;
        const isCollapsed = collapsedIds.has(node.id);
        const visibleChildren = canExpand && !isCollapsed ? node.children : [];
        const subjectId = node.level === "subject" ? node.id : currentSubjectId;

        let y;
        if (visibleChildren.length === 0) {
            y = leafIndex * LEAF_VERTICAL_SPACING;
            leafIndex += 1;
        } else {
            const childYs = visibleChildren.map((child) => visit(child, node.id, depth + 1, subjectId));
            y = (Math.min(...childYs) + Math.max(...childYs)) / 2;
        }

        const prefix = node.level !== "root" && canExpand ? (isCollapsed ? "▶ " : "▼ ") : "";
        const x = X_BY_LEVEL[node.level] ?? depth * 320;
        nodes.push({
            id: node.id,
            position: { x, y },
            data: {
                label: `${prefix}${node.label}`,
                level: node.level,
                hasChildren: canExpand,
                color: node.color,
                subjectId,
            },
            sourcePosition: "right",
            targetPosition: "left",
            style: styleForNode(node.level, node.color),
        });

        if (parentId) {
            const isRootToSubject = parentId === "curriculum-root";
            edges.push({
                id: `e-${parentId}-${node.id}`,
                source: parentId,
                target: node.id,
                type: isRootToSubject ? "straight" : "smoothstep",
                style: { stroke: "#9ca3af", strokeWidth: 1.6 },
                markerEnd: { type: MarkerType.ArrowClosed, color: "#9ca3af" },
            });
        }
        return y;
    };

    visit(root, null, 0);
    return { nodes, edges };
}

function mergeNodesWithPinnedPositions(nextNodes, prevNodes, edges) {
    const prevById = new Map((prevNodes || []).map((n) => [n.id, n]));
    const nextById = new Map((nextNodes || []).map((n) => [n.id, n]));
    const parentByChild = new Map((edges || []).map((e) => [e.target, e.source]));

    return (nextNodes || []).map((nextNode) => {
        const prevNode = prevById.get(nextNode.id);
        if (prevNode) {
            // Preserve only manual horizontal moves; vertical position should reflow.
            return { ...nextNode, position: { x: prevNode.position.x, y: nextNode.position.y } };
        }

        // New node (e.g. after expand): inherit parent's horizontal shift if parent moved.
        const parentId = parentByChild.get(nextNode.id);
        if (!parentId) return nextNode;

        const prevParent = prevById.get(parentId);
        const nextParent = nextById.get(parentId);
        if (!prevParent || !nextParent) return nextNode;

        const dx = prevParent.position.x - nextParent.position.x;
        return {
            ...nextNode,
            position: { x: nextNode.position.x + dx, y: nextNode.position.y },
        };
    });
}

function nodesOverlap(a, b, gap = NODE_COLLISION_GAP) {
    return (
        a.position.x < b.position.x + GRAPH_NODE_WIDTH + gap &&
        a.position.x + GRAPH_NODE_WIDTH + gap > b.position.x &&
        a.position.y < b.position.y + GRAPH_NODE_HEIGHT + gap &&
        a.position.y + GRAPH_NODE_HEIGHT + gap > b.position.y
    );
}

function resolveNodeOverlaps(inputNodes) {
    const nodes = (inputNodes || []).map((n) => ({ ...n, position: { ...n.position } }));
    nodes.sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x));

    // Push overlapping nodes downward until all collisions are resolved.
    for (let i = 0; i < nodes.length; i += 1) {
        let moved = true;
        while (moved) {
            moved = false;
            for (let j = 0; j < i; j += 1) {
                if (!nodesOverlap(nodes[i], nodes[j])) continue;
                nodes[i].position.y = nodes[j].position.y + GRAPH_NODE_HEIGHT + NODE_COLLISION_GAP;
                moved = true;
            }
        }
    }

    return nodes;
}

function enforceHierarchicalOrder(nodes, subjectOrder, movedNodeIds) {
    const moved = movedNodeIds || new Set();
    const byId = new Map((nodes || []).map((n) => [n.id, { ...n, position: { ...n.position } }]));
    const subjectIds = subjectOrder || [];

    const overlapAgainstEarlier = (group, idx) => {
        let y = group[idx].position.y;
        for (let j = 0; j < idx; j += 1) {
            while (nodesOverlap({ ...group[idx], position: { ...group[idx].position, y } }, group[j])) {
                y = group[j].position.y + GRAPH_NODE_HEIGHT + NODE_COLLISION_GAP;
            }
        }
        return y;
    };

    // 1) Resolve overlaps within each subject, but keep manually moved nodes pinned.
    for (const subjectId of subjectIds) {
        const group = Array.from(byId.values())
            .filter((n) => n?.data?.subjectId === subjectId)
            .sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x));

        for (let i = 0; i < group.length; i += 1) {
            if (moved.has(group[i].id)) continue;
            group[i].position.y = overlapAgainstEarlier(group, i);
            byId.set(group[i].id, group[i]);
        }
    }

    // 2) Keep exam-subject order strict: subject bands are stacked from top to bottom.
    let cursorY = 0;
    for (const subjectId of subjectIds) {
        const group = Array.from(byId.values()).filter((n) => n?.data?.subjectId === subjectId);
        if (!group.length) continue;

        const minY = Math.min(...group.map((n) => n.position.y));
        const maxY = Math.max(...group.map((n) => n.position.y + GRAPH_NODE_HEIGHT));
        const needsShift = minY < cursorY;
        if (needsShift) {
            const dy = cursorY - minY;
            for (const node of group) {
                if (moved.has(node.id)) continue;
                const shifted = {
                    ...node,
                    position: { x: node.position.x, y: node.position.y + dy },
                };
                byId.set(node.id, shifted);
            }
        }

        const groupAfter = Array.from(byId.values()).filter((n) => n?.data?.subjectId === subjectId);
        const bandBottom = Math.max(...groupAfter.map((n) => n.position.y + GRAPH_NODE_HEIGHT));
        cursorY = bandBottom + NODE_COLLISION_GAP;
    }

    return Array.from(byId.values());
}

export default function CurriculumGraphView({ catalog, subjectColors, onSwitchToTable }) {
    const root = useMemo(() => buildTree(catalog, subjectColors), [catalog, subjectColors]);
    const [collapsedIds, setCollapsedIds] = useState(() => collectCollapsibleIds(root));

    useEffect(() => {
        setCollapsedIds(collectCollapsibleIds(root));
    }, [root]);

    const { nodes, edges: autoEdges } = useMemo(() => {
        return layoutTree(root, collapsedIds);
    }, [root, collapsedIds]);
    const subjectOrder = useMemo(
        () => (root?.children || []).map((s) => s.id),
        [root]
    );
    const [displayNodes, setDisplayNodes, onNodesChange] = useNodesState(nodes);
    const edges = autoEdges;

    useEffect(() => {
        setDisplayNodes((prev) => {
            const merged = mergeNodesWithPinnedPositions(nodes, prev, autoEdges);
            const noOverlap = resolveNodeOverlaps(merged);
            return enforceHierarchicalOrder(noOverlap, subjectOrder, new Set());
        });
    }, [nodes, autoEdges, subjectOrder, setDisplayNodes]);

    const onNodeClick = useCallback((_, node) => {
        if (node?.data?.level === "root" || !node?.data?.hasChildren) return;
        setCollapsedIds((prev) => {
            const next = new Set(prev);
            if (next.has(node.id)) next.delete(node.id);
            else next.add(node.id);
            return next;
        });
    }, []);

    const dragStartYById = useRef(new Map());

    const onNodeDragStart = useCallback((_, node) => {
        if (!node?.id) return;
        dragStartYById.current.set(node.id, node.position.y);
    }, []);

    const onNodeDrag = useCallback((_, node) => {
        if (!node?.id) return;
        const lockedY = dragStartYById.current.get(node.id);
        if (typeof lockedY !== "number") return;
        setDisplayNodes((prev) =>
            prev.map((n) =>
                n.id === node.id
                    ? { ...n, position: { x: node.position.x, y: lockedY } }
                    : n
            )
        );
    }, [setDisplayNodes]);

    const onNodeDragStop = useCallback((_, node) => {
        if (!node?.id) return;
        dragStartYById.current.delete(node.id);
    }, []);

    return (
        <div style={{ height: "100vh", width: "100vw", position: "relative", background: "#f9fafb" }}>
            <button
                onClick={onSwitchToTable}
                style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    zIndex: 5,
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontWeight: 600,
                    cursor: "pointer",
                }}
            >
                Table View
            </button>
            <button
                onClick={() => {
                    setDisplayNodes(nodes);
                }}
                style={{
                    position: "absolute",
                    top: 12,
                    left: 122,
                    zIndex: 5,
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontWeight: 600,
                    cursor: "pointer",
                }}
            >
                Reorder
            </button>
            <ReactFlow
                nodes={displayNodes}
                edges={edges}
                onNodeClick={onNodeClick}
                onNodesChange={onNodesChange}
                onNodeDragStart={onNodeDragStart}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                nodesConnectable={false}
                nodesDraggable
                elementsSelectable
                proOptions={{ hideAttribution: true }}
            >
                <MiniMap pannable zoomable />
                <Controls />
                <Background gap={18} />
            </ReactFlow>
        </div>
    );
}
