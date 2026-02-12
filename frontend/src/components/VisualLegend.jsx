import React from "react";
import {
    mapTypeForProgram,
    layeredTypeShadow,
    stateVisualByStatus,
} from "../utils/courseVisuals.js";

const BACHELOR_PROGRAM_CODE = "033 521";

export default function VisualLegend({ programCode }) {
    const isBachelor = programCode === BACHELOR_PROGRAM_CODE;
    const mandatory = mapTypeForProgram("mandatory", programCode);
    const core = mapTypeForProgram("core", programCode);
    const elective = mapTypeForProgram("elective", programCode);
    const todoState = stateVisualByStatus("todo");
    const plannedState = stateVisualByStatus("in_plan");
    const doneState = stateVisualByStatus("done");
    const subjectColor = "#2563eb";
    const moduleTint = "rgba(37, 99, 235, 0.2)";

    const sampleCard = (title, state, borderLayers = 1, borderColor = "#2563eb") => (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, background: "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{title}</div>
            <div
                style={{
                    height: 58,
                    borderRadius: 10,
                    border: `1px solid ${state.borderColor || borderColor}`,
                    background: state.background,
                    boxShadow: `${layeredTypeShadow(borderColor, borderLayers, state.background || "transparent")}${state.extraShadow && state.extraShadow !== "none" ? `, ${state.extraShadow}` : ""}`,
                    opacity: state.opacity,
                }}
            />
        </div>
    );

    const structureSample = (title, style) => (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, background: "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{title}</div>
            <div
                style={{
                    height: 58,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    ...style,
                }}
            />
        </div>
    );

    const typeCard = (title, layers, color) => (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, background: "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{title}</div>
            <div
                style={{
                    height: 58,
                    borderRadius: 10,
                    border: `1px solid ${color}`,
                    background: "#ffffff",
                    boxShadow: layeredTypeShadow(color, layers, "#ffffff"),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            />
        </div>
    );

    return (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#ffffff", padding: 10, width: 330 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Visual Legend</div>
            <div style={{ display: "grid", gap: 8 }}>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {sampleCard("Not Planned", todoState, 1)}
                    {sampleCard("Planned", plannedState, 1)}
                    {sampleCard("Done", doneState, 1, "#9ca3af")}
                </div>

                <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 8, display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 700 }}>Structure</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        {structureSample(
                            "Exam Subject",
                            {
                                border: `1px solid ${subjectColor}`,
                                background: subjectColor,
                                color: "#ffffff",
                                boxShadow: "none",
                            }
                        )}
                        {structureSample(
                            "Module",
                            {
                                border: `1px solid ${subjectColor}`,
                                background: moduleTint,
                                color: "#1f2937",
                            }
                        )}
                        {structureSample(
                            "Course",
                            {
                                border: `1px solid ${subjectColor}`,
                                background: "transparent",
                                color: "#1f2937",
                            }
                        )}
                    </div>
                </div>

                <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 8, display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 700 }}>Type Borders</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        {typeCard(mandatory.label, 3, subjectColor)}
                        {typeCard(core.label, 2, subjectColor)}
                        {typeCard(elective.label, 1, subjectColor)}
                    </div>
                </div>
            </div>
        </div>
    );
}
