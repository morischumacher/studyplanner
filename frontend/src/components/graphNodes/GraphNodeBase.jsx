import React from "react";
import { Handle, Position } from "reactflow";
import { CARD_WIDTH, NODE_HEIGHT } from "../../utils/constants.js";

const baseTextStyles = {
    width: CARD_WIDTH,
    height: NODE_HEIGHT,
    borderRadius: 10,
    boxSizing: "border-box",
    display: "-webkit-box",
    padding: "8px 12px",
    overflow: "hidden",
    overflowWrap: "anywhere",
    lineHeight: 1.25,
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    textOverflow: "ellipsis",
    whiteSpace: "normal",
};

export default function GraphNodeBase({ label, style }) {
    return (
        <div style={{ ...baseTextStyles, ...(style || {}) }}>
            <Handle id="left-target" type="target" position={Position.Left} />
            <Handle id="right-source" type="source" position={Position.Right} />
            {label}
        </div>
    );
}
