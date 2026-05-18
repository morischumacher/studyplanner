import React from "react";

const BACHELOR_PROGRAM_CODE = "033 521";

function norm(value) {
    return String(value || "").trim().toLowerCase();
}

export function mapTypeForProgram(category, programCode) {
    const c = norm(category);
    const isBachelor = programCode === BACHELOR_PROGRAM_CODE;

    if (c === "mandatory" || c === "pflicht" || c === "required") {
        return { key: "mandatory", label: "Mandatory", layers: 3 };
    }

    if (c === "core" || c === "narrow_elective" || c === "narrow" || c === "enge wahl") {
        return {
            key: "core",
            label: isBachelor ? "Enge Wahl (+)" : "Core (+)",
            layers: 2,
        };
    }

    if (c === "elective" || c === "broad_elective" || c === "broad" || c === "breite wahl") {
        return {
            key: "elective",
            label: isBachelor ? "Breite Wahl (*)" : "Elective (*)",
            layers: 1,
        };
    }

    return { key: "other", label: "Other", layers: 1 };
}

export function layeredTypeShadow(color, layers, gapColor = "transparent") {
    const layerCount = Math.max(1, Math.min(3, Number(layers) || 1));
    if (layerCount === 1) {
        return `inset 0 0 0 1px ${color}`;
    }
    if (layerCount === 2) {
        return [
            `inset 0 0 0 3px ${color}`,
            `inset 0 0 0 2px ${gapColor}`,
            `inset 0 0 0 1px ${color}`,
        ].join(", ");
    }
    return [
        `inset 0 0 0 5px ${color}`,
        `inset 0 0 0 4px ${gapColor}`,
        `inset 0 0 0 3px ${color}`,
        `inset 0 0 0 2px ${gapColor}`,
        `inset 0 0 0 1px ${color}`,
    ].join(", ");
}

export function stateVisualByStatus(status) {
    if (status === "done") {
        return {
            background: "#f3f4f6",
            borderColor: "#9ca3af",
            textColor: "#6b7280",
            opacity: 0.8,
            extraShadow: "inset 0 0 0 1px #9ca3af",
        };
    }
    if (status === "parked") {
        return {
            background: "#ffffff",
            borderColor: null,
            textColor: "#111827",
            opacity: 1,
            extraShadow: "0 2px 8px rgba(0,0,0,0.08)",
        };
    }
    if (status === "in_plan") {
        return {
            background: "#f3f4f6",
            borderColor: null,
            textColor: "#111827",
            opacity: 1,
            extraShadow: "0 2px 8px rgba(0,0,0,0.08)",
        };
    }
    return {
        background: "#ffffff",
        borderColor: null,
        textColor: "#111827",
        opacity: 1,
        extraShadow: "0 2px 8px rgba(0,0,0,0.08)",
    };
}

export function combinedCardShadow(typeShadow, stateShadow) {
    const parts = [typeShadow, stateShadow].filter(Boolean).filter((v) => v !== "none");
    return parts.length ? parts.join(", ") : "none";
}

export const REC_TYPE_META = {
    interest:   { icon: "★", label: "Interest match",      badge: "#7c3aed", badgeBg: "#f5f3ff" },
    sequence:   { icon: "→", label: "Sequence dependency", badge: "#2563eb", badgeBg: "#eff6ff" },
    similarity: { icon: "≈", label: "Content similarity",  badge: "#0891b2", badgeBg: "#ecfeff" },
    completed:  { icon: "✓", label: "Based on completed",  badge: "#16a34a", badgeBg: "#f0fdf4" },
    internship: { icon: "▶", label: "Internship lens",      badge: "#ea580c", badgeBg: "#fff7ed" },
    peer:       { icon: "👤", label: "Other students",      badge: "#db2777", badgeBg: "#fdf2f8" },
};

export function renderRecommendationPatch(type) {
    const meta = REC_TYPE_META[type] || REC_TYPE_META.interest;
    return React.createElement(
        "div",
        {
            style: {
                position: "absolute",
                top: -10,
                right: 12,
                background: meta.badgeBg,
                border: `1px solid ${meta.badge}`,
                borderRadius: 99,
                padding: "2px 8px",
                fontSize: 10,
                fontWeight: 700,
                color: meta.badge,
                zIndex: 10,
                boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                pointerEvents: "none",
            },
        },
        React.createElement("span", null, meta.label)
    );
}

export const VISUAL_LEGEND_ITEMS = [
    { name: "Exam Subject", token: "Solid Primary Color", detail: "High-level subject anchor." },
    { name: "Module", token: "20% Opacity Tint", detail: "Background container with module boundaries." },
    { name: "Course: Base", token: "Transparent Center + Borders", detail: "Not planned." },
    { name: "Course: In Plan", token: "Solid Gray + Shadow", detail: "Planned." },
    { name: "Course: Done", token: "Grey + Inner Border", detail: "Completed." },
];
