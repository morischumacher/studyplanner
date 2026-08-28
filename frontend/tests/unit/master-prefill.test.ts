// @vitest-environment jsdom
/**
 * The prebuilt master plan, and the applier that lays it out.
 *
 * The master curriculum sequences two courses and leaves the rest to the
 * student, so the template is short and every entry in it is one the student is
 * told about: a course the matcher cannot find is reported as missing, and a
 * course it does find is placed. Something in between, a plan filled with
 * courses nobody asked for, is the worst of the three, because a prebuilt plan
 * is accepted on trust.
 */
import { describe, expect, it } from "vitest";

import { centerX } from "../../src/domain/layout.ts";
import { buildMasterPrefillPlan } from "../../src/domain/prefill/index.ts";
import { MASTER_PROGRAM_CODE } from "../../src/domain/programmes.ts";
import type { Catalogue } from "../../src/domain/types.ts";
import { usePrefilledPlans } from "../../src/features/prefill/usePrefilledPlans.ts";
import type {
    PrefillNode,
    UsePrefilledPlansInput,
} from "../../src/features/prefill/usePrefilledPlans.ts";
import { renderHook } from "./support/render-hook.ts";

const SEQUENCED = ["Advanced Software Engineering", "Advanced Software Engineering Project"];

/** A catalogue of one module, holding whatever courses it is given. */
function catalogueOf(courses: { code: string; name: string }[]): Catalogue {
    return [{
        pruefungsfach: "Software Engineering",
        modules: [{
            code: "MOD-1",
            name: "Software Engineering",
            ects: 12,
            category: "core",
            is_mandatory: true,
            module_exam_subject: "Software Engineering",
            courses: courses.map((course) => ({
                ...course,
                ects: 6,
                type: "VU",
                termAvailability: "both",
            })),
        }],
    }];
}

describe("the prebuilt master plan", () => {
    it("plans the two courses the curriculum sequences", () => {
        const plan = buildMasterPrefillPlan(catalogueOf([
            { code: "ASE", name: "Advanced Software Engineering" },
            { code: "ASE-P", name: "Advanced Software Engineering Project" },
        ]));

        expect(plan.plannedCourses.map((course) => course.code)).toEqual(["ASE", "ASE-P"]);
        expect(plan.missingAliases).toEqual([]);
    });

    it("reports an alias the catalogue does not offer rather than taking any course", () => {
        const plan = buildMasterPrefillPlan(catalogueOf([
            { code: "NUM", name: "Numerical Mathematics" },
            { code: "STO", name: "Stochastic Processes" },
        ]));

        expect(plan.plannedCourses).toEqual([]);
        expect(plan.missingAliases).toEqual(SEQUENCED);
    });

    it("moves both into the second semester for a summer start", () => {
        const plan = buildMasterPrefillPlan(
            catalogueOf([
                { code: "ASE", name: "Advanced Software Engineering" },
                { code: "ASE-P", name: "Advanced Software Engineering Project" },
            ]),
            { startSeason: "summer" }
        );

        expect(plan.plannedCourses.map((course) => course.semester)).toEqual([2, 2]);
    });
});

describe("accepting the prebuilt master plan", () => {
    it("lays it out for the start season the profile holds now", () => {
        let placed: PrefillNode[] = [];
        const input: UsePrefilledPlansInput = {
            programCode: MASTER_PROGRAM_CODE,
            catalog: catalogueOf([
                { code: "ASE", name: "Advanced Software Engineering" },
                { code: "ASE-P", name: "Advanced Software Engineering Project" },
            ]),
            startTermSeason: "winter",
            doneCourseCodes: [],
            maxSemesterCount: 8,
            subjectColors: {},
            laneNodes: [],
            minGroupChildY: 144,
            firstAllowedLaneForCourse: (_code, preferredLane) => preferredLane,
            termAvailabilityForCode: () => "both",
            resolveLaneCollisions: (nodes) => nodes,
            compactPrefillLayout: (nodes) => nodes,
            recomputeGroupFromChildren: (nodes) => nodes,
            setNodes: () => {},
            setCoursesFromNodes: (nodes) => {
                placed = nodes;
            },
            setNeedsPersist: () => {},
            setDragPreviewSemesterCount: () => {},
            setStickyViolation: () => {},
            removeCourseNode: () => {},
            removeModuleGroup: () => {},
            toggleCourseDone: () => {},
            toggleModuleDoneCodes: () => {},
            updateCourseEcts: () => {},
        };

        const harness = renderHook(
            (props: UsePrefilledPlansInput) => usePrefilledPlans(props),
            input
        );
        // Only the season changes, so an applier that does not follow it is
        // still the one built for the season before.
        harness.rerender({ ...input, startTermSeason: "summer" });

        expect(harness.current.applyMasterPrefilledPlan()).toBe(true);
        expect(placed.map((node) => node.position.x)).toEqual([centerX(1), centerX(1)]);

        harness.unmount();
    });
});
