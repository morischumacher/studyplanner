import React from "react";
import GraphNodeBase from "./GraphNodeBase.jsx";

export default function GraphSubjectNode({ data }) {
    const color = data?.color || "#4b5563";
    return (
        <GraphNodeBase
            label={data?.label}
            style={{
                background: color,
                color: "#ffffff",
                border: `2px solid ${color}`,
                fontWeight: 700,
                fontSize: 13,
            }}
        />
    );
}
