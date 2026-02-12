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
        background: "transparent",
        borderColor: null,
        textColor: "#111827",
        opacity: 1,
        extraShadow: "none",
    };
}

export function combinedCardShadow(typeShadow, stateShadow) {
    const parts = [typeShadow, stateShadow].filter(Boolean).filter((v) => v !== "none");
    return parts.length ? parts.join(", ") : "none";
}

export const VISUAL_LEGEND_ITEMS = [
    { name: "Exam Subject", token: "Solid Primary Color", detail: "High-level subject anchor." },
    { name: "Module", token: "20% Opacity Tint", detail: "Background container with module boundaries." },
    { name: "Course: Base", token: "Transparent Center + Borders", detail: "Not planned." },
    { name: "Course: In Plan", token: "Solid White + Shadow", detail: "Planned." },
    { name: "Course: Done", token: "Grey + Inner Border", detail: "Completed." },
];
