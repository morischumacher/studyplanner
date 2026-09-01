/**
 * The planning canvas itself: the drop target, React Flow, and its controls.
 *
 * The wrapper element is the drop target rather than React Flow, because a drop
 * has to be turned into a lane from the wrapper's own bounding box and the
 * viewport transform. Everything the canvas needs is passed in, so this
 * component holds no state of its own beyond React Flow's.
 */

import ReactFlow, {
    Background,
    ControlButton,
    Controls,
    MiniMap,
} from "reactflow";
import type { Node, NodeChange } from "reactflow";
import "reactflow/dist/style.css";
import type { DragEvent, MutableRefObject } from "react";

import { CourseCard, LaneColumn, ModuleGroupBackground } from "../../components/index.js";
import { GRID_SIZE } from "../../domain/layout.ts";
import type { VerticalSemantics } from "../../domain/nodes.ts";
import LayoutSemanticsPill from "./LayoutSemanticsPill.tsx";
import type { BoardFlowInstance } from "./useBoardNodes.ts";
import type { BoardNode } from "./types.ts";

/** Which component draws each kind of node. */
const NODE_TYPES = {
    course: CourseCard,
    lane: LaneColumn,
    moduleBg: ModuleGroupBackground,
};

/** Whether dragging on empty canvas pans the view or rubber-bands a selection. */
export type TableInteractionMode = "pan" | "select";

export interface PlannerBoardProps {
    wrapperRef: MutableRefObject<HTMLDivElement | null>;
    rfRef: MutableRefObject<BoardFlowInstance | null>;
    renderNodes: BoardNode[];
    onNodesChange: (changes: NodeChange[]) => void;
    onNodeDragStart: (event: unknown, node: BoardNode) => void;
    onNodeDrag: (event: unknown, node: BoardNode) => void;
    onNodeDragStop: (event: unknown, node: BoardNode) => void;
    onSelectionDragStop: (event: unknown, nodes: BoardNode[]) => void;
    onDrop: (event: DragEvent) => void;
    onDragOver: (event: DragEvent) => void;
    onDragLeave: () => void;
    tableInteractionMode: TableInteractionMode;
    onToggleInteractionMode: () => void;
    isLegendOpen: boolean;
    onToggleLegend: () => void;
    verticalSemantics: VerticalSemantics;
    onVerticalSemanticsChange: (semantics: VerticalSemantics) => void;
    verticalCustomText: string;
    onVerticalCustomTextChange: (text: string) => void;
    isSemanticsPopupOpen: boolean;
    onSemanticsPopupOpenChange: (open: boolean) => void;
}

export default function PlannerBoard({
    wrapperRef,
    rfRef,
    renderNodes,
    onNodesChange,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
    onSelectionDragStop,
    onDrop,
    onDragOver,
    onDragLeave,
    tableInteractionMode,
    onToggleInteractionMode,
    isLegendOpen,
    onToggleLegend,
    verticalSemantics,
    onVerticalSemanticsChange,
    verticalCustomText,
    onVerticalCustomTextChange,
    isSemanticsPopupOpen,
    onSemanticsPopupOpenChange,
}: PlannerBoardProps) {
    return (
        <div className="rf-wrapper" ref={wrapperRef} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} style={{ position: "absolute", inset: 0 }}>
            <ReactFlow
                onInit={(inst) => (rfRef.current = inst)}
                nodes={renderNodes as unknown as Node[]}
                onNodesChange={onNodesChange}
                onNodeDragStart={onNodeDragStart}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                onSelectionDragStop={onSelectionDragStop}
                nodeTypes={NODE_TYPES}
                fitView
                snapToGrid
                snapGrid={[GRID_SIZE, GRID_SIZE]}
                selectNodesOnDrag={tableInteractionMode === "select"}
                selectionOnDrag={tableInteractionMode === "select"}
                panOnDrag={tableInteractionMode === "pan"}
                proOptions={{ hideAttribution: true }}
            >
                <MiniMap pannable zoomable />
                <Controls position="bottom-left">
                    <ControlButton
                        onClick={onToggleInteractionMode}
                        title={`Mode: ${tableInteractionMode === "select" ? "Select" : "Pan"}`}
                        aria-label={`Mode: ${tableInteractionMode === "select" ? "Select" : "Pan"}`}
                    >
                        <span style={{ fontSize: 13, lineHeight: 1 }}>{tableInteractionMode === "select" ? "▣" : "✋"}</span>
                    </ControlButton>
                    <ControlButton
                        onClick={onToggleLegend}
                        title={isLegendOpen ? "Close Legend" : "Show Legend"}
                        aria-label={isLegendOpen ? "Close Legend" : "Show Legend"}
                    >
                        <span style={{ fontSize: 14, lineHeight: 1 }}>ℹ</span>
                    </ControlButton>
                </Controls>
                <Background gap={GRID_SIZE} />
            </ReactFlow>

            <LayoutSemanticsPill
                verticalSemantics={verticalSemantics}
                onVerticalSemanticsChange={onVerticalSemanticsChange}
                customText={verticalCustomText}
                onCustomTextChange={onVerticalCustomTextChange}
                isPopupOpen={isSemanticsPopupOpen}
                onPopupOpenChange={onSemanticsPopupOpenChange}
            />
        </div>
    );
}
