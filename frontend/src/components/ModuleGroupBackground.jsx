import React from "react";
import { Handle, Position } from "reactflow";
import {
    GROUP_PADDING_Y,
    MODULE_HEADER_HEIGHT,
} from "../utils/constants.js";
import { colorForType } from "../utils/constants.js";
import { hexToRgba, MODULE_GROUP_COLOR_ALPHA } from "../utils/examSubjectColors.js";

/** ModuleGroupBackground — soft panel wrapping a set of course nodes. */
export default function ModuleGroupBackground({ data }) {
    const { title, width, height, onRemove, category, subjectColor } = data || {};
    const fallback = colorForType(category);
    const baseColor = subjectColor ?? fallback.border;
    const moduleColor = hexToRgba(baseColor, MODULE_GROUP_COLOR_ALPHA);

    return (
        <div
            style={{
                pointerEvents: "all",
                width,
                height,
                overflow: "visible",
                background: moduleColor,
                border: `1px solid ${baseColor}`,
                borderRadius: 12,
                position: "relative",
                padding: GROUP_PADDING_Y,
                paddingTop: GROUP_PADDING_Y,
                boxSizing: "border-box",
            }}
        >
            {/* top */}
            <Handle id="top" type="target" position={Position.Top} />
            <Handle id="top" type="source" position={Position.Top} />

            {/* right */}
            <Handle id="right" type="target" position={Position.Right} />
            <Handle id="right" type="source" position={Position.Right} />

            {/* bottom */}
            <Handle id="bottom" type="target" position={Position.Bottom} />
            <Handle id="bottom" type="source" position={Position.Bottom} />

            {/* left */}
            <Handle id="left" type="target" position={Position.Left} />
            <Handle id="left" type="source" position={Position.Left} />

            {/* Header bar */}
            <div
                style={{
                    position: "absolute",
                    top: 6,
                    left: 10,
                    right: 10,
                    height: MODULE_HEADER_HEIGHT - 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: "#111827",
                    fontWeight: 700,
                    fontSize: 13,
                    background: moduleColor,
                    borderRadius: 8,
                    padding: "0 10px",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{title ?? "Modul"}</span>
                </div>

                {onRemove && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                        title="Remove module"
                        style={{
                            border: `1px solid ${baseColor}`,
                            background: "#fff",
                            color: "#111827",
                            borderRadius: 6,
                            fontSize: 12,
                            padding: "2px 6px",
                            cursor: "pointer",
                            lineHeight: 1.2,
                        }}
                    >
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
}
