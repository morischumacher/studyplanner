export const PROGRAM_OPTIONS = [
    { code: "066 937", label: "Master Software Engineering" },
    { code: "033 521", label: "Bachelor Informatics" },
];

export const MASTER_PROGRAM_CODE = "066 937";
export const BACHELOR_PROGRAM_CODE = "033 521";

export const BACHELOR_FOCUS_OPTIONS = [
    "Artificial Intelligence und Machine Learning",
    "Cybersecurity",
    "Digital Health",
    "Human-Centered Computing",
    "Software Engineering",
    "Theoretische Informatik und Logik",
    "Visual Computing",
];

export const DEFAULT_PLANNED_SECTION_ORDER = [
    "steop",
    "focus",
    "planned_exam_subject",
    "key_buckets",
    "planned_semester",
    "planned_category",
    "missing",
    "warnings",
];

export const DEFAULT_DONE_SECTION_ORDER = [
    "steop",
    "focus",
    "exam_subject",
    "done_semester",
    "category",
];

export const EMPTY_RULE_CHECK_STATE = {
    sending: false,
    error: "",
    response: null,
    lastUpdatedAt: null,
};

export function sanitizeSectionOrder(rawOrder, defaults) {
    const base = Array.isArray(defaults) ? defaults : [];
    const incoming = Array.isArray(rawOrder) ? rawOrder : [];
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
