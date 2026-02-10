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
    const handleToggleDone = (e) => {
        e.stopPropagation();
        const nextDone = !(data?.status === "done");
        data?.onToggleDone?.(data?.code, nextDone, data?.nodeId);
    };
    const handleEctsChange = (e) => {
        e.stopPropagation();
        data?.onUpdateEcts?.(data?.nodeId, Number(e.target.value));
    };

    const fallback = colorForType(data?.category);
    const subjectColor = data?.subjectColor ?? fallback.border;
    const isDone = data?.status === "done";
    const codeKey = String(data?.code ?? "").trim().toLowerCase();
    const labelKey = String(data?.label ?? "").trim().toLowerCase();
    const isTransferableSkills =
        data?.category === "transferable_skills" ||
        codeKey === "fwts-el" ||
        labelKey.includes("transferable skills");
    const isExtension =
        data?.category === "extension" ||
        codeKey === "extension" ||
        labelKey.includes("extension");
    const ectsOptions = [4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];
    const extensionOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    return (
        <div
            className="card"
            style={{
                width: CARD_WIDTH,
                position: "relative",
                background: isDone ? "#f3f4f6" : "#fff",
                border: `1px solid ${isDone ? "#9ca3af" : subjectColor}`,
                borderLeftWidth: 6,
                borderRadius: 10,
                padding: 12,
                boxShadow: "0 1px 1px rgba(0,0,0,0.03)",
                opacity: isDone ? 0.8 : 1,
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
                <div className="title" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2, color: isDone ? "#6b7280" : "#111827" }}>
                    {data.label}
                </div>
            </div>

            <div className="muted" style={{ fontSize: 12, color: isDone ? "#6b7280" : "#374151", opacity: 0.9 }}>{data.code}</div>
            {data.ects ? (
                <div className="muted" style={{ fontSize: 12, color: isDone ? "#6b7280" : "#374151", opacity: 0.8 }}>{data.ects} ECTS</div>
            ) : null}
            {isTransferableSkills && data?.onUpdateEcts && (
                <div style={{ marginTop: 6 }}>
                    <label style={{ fontSize: 11, color: "#6b7280", marginRight: 6 }}>ECTS</label>
                    <select
                        value={Number(data?.ects ?? 9)}
                        onChange={handleEctsChange}
                        style={{
                            border: `1px solid ${isDone ? "#9ca3af" : subjectColor}`,
                            borderRadius: 6,
                            fontSize: 12,
                            padding: "2px 6px",
                            background: "#fff",
                            color: "#111827",
                        }}
                    >
                        {ectsOptions.map((v) => (
                            <option key={v} value={v}>
                                {String(v).replace(".", ",")}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {isExtension && data?.onUpdateEcts && (
                <div style={{ marginTop: 6 }}>
                    <label style={{ fontSize: 11, color: "#6b7280", marginRight: 6 }}>ECTS</label>
                    <select
                        value={Number(data?.ects ?? 6)}
                        onChange={handleEctsChange}
                        style={{
                            border: `1px solid ${isDone ? "#9ca3af" : subjectColor}`,
                            borderRadius: 6,
                            fontSize: 12,
                            padding: "2px 6px",
                            background: "#fff",
                            color: "#111827",
                        }}
                    >
                        {extensionOptions.map((v) => (
                            <option key={v} value={v}>
                                {v}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {data.onToggleDone && (
                <button
                    onClick={handleToggleDone}
                    aria-label={isDone ? "Mark as in plan" : "Mark as done"}
                    title={isDone ? "Mark as in plan" : "Mark as done"}
                    style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        border: `1px solid ${isDone ? "#9ca3af" : subjectColor}`,
                        background: isDone ? "#10b981" : hexToRgba(subjectColor, 0.08),
                        color: isDone ? "#ffffff" : "#111827",
                        borderRadius: 6,
                        fontSize: 12,
                        padding: "2px 6px",
                        cursor: "pointer",
                        lineHeight: 1.2,
                    }}
                >
                    ✓
                </button>
            )}

            {data.onRemove && (
                <button
                    onClick={handleRemove}
                    aria-label="Remove course"
                    title="Remove course"
                    style={{
                        position: "absolute",
                        top: 6,
                        left: 6,
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
