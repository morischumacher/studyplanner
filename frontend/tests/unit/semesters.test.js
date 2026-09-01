/**
 * Term parity and lane rules.
 *
 * This module decides which semester a course may be placed in, which is the
 * mechanism behind the single most frequent friction the evaluation recorded:
 * students guess a term, the drop is rejected, and they place again. The rules
 * themselves are correct, so the refactor must not disturb them while the
 * surrounding code moves.
 */
import { describe, expect, it } from "vitest";

import {
    BACHELOR_PROGRAM_CODE,
    TERM_BOTH,
    TERM_SUMMER,
    TERM_WINTER,
    buildSemesterList,
    clampLaneIndex,
    firstAllowedLaneAtOrAfter,
    isLaneAllowedForTerm,
    laneSeason,
    normalizeStartSeason,
    normalizeTermAvailability,
    semesterBoundsForProgram,
} from "../../src/domain/terms.ts";

describe("semesterBoundsForProgram", () => {
    it("gives the bachelor programme a longer range than the master", () => {
        expect(semesterBoundsForProgram(BACHELOR_PROGRAM_CODE)).toEqual({ min: 6, max: 10 });
        expect(semesterBoundsForProgram("066 937")).toEqual({ min: 4, max: 8 });
    });

    it("treats an unknown or absent code as the master programme", () => {
        for (const code of [undefined, null, "", "   ", "999 999"]) {
            expect(semesterBoundsForProgram(code)).toEqual({ min: 4, max: 8 });
        }
    });

    it("tolerates surrounding whitespace but not missing inner spacing", () => {
        expect(semesterBoundsForProgram("  033 521  ")).toEqual({ min: 6, max: 10 });
        // The spaced form is the one the curriculum regulations print, and the
        // backend rule checkers compare against it too.
        expect(semesterBoundsForProgram("033521")).toEqual({ min: 4, max: 8 });
    });
});

describe("buildSemesterList", () => {
    it("numbers semesters from one", () => {
        expect(buildSemesterList(3)).toEqual([
            { id: 1, title: "Semester 1" },
            { id: 2, title: "Semester 2" },
            { id: 3, title: "Semester 3" },
        ]);
    });

    it("never produces an empty plan, whatever it is asked for", () => {
        for (const count of [0, -5, NaN, undefined, null, "nonsense"]) {
            expect(buildSemesterList(count)).toHaveLength(1);
        }
    });
});

describe("clampLaneIndex", () => {
    it("keeps an index inside the plan", () => {
        expect(clampLaneIndex(5, 7)).toBe(5);
        expect(clampLaneIndex(9, 7)).toBe(7);
        expect(clampLaneIndex(-3, 7)).toBe(0);
    });

    it("leaves the index unbounded above when no maximum is given", () => {
        expect(clampLaneIndex(99, undefined)).toBe(99);
        expect(clampLaneIndex(99, NaN)).toBe(99);
    });

    it("floors fractional indices rather than rounding", () => {
        expect(clampLaneIndex(2.9, 7)).toBe(2);
    });
});

describe("normalisation", () => {
    it("accepts the three known term values in any casing", () => {
        expect(normalizeTermAvailability("WINTER")).toBe(TERM_WINTER);
        expect(normalizeTermAvailability(" Summer ")).toBe(TERM_SUMMER);
        expect(normalizeTermAvailability("both")).toBe(TERM_BOTH);
    });

    it("falls back to 'both' for anything unrecognised", () => {
        // Permissive on purpose: an unknown term must not make a course
        // unplaceable, which would be worse than allowing it anywhere.
        for (const value of [undefined, null, "", "spring", 42]) {
            expect(normalizeTermAvailability(value)).toBe(TERM_BOTH);
        }
    });

    it("falls back to winter for an unrecognised start season", () => {
        expect(normalizeStartSeason("summer")).toBe(TERM_SUMMER);
        for (const value of [undefined, null, "", "both", "autumn"]) {
            expect(normalizeStartSeason(value)).toBe(TERM_WINTER);
        }
    });
});

describe("laneSeason", () => {
    it("alternates from the start season", () => {
        expect([0, 1, 2, 3, 4].map((i) => laneSeason(TERM_WINTER, i))).toEqual([
            TERM_WINTER, TERM_SUMMER, TERM_WINTER, TERM_SUMMER, TERM_WINTER,
        ]);
        expect([0, 1, 2, 3].map((i) => laneSeason(TERM_SUMMER, i))).toEqual([
            TERM_SUMMER, TERM_WINTER, TERM_SUMMER, TERM_WINTER,
        ]);
    });

    it("treats lane zero as the start season, not as a falsy index", () => {
        // Lane 0 is the first semester. An earlier version of the backend had a
        // bug here precisely because 0 is falsy in JavaScript and Python alike.
        expect(laneSeason(TERM_SUMMER, 0)).toBe(TERM_SUMMER);
    });
});

describe("isLaneAllowedForTerm", () => {
    it("allows a course offered in both terms into any lane", () => {
        for (let lane = 0; lane < 8; lane += 1) {
            expect(isLaneAllowedForTerm(TERM_BOTH, TERM_WINTER, lane)).toBe(true);
        }
    });

    it("allows a season-locked course only into lanes of that season", () => {
        expect(isLaneAllowedForTerm(TERM_WINTER, TERM_WINTER, 0)).toBe(true);
        expect(isLaneAllowedForTerm(TERM_WINTER, TERM_WINTER, 1)).toBe(false);
        expect(isLaneAllowedForTerm(TERM_SUMMER, TERM_WINTER, 1)).toBe(true);
    });

    it("shifts the whole parity when the plan starts in summer", () => {
        expect(isLaneAllowedForTerm(TERM_WINTER, TERM_SUMMER, 0)).toBe(false);
        expect(isLaneAllowedForTerm(TERM_WINTER, TERM_SUMMER, 1)).toBe(true);
    });
});

describe("firstAllowedLaneAtOrAfter", () => {
    it("returns the starting lane when it already fits", () => {
        expect(firstAllowedLaneAtOrAfter(TERM_WINTER, TERM_WINTER, 2, 7)).toBe(2);
    });

    it("advances by one when the parity is wrong", () => {
        expect(firstAllowedLaneAtOrAfter(TERM_SUMMER, TERM_WINTER, 2, 7)).toBe(3);
    });

    it("returns null when no lane inside the plan can hold the course", () => {
        // A summer course with only lane 0 available has nowhere to go, and the
        // caller has to say so rather than silently placing it wrongly.
        expect(firstAllowedLaneAtOrAfter(TERM_SUMMER, TERM_WINTER, 0, 0)).toBeNull();
    });

    it("searches a bounded distance when no maximum is supplied", () => {
        expect(firstAllowedLaneAtOrAfter(TERM_BOTH, TERM_WINTER, 0)).toBe(0);
        expect(firstAllowedLaneAtOrAfter(TERM_SUMMER, TERM_WINTER, 0)).toBe(1);
    });
});
