/**
 * The shapes the domain modules hand to one another.
 *
 * Every type here is derived from what the code already builds and reads rather
 * than from what a curriculum ought to look like. The catalogue types describe
 * the output of `normalizeCatalog` and nothing else: the backend payload is
 * narrowed once on the way in, so no module downstream has to guess whether it
 * is holding raw JSON or a catalogue.
 */

/** A point in React Flow's coordinate space, not in screen pixels. */
export interface Point {
    x: number;
    y: number;
}

/** A course as it appears once the catalogue has been normalised. */
export interface CatalogueCourse {
    name: string;
    code: string;
    ects: number | null;
    /** Teaching format such as "VU". Null where the backend left it blank. */
    type: string | null;
    /** Still in whatever case the backend used; `normalizeTermAvailability` settles it. */
    termAvailability: string;
}

/**
 * A module is the unit a requirement is written against, and it holds the
 * courses that can satisfy it. The snake_case fields are the backend's own and
 * are read under those names throughout the planner.
 */
export interface CatalogueModule {
    code: string;
    name: string;
    ects: number;
    category: string | null;
    is_mandatory: boolean;
    module_exam_subject: string | null;
    courses: CatalogueCourse[];
}

/** An exam subject (Prüfungsfach) and the modules counted towards it. */
export interface CatalogueSubject {
    pruefungsfach: string;
    modules: CatalogueModule[];
}

export type Catalogue = CatalogueSubject[];

/**
 * A catalogue course lifted out of its module, carrying the normalised strings
 * the prefill matcher compares against. Those strings are precomputed because
 * matching runs every alias of every template entry against every course.
 */
export interface FlattenedCourse {
    code: string;
    name: string;
    ects: number | null;
    category: string;
    examSubject: string | null;
    moduleName?: string | null;
    moduleCode?: string | null;
    moduleEcts?: number | null;
    _normCode: string;
    _normName: string;
    _normModule: string;
}

/** One entry of a prefill template: the aliases to match, and where it lands. */
export interface PrefillTemplateItem {
    semester: number;
    aliases: string[];
    ects?: number;
    /** Keeps the entry in its stated semester when a summer start would move it. */
    prefillFixedSemester?: boolean;
}

/** One line of a prefilled plan. */
export interface PlannedCourse {
    semester: number;
    code: string;
    name: string;
    ects: number | null;
    category: string;
    examSubject: string | null;
}

/** The module a prefilled bachelor course belongs to, as the planner groups it. */
export interface PlannedModule {
    key: string;
    title: string;
    code: string | null;
    ects: number | null;
    category: string;
}

export interface BachelorPlannedCourse extends PlannedCourse {
    prefillFixedSemester: boolean;
    module: PlannedModule;
}

/**
 * What a course card carries about the module it belongs to. Only the id is
 * certain: a card whose module panel has been collapsed away keeps the id and
 * loses the rest.
 */
export interface CourseModuleMeta {
    id: string;
    title?: string | undefined;
    examSubject?: string | null | undefined;
    category?: string | undefined;
    subjectColor?: string | null | undefined;
    code?: string | null | undefined;
    ects?: number | null | undefined;
}

/**
 * What the planner stores on a canvas node. A node is a course card, the panel
 * behind a module group, or a lane background, and the three kinds read
 * disjoint fields, which is why every field is optional.
 */
export interface PlanNodeData {
    groupId?: string | undefined;
    status?: string | undefined;
    code?: string | undefined;
    name?: string | undefined;
    label?: string | undefined;
    title?: string | undefined;
    /** Teaching format such as "VU", not the node's kind. */
    type?: string | undefined;
    category?: string | undefined;
    examSubject?: string | null | undefined;
    subjectColor?: string | null | undefined;
    ects?: number | undefined;
    width?: number | undefined;
    height?: number | undefined;
    moduleCode?: string | null | undefined;
    moduleEcts?: number | null | undefined;
    moduleMeta?: CourseModuleMeta | undefined;
    moduleCourseCount?: number | undefined;
    moduleCourseCodes?: string[] | undefined;
}

/** A node on the planning canvas. */
export interface PlanNode {
    id: string;
    type?: string | undefined;
    position: Point;
    data?: PlanNodeData | undefined;
    zIndex?: number | undefined;
}
