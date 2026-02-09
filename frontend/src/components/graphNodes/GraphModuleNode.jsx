import React from "react";
import GraphNodeBase from "./GraphNodeBase.jsx";
import { hexToRgba, MODULE_GROUP_COLOR_ALPHA } from "../../utils/examSubjectColors.js";

export default function GraphModuleNode({ data }) {
    const color = data?.color || "#4b5563";
    return (
        <GraphNodeBase
            label={data?.label}
            style={{
                background: hexToRgba(color, MODULE_GROUP_COLOR_ALPHA),
                color: "#111827",
                border: `2px solid ${color}`,
                fontWeight: 600,
                fontSize: 12,
            }}
        />
    );
}
