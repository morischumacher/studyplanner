/**
 * Lane geometry: where a semester column sits, and which one a drop lands in.
 *
 * Every measurement is in React Flow's flow space rather than screen pixels, so
 * the numbers survive zooming and panning untouched. The single place the two
 * spaces meet is `projectToLaneAndSnap`, and it does the conversion from the
 * wrapper's bounding box and the viewport transform instead of asking React
 * Flow to project for us, because that arithmetic has stayed stable across
 * React Flow versions while the projection helpers have not.
 */

import type { Point } from "./types.ts";

export const LANE_WIDTH = 360;
export const LANE_GAP = 20;
export const CARD_WIDTH = 270;
export const CANVAS_HEIGHT = 2000;

/** The snap grid a dropped card's vertical position is rounded to. */
export const GRID_SIZE = 16;

/** The height a course card draws at. */
export const NODE_HEIGHT = 124;

/**
 * The vertical space a course card is reserved in a lane. It is larger than the
 * drawn height so that stacked cards keep a visible seam between them.
 */
export const COURSE_LAYOUT_HEIGHT = 156;

export const COLLISION_GAP = 8;
export const COURSE_VERTICAL_GAP = 8;

export const GROUP_PADDING_X = 6;
export const GROUP_PADDING_Y = 20;
export const GROUP_EXTRA_RIGHT = 60;

export const MODULE_HEADER_HEIGHT = 68;
export const MODULE_TOP_PADDING = 4;
export const MODULE_BOTTOM_PADDING = 30;

/**
 * A manual optical correction. Cards centred by arithmetic in a lane read as
 * sitting slightly right of centre, and this is the nudge that was settled on.
 */
export const VISUAL_CENTER_OFFSET_X = -13;

/** Left edge of a lane. */
export const laneX = (laneIndex: number): number => laneIndex * (LANE_WIDTH + LANE_GAP);

export const clamp = (value: number, lo: number, hi: number): number =>
    Math.max(lo, Math.min(hi, value));

/** Where a card's left edge goes if the card is to look centred in its lane. */
export const centerX = (laneIndex: number): number =>
    laneX(laneIndex) + (LANE_WIDTH - CARD_WIDTH) / 2 + (VISUAL_CENTER_OFFSET_X ?? 0);

export const laneIndexFromX = (flowX: number, maxLaneIndex: number | null = null): number => {
    const span = LANE_WIDTH + LANE_GAP;
    // Half the gap belongs to the lane on the left, so that a drop just past a
    // lane's right edge stays in that lane instead of rounding into the next.
    const idx = Math.floor((flowX + LANE_GAP * 0.5) / span);
    if (Number.isFinite(maxLaneIndex)) return clamp(idx, 0, Number(maxLaneIndex));
    return Math.max(0, idx);
};

/** The viewport transform React Flow applies to flow space. */
export interface Viewport {
    x: number;
    y: number;
    zoom: number;
}

/** Only what `projectToLaneAndSnap` asks of a React Flow instance. */
export interface ViewportSource {
    getViewport?: () => Viewport;
}

/** Only what `projectToLaneAndSnap` reads from a drop event. */
export interface PointerPosition {
    clientX?: number;
    clientY?: number;
}

export interface DropProjection {
    evt: PointerPosition | null | undefined;
    wrapperEl: { getBoundingClientRect?: () => DOMRect } | null | undefined;
    rfInstance: ViewportSource | null | undefined;
    maxLaneIndex?: number | null;
}

/** Turns a drop event into the snapped flow-space position of the card. */
export const projectToLaneAndSnap = ({
    evt,
    wrapperEl,
    rfInstance,
    maxLaneIndex = null,
}: DropProjection): Point => {
    const bounds = wrapperEl?.getBoundingClientRect?.();
    const viewport = typeof rfInstance?.getViewport === "function"
        ? rfInstance.getViewport()
        : { x: 0, y: 0, zoom: 1 };

    const zoom = Number.isFinite(viewport?.zoom) && viewport.zoom > 0 ? viewport.zoom : 1;
    const vx = Number.isFinite(viewport?.x) ? viewport.x : 0;
    const vy = Number.isFinite(viewport?.y) ? viewport.y : 0;

    const clientX = Number.isFinite(evt?.clientX) ? Number(evt?.clientX) : 0;
    const clientY = Number.isFinite(evt?.clientY) ? Number(evt?.clientY) : 0;
    const left = Number.isFinite(bounds?.left) ? Number(bounds?.left) : 0;
    const top = Number.isFinite(bounds?.top) ? Number(bounds?.top) : 0;

    const flowX = (clientX - left - vx) / zoom;
    const flowY = (clientY - top - vy) / zoom;

    const laneIndex = laneIndexFromX(flowX, maxLaneIndex);
    const x = Math.max(0, centerX(laneIndex));
    const y = Math.max(0, Math.round(flowY / GRID_SIZE) * GRID_SIZE - NODE_HEIGHT / 2);

    return { x, y };
};
