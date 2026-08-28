/**
 * Reading a plan back off the canvas.
 *
 * The canvas is the record of what the student decided, so a course's semester
 * is derived from where its card ended up rather than from any field on the
 * card: the lane a card sits in is what the student sees, and the two must not
 * be able to disagree.
 *
 * Vertical order is kept as well, since a lane's order is meaningful to the
 * student even where it means nothing to the curriculum.
 */

import { laneIndexFromX } from "../layout.ts";
import { semesterBoundsForProgram } from "../terms.ts";
import type { CourseModuleMeta, PlanNode } from "../types.ts";
import { emptyCoursesOnlyPlan } from "./semesters.ts";
import type { CoursesBySemester } from "./state.ts";

export interface PlanFromNodes {
    bySem: CoursesBySemester;
    parkedCodes: string[];
}

export function buildCoursesOnlyFromNodes(
    nodes: readonly PlanNode[] | null | undefined,
    programCode: string | null | undefined
): PlanFromNodes {
    const bounds = semesterBoundsForProgram(programCode);
    if (!Array.isArray(nodes)) {
        return { bySem: emptyCoursesOnlyPlan(bounds.min), parkedCodes: [] };
    }

    const modules = new Map<string, CourseModuleMeta>();
    for (const n of nodes) {
        if (n?.type === "moduleBg") {
            modules.set(n.id, {
                id: n.id,
                title: n?.data?.title ?? n?.data?.label ?? "Module",
                examSubject: n?.data?.examSubject ?? null,
                category: n?.data?.category ?? "unknown",
                subjectColor: n?.data?.subjectColor ?? null,
                code: n?.data?.moduleCode ?? null,
                ects: n?.data?.moduleEcts ?? null,
            });
        }
    }

    const bySem = emptyCoursesOnlyPlan(bounds.min);
    const parkedCodes: string[] = [];
    const yById: Record<string, number> = Object.fromEntries(nodes.map((n) => [n.id, n?.position?.y ?? 0]));

    for (const n of nodes) {
        if (n?.type !== "course") continue;
        // A parked course has no lane, so it is recorded by code alone.
        if (String(n?.data?.status || "").trim() === "parked") {
            const parkedCode = String(n?.data?.code || "").trim();
            if (parkedCode) parkedCodes.push(parkedCode);
            continue;
        }
        const laneIdx = Math.max(0, Math.min(laneIndexFromX(n.position?.x ?? 0, bounds.max - 1), bounds.max - 1));
        const semesterId = laneIdx + 1;
        const modMeta = n?.data?.groupId
            ? (modules.get(n.data.groupId) || { id: n.data.groupId })
            : (n?.data?.moduleMeta && typeof n.data.moduleMeta === "object" ? n.data.moduleMeta : null);

        if (!bySem[semesterId]) bySem[semesterId] = [];

        bySem[semesterId]?.push({
            id: n.id,
            code: n?.data?.code ?? null,
            name: n?.data?.name ?? n?.data?.label ?? null,
            type: n?.data?.type ?? null,
            ects: n?.data?.ects ?? null,
            category: n?.data?.category ?? "unknown",
            examSubject: n?.data?.examSubject ?? null,
            position: { x: n?.position?.x ?? 0, y: n?.position?.y ?? 0 },
            laneIndex: laneIdx,
            subjectColor: n?.data?.subjectColor ?? null,
            module: modMeta ? { ...modMeta } : null,
        });
    }

    for (const list of Object.values(bySem)) {
        list.sort((a, b) => (yById[a.id] ?? 0) - (yById[b.id] ?? 0));
    }
    return {
        bySem,
        parkedCodes: [...new Set(parkedCodes)],
    };
}
