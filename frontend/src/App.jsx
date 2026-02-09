// src/App.jsx
// Cleaned, commented, and lightly restructured version.
// NOTE: Logic and behaviors are preserved.

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { currentProgram } from "./ProgramContext.jsx";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useEdgesState,
    useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

import { fetchCatalog } from "./lib/api";
import { CourseCard, LaneColumn, ModuleGroupBackground, Sidebar } from "./components";
import {
    CANVAS_HEIGHT,
    CARD_WIDTH,
    COLLISION_GAP,
    DEFAULT_EDGE_OPTIONS,
    GRID_SIZE,
    GROUP_EXTRA_RIGHT,
    GROUP_PADDING_X,
    GROUP_PADDING_Y,
    MODULE_HEADER_HEIGHT,
    NODE_HEIGHT,
    SEMESTERS,
} from "./utils/constants.js";
import { centerX, laneIndexFromX, projectToLaneAndSnap } from "./utils/geometry.js";

/*********************************
 * React Flow node type registry *
 *********************************/
const NODE_TYPES = {
    course: CourseCard,
    lane: LaneColumn,
    moduleBg: ModuleGroupBackground,
};

/***********************
 * Edge-building utils *
 ***********************/
const VERTICAL_X_TOLERANCE = 24; // how far off in X two nodes can be and still count as "vertical"
const MIN_VERTICAL_GAP = 20; // minimum y-distance to be considered stacked
const SAME_LANE_REQUIRED = true; // only use vertical edges within the same lane

/** Return lane index for a node (based on its X). */
function laneIdx(node) {
    return laneIndexFromX(node.position.x);
}

/** True if two nodes are in (roughly) the same X position. */
function isRoughlySameX(a, b) {
    return Math.abs(a.position.x - b.position.x) <= VERTICAL_X_TOLERANCE;
}

/** True if b is placed below a by at least MIN_VERTICAL_GAP. */
function stackedVertically(a, b) {
    return b.position.y - a.position.y >= MIN_VERTICAL_GAP;
}

/**
 * Decide which handles to use when creating an edge from a → b.
 * Prefer vertical straight edges when stacked in the same lane; otherwise use horizontal smoothstep.
 */
function chooseHandles(a, b) {
    const sameLane = laneIdx(a) === laneIdx(b);
    if ((!SAME_LANE_REQUIRED || sameLane) && stackedVertically(a, b) && isRoughlySameX(a, b)) {
        return { sourceHandle: "bottom", targetHandle: "top", edgeType: "straight" };
    }
    const toRight = b.position.x >= a.position.x;
    return {
        sourceHandle: toRight ? "right" : "left",
        targetHandle: toRight ? "left" : "right",
        edgeType: "smoothstep",
    };
}

/***********************************************
 * Module group background (size/position) calc *
 ***********************************************/
/**
 * Recompute a group background node's size and position from its child course nodes.
 * If the group has no children, remove the group node.
 */
function recomputeGroupFromChildren(nodes, groupId) {
    const children = nodes.filter((n) => n.type === "course" && n.data?.groupId === groupId);
    const group = nodes.find((n) => n.type === "moduleBg" && n.id === groupId);
    if (!group) return nodes;

    // No children → remove the group background.
    if (children.length === 0) return nodes.filter((n) => n.id !== groupId);

    // Compute bounding box around children (spanning multiple lanes if needed).
    const minX = Math.min(...children.map((c) => c.position.x));
    const minY = Math.min(...children.map((c) => c.position.y));
    const maxX = Math.max(...children.map((c) => c.position.x + CARD_WIDTH));
    const maxY = Math.max(...children.map((c) => c.position.y + NODE_HEIGHT));

    const width = maxX - minX + GROUP_PADDING_X * 2 + GROUP_EXTRA_RIGHT;
    const height = maxY - minY + GROUP_PADDING_Y * 2 + MODULE_HEADER_HEIGHT;

    return nodes.map((n) =>
        n.id === groupId
            ? {
                ...n,
                position: {
                    x: minX - GROUP_PADDING_X,
                    y: minY - GROUP_PADDING_Y - MODULE_HEADER_HEIGHT,
                },
                data: { ...n.data, width, height },
            }
            : n
    );
}

/****************************************
 * Catalog → exam subject lookup helpers *
 ****************************************/
/**
 * Walk a normalized catalog to find the exam subject tied to a module or course code.
 * Returns the closest module exam subject; falls back to parent subject.
 */
function getExamSubjectForCode(catalog, code) {
    if (!code) return null;
    for (const pf of catalog || []) {
        const pfName = pf.pruefungsfach ?? null;
        for (const mod of pf.modules || []) {
            if (mod.code === code) return mod.module_exam_subject || pfName || null; // module by code
            for (const c of mod.courses || []) {
                if (c.code === code) return mod.module_exam_subject || pfName || null; // child course by code
            }
        }
    }
    return null;
}

/**
 * Build edges so that all nodes with the same exam subject form a chain ordered by
 * lane (left→right) and vertical position (top→bottom).
 *
 * Chain includes:
 *  - module group nodes that carry an examSubject
 *  - ungrouped course nodes that carry an examSubject
 */
function buildSubjectEdges(nodes) {
    const subjectNodes = [];

    for (const n of nodes) {
        if (n.type === "moduleBg" && n?.data?.examSubject) {
            subjectNodes.push({ id: n.id, subject: n.data.examSubject, node: n });
        } else if (n.type === "course" && !n?.data?.groupId && n?.data?.examSubject) {
            subjectNodes.push({ id: n.id, subject: n.data.examSubject, node: n });
        }
    }
    if (subjectNodes.length <= 1) return [];

    // Group nodes by subject
    const bySubject = {};
    for (const s of subjectNodes) (bySubject[s.subject] ||= []).push(s.node);

    const edges = [];
    for (const [subj, list] of Object.entries(bySubject)) {
        const sorted = list
            .slice()
            .sort((a, b) => {
                const la = laneIdx(a);
                const lb = laneIdx(b);
                if (la !== lb) return la - lb; // left → right
                if (a.position.y !== b.position.y) return a.position.y - b.position.y; // top → bottom
                return String(a.id).localeCompare(String(b.id));
            });

        for (let i = 0; i < sorted.length - 1; i++) {
            const from = sorted[i];
            const to = sorted[i + 1];
            const { sourceHandle, targetHandle, edgeType } = chooseHandles(from, to);
            edges.push({
                id: `es:${subj}:${from.id}->${to.id}`,
                source: from.id,
                target: to.id,
                sourceHandle,
                targetHandle,
                type: edgeType,
                animated: false,
            });
        }
    }
    return edges;
}

/***********************************
 * Normalize backend payload → UI  *
 ***********************************/
const normalizeCatalog = (raw) => {
    const subjects = Array.isArray(raw) ? raw : [];
    if (!subjects.length) return [];

    return subjects.map((s, sIdx) => {
        const modules = Array.isArray(s.modules) ? s.modules : [];
        return {
            pruefungsfach: s.exam_subject ?? `Prüfungsfach ${sIdx + 1}`,
            modules: modules.map((m) => {
                const courses = Array.isArray(m.courses) ? m.courses : [];
                return {
                    code: courses[0]?.code ?? m.code ?? `M-${sIdx}`,
                    name: m.name ?? "Ohne Titel",
                    ects: Number(m.ects) || 0,
                    category: m.category ?? null,
                    is_mandatory: !!m.is_mandatory,
                    module_exam_subject: m.module_exam_subject ?? s.exam_subject ?? null,
                    courses: courses.map((c) => ({
                        name: c.title ?? c.name ?? "",
                        code: c.code ?? "",
                        ects: Number(c.ects) || null,
                    })),
                };
            }),
        };
    });
};

/****************
 * Main component
 ****************/
export default function App() {
    const { programCode, setCoursesFromNodes, coursesBySemester } = currentProgram();

    // Catalog state
    const [catalog, setCatalog] = useState([]);
    const [loadingCatalog, setLoadingCatalog] = useState(false);
    const [catalogError, setCatalogError] = useState("");

    // React Flow refs
    const wrapperRef = useRef(null);
    const rfRef = useRef(null);
    const groupDragRef = useRef(new Map()); // Map<groupId, { lastX, lastY }>

    // Fetch & normalize catalog whenever programCode changes
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingCatalog(true);
            setCatalogError("");
            try {
                const raw = await fetchCatalog(programCode);
                if (cancelled) return;
                setCatalog(normalizeCatalog(raw));
            } catch (e) {
                if (cancelled) return;
                console.error(e);
                setCatalog([]);
                setCatalogError(String(e?.message || e));
            } finally {
                if (!cancelled) setLoadingCatalog(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [programCode]);

    // Lane background columns (static)
    const laneNodes = useMemo(
        () =>
            SEMESTERS.map((s, i) => ({
                id: `lane-${s.id}`,
                type: "lane",
                data: { title: s.title, even: i % 2 === 0 },
                position: { x: i * 340 /* fallback for LANE_WIDTH+LANE_GAP */, y: 0 },
                draggable: false,
                selectable: false,
                zIndex: 0,
                style: { height: CANVAS_HEIGHT },
            })),
        []
    );

    // React Flow state
    const initialNodes = useMemo(() => [...laneNodes], [laneNodes]);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // Persist scheduling flag – set to true to persist after the next commit
    const [needsPersist, setNeedsPersist] = useState(false);

    /***********************
     * Sidebar drag & drop *
     ***********************/
    const handleDragStart = useCallback((e, payload) => {
        e.dataTransfer.setData("application/x-course", JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "move";
    }, []);

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }, []);

    /***********************
     * Node remove helpers *
     ***********************/
    const removeCourseNode = useCallback((id) => {
        setNodes((prev) => {
            const victim = prev.find((n) => n.id === id);
            const groupId = victim?.data?.groupId;
            let next = prev.filter((n) => n.id !== id);
            if (groupId) next = recomputeGroupFromChildren(next, groupId);
            return next;
        });
    }, [setNodes]);

    const removeModuleGroup = useCallback((groupId) => {
        setNodes((prev) => prev.filter((n) => n.id !== groupId && n.data?.groupId !== groupId));
    }, [setNodes]);

    /************************
     * Group drag mechanics *
     ************************/
    const onNodeDragStart = useCallback((_, node) => {
        if (node?.type !== "moduleBg") return;
        groupDragRef.current.set(node.id, { lastX: node.position.x, lastY: node.position.y });
    }, []);

    const onNodeDrag = useCallback((_, node) => {
        if (node?.type !== "moduleBg") return;
        const st = groupDragRef.current.get(node.id) || { lastX: node.position.x, lastY: node.position.y };
        const dx = node.position.x - st.lastX;
        const dy = node.position.y - st.lastY;
        if (dx === 0 && dy === 0) return;
        groupDragRef.current.set(node.id, { lastX: node.position.x, lastY: node.position.y });
        setNodes((prev) =>
            prev.map((n) => (n.type === "course" && n.data?.groupId === node.id
                ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
                : n))
        );
    }, [setNodes]);

    /** Mark that we should persist after the next nodes commit. */
    const schedulePersist = useCallback(() => setNeedsPersist(true), []);

    // Debug logging (kept, but behind dev-only guard if you add one later)
    useEffect(() => {
        // eslint-disable-next-line no-console
        console.log("Full frontend plan storage:", coursesBySemester);
    }, [coursesBySemester]);

    // Persist storage once, right after nodes changed (drop or drag-stop)
    useEffect(() => {
        if (!needsPersist) return;
        const latestNodes = (rfRef.current?.getNodes?.() || nodes).filter((n) => n.type !== "lane");
        setCoursesFromNodes(latestNodes);
        setNeedsPersist(false);
    }, [needsPersist, nodes, setCoursesFromNodes]);

    /***************************
     * Snap & collision resolve *
     ***************************/
    const onNodeDragStop = useCallback((_, node) => {
        const li = laneIndexFromX(node.position.x);
        const snappedX = centerX(li);
        const snappedY = Math.max(0, Math.round(node.position.y / GRID_SIZE) * GRID_SIZE);

        // If a whole module group was dragged: shift children by the snap delta, snap the group,
        // then recompute the group bbox, and resolve collisions.
        if (node?.type === "moduleBg") {
            const dxSnap = snappedX - node.position.x;
            const dySnap = snappedY - node.position.y;
            setNodes((prev) => {
                const moved = prev.map((n) => {
                    if (n.id === node.id) return { ...n, position: { x: snappedX, y: snappedY } };
                    if (n.type === "course" && n.data?.groupId === node.id) {
                        return { ...n, position: { x: n.position.x + dxSnap, y: n.position.y + dySnap } };
                    }
                    return n;
                });
                const sized = recomputeGroupFromChildren(moved, node.id);
                return resolveLaneCollisions(sized);
            });
            groupDragRef.current.delete(node.id);
            return;
        }

        // Course inside a group → snap only the course, then recompute the group bbox
        if (node?.type === "course" && node?.data?.groupId) {
            const groupId = node.data.groupId;
            setNodes((prev) => {
                const updated = prev.map((n) => (n.id === node.id ? { ...n, position: { x: snappedX, y: snappedY } } : n));
                return resolveLaneCollisions(recomputeGroupFromChildren(updated, groupId));
            });
            return;
        }

        // All other nodes: normal snapping + collision resolution
        setNodes((prev) => {
            const next = prev.map((n) => (n.id === node.id ? { ...n, position: { x: snappedX, y: snappedY } } : n));
            return resolveLaneCollisions(next);
        });
    }, [setNodes]);

    // Merge: run drag-stop logic, then schedule a persist
    const onNodeDragStopMerged = useCallback((evt, node) => {
        onNodeDragStop(evt, node);
        schedulePersist();
    }, [onNodeDragStop, schedulePersist]);

    // Handle drop from the sidebar
    const onDrop = useCallback(
        (evt) => {
            evt.preventDefault();
            const raw = evt.dataTransfer.getData("application/x-course");
            if (!raw) return;

            let payload;
            try {
                payload = JSON.parse(raw);
            } catch {
                return;
            }

            const { x, y } = projectToLaneAndSnap({ evt, wrapperEl: wrapperRef.current, rfInstance: rfRef.current });
            const now = Date.now();

            // A) Module with >= 2 courses → create group + children
            if (payload?.kind === "module" && Array.isArray(payload.courses) && payload.courses.length >= 2) {
                const groupId = `mod-${now}`;

                const groupNode = {
                    id: groupId,
                    type: "moduleBg",
                    data: {
                        title: `${payload.name}`,
                        code: null,
                        groupId,
                        onRemoveGroup: removeModuleGroup,
                        onRemove: () => removeModuleGroup(groupId),
                        examSubject:
                            getExamSubjectForCode(catalog, payload.code) ||
                            getExamSubjectForCode(catalog, payload.courses?.[0]?.code) ||
                            null,
                        category: payload.category ?? "unknown",
                    },
                    position: { x, y }, // preliminary; will be resized by recomputeGroupFromChildren
                    draggable: true,
                    selectable: false,
                    zIndex: 0,
                };

                const childCourseNodes = payload.courses.map((course, idx) => {
                    const childId = `${course.code}-${now}-${idx}`;
                    const baseY = y + idx * (56 /* NODE_HEIGHT */ + 8 /* COURSE_VERTICAL_GAP */);
                    const examSubject =
                        getExamSubjectForCode(catalog, course.code) || getExamSubjectForCode(catalog, payload.code);

                    return {
                        id: childId,
                        type: "course",
                        data: {
                            label: course.name,
                            code: course.code,
                            groupId,
                            baseY,
                            onRemove: removeCourseNode,
                            nodeId: childId,
                            examSubject,
                            category: payload.category ?? "unknown",
                        },
                        position: { x, y: baseY },
                        sourcePosition: "right",
                        targetPosition: "left",
                        zIndex: 1,
                    };
                });

                setNodes((prev) => {
                    const withAll = prev.concat(groupNode, ...childCourseNodes);
                    const sized = recomputeGroupFromChildren(withAll, groupId);
                    return resolveLaneCollisions(sized);
                });
                schedulePersist();
                return;
            }

            // B) Single course card (or module with a single course treated as course)
            const id = `${payload.code}-${now}`;
            const examSubject = getExamSubjectForCode(catalog, payload.code);
            setNodes((prev) => {
                const next = prev.concat({
                    id,
                    type: "course",
                    data: {
                        label: payload.name,
                        code: payload.code,
                        onRemove: removeCourseNode,
                        nodeId: id,
                        examSubject,
                        category: payload.category ?? "unknown",
                    },
                    position: { x, y },
                    sourcePosition: "right",
                    targetPosition: "left",
                    zIndex: 1,
                });
                return resolveLaneCollisions(next);
            });
            schedulePersist();
        },
        [catalog, removeCourseNode, removeModuleGroup]
    );

    /***************************************
     * Sidebar expand/collapse (per subject)
     ***************************************/
    const [expandedPf, setExpandedPf] = useState(new Set());
    const togglePf = useCallback((name) => {
        setExpandedPf((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    }, []);

    /****************************
     * Collision avoidance utils *
     ****************************/
    function nodeBBox(n) {
        if (n.type === "course") {
            return {
                x1: n.position.x,
                y1: n.position.y,
                x2: n.position.x + CARD_WIDTH,
                y2: n.position.y + NODE_HEIGHT,
                h: NODE_HEIGHT,
            };
        }
        if (n.type === "moduleBg") {
            const w = Number(n?.data?.width) || CARD_WIDTH + 2 * GROUP_PADDING_X;
            const h = Number(n?.data?.height) || NODE_HEIGHT + MODULE_HEADER_HEIGHT + 2 * GROUP_PADDING_Y;
            return { x1: n.position.x, y1: n.position.y, x2: n.position.x + w, y2: n.position.y + h, h };
        }
        return { x1: n.position.x, y1: n.position.y, x2: n.position.x, y2: n.position.y, h: 0 };
    }

    function isRelevantForCollision(n) {
        // Avoid collisions between: single courses (not in a group) and module groups.
        // Courses inside groups are handled by the group's own layout.
        return n.type === "moduleBg" || (n.type === "course" && !n.data?.groupId);
    }

    function applyDeltaToGroupChildren(nodes, groupId, dx, dy) {
        if (!groupId || (dx === 0 && dy === 0)) return nodes;
        return nodes.map((n) =>
            n.type === "course" && n.data?.groupId === groupId
                ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
                : n
        );
    }

    /**
     * Resolve vertical overlaps per lane among module groups and un-grouped course nodes.
     * Strategy: sort by Y, then push each down if it touches the previous (with COLLISION_GAP).
     * If a moduleBg is moved, shift its children by the same delta.
     */
    function resolveLaneCollisions(allNodes) {
        let nodes = allNodes.slice(); // defensive copy

        // Group by lane index
        const lanes = new Map();
        for (const n of nodes) {
            if (!isRelevantForCollision(n)) continue;
            const li = laneIdx(n);
            if (!lanes.has(li)) lanes.set(li, []);
            lanes.get(li).push(n.id);
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
                const minY = prevB.y2 + COLLISION_GAP; // previous bottom + gap
                if (curB.y1 < minY) {
                    const dy = minY - curB.y1;
                    nodes = nodes.map((n) => (n.id === curr.id ? { ...n, position: { x: n.position.x, y: n.position.y + dy } } : n));
                    if (curr.type === "moduleBg") nodes = applyDeltaToGroupChildren(nodes, curr.id, 0, dy);
                    // update working copy for subsequent comparisons
                    const idx = laneNodes.findIndex((ln) => ln.id === curr.id);
                    if (idx !== -1) laneNodes[idx] = { ...curr, position: { x: curr.position.x, y: curr.position.y + dy } };
                }
                prev = laneNodes.find((ln) => ln.id === curr.id) || curr;
            }
        }
        return nodes;
    }

    /**********************************************
     * Auto-build edges by examSubject when nodes change
     **********************************************/
    useEffect(() => {
        setEdges(buildSubjectEdges(nodes));
    }, [nodes, setEdges]);

    /***********
     * Render  *
     ***********/
    return (
        <div style={{ display: "flex", height: "100vh", width: "100vw", background: "#f9fafb" }}>
            <Sidebar
                catalog={catalog}
                loading={loadingCatalog}
                error={catalogError}
                expandedSet={expandedPf}
                togglePf={togglePf}
                onDragStart={handleDragStart}
            />

            <div style={{ flex: 1, position: "relative" }}>
                <div className="rf-wrapper" ref={wrapperRef} onDrop={onDrop} onDragOver={onDragOver} style={{ position: "absolute", inset: 0 }}>
                    <ReactFlow
                        onInit={(inst) => (rfRef.current = inst)}
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onNodeDragStart={onNodeDragStart}
                        onNodeDrag={onNodeDrag}
                        onNodeDragStop={onNodeDragStopMerged}
                        onSelectionDragStop={schedulePersist}
                        nodeTypes={NODE_TYPES}
                        fitView
                        snapToGrid
                        snapGrid={[GRID_SIZE, GRID_SIZE]}
                        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
                        proOptions={{ hideAttribution: true }}
                    >
                        <MiniMap pannable zoomable />
                        <Controls position="top-right" />
                        <Background gap={GRID_SIZE} />
                    </ReactFlow>
                </div>
            </div>
        </div>
    );
}
