import React from "react";
import { CANVAS_HEIGHT, LANE_WIDTH } from "../utils/constants.js";


/** LaneColumn — background strip for each semester lane. */
export default function LaneColumn({ data }) {
    const plannedEcts = Number(data?.ectsPlanned ?? 0);
    return (
        <div
            style={{
                height: CANVAS_HEIGHT,
                width: LANE_WIDTH,
                background: data.even ? "rgba(249,250,251,0.6)" : "rgba(255,255,255,0.6)",
                border: "1px dashed #e5e7eb",
                borderRadius: 16,
                pointerEvents: "none",
                position: "relative",
            }}
        >
            <div style={{ position: "absolute", top: 8, left: 12, fontSize: 14, fontWeight: 600, color: "#4b5563" }}>
                {data.title} · {plannedEcts.toFixed(1)} ECTS
            </div>
        </div>
    );
}
