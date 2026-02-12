import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { applyNodeChanges, Background, Controls, MarkerType, MiniMap, SelectionMode, useNodesState } from "reactflow";
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
const MAX_PERSISTED_ABS_X = 10000;

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
                    examSubject: mod?.module_exam_subject ?? subjectName ?? null,
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
                    examSubject: mod?.module_exam_subject ?? subjectName ?? null,
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

function mergeNodesWithPinnedPositions(nextNodes, prevNodes, edges, persistedPosById = {}) {
    const prevById = new Map((prevNodes || []).map((n) => [n.id, n]));
    const nextById = new Map((nextNodes || []).map((n) => [n.id, n]));
    const parentByChild = new Map((edges || []).map((e) => [e.target, e.source]));
    const persisted = persistedPosById && typeof persistedPosById === "object" ? persistedPosById : {};

    return (nextNodes || []).map((nextNode) => {
        const persistedValue = persisted?.[nextNode.id];
        const persistedX = Number(persistedValue?.x);
        if (Number.isFinite(persistedX) && Math.abs(persistedX) < MAX_PERSISTED_ABS_X) {
            return {
                ...nextNode,
                position: {
                    x: persistedX,
                    y: nextNode.position.y,
                },
            };
        }

        const prevNode = prevById.get(nextNode.id);
        if (prevNode) {
            return {
                ...nextNode,
                position: {
                    x: prevNode.position.x,
                    y: nextNode.position.y,
                },
            };
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
    const rfRef = useRef(null);
    const root = useMemo(() => buildTree(catalog, subjectColors), [catalog, subjectColors]);
    const isDraggingRef = useRef(false);
    const suppressCollapsedPersistRef = useRef(false);
    const [isProgramSwitching, setIsProgramSwitching] = useState(false);
    const [interactionMode, setInteractionMode] = useState("pan");
    const [collapsedIds, setCollapsedIds] = useState(() => {
        const saved = graphViewState?.collapsedIds;
        if (Array.isArray(saved)) return new Set(saved);
        return collectCollapsibleIds(root);
    });

    useEffect(() => {
        suppressCollapsedPersistRef.current = true;
        setCollapsedIds((prev) => {
            const allowed = collectCollapsibleIds(root);
            const saved = Array.isArray(graphViewState?.collapsedIds) ? new Set(graphViewState.collapsedIds) : null;
            const next = saved
                ? new Set([...saved].filter((id) => allowed.has(id)))
                : allowed;
            const same = next.size === prev.size && [...next].every((id) => prev.has(id));
            if (same) {
                suppressCollapsedPersistRef.current = false;
                return prev;
            }
            if (saved) {
                return next;
            }
            // Program-specific default: start collapsed for this program's tree.
            // Do not reuse previous program's collapsed set.
            return next;
        });
    }, [root, graphViewState?.collapsedIds]);

    useEffect(() => {
        if (suppressCollapsedPersistRef.current) return;
        const next = Array.from(collapsedIds);
        const current = Array.isArray(graphViewState?.collapsedIds) ? graphViewState.collapsedIds : [];
        if (next.length === current.length && next.every((v, i) => v === current[i])) return;
        setGraphViewState?.((prev) => ({ ...prev, collapsedIds: next }));
    }, [collapsedIds, graphViewState?.collapsedIds, setGraphViewState]);

    useEffect(() => {
        if (suppressCollapsedPersistRef.current) {
            suppressCollapsedPersistRef.current = false;
        }
    }, [collapsedIds]);

    useEffect(() => {
        setIsProgramSwitching(true);
        const t = window.setTimeout(() => {
            setIsProgramSwitching(false);
        }, 120);
        return () => window.clearTimeout(t);
    }, [programCode]);

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
    const [displayNodes, setDisplayNodes] = useNodesState(nodes);
    const edges = autoEdges;

    const onNodesChange = useCallback((changes) => {
        setDisplayNodes((prevNodes) => {
            const prevById = new Map((prevNodes || []).map((n) => [n.id, n]));
            const clampedChanges = (changes || []).map((change) => {
                if (change?.type !== "position" || !change?.position || !change?.id) {
                    return change;
                }
                const prevNode = prevById.get(change.id);
                const lockedY = Number(prevNode?.position?.y);
                if (!Number.isFinite(lockedY)) return change;
                return {
                    ...change,
                    position: {
                        ...change.position,
                        y: lockedY,
                    },
                };
            });
            return applyNodeChanges(clampedChanges, prevNodes);
        });
    }, [setDisplayNodes]);

    useEffect(() => {
        if (isDraggingRef.current) return;
        setDisplayNodes((prev) => {
            const merged = mergeNodesWithPinnedPositions(nodes, prev, autoEdges, graphViewState?.nodePosById);
            const noOverlap = resolveNodeOverlaps(merged);
            return enforceHierarchicalOrder(noOverlap, subjectOrder, new Set());
        });
    }, [nodes, autoEdges, subjectOrder, setDisplayNodes, graphViewState?.nodePosById]);

    const onNodeClick = useCallback((_, node) => {
        if (node?.data?.level === "root" || !node?.data?.hasChildren) return;
        setCollapsedIds((prev) => {
            const next = new Set(prev);
            if (next.has(node.id)) next.delete(node.id);
            else next.add(node.id);
            return next;
        });
    }, []);

    const dragStartPosById = useRef(new Map());
    const dragLeaderIdRef = useRef(null);

    const onNodeDragStart = useCallback((_, node) => {
        if (!node?.id) return;
        isDraggingRef.current = true;
        dragLeaderIdRef.current = node.id;
        const selectedNodes = (displayNodes || []).filter((n) => n?.selected);
        const group = selectedNodes.length > 0 ? selectedNodes : (displayNodes || []).filter((n) => n.id === node.id);
        const startMap = new Map();
        for (const n of group) {
            startMap.set(n.id, { x: Number(n?.position?.x ?? 0), y: Number(n?.position?.y ?? 0) });
        }
        // Ensure leader is always present.
        if (!startMap.has(node.id)) {
            startMap.set(node.id, { x: Number(node?.position?.x ?? 0), y: Number(node?.position?.y ?? 0) });
        }
        dragStartPosById.current = startMap;
    }, [displayNodes]);

    const onNodeDrag = useCallback((_, node) => {
        if (!node?.id) return;
        const leaderId = dragLeaderIdRef.current || node.id;
        const leaderStart = dragStartPosById.current.get(leaderId);
        if (!leaderStart) return;
        const dx = Number(node?.position?.x ?? 0) - Number(leaderStart.x ?? 0);
        setDisplayNodes((prev) =>
            prev.map((n) =>
                dragStartPosById.current.has(n.id)
                    ? {
                        ...n,
                        position: {
                            x: Number(dragStartPosById.current.get(n.id)?.x ?? n.position.x) + dx,
                            y: Number(dragStartPosById.current.get(n.id)?.y ?? n.position.y),
                        },
                    }
                    : n
            )
        );
    }, [setDisplayNodes]);

    const onNodeDragStop = useCallback((_, node) => {
        if (!node?.id) return;
        isDraggingRef.current = false;
        const startPosById = dragStartPosById.current;
        const movedNodeIds = Array.from(dragStartPosById.current.keys());
        dragLeaderIdRef.current = null;
        dragStartPosById.current = new Map();
        if (movedNodeIds.length === 0) return;

        // Enforce horizontal-only drag for single and multi-selection drags.
        setDisplayNodes((prev) =>
            prev.map((n) =>
                movedNodeIds.includes(n.id)
                    ? {
                        ...n,
                        position: {
                            x: Number(n?.position?.x ?? 0),
                            y: Number(startPosById.get(n.id)?.y ?? n?.position?.y ?? 0),
                        },
                    }
                    : n
            )
        );

        setGraphViewState?.((prev) => {
            const currentPosById = prev?.nodePosById ?? {};
            const byId = new Map((displayNodes || []).map((n) => [n.id, n]));
            const nextPosById = { ...currentPosById };
            let changed = false;
            for (const id of movedNodeIds) {
                const n = byId.get(id);
                const x = Number(n?.position?.x);
                if (!Number.isFinite(x) || Math.abs(x) >= MAX_PERSISTED_ABS_X) continue;
                const prevEntry = currentPosById?.[id] ?? null;
                const prevY = Number(prevEntry?.y);
                const y = Number.isFinite(prevY) ? prevY : Number(n?.position?.y ?? 0);
                const prevX = Number(prevEntry?.x);
                if (Number.isFinite(prevX) && prevX === x && Number(prevEntry?.y) === y) continue;
                nextPosById[id] = { x, y };
                changed = true;
            }
            if (!changed) return prev;
            return {
                ...prev,
                nodePosById: nextPosById,
            };
        });
    }, [displayNodes, setGraphViewState]);

    const persistGraphSnapshot = useCallback(() => {
        const currentNodePosById = graphViewState?.nodePosById ?? {};
        const nextNodePosById = {};
        for (const node of displayNodes || []) {
            if (!node?.id) continue;
            const x = Number(node?.position?.x);
            if (!Number.isFinite(x) || Math.abs(x) >= MAX_PERSISTED_ABS_X) continue;
            const prevY = Number(currentNodePosById?.[node.id]?.y);
            const y = Number.isFinite(prevY) ? prevY : Number(node?.position?.y ?? 0);
            nextNodePosById[node.id] = { x, y };
        }
        setGraphViewState?.((prev) => ({
            ...prev,
            collapsedIds: Array.from(collapsedIds),
            nodePosById: nextNodePosById,
        }));
    }, [displayNodes, graphViewState?.nodePosById, collapsedIds, setGraphViewState]);

    useEffect(() => {
        if (!rfRef.current) return;
        if (!Array.isArray(displayNodes) || displayNodes.length === 0) return;
        window.requestAnimationFrame(() => {
            try {
                rfRef.current.fitView({ padding: 0.2, includeHiddenNodes: true });
            } catch {
                // no-op
            }
        });
    }, [displayNodes.length, programCode]);

    return (
        <div style={{ height: "100%", width: "100%", position: "relative", background: "#f9fafb" }}>
            <button
                onClick={() => {
                    persistGraphSnapshot();
                    onSwitchToTable?.();
                }}
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
                    isDraggingRef.current = false;
                    setGraphViewState?.((prev) => ({
                        ...prev,
                        nodePosById: {},
                    }));
                    setDisplayNodes(nodes);
                }}
                style={{
                    position: "absolute",
                    top: 52,
                    left: 352,
                    zIndex: 5,
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontWeight: 600,
                    cursor: "pointer",
                }}
            >
                Reorder Horizontal
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
                onClick={() => {
                    setInteractionMode((m) => (m === "pan" ? "select" : "pan"));
                }}
                style={{
                    position: "absolute",
                    top: 92,
                    left: 12,
                    zIndex: 5,
                    border: "1px solid #d1d5db",
                    background: interactionMode === "select" ? "#dbeafe" : "#ffffff",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontWeight: 600,
                    cursor: "pointer",
                }}
            >
                Mode: {interactionMode === "select" ? "Select" : "Pan"}
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
                onChange={(e) => {
                    persistGraphSnapshot();
                    setProgramCode?.(e.target.value);
                }}
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
            {isProgramSwitching ? (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        color: "#6b7280",
                        fontSize: 13,
                        fontWeight: 600,
                    }}
                >
                    Loading graph...
                </div>
            ) : (
                <ReactFlow
                    onInit={(instance) => {
                        rfRef.current = instance;
                    }}
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
                    minZoom={0.2}
                    nodesConnectable={false}
                    nodesDraggable
                    elementsSelectable
                    selectNodesOnDrag={interactionMode === "select"}
                    selectionOnDrag={interactionMode === "select"}
                    selectionKeyCode={null}
                    selectionMode={SelectionMode.Partial}
                    multiSelectionKeyCode={["Meta", "Shift", "Control"]}
                    panOnDrag={interactionMode === "pan"}
                    proOptions={{ hideAttribution: true }}
                >
                    <MiniMap pannable zoomable />
                    <Controls />
                    <Background gap={18} />
                </ReactFlow>
            )}
        </div>
    );
}
