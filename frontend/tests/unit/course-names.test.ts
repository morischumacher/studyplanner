/**
 * The short label a module group is headed with.
 *
 * Three sources are tried in turn, and the order is the point: an acronym of the
 * module's name, the shared prefix of its course codes, and then the module
 * itself. What the last step must not do is answer with a code while a name is
 * sitting unread in its arguments, because a header that reads as a code where
 * every other header reads as a name is worse than a long name.
 */
import { describe, expect, it } from "vitest";

import { displayModuleHeader } from "../../src/domain/course-names.ts";

describe("displayModuleHeader", () => {
    it("prefers an acronym of the module name", () => {
        expect(displayModuleHeader("MOD-1", "Algorithmen und Datenstrukturen", ["AD-VU"]))
            .toBe("AD");
    });

    it("falls back to what the module's course codes share", () => {
        expect(displayModuleHeader("MOD-1", "", ["SEC-VU", "SEC-UE"])).toBe("SEC");
    });

    it("falls back to the module name when there is nothing else to go on", () => {
        // Every word is a stop word, so the name yields no acronym, and there
        // are no course codes to share a prefix.
        expect(displayModuleHeader("MOD-1", "der die das", [])).toBe("der die das");
    });

    it("falls back to the module code only when there is no name", () => {
        expect(displayModuleHeader("MOD-1", "", [])).toBe("MOD-1");
        expect(displayModuleHeader("MOD-1", null, [])).toBe("MOD-1");
    });

    it("answers with nothing when it is given nothing", () => {
        expect(displayModuleHeader("", "", [])).toBe("");
    });
});
