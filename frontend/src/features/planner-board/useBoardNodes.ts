/**
 * The node array React Flow draws, and the lane backgrounds behind it.
 *
 * The array and the plan are two representations of the same thing, kept in
 * step in both directions: a course's semester is read back out of the x
 * position of its card, and the plan is written back onto the canvas only when
 * the programme changes or the planner first loads. Everything in between
 * patches `data` on nodes that are already there, which is why each of the
 * effects below compares before it writes. Returning a fresh array for an
 * unchanged canvas would restart the drag machinery under the student's hand.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNodesState } from "reactflow";
import type { Node, NodeChange } from "reactflow";
import type { MutableRefObject } from "react";

import type { CoursesBySemester } from "../../domain/plan/state.ts";
import {
    CANVAS_HEIGHT,
    COURSE_LAYOUT_HEIGHT,
    GRID_SIZE,
    GROUP_PADDING_Y,
    LANE_WIDTH,
    MODULE_BOTTOM_PADDING,
    MODULE_HEADER_HEIGHT,
    laneX,
} from "../../domain/layout.ts";
import type { CatalogueCourseEntry } from "../catalogue/index.ts";
import type { BoardNode, BoardNodeData, LaneInsight, SemesterOption } from "./types.ts";

/** The height the collapsed parking stage shrinks to, header and nothing else. */
const COLLAPSED_PARKING_HEIGHT = 88;

/** Only what this module asks of a React Flow instance. */
export interface BoardFlowInstance {
    getNodes?: () => BoardNode[];
    getViewport?: () => { x: number; y: number; zoom: number };
}

export interface UseBoardNodesInput {
    semesters: SemesterOption[];
    coursesBySemester: CoursesBySemester | null | undefined;
    parkedCourseCodes: readonly string[] | null | undefined;
    catalogCourseByCode: Map<string, CatalogueCourseEntry>;
    laneInsightsBySemester: Record<number, LaneInsight> | null | undefined;
    setSemesterNote: (semesterId: number, note: string) => void;
    /** "table" or "graph"; the canvas is only laid out while it is on screen. */
    viewMode: string;
    verticalSemantics: string;
    resolveLaneCollisions: (nodes: BoardNode[]) => BoardNode[];
}

export interface UseBoardNodesResult {
    nodes: BoardNode[];
    setNodes: (update: BoardNode[] | ((nodes: BoardNode[]) => BoardNode[])) => void;
    onNodesChange: (changes: NodeChange[]) => void;
    /** The array handed to React Flow, with parked cards hidden when collapsed. */
    renderNodes: BoardNode[];
    laneNodes: BoardNode[];
    requiredLaneHeight: number;
    plannedEctsBySemester: Record<number, number>;
    needsPersist: boolean;
    setNeedsPersist: (needsPersist: boolean) => void;
    isParkingCollapsed: boolean;
    wrapperRef: MutableRefObject<HTMLDivElement | null>;
    rfRef: MutableRefObject<BoardFlowInstance | null>;
}

export function useBoardNodes({
    semesters,
    coursesBySemester,
    parkedCourseCodes,
    catalogCourseByCode,
    laneInsightsBySemester,
    setSemesterNote,
    viewMode,
    verticalSemantics,
    resolveLaneCollisions,
}: UseBoardNodesInput): UseBoardNodesResult {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const rfRef = useRef<BoardFlowInstance | null>(null);
    const [isParkingCollapsed, setIsParkingCollapsed] = useState(false);

    const plannedEctsBySemester = useMemo(() => {
        const out: Record<number, number> = {};
        for (const semester of semesters) {
            const semesterId = Number(semester.id);
            const list = Array.isArray(coursesBySemester?.[semesterId]) ? coursesBySemester[semesterId] : [];
            out[semesterId] = (list ?? []).reduce((sum, course) => sum + Number(course?.ects || 0), 0);
        }
        return out;
    }, [coursesBySemester, semesters]);

    const parkingEctsFromParkedCodes = useMemo(() => {
        const seenCodes = new Set<string>();
        let total = 0;
        for (const codeRaw of Array.isArray(parkedCourseCodes) ? parkedCourseCodes : []) {
            const code = String(codeRaw || "").trim();
            if (!code || seenCodes.has(code)) continue;
            seenCodes.add(code);
            const catalogCourse = catalogCourseByCode.get(code);
            total += Number(catalogCourse?.ects || 0);
        }
        return total;
    }, [catalogCourseByCode, parkedCourseCodes]);

    const laneNodes = useMemo<BoardNode[]>(
        () => {
            const parkingLaneHeight = isParkingCollapsed ? COLLAPSED_PARKING_HEIGHT : CANVAS_HEIGHT;
            const parkingLane: BoardNode = {
                id: "lane-0",
                type: "lane",
                data: {
                    title: "Parking Stage",
                    isParking: true,
                    isParkingCollapsed,
                    onToggleParkingCollapsed: () => setIsParkingCollapsed((v) => !v),
                    even: false,
                    height: parkingLaneHeight,
                    ectsPlanned: Number(parkingEctsFromParkedCodes ?? 0),
                    semesterId: 0,
                    courseNotes: [],
                    estimatedHoursTotal: 0,
                    weightedGrade: null,
                    additionalNote: "",
                    onSetSemesterNote: null,
                },
                position: { x: laneX(-1), y: 0 },
                draggable: false,
                selectable: false,
                zIndex: 0,
                style: { height: parkingLaneHeight, width: LANE_WIDTH },
            };
            const regular = semesters.map((s, i): BoardNode => ({
                id: `lane-${s.id}`,
                type: "lane",
                data: {
                    title: s.title,
                    isParking: false,
                    even: i % 2 === 0,
                    height: CANVAS_HEIGHT,
                    ectsPlanned: Number(plannedEctsBySemester?.[Number(s.id)] ?? 0),
                    semesterId: Number(s.id),
                    courseNotes: laneInsightsBySemester?.[Number(s.id)]?.courseNotes ?? [],
                    estimatedHoursTotal: Number(laneInsightsBySemester?.[Number(s.id)]?.estimatedHoursTotal ?? 0),
                    weightedGrade: laneInsightsBySemester?.[Number(s.id)]?.weightedGrade ?? null,
                    additionalNote: String(laneInsightsBySemester?.[Number(s.id)]?.additionalNote || ""),
                    onSetSemesterNote: setSemesterNote,
                },
                position: { x: laneX(i), y: 0 },
                draggable: false,
                selectable: false,
                zIndex: 0,
                style: { height: CANVAS_HEIGHT },
            }));
            return [parkingLane, ...regular];
        },
        [isParkingCollapsed, laneInsightsBySemester, parkingEctsFromParkedCodes, plannedEctsBySemester, semesters, setSemesterNote]
    );

    const initialNodes = useMemo(() => [...laneNodes], [laneNodes]);
    // React Flow's own node type insists on a `data` bag and spells the handle
    // positions as an enum. The canvas keeps the shape the domain uses instead,
    // and the two meet here and at the render.
    const [nodes, setNodes, onNodesChange] = useNodesState(
        initialNodes as unknown as Node<BoardNodeData>[]
    ) as unknown as [
        BoardNode[],
        (update: BoardNode[] | ((nodes: BoardNode[]) => BoardNode[])) => void,
        (changes: NodeChange[]) => void,
    ];

    const renderNodes = useMemo(() => {
        return nodes.map((node) => {
            const isParkedCourse = node?.type === "course" && String(node?.data?.status || "") === "parked";
            const isParkedGroup = node?.type === "moduleBg" && String(node?.data?.status || "") === "parked";
            const shouldHide = Boolean(isParkingCollapsed && (isParkedCourse || isParkedGroup));
            const hadGhost = Boolean(node?.data?.collapsedGhost);
            if (Boolean(node?.hidden) === shouldHide && !hadGhost) return node;
            return {
                ...node,
                hidden: shouldHide,
                data: {
                    ...(node?.data || {}),
                    collapsedGhost: false,
                },
            };
        });
    }, [isParkingCollapsed, nodes]);

    const requiredLaneHeight = useMemo(() => {
        let maxBottom = 0;
        for (const node of nodes) {
            if (node?.type === "lane") continue;
            if (node?.type === "course") {
                maxBottom = Math.max(maxBottom, Number(node?.position?.y || 0) + COURSE_LAYOUT_HEIGHT);
                continue;
            }
            if (node?.type === "moduleBg") {
                const groupHeight =
                    Number(node?.data?.height) ||
                    (COURSE_LAYOUT_HEIGHT + MODULE_HEADER_HEIGHT + GROUP_PADDING_Y + MODULE_BOTTOM_PADDING);
                maxBottom = Math.max(maxBottom, Number(node?.position?.y || 0) + groupHeight);
            }
        }
        const padded = Math.max(CANVAS_HEIGHT, maxBottom + 220);
        return Math.ceil(padded / GRID_SIZE) * GRID_SIZE;
    }, [nodes]);

    /** Set to true to persist after the next commit of the node array. */
    const [needsPersist, setNeedsPersist] = useState(false);

    // The lane backgrounds are rebuilt from the plan rather than edited, so they
    // are spliced back in ahead of everything else on every rebuild.
    useEffect(() => {
        setNodes((prev) => {
            const nonLane = prev.filter((n) => n.type !== "lane");
            return [...laneNodes, ...nonLane];
        });
    }, [laneNodes, setNodes]);

    useEffect(() => {
        setNodes((prev) => {
            const seenParkedCodes = new Set<string>();
            let parkedEctsFromNodes = 0;
            for (const node of prev) {
                if (node?.type !== "course") continue;
                if (String(node?.data?.status || "") !== "parked") continue;
                const code = String(node?.data?.code || "").trim();
                if (code && seenParkedCodes.has(code)) continue;
                if (code) seenParkedCodes.add(code);
                parkedEctsFromNodes += Number(node?.data?.ects || 0);
            }
            let changed = false;
            const next = prev.map((node) => {
                if (node.type !== "lane") return node;
                const semesterId = Number(String(node.id).replace("lane-", ""));
                const ectsPlanned = semesterId === 0
                    ? Number(parkedEctsFromNodes || 0)
                    : Number(plannedEctsBySemester?.[semesterId] ?? 0);
                const laneInsight = laneInsightsBySemester?.[semesterId] ?? ({} as Partial<LaneInsight>);
                const currentEcts = Number(node?.data?.ectsPlanned ?? 0);
                const currentHeight = Number(node?.data?.height ?? 0);
                const nextCourseNotes = Array.isArray(laneInsight?.courseNotes) ? laneInsight.courseNotes : [];
                const nextEstimatedHoursTotal = Number(laneInsight?.estimatedHoursTotal ?? 0);
                const nextWeightedGrade = laneInsight?.weightedGrade ?? null;
                const nextAdditionalNote = String(laneInsight?.additionalNote || "");
                const notesUnchanged = JSON.stringify(node?.data?.courseNotes ?? []) === JSON.stringify(nextCourseNotes);
                if (
                    currentEcts === ectsPlanned &&
                    currentHeight === requiredLaneHeight &&
                    notesUnchanged &&
                    Number(node?.data?.estimatedHoursTotal ?? 0) === nextEstimatedHoursTotal &&
                    (node?.data?.weightedGrade ?? null) === nextWeightedGrade &&
                    String(node?.data?.additionalNote || "") === nextAdditionalNote
                ) {
                    return node;
                }
                changed = true;
                return {
                    ...node,
                    data: {
                        ...node.data,
                        ectsPlanned,
                        height: requiredLaneHeight,
                        courseNotes: nextCourseNotes,
                        estimatedHoursTotal: nextEstimatedHoursTotal,
                        weightedGrade: nextWeightedGrade,
                        additionalNote: nextAdditionalNote,
                        onSetSemesterNote: setSemesterNote,
                    },
                };
            });
            return changed ? next : prev;
        });
    }, [laneInsightsBySemester, plannedEctsBySemester, requiredLaneHeight, setNodes, setSemesterNote]);

    // Changing what the vertical order of a lane means re-sorts every lane, so
    // the whole canvas is settled again rather than only the lane last touched.
    useEffect(() => {
        if (viewMode === "table") {
            setNodes((prev) => resolveLaneCollisions(prev));
        }
    }, [verticalSemantics, resolveLaneCollisions, viewMode, setNodes]);

    return {
        nodes,
        setNodes,
        onNodesChange,
        renderNodes,
        laneNodes,
        requiredLaneHeight,
        plannedEctsBySemester,
        needsPersist,
        setNeedsPersist,
        isParkingCollapsed,
        wrapperRef,
        rfRef,
    };
}
