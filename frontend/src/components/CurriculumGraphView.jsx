import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, MarkerType, MiniMap, useNodesState } from "reactflow";
import "reactflow/dist/style.css";
import { CARD_WIDTH, NODE_HEIGHT, SEMESTERS } from "../utils/constants.js";
import {
    GraphCourseNode,
    GraphModuleNode,
    GraphRootNode,
    GraphSubjectNode,
} from "./graphNodes/index.js";
import VisualLegend from "./VisualLegend.jsx";

const X_BY_LEVEL = {
    root: 40,
    subject: 340,
    module: 660,
    courseDirect: 660,
    course: 980,
};

const GRAPH_NODE_WIDTH = CARD_WIDTH;
const GRAPH_NODE_HEIGHT = NODE_HEIGHT;
const LEAF_VERTICAL_SPACING = NODE_HEIGHT + 36;
const NODE_COLLISION_GAP = 12;

const NODE_TYPES = {
    graphRoot: GraphRootNode,
    graphSubject: GraphSubjectNode,
    graphModule: GraphModuleNode,
    graphCourse: GraphCourseNode,
};

function nodeTypeForLevel(level) {
    if (level === "root") return "graphRoot";
    if (level === "subject") return "graphSubject";
    if (level === "module") return "graphModule";
    return "graphCourse";
}

function buildTree(catalog, subjectColors) {
    const subjects = (catalog || []).map((pf, pfIdx) => {
        const subjectName = pf?.pruefungsfach ?? `Pruefungsfach ${pfIdx + 1}`;
        const subjectColor = subjectColors?.[subjectName] ?? "#4b5563";
        const sourceModules = pf?.modules || [];
        const modules = sourceModules.flatMap((mod, modIdx) => {
            const courses = mod?.courses || [];

            // Match table behavior: module wrapper only if module has multiple courses.
            if (courses.length === 1) {
                const course = courses[0];
                return [{
                    id: `course-${pfIdx}-${modIdx}-single-${course?.code || mod?.code || "course"}`,
                    label: `${course?.name || mod?.name || "Course"}`,
                    level: "courseDirect",
                    color: subjectColor,
                    courseCode: course?.code ?? mod?.code ?? "",
                    courseName: course?.name ?? mod?.name ?? "Course",
                    ects: course?.ects ?? mod?.ects ?? null,
                    category: mod?.category ?? null,
                    examSubject: mod?.module_exam_subject ?? pfName ?? null,
                    children: [],
                }];
            }

            const modulePayload = {
                code: mod?.code ?? "",
                name: mod?.name ?? "Module",
                category: mod?.category ?? null,
                examSubject: mod?.module_exam_subject ?? subjectName ?? null,
                subjectColor,
                courses: courses.map((course) => ({
                    code: course?.code ?? "",
                    name: course?.name ?? "Course",
                    ects: course?.ects ?? null,
                })),
            };

            return [{
                id: `module-${pfIdx}-${modIdx}-${mod?.code || mod?.name || "module"}`,
                label: `${mod?.name || "Module"}`,
                level: "module",
                color: subjectColor,
                moduleCode: mod?.code ?? "",
                moduleEcts: mod?.ects ?? null,
                moduleCourseCount: courses.length,
                category: mod?.category ?? null,
                examSubject: mod?.module_exam_subject ?? subjectName ?? null,
                modulePayload,
                moduleCourseCodes: courses.map((course) => course?.code).filter(Boolean),
                children: courses.map((course, courseIdx) => ({
                    id: `course-${pfIdx}-${modIdx}-${courseIdx}-${course?.code || "course"}`,
                    label: `${course?.name || "Course"}`,
                    level: "course",
                    color: subjectColor,
                    courseCode: course?.code ?? "",
                    courseName: course?.name ?? "Course",
                    ects: course?.ects ?? null,
                    category: mod?.category ?? null,
                    examSubject: mod?.module_exam_subject ?? pfName ?? null,
                    parentModulePayload: modulePayload,
                    children: [],
                })),
            }];
        });

        return {
            id: `subject-${pfIdx}-${subjectName}`,
            label: subjectName,
            level: "subject",
            color: subjectColor,
            moduleCount: sourceModules.length,
            children: modules,
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

function layoutTree(root, collapsedIds, options = {}) {
    const getCourseStatus = options?.getCourseStatus;
    const onAddToPlan = options?.onAddToPlan;
    const onToggleDone = options?.onToggleDone;
    const onAddModuleToPlan = options?.onAddModuleToPlan;
    const onToggleModuleDone = options?.onToggleModuleDone;
    const onRemoveFromPlan = options?.onRemoveFromPlan;
    const onRemoveModuleFromPlan = options?.onRemoveModuleFromPlan;
    const programCode = options?.programCode ?? "";
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
        let status = null;
        if (node.level === "course" || node.level === "courseDirect") {
            status = getCourseStatus?.(node?.courseCode) ?? "todo";
        } else if (node.level === "module") {
            const codes = Array.isArray(node?.moduleCourseCodes) ? node.moduleCourseCodes : [];
            const statuses = codes.map((code) => getCourseStatus?.(code) ?? "todo");
            if (statuses.length === 0) status = "todo";
            else if (statuses.every((s) => s === "done")) status = "done";
            else if (statuses.some((s) => s === "in_plan" || s === "done")) status = "in_plan";
            else status = "todo";
        }
        nodes.push({
            id: node.id,
            type: nodeTypeForLevel(node.level),
            position: { x, y },
            data: {
                label: `${prefix}${node.label}`,
                level: node.level,
                hasChildren: canExpand,
                color: node.color,
                subjectId,
                courseCode: node?.courseCode ?? null,
                courseName: node?.courseName ?? null,
                ects: node?.ects ?? null,
                category: node?.category ?? null,
                examSubject: node?.examSubject ?? null,
                programCode,
                moduleCount: node?.moduleCount ?? null,
                status,
                onAddToPlan: (node.level === "course" || node.level === "courseDirect") ? onAddToPlan : null,
                onToggleDone: (node.level === "course" || node.level === "courseDirect") ? onToggleDone : null,
                semesters: (node.level === "course" || node.level === "courseDirect") ? SEMESTERS : null,
                modulePayload: node?.modulePayload ?? null,
                moduleCourseCodes: node?.moduleCourseCodes ?? null,
                moduleCode: node?.moduleCode ?? null,
                moduleEcts: node?.moduleEcts ?? null,
                moduleCourseCount: node?.moduleCourseCount ?? null,
                parentModulePayload: node?.parentModulePayload ?? null,
                onAddModuleToPlan: (node.level === "module" || node.level === "course") ? onAddModuleToPlan : null,
                onToggleModuleDone: node.level === "module" ? onToggleModuleDone : null,
                onRemoveFromPlan: (node.level === "course" || node.level === "courseDirect") ? onRemoveFromPlan : null,
                onRemoveModuleFromPlan: (node.level === "module" || node.level === "course") ? onRemoveModuleFromPlan : null,
                semestersForModule: node.level === "module" ? SEMESTERS : null,
            },
            sourcePosition: "right",
            targetPosition: "left",
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

function mergeNodesWithPinnedPositions(nextNodes, prevNodes, edges, persistedXById = {}) {
    const prevById = new Map((prevNodes || []).map((n) => [n.id, n]));
    const nextById = new Map((nextNodes || []).map((n) => [n.id, n]));
    const parentByChild = new Map((edges || []).map((e) => [e.target, e.source]));
    const persisted = persistedXById && typeof persistedXById === "object" ? persistedXById : {};

    return (nextNodes || []).map((nextNode) => {
        const prevNode = prevById.get(nextNode.id);
        if (prevNode) {
            // Preserve only manual horizontal moves; vertical position should reflow.
            return { ...nextNode, position: { x: prevNode.position.x, y: nextNode.position.y } };
        }

        const persistedX = persisted?.[nextNode.id];
        if (Number.isFinite(persistedX)) {
            return { ...nextNode, position: { x: persistedX, y: nextNode.position.y } };
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

export default function CurriculumGraphView({
    catalog,
    subjectColors,
    onSwitchToTable,
    programCode,
    setProgramCode,
    programOptions,
    selectedFocus,
    setSelectedFocus,
    bachelorProgramCode,
    bachelorFocusOptions,
    getCourseStatus,
    onAddToPlan,
    onToggleDone,
    onAddModuleToPlan,
    onToggleModuleDone,
    onRemoveFromPlan,
    onRemoveModuleFromPlan,
    graphViewState,
    setGraphViewState,
    ruleFeedback,
    isRuleDashboardOpen,
    onToggleRuleDashboard,
    isLegendOpen,
    onToggleLegend,
}) {
    const root = useMemo(() => buildTree(catalog, subjectColors), [catalog, subjectColors]);
    const [collapsedIds, setCollapsedIds] = useState(() => {
        const saved = graphViewState?.collapsedIds;
        if (Array.isArray(saved)) return new Set(saved);
        return collectCollapsibleIds(root);
    });

    useEffect(() => {
        setCollapsedIds((prev) => {
            const allowed = collectCollapsibleIds(root);
            const saved = Array.isArray(graphViewState?.collapsedIds) ? new Set(graphViewState.collapsedIds) : null;
            if (saved) {
                return new Set([...saved].filter((id) => allowed.has(id)));
            }
            return new Set([...prev].filter((id) => allowed.has(id)));
        });
    }, [root, graphViewState?.collapsedIds]);

    useEffect(() => {
        const next = Array.from(collapsedIds);
        const current = Array.isArray(graphViewState?.collapsedIds) ? graphViewState.collapsedIds : [];
        if (next.length === current.length && next.every((v, i) => v === current[i])) return;
        setGraphViewState?.((prev) => ({ ...prev, collapsedIds: next }));
    }, [collapsedIds, graphViewState?.collapsedIds, setGraphViewState]);

    const { nodes, edges: autoEdges } = useMemo(() => {
        return layoutTree(root, collapsedIds, {
            getCourseStatus,
            onAddToPlan,
            onToggleDone,
            onAddModuleToPlan,
            onToggleModuleDone,
            onRemoveFromPlan,
            onRemoveModuleFromPlan,
            programCode,
        });
    }, [
        root,
        collapsedIds,
        getCourseStatus,
        onAddToPlan,
        onToggleDone,
        onAddModuleToPlan,
        onToggleModuleDone,
        onRemoveFromPlan,
        onRemoveModuleFromPlan,
        programCode,
    ]);
    const subjectOrder = useMemo(
        () => (root?.children || []).map((s) => s.id),
        [root]
    );
    const [displayNodes, setDisplayNodes, onNodesChange] = useNodesState(nodes);
    const edges = autoEdges;

    useEffect(() => {
        setDisplayNodes((prev) => {
            const merged = mergeNodesWithPinnedPositions(nodes, prev, autoEdges, graphViewState?.nodeXById);
            const noOverlap = resolveNodeOverlaps(merged);
            return enforceHierarchicalOrder(noOverlap, subjectOrder, new Set());
        });
    }, [nodes, autoEdges, subjectOrder, setDisplayNodes, graphViewState?.nodeXById]);

    useEffect(() => {
        const nextNodeXById = {};
        for (const node of displayNodes || []) {
            if (!node?.id) continue;
            const x = Number(node?.position?.x);
            if (!Number.isFinite(x)) continue;
            nextNodeXById[node.id] = x;
        }
        const currentNodeXById = graphViewState?.nodeXById ?? {};
        const currentKeys = Object.keys(currentNodeXById);
        const nextKeys = Object.keys(nextNodeXById);
        if (currentKeys.length === nextKeys.length && currentKeys.every((k) => currentNodeXById[k] === nextNodeXById[k])) {
            return;
        }
        setGraphViewState?.((prev) => ({
            ...prev,
            nodeXById: nextNodeXById,
        }));
    }, [displayNodes, graphViewState?.nodeXById, setGraphViewState]);

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
        <div style={{ height: "100%", width: "100%", position: "relative", background: "#f9fafb" }}>
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
            <button
                onClick={() => onToggleRuleDashboard?.()}
                style={{
                    position: "absolute",
                    top: 52,
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
                {isRuleDashboardOpen ? "Close Rule Dashboard" : "Open Rule Dashboard"}
            </button>
            <button
                onClick={() => onToggleLegend?.()}
                style={{
                    position: "absolute",
                    top: 52,
                    left: 212,
                    zIndex: 5,
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontWeight: 600,
                    cursor: "pointer",
                }}
            >
                {isLegendOpen ? "Hide Legend" : "Show Legend"}
            </button>
            <select
                value={programCode}
                onChange={(e) => setProgramCode?.(e.target.value)}
                style={{
                    position: "absolute",
                    top: 12,
                    left: 214,
                    zIndex: 5,
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    borderRadius: 8,
                    padding: "8px 10px",
                    fontWeight: 600,
                    minWidth: 290,
                }}
            >
                {(programOptions || []).map((opt) => (
                    <option key={opt.code} value={opt.code}>
                        {opt.label} ({opt.code})
                    </option>
                ))}
            </select>
            {programCode === bachelorProgramCode && (
                <select
                    value={selectedFocus || ""}
                    onChange={(e) => setSelectedFocus?.(e.target.value)}
                    style={{
                        position: "absolute",
                        top: 12,
                        left: 512,
                        zIndex: 5,
                        border: "1px solid #d1d5db",
                        background: "#ffffff",
                        borderRadius: 8,
                        padding: "8px 10px",
                        fontWeight: 600,
                        minWidth: 320,
                    }}
                >
                    <option value="">Select focus area</option>
                    {(bachelorFocusOptions || []).map((focus) => (
                        <option key={focus} value={focus}>
                            {focus}
                        </option>
                    ))}
                </select>
            )}
            {ruleFeedback?.text && (
                <div
                    style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        zIndex: 5,
                        border: `1px solid ${ruleFeedback.border || "#d1d5db"}`,
                        background: ruleFeedback.bg || "#f3f4f6",
                        color: ruleFeedback.color || "#374151",
                        borderRadius: 8,
                        padding: "8px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                        maxWidth: 360,
                    }}
                >
                    {ruleFeedback.text}
                </div>
            )}
            {isLegendOpen && (
                <div style={{ position: "absolute", right: 12, bottom: 12, zIndex: 5 }}>
                    <VisualLegend programCode={programCode} />
                </div>
            )}
            <ReactFlow
                nodes={displayNodes}
                edges={edges}
                nodeTypes={NODE_TYPES}
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
