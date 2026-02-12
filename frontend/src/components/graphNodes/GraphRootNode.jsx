import React from "react";
import GraphNodeBase from "./GraphNodeBase.jsx";

export default function GraphRootNode({ data }) {
    return (
        <GraphNodeBase
            label={data?.label}
            style={{
                background: "#111827",
                color: "#ffffff",
                border: "2px solid #111827",
                fontWeight: 700,
                fontSize: 14,
                height: 64,
                padding: "8px 12px",
            }}
        />
    );
}
