import {
    LANE_WIDTH,
    LANE_GAP,
    GRID_SIZE,
    NODE_HEIGHT,
    VISUAL_CENTER_OFFSET_X,
    SEMESTERS,
    CARD_WIDTH,
} from "./constants.js";

// X position of a lane (left edge)
export const laneX = (laneIndex) => laneIndex * (LANE_WIDTH + LANE_GAP);

// Clamp helper
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Center X for a card in a lane
export const centerX = (laneIndex) =>
    laneX(laneIndex) + (LANE_WIDTH - CARD_WIDTH) / 2 + (VISUAL_CENTER_OFFSET_X ?? 0);

// Determine lane from a flow-space X
export const laneIndexFromX = (flowX) => {
    const span = LANE_WIDTH + LANE_GAP;
    // give half the gap visually to the lane on the left to avoid rounding up near edges
    const idx = Math.floor((flowX + LANE_GAP * 0.5) / span);
    return clamp(idx, 0, SEMESTERS.length - 1);
};

/**
 * Convert a DOM drop event to snapped React Flow coords, honoring zoom/pan.
 * Uses screenToFlowPosition (no manual bounds math needed).
 *
 * NOTE: wrapperEl is unused now; kept in the signature for backward compatibility.
 */
export const projectToLaneAndSnap = ({ evt, wrapperEl: _unused, rfInstance }) => {
    // Fall back gracefully if instance is missing (e.g. very early in mount)
    const hasProjector = typeof rfInstance?.screenToFlowPosition === "function";

    const { x: flowX, y: flowY } = hasProjector
        ? rfInstance.screenToFlowPosition({ x: evt.clientX, y: evt.clientY })
        : { x: evt.clientX, y: evt.clientY };

    const laneIndex = laneIndexFromX(flowX);
    const x = Math.max(0, centerX(laneIndex));
    const y = Math.max(0, Math.round(flowY / GRID_SIZE) * GRID_SIZE - NODE_HEIGHT / 2);

    return { x, y };
};