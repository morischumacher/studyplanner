import {
    LANE_WIDTH,
    LANE_GAP,
    GRID_SIZE,
    NODE_HEIGHT,
    VISUAL_CENTER_OFFSET_X,
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
export const laneIndexFromX = (flowX, maxLaneIndex = null) => {
    const span = LANE_WIDTH + LANE_GAP;
    // give half the gap visually to the lane on the left to avoid rounding up near edges
    const idx = Math.floor((flowX + LANE_GAP * 0.5) / span);
    if (Number.isFinite(maxLaneIndex)) return clamp(idx, 0, Number(maxLaneIndex));
    return Math.max(0, idx);
};

/**
 * Convert a DOM drop event to snapped React Flow coords, honoring zoom/pan.
 * We derive flow-space coordinates from wrapper bounds + viewport transform,
 * which is stable across browsers and React Flow versions.
 */
export const projectToLaneAndSnap = ({ evt, wrapperEl, rfInstance, maxLaneIndex = null }) => {
    const bounds = wrapperEl?.getBoundingClientRect?.();
    const viewport = typeof rfInstance?.getViewport === "function"
        ? rfInstance.getViewport()
        : { x: 0, y: 0, zoom: 1 };

    const zoom = Number.isFinite(viewport?.zoom) && viewport.zoom > 0 ? viewport.zoom : 1;
    const vx = Number.isFinite(viewport?.x) ? viewport.x : 0;
    const vy = Number.isFinite(viewport?.y) ? viewport.y : 0;

    const clientX = Number.isFinite(evt?.clientX) ? evt.clientX : 0;
    const clientY = Number.isFinite(evt?.clientY) ? evt.clientY : 0;
    const left = Number.isFinite(bounds?.left) ? bounds.left : 0;
    const top = Number.isFinite(bounds?.top) ? bounds.top : 0;

    const flowX = (clientX - left - vx) / zoom;
    const flowY = (clientY - top - vy) / zoom;

    const laneIndex = laneIndexFromX(flowX, maxLaneIndex);
    const x = Math.max(0, centerX(laneIndex));
    const y = Math.max(0, Math.round(flowY / GRID_SIZE) * GRID_SIZE - NODE_HEIGHT / 2);

    return { x, y };
};
