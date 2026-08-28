/**
 * The programmes the planner supports, and the fixed text that goes with them.
 *
 * The two programme codes are the identity the whole planner keys off, and they
 * are spaced exactly as the curriculum regulations print them; a code without
 * its space matches nothing, on purpose.
 *
 * The long German passages below are quoted from the curriculum regulations and
 * are shown to students verbatim, so they are held as data rather than as
 * component markup: an editor changing a rule should not have to read JSX.
 */

export { BACHELOR_PROGRAM_CODE } from "./terms.ts";

export const MASTER_PROGRAM_CODE = "066 937";

/** A programme as the programme picker lists it. */
export interface ProgrammeOption {
    code: string;
    label: string;
}

export const PROGRAM_OPTIONS: ProgrammeOption[] = [
    { code: "066 937", label: "Master Software Engineering" },
    { code: "033 521", label: "Bachelor Informatics" },
];

/** The bachelor focus areas, spelled as the rule checker expects them. */
export const BACHELOR_FOCUS_OPTIONS: string[] = [
    "Artificial Intelligence und Machine Learning",
    "Cybersecurity",
    "Digital Health",
    "Human-Centered Computing",
    "Software Engineering",
    "Theoretische Informatik und Logik",
    "Visual Computing",
];

export const DEFAULT_PLANNED_SECTION_ORDER: string[] = [
    "steop",
    "focus",
    "planned_exam_subject",
    "planned_semester",
    "planned_hours",
    "planned_category",
    "missing",
    "warnings",
];

export const DEFAULT_DONE_SECTION_ORDER: string[] = [
    "steop",
    "focus",
    "exam_subject",
    "done_semester",
    "done_grade",
    "category",
];

/** What the planner knows about the rule check before one has run. */
export interface RuleCheckState {
    sending: boolean;
    error: string;
    /** The rule checker's reply, whose shape is the backend's to decide. */
    response: unknown;
    lastUpdatedAt: number | null;
}

export const EMPTY_RULE_CHECK_STATE: RuleCheckState = {
    sending: false,
    error: "",
    response: null,
    lastUpdatedAt: null,
};

/**
 * Reconciles a stored dashboard section order with the sections that currently
 * exist. Unknown keys are dropped and new ones are appended, so a student who
 * reordered their dashboard before a section was added keeps their order and
 * still sees the addition.
 */
export function sanitizeSectionOrder(rawOrder: unknown, defaults: readonly string[]): string[] {
    const base: readonly string[] = Array.isArray(defaults) ? defaults : [];
    const incoming: string[] = Array.isArray(rawOrder) ? rawOrder : [];
    const set = new Set(base);
    const filtered = incoming.filter((key, idx) => set.has(key) && incoming.indexOf(key) === idx);
    return [...filtered, ...base.filter((key) => !filtered.includes(key))];
}

export const STEOP_RULES_TEXT = `Die Studieneingangs- und Orientierungsphase des Bachelorstudiums Informatik umfasst die Lehrveranstaltungen
5,5 VU Einfuehrung in die Programmierung 1
2,0 VU Mathematisches Arbeiten fuer Informatik und Wirtschaftsinformatik
1,0 VU Orientierung Informatik und Wirtschaftsinformatik
sowie mindestens 8 ECTS aus dem Pool folgender Lehrveranstaltungen:
4,0 VO Algebra und Diskrete Mathematik fuer Informatik und Wirtschaftsinformatik
5,0 UE Algebra und Diskrete Mathematik fuer Informatik und Wirtschaftsinformatik
9,0 VU Algebra und Diskrete Mathematik fuer Informatik und Wirtschaftsinformatik
2,0 VO Analysis fuer Informatik und Wirtschaftsinformatik
4,0 UE Analysis fuer Informatik und Wirtschaftsinformatik
6,0 VU Analysis fuer Informatik und Wirtschaftsinformatik
5,5 VU Denkweisen der Informatik
6,0 VU Grundzuege digitaler Systeme
Vor positiver Absolvierung der StEOP duerfen weitere Lehrveranstaltungen im Umfang von 22 ECTS absolviert werden, die aus den oben genannten Lehrveranstaltungen und den folgenden gewaehlt werden koennen:
8,0 VU Algorithmen und Datenstrukturen
6,0 VU Datenbanksysteme
6,0 VU Daten- und Informatikrecht
4,0 VU Einfuehrung in die Programmierung 2
6,0 VU Einfuehrung in Visual Computing
Weiters koennen Lehrveranstaltungen im Rahmen des Moduls Freie Wahlfaecher und Transferable Skills gewaehlt werden, sofern deren Absolvierung nicht anderweitig beschraenkt ist.`;

export const FOCUS_INFO_TEXT = `Die Vertiefung (Focus Area) wird nur ausgewertet, wenn sie ausgewaehlt ist.
Der Rulechecker meldet dann:
- ob die Vertiefung erkannt wurde,
- wie viele Vertiefungsanforderungen noch fehlen.
Die Detailhinweise findest du in "Missing Requirements".`;
