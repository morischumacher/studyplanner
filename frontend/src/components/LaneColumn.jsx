import React, { useEffect, useRef, useState } from "react";
import { CANVAS_HEIGHT, LANE_WIDTH } from "../utils/constants.js";


/** LaneColumn — background strip for each semester lane. */
export default function LaneColumn({ data }) {
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const infoRef = useRef(null);
    const rootRef = useRef(null);
    const plannedEcts = Number(data?.ectsPlanned ?? 0);
    const estimatedHoursTotal = Number(data?.estimatedHoursTotal ?? 0);
    const weightedGrade = Number.isFinite(Number(data?.weightedGrade)) ? Number(data.weightedGrade) : null;
    const courseNotes = Array.isArray(data?.courseNotes) ? data.courseNotes : [];
    const additionalNote = String(data?.additionalNote || "");
    const isParkingLane = Boolean(data?.isParking) || Number(data?.semesterId) === 0;
    const laneHeight = isParkingLane
        ? Math.max(64, Number(data?.height) || 88)
        : Math.max(CANVAS_HEIGHT, Number(data?.height) || CANVAS_HEIGHT);

    useEffect(() => {
        if (!isInfoOpen) return;
        const onPointerDown = (event) => {
            if (!infoRef.current?.contains(event.target)) setIsInfoOpen(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, [isInfoOpen]);

    useEffect(() => {
        const nodeEl = rootRef.current?.closest?.(".react-flow__node");
        if (!nodeEl) return;
        if (isInfoOpen) {
            nodeEl.style.zIndex = "100000";
            return () => {
                nodeEl.style.zIndex = "";
            };
        }
        nodeEl.style.zIndex = "";
    }, [isInfoOpen]);

    return (
        <div
            ref={rootRef}
            style={{
                height: laneHeight,
                width: LANE_WIDTH,
                background: data.even ? "rgba(243,244,246,0.82)" : "rgba(255,255,255,0.88)",
                border: data.even ? "1px dashed #d1d5db" : "1px dashed #cbd5e1",
                borderRadius: 16,
                pointerEvents: "none",
                position: "relative",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#374151",
                    background: "rgba(255,255,255,0.78)",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "5px 10px",
                    lineHeight: 1.2,
                }}
            >
                {`${data.title} · ${plannedEcts.toFixed(1)} ECTS`}
            </div>
            <div
                ref={infoRef}
                style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    pointerEvents: "all",
                    zIndex: 1200,
                }}
            >
                {isParkingLane ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            data?.onToggleParkingCollapsed?.();
                        }}
                        style={{
                            border: "1px solid #d1d5db",
                            background: "#ffffff",
                            color: "#111827",
                            borderRadius: 8,
                            fontSize: 12,
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontWeight: 700,
                        }}
                        title={data?.isParkingCollapsed ? "Show parking courses" : "Hide parking courses"}
                        aria-label={data?.isParkingCollapsed ? "Show parking courses" : "Hide parking courses"}
                    >
                        {data?.isParkingCollapsed ? "Show" : "Hide"}
                    </button>
                ) : (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsInfoOpen((v) => !v);
                        }}
                        style={{
                            border: "1px solid #d1d5db",
                            background: "#ffffff",
                            color: "#111827",
                            borderRadius: 8,
                            fontSize: 12,
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontWeight: 700,
                        }}
                        title="Semester details"
                        aria-label="Semester details"
                    >
                        i
                    </button>
                )}
                {!isParkingLane && isInfoOpen && (
                    <div
                        style={{
                            position: "absolute",
                            top: 30,
                            right: 0,
                            width: 300,
                            border: "1px solid #d1d5db",
                            borderRadius: 10,
                            background: "#ffffff",
                            boxShadow: "0 8px 18px rgba(0,0,0,0.14)",
                            padding: 10,
                            display: "grid",
                            gap: 8,
                            maxHeight: 360,
                            overflow: "auto",
                            zIndex: 100001,
                        }}
                    >
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{data?.title} summary</div>
                        <div style={{ display: "grid", gap: 4 }}>
                            <div style={{ fontSize: 12, color: "#374151" }}>
                                Estimated hours per week: <strong>{estimatedHoursTotal.toFixed(1)} h</strong>
                            </div>
                            <div style={{ fontSize: 12, color: "#374151" }}>
                                ECTS-weighted done grade: <strong>{weightedGrade == null ? "-" : weightedGrade.toFixed(2)}</strong>
                            </div>
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                            <div style={{ fontSize: 12, color: "#111827", fontWeight: 700 }}>Course notes</div>
                            {courseNotes.length === 0 && (
                                <div style={{ fontSize: 12, color: "#6b7280" }}>No course notes yet.</div>
                            )}
                            {courseNotes.map((item, idx) => (
                                <div key={`${item?.code || "course"}-${idx}`} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", background: "#f9fafb" }}>
                                    <div style={{ fontSize: 11, color: "#374151", fontWeight: 700 }}>{item?.code || "-"} {item?.name ? `· ${item.name}` : ""}</div>
                                    <div style={{ fontSize: 12, color: "#111827", whiteSpace: "pre-wrap" }}>{item?.note || ""}</div>
                                </div>
                            ))}
                        </div>
                        <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#111827", fontWeight: 700 }}>
                            Additional semester note
                            <textarea
                                value={additionalNote}
                                onChange={(e) => data?.onSetSemesterNote?.(data?.semesterId, e.target.value)}
                                rows={4}
                                placeholder="Add note for this semester"
                                style={{ resize: "vertical", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 500 }}
                            />
                        </label>
                    </div>
                )}
            </div>
        </div>
    );
}
