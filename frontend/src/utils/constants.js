// ----- Type colors (WCAG-friendly) -----
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
    style: { strokeWidth: 2, stroke: "#A8B5C3" }, // calmer, thicker
    markerEnd: { type: "arrowclosed", color: "#A8B5C3" },
};

export const SEMESTERS = [
    { id: 1, title: "Semester 1" },
    { id: 2, title: "Semester 2" },
    { id: 3, title: "Semester 3" },
    { id: 4, title: "Semester 4" },
    { id: 5, title: "Semester 5" },
    { id: 6, title: "Semester 6" },
];

export const COLLISION_GAP = 8; // minimal breathing room between blocks

export const LANE_WIDTH = 360;           // width per semester column (flow units)
export const LANE_GAP = 20;              // gap between lanes (flow units)
export const NODE_HEIGHT = 124;          // course-card baseline height
export const COURSE_LAYOUT_HEIGHT = 156; // vertical spacing/bbox used for table layout
export const GRID_SIZE = 16;             // snap grid
export const CANVAS_HEIGHT = 2000;       // tall background per lane
export const CARD_WIDTH = 270;           // fixed card width â†’ easy centering

// Group panel padding
export const GROUP_PADDING_X = 6;
export const GROUP_PADDING_Y = 20;
export const GROUP_EXTRA_RIGHT = 60;
export const COURSE_VERTICAL_GAP = 8;    // distance between stacked courses

// Module group panel tuning
export const MODULE_HEADER_HEIGHT = 68;
export const MODULE_TOP_PADDING = 4;     // small top padding under header
export const MODULE_BOTTOM_PADDING = 30; // extra breathing room at bottom

// Visual fine-tuning: center cards slightly left/right if needed
export const VISUAL_CENTER_OFFSET_X = -13; // (DE) kleiner Feinausgleich
