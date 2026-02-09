import React from "react";
import { TYPE_COLORS } from "../utils/constants.js";

// normalize the module type for styling
const typeFromModule = (m) =>
    m?.is_mandatory ? "mandatory" : (m?.category ?? "unknown");

function Legend() {
    const item = (label, key) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
          aria-hidden
          style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: TYPE_COLORS[key].bg,
              border: `1px solid ${TYPE_COLORS[key].border}`,
              display: "inline-block",
          }}
      />
            <span style={{ fontSize: 12 }}>{label}</span>
        </div>
    );
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                padding: "8px 10px 12px",
                background: "#fafafa",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                marginTop: 8,
                marginBottom: 12,
            }}
        >
            {item("Mandatory", "mandatory")}
            {item("Core", "core")}
            {item("Elective", "elective")}
        </div>
    );
}

/** Sidebar — catalog + drag sources */
export default function Sidebar({ catalog, loading, error, expandedSet, togglePf, onDragStart }) {
    return (
        <aside
            style={{
                width: 280,
                background: "#fff",
                borderRight: "1px solid #e5e7eb",
                padding: 16,
                overflow: "auto",
            }}
        >
            <div style={{ fontSize: 18, fontWeight: 600 }}>Course Catalog</div>
            <p style={{ fontSize: 14, color: "#6b7280" }}>
                Drag a course or a multi-course module into any semester lane.
            </p>

            <Legend />

            {!(Array.isArray(catalog) && catalog.length > 0) && (
                <div style={{ fontSize: 14, color: "#6b7280", margin: "8px 0 12px" }}>
                    {loading ? "Lade Katalog ..." : (error ? `Fehler beim Laden: ${error}` : "Kein Katalog gefunden.")}
                </div>
            )}

            <div style={{ display: "grid", gap: 10 }}>
                {(Array.isArray(catalog) ? catalog : []).map((pf, pfIdx) => {
                    const pfName = pf.pruefungsfach ?? `Prüfungsfach ${pfIdx + 1}`;
                    const modules = Array.isArray(pf.modules) ? pf.modules : [];
                    const isOpen = expandedSet.has(pfName);

                    return (
                        <div key={`pf-${pfIdx}`} style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
                            {/* Header */}
                            <button
                                onClick={() => togglePf(pfName)}
                                style={{
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "10px 12px",
                                    background: "transparent",
                                    border: "none",
                                    borderBottom: "1px solid #e5e7eb",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    cursor: "pointer",
                                }}
                                aria-expanded={isOpen}
                            >
                <span
                    aria-hidden
                    style={{
                        display: "inline-block",
                        transform: `rotate(${isOpen ? 90 : 0}deg)`,
                        transition: "transform 0.15s ease",
                        color: "#6b7280",
                        fontWeight: 700,
                    }}
                >
                  ▶
                </span>
                                <span style={{ fontWeight: 700 }}>{pfName}</span>
                                <span style={{ marginLeft: "auto", color: "#6b7280", fontSize: 12 }}>
                  {modules.length} Module
                </span>
                            </button>

                            {/* Body */}
                            {isOpen && (
                                <div style={{ padding: "8px 10px 12px 10px", display: "grid", gap: 8 }}>
                                    {modules.map((mod, modIdx) => {
                                        const courses = Array.isArray(mod.courses) ? mod.courses : [];
                                        const cat = typeFromModule(mod);

                                        // Case B: single course → drag that one (use the course's code!)
                                        if (courses.length === 1) {
                                            const course = courses[0] ?? {};
                                            return (
                                                <button
                                                    key={`pf${pfIdx}-${mod.code || course.code || modIdx}`}
                                                    draggable
                                                    onDragStart={(e) =>
                                                        onDragStart(e, {
                                                            kind: "course",
                                                            code: course.code ?? mod.code,
                                                            name: course.name ?? mod.name,
                                                            category: cat,
                                                        })
                                                    }
                                                    title="Drag into the graph"
                                                    style={{
                                                        textAlign: "left",
                                                        border: "1px solid #e5e7eb",
                                                        borderRadius: 12,
                                                        background: "#fff",
                                                        padding: "10px 12px",
                                                        cursor: "grab",
                                                    }}
                                                >
                                                    <div style={{ color: "#6b7280", fontSize: 12 }}>{course.code ?? mod.code}</div>
                                                    <div style={{ fontWeight: 600 }}>{course.name ?? mod.name}</div>
                                                </button>
                                            );
                                        }

                                        // Case C: multiple courses → one draggable for the whole module + individual draggables
                                        const modulePayload = {
                                            kind: "module",
                                            code: mod.code,
                                            name: mod.name,
                                            category: cat,
                                            courses: courses.map((c) => ({ code: c.code, name: c.name })),
                                        };

                                        return (
                                            <div
                                                key={`pf${pfIdx}-${mod.code || modIdx}`}
                                                style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}
                                            >
                                                <button
                                                    draggable
                                                    onDragStart={(e) => onDragStart(e, modulePayload)}
                                                    title="Drag the whole module"
                                                    style={{
                                                        width: "100%",
                                                        textAlign: "left",
                                                        border: "none",
                                                        borderBottom: "1px solid #e5e7eb",
                                                        background: "#f3f4f6",
                                                        padding: 12,
                                                        display: "grid",
                                                        gap: 8,
                                                        cursor: "grab",
                                                    }}
                                                >
                                                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                                                        <span style={{ color: "#6b7280" }}>{mod.code}</span> · {mod.name}
                                                    </div>
                                                    <div style={{ color: "#6b7280", fontSize: 12 }}>
                                                        {courses.length} Kurse
                                                    </div>
                                                </button>

                                                <div style={{ padding: 8, display: "grid", gap: 8 }}>
                                                    {courses.map((course, idx) => (
                                                        <button
                                                            key={`pf${pfIdx}-${mod.code}-${idx}`}
                                                            draggable
                                                            onDragStart={(e) =>
                                                                onDragStart(e, {
                                                                    kind: "course",
                                                                    code: course?.code ?? mod.code, // prefer the real course code
                                                                    name: course?.name ?? mod.name,
                                                                    category: cat,
                                                                })
                                                            }
                                                            title="Drag only this course into the graph"
                                                            style={{
                                                                textAlign: "left",
                                                                border: "1px solid #e5e7eb",
                                                                borderRadius: 10,
                                                                background: "#fff",
                                                                padding: "8px 10px",
                                                                cursor: "grab",
                                                            }}
                                                        >
                                                            <div style={{ color: "#6b7280", fontSize: 12 }}>{course?.code ?? mod.code}</div>
                                                            <div style={{ fontWeight: 600 }}>{course?.name ?? mod.name}</div>
                                                            <div style={{ color: "#6b7280", fontSize: 12 }}>
                                                                {typeof course?.ects === "number" ? `${course?.ects} ECTS` : course?.ects}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
