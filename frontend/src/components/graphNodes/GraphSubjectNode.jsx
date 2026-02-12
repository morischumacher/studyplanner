import React from "react";
import GraphNodeBase from "./GraphNodeBase.jsx";

export default function GraphSubjectNode({ data }) {
    const color = data?.color || "#4b5563";
    return (
        <GraphNodeBase
            label={(
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%" }}>
                    <span
                        style={{
                            display: "-webkit-box",
                            WebkitBoxOrient: "vertical",
                            WebkitLineClamp: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {data?.label}
                    </span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {Number(data?.moduleCount ?? 0)} Modules
                    </span>
                </div>
            )}
            style={{
                background: color,
                color: "#ffffff",
                border: `2px solid ${color}`,
                fontWeight: 700,
                fontSize: 13,
                height: 64,
                padding: "8px 12px",
            }}
        />
    );
}
