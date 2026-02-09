import React from "react";
import GraphNodeBase from "./GraphNodeBase.jsx";

export default function GraphCourseNode({ data }) {
    const color = data?.color || "#4b5563";
    return (
        <GraphNodeBase
            label={data?.label}
            style={{
                background: "#ffffff",
                color: "#111827",
                border: `1px solid ${color}`,
                borderLeft: `6px solid ${color}`,
                boxShadow: "0 1px 1px rgba(0,0,0,0.03)",
                fontWeight: 600,
                fontSize: 12,
            }}
        />
    );
}
