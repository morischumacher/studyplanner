import React from "react";
import { Handle, Position } from "reactflow";
import { CARD_WIDTH, colorForType } from "../utils/constants.js";
import { hexToRgba } from "../utils/examSubjectColors.js";

/** CourseCard — React Flow node renderer */
export default function CourseCard({ data }) {
    const handleRemove = (e) => {
        e.stopPropagation();
        data?.onRemove?.(data.nodeId);
    };

    const fallback = colorForType(data?.category);
    const subjectColor = data?.subjectColor ?? fallback.border;

    return (
        <div
            className="card"
            style={{
                width: CARD_WIDTH,
                position: "relative",
                background: "#fff",
                border: `1px solid ${subjectColor}`,
                borderLeftWidth: 6,
                borderRadius: 10,
                padding: 12,
                boxShadow: "0 1px 1px rgba(0,0,0,0.03)",
            }}
        >
            {/* four handles with IDs so edges can target specific sides */}
            {!data?.groupId && (
                <>
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
                </>
            )}

            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div className="title" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2, color: "#111827" }}>
                    {data.label}
                </div>
            </div>

            <div className="muted" style={{ fontSize: 12, color: "#374151", opacity: 0.9 }}>{data.code}</div>
            {data.ects ? (
                <div className="muted" style={{ fontSize: 12, color: "#374151", opacity: 0.8 }}>{data.ects} ECTS</div>
            ) : null}

            {data.onRemove && (
                <button
                    onClick={handleRemove}
                    aria-label="Remove course"
                    title="Remove course"
                    style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        border: `1px solid ${subjectColor}`,
                        background: hexToRgba(subjectColor, 0.08),
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
    );
}
