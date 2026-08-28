/**
 * The colour a course card is drawn in, by how the course counts.
 *
 * The palette is chosen for contrast against its own text at WCAG AA, which is
 * why each entry carries five values rather than one: the chip and the border
 * share a hue that the background and the faint fill deliberately do not reach.
 * An unrecognised category falls back to the neutral grey, so a course the
 * catalogue cannot classify still reads as a card.
 */

export const TYPE_COLORS = {
    mandatory: {
        bg: "#FDECE8",
        chip: "#E5533D",
        border: "#E5533D",
        text: "#5A1B12",
        faint: "#FEF6F4",
    },
    core: {
        bg: "#EAF5FF",
        chip: "#1280DF",
        border: "#1280DF",
        text: "#0A2A4A",
        faint: "#F5FAFF",
    },
    elective: {
        bg: "#EEF8ED",
        chip: "#2F9E44",
        border: "#2F9E44",
        text: "#163B1D",
        faint: "#F6FBF6",
    },
    unknown: {
        bg: "#F4F4F5",
        chip: "#71717A",
        border: "#A1A1AA",
        text: "#27272A",
        faint: "#FAFAFA",
    },
};

export const colorForType = (t) => TYPE_COLORS[t] || TYPE_COLORS.unknown;

export const DEFAULT_EDGE_OPTIONS = {
    type: "smoothstep",
    animated: false,
    style: { strokeWidth: 2, stroke: "#A8B5C3" },
    markerEnd: { type: "arrowclosed", color: "#A8B5C3" },
};
