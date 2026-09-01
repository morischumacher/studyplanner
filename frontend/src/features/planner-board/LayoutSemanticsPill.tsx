/**
 * The caption under the canvas saying what each axis of the plan means.
 *
 * The horizontal axis is fixed: it is the sequence of semesters, and the whole
 * planner is built on that. The vertical axis means whatever the student says
 * it means, and saying so is the point of this control: an order that carries a
 * meaning only the student knows is still worth naming, so "custom" is an
 * answer here rather than a way of sorting.
 */

import type { VerticalSemantics } from "../../domain/nodes.ts";

export interface LayoutSemanticsPillProps {
    verticalSemantics: VerticalSemantics;
    onVerticalSemanticsChange: (semantics: VerticalSemantics) => void;
    customText: string;
    onCustomTextChange: (text: string) => void;
    isPopupOpen: boolean;
    onPopupOpenChange: (open: boolean) => void;
}

export default function LayoutSemanticsPill({
    verticalSemantics,
    onVerticalSemanticsChange,
    customText,
    onCustomTextChange,
    isPopupOpen,
    onPopupOpenChange,
}: LayoutSemanticsPillProps) {
    return (
        <>
            {/* Layout Semantics Pill */}
            <div
                style={{
                    position: "absolute",
                    bottom: 16,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(255, 255, 255, 0.9)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid #e5e7eb",
                    borderRadius: 9999,
                    padding: "6px 14px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "#374151",
                }}
            >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: "#4f46e5", fontWeight: 700 }}>↔ Horizontal:</span> Semesters (Chronological)
                </span>
                <span style={{ color: "#d1d5db" }}>|</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: "#4f46e5", fontWeight: 700 }}>↕ Vertical:</span>
                    {verticalSemantics === "no_meaning" && (
                        <span style={{ color: "#9ca3af", fontStyle: "italic" }}>
                            no meaning
                        </span>
                    )}
                    {verticalSemantics === "alphabetical" && <span>Alphabetical (A-Z)</span>}
                    {verticalSemantics === "ects" && <span>ECTS (descending)</span>}
                    {verticalSemantics === "custom" && (
                        <span style={{ fontWeight: 600, color: "#1f2937" }}>{customText || "Custom meaning"}</span>
                    )}
                </span>
                <button
                    id="table-semantics-edit-btn"
                    onClick={() => onPopupOpenChange(true)}
                    style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        color: "#4f46e5",
                        fontWeight: 700,
                        fontSize: 11,
                        marginLeft: 6,
                        textDecoration: "underline",
                    }}
                >
                    Edit
                </button>
            </div>

            {isPopupOpen && (
                <div
                    style={{
                        position: "absolute",
                        bottom: 50,
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 11,
                        width: 320,
                        background: "#ffffff",
                        border: "1px solid #d1d5db",
                        borderRadius: 12,
                        padding: 14,
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                        display: "grid",
                        gap: 10,
                    }}
                >
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>Configure Layout Axis Semantics</div>

                    {/* Horizontal Axis */}
                    <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#4b5563" }}>Horizontal Axis Semantics</div>
                        <div style={{ fontSize: 11, color: "#6b7280", fontStyle: "italic" }}>
                            Semesters (fixed by layout)
                        </div>
                    </div>

                    <hr style={{ border: "0", borderTop: "1px solid #e5e7eb", margin: "4px 0" }} />

                    {/* Vertical Axis */}
                    <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#4b5563" }}>Vertical Axis Semantics</div>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#374151", cursor: "pointer" }}>
                            <input
                                type="radio"
                                name="tableVerticalSemantics"
                                checked={verticalSemantics === "no_meaning"}
                                onChange={() => onVerticalSemanticsChange("no_meaning")}
                            />
                            No meaning
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#374151", cursor: "pointer" }}>
                            <input
                                type="radio"
                                name="tableVerticalSemantics"
                                checked={verticalSemantics === "alphabetical"}
                                onChange={() => onVerticalSemanticsChange("alphabetical")}
                            />
                            Alphabetical (A-Z)
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#374151", cursor: "pointer" }}>
                            <input
                                type="radio"
                                name="tableVerticalSemantics"
                                checked={verticalSemantics === "ects"}
                                onChange={() => onVerticalSemanticsChange("ects")}
                            />
                            ECTS (descending)
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#374151", cursor: "pointer" }}>
                            <input
                                type="radio"
                                name="tableVerticalSemantics"
                                checked={verticalSemantics === "custom"}
                                onChange={() => onVerticalSemanticsChange("custom")}
                            />
                            Custom meaning...
                        </label>
                    </div>

                    {verticalSemantics === "custom" && (
                        <input
                            type="text"
                            placeholder="Enter custom vertical ordering meaning"
                            value={customText}
                            onChange={(e) => onCustomTextChange(e.target.value)}
                            style={{
                                border: "1px solid #d1d5db",
                                borderRadius: 6,
                                padding: "4px 8px",
                                fontSize: 11,
                                width: "100%",
                                boxSizing: "border-box",
                            }}
                        />
                    )}

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
                        <button
                            onClick={() => onPopupOpenChange(false)}
                            style={{
                                background: "#4f46e5",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: 6,
                                padding: "4px 10px",
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
