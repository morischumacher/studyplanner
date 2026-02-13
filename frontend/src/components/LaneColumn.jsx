import React from "react";
import { CANVAS_HEIGHT, LANE_WIDTH } from "../utils/constants.js";


/** LaneColumn — background strip for each semester lane. */
export default function LaneColumn({ data }) {
    const plannedEcts = Number(data?.ectsPlanned ?? 0);
    const laneHeight = Math.max(CANVAS_HEIGHT, Number(data?.height) || CANVAS_HEIGHT);
    return (
        <div
            style={{
                height: laneHeight,
                width: LANE_WIDTH,
                background: data.even ? "rgba(243,244,246,0.82)" : "rgba(255,255,255,0.88)",
                border: data.even ? "1px dashed #d1d5db" : "1px dashed #cbd5e1",
                borderRadius: 16,
                pointerEvents: "none",
                position: "relative",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#374151",
                    background: "rgba(255,255,255,0.78)",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "5px 10px",
                    lineHeight: 1.2,
                }}
            >
                {data.title} · {plannedEcts.toFixed(1)} ECTS
            </div>
        </div>
    );
}
