/**
 * What the planning canvas puts on a React Flow node, and the small payloads
 * the sidebar and the curriculum graph hand it.
 *
 * One `data` bag is shared by the three kinds of node the canvas draws, so
 * every field is optional and each kind reads only its own. The handlers live
 * on the bag rather than arriving as props because React Flow renders the node
 * components itself and gives them nothing but their node.
 */

import type { CSSProperties } from "react";

import type { RecommendedCourse } from "../recommendations/index.ts";
import type { CourseModuleMeta, Point } from "../../domain/types.ts";

/**
 * The module a card came from. A catalogue entry names the module's courses and
 * a stored plan's entry does not, so the field is written from either source
 * and read for whichever part is present.
 */
export interface BoardModuleMeta extends CourseModuleMeta {
    courseCodes?: string[] | undefined;
}

/** A semester as the placement menus list it. */
export interface SemesterOption {
    /** A lane's number, zero for the parking stage, or a two-lane window's key. */
    id: number | string;
    title: string;
    isParking?: boolean | undefined;
    /** A lane past the plan's current length, offered so the plan can grow. */
    isPlus?: boolean | undefined;
    laneIndex?: number | undefined;
    windowEndLaneIndex?: number | undefined;
}

/** A note the student wrote on a course, as its lane header lists it. */
export interface LaneCourseNote {
    code: string;
    name: string;
    note: string;
}

/** What one lane header says beyond its credit total. */
export interface LaneInsight {
    courseNotes: LaneCourseNote[];
    estimatedHoursTotal: number;
    weightedGrade: number | null;
    additionalNote: string;
}

/** A course as the sidebar, the graph or the catalogue hands it over. */
export interface CourseLike {
    code?: string | null | undefined;
    name?: string | null | undefined;
    /** What the graph calls a course when it has no separate name for it. */
    label?: string | null | undefined;
    /** Teaching format such as "VU". */
    type?: string | null | undefined;
    /** The graph's name for the same thing, and the only one placement reads. */
    courseType?: string | null | undefined;
    ects?: number | null | undefined;
    category?: string | null | undefined;
    examSubject?: string | null | undefined;
    subjectColor?: string | null | undefined;
    moduleMeta?: BoardModuleMeta | null | undefined;
}

/** A module as the sidebar and the graph hand it over. */
export interface ModulePayload {
    kind?: string | undefined;
    code?: string | null | undefined;
    name?: string | null | undefined;
    ects?: number | null | undefined;
    category?: string | null | undefined;
    examSubject?: string | null | undefined;
    subjectColor?: string | null | undefined;
    courses?: CourseLike[] | undefined;
    variantId?: string | null | undefined;
}

/** How a caller asks for a lane rather than accepting the one we would pick. */
export interface PlacementOptions {
    /**
     * True when the lane was named by the student rather than guessed from a
     * drop, in which case a lane the course cannot be taken in is a refusal
     * instead of an invitation to look further along the plan.
     */
    allowDirectLaneSelection?: boolean | undefined;
    variantId?: string | null | undefined;
}

/** What the sidebar puts on the drag event when a card leaves it. */
export interface DragPayload {
    kind?: string | undefined;
    code?: string | undefined;
    name?: string | undefined;
    type?: string | null | undefined;
    ects?: number | null | undefined;
    category?: string | null | undefined;
    subjectColor?: string | null | undefined;
    moduleMeta?: BoardModuleMeta | null | undefined;
    courses?: CourseLike[] | undefined;
    variantId?: string | null | undefined;
}

/** What the student records about a course beyond where they put it. */
export interface CourseMetaPatch {
    notes?: string | undefined;
    estimatedHours?: string | undefined;
    grade?: string | undefined;
}

export type AddCourseToPlan = (
    course: CourseLike,
    requestedLaneIndex: number,
    options?: PlacementOptions | null
) => boolean;

export type AddModuleToPlan = (
    modulePayload: ModulePayload,
    requestedLaneIndex: number,
    options?: PlacementOptions | null
) => boolean;

/** The fields the canvas writes onto a node. */
export interface BoardNodeData {
    label?: string | undefined;
    title?: string | undefined;
    name?: string | null | undefined;
    code?: string | null | undefined;
    /** Teaching format such as "VU", not the node's kind. */
    type?: string | null | undefined;
    ects?: number | null | undefined;
    status?: string | undefined;
    category?: string | null | undefined;
    examSubject?: string | null | undefined;
    subjectColor?: string | null | undefined;
    programCode?: string | undefined;
    termAvailability?: string | undefined;
    nodeId?: string | undefined;
    groupId?: string | null | undefined;
    moduleMeta?: BoardModuleMeta | null | undefined;
    /** Where a card inside a module panel was first laid out. */
    baseY?: number | undefined;
    notes?: string | undefined;
    estimatedHours?: string | undefined;
    grade?: string | undefined;
    recommendation?: RecommendedCourse | null | undefined;
    semesters?: SemesterOption[] | undefined;

    moduleCode?: string | null | undefined;
    moduleEcts?: number | null | undefined;
    moduleCourseCount?: number | undefined;
    moduleCourseCodes?: string[] | undefined;
    semestersForModule?: SemesterOption[] | undefined;
    modulePayload?: ModulePayload | undefined;
    width?: number | undefined;
    height?: number | undefined;
    /** Set while a card is hidden behind a collapsed parking stage. */
    collapsedGhost?: boolean | undefined;

    isParking?: boolean | undefined;
    isParkingCollapsed?: boolean | undefined;
    onToggleParkingCollapsed?: (() => void) | undefined;
    even?: boolean | undefined;
    ectsPlanned?: number | undefined;
    semesterId?: number | undefined;
    courseNotes?: LaneCourseNote[] | undefined;
    estimatedHoursTotal?: number | undefined;
    weightedGrade?: number | null | undefined;
    additionalNote?: string | undefined;
    onSetSemesterNote?: ((semesterId: number, note: string) => void) | null | undefined;

    onRemove?: ((nodeId: string) => void) | undefined;
    onRemoveModuleGroup?: ((groupId: string) => void) | undefined;
    onRemoveGroup?: ((groupId: string) => void) | undefined;
    onToggleDone?: ((courseCode: string, nextDone: boolean, nodeId: string) => void) | undefined;
    onUpdateEcts?: ((nodeId: string, nextEcts: number) => void) | undefined;
    onToggleModuleDone?: ((courseCodes: string[], nextDone: boolean, groupId: string) => void) | undefined;
    onAddToPlan?: AddCourseToPlan | undefined;
    onAddModuleToPlan?: AddModuleToPlan | undefined;
    onUpdateCourseMeta?: ((courseCode: string, patch: CourseMetaPatch) => void) | undefined;
}

/** A node on the planning canvas. */
export interface BoardNode {
    id: string;
    /** "course", "moduleBg" or "lane". */
    type?: string | undefined;
    position: Point;
    data?: BoardNodeData | undefined;
    zIndex?: number | undefined;
    hidden?: boolean | undefined;
    selected?: boolean | undefined;
    draggable?: boolean | undefined;
    selectable?: boolean | undefined;
    dragHandle?: string | undefined;
    sourcePosition?: string | undefined;
    targetPosition?: string | undefined;
    style?: CSSProperties | undefined;
}
