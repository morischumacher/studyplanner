/**
 * Reading the stored plan back at start-up, and writing it out again as the
 * student works.
 *
 * Saving is gated on `plannerLoadOk`, and that guard is the whole reason this
 * module is worth reading twice. A load that fails leaves the planner showing
 * an empty plan, which is indistinguishable from a student who has planned
 * nothing; were the save to run anyway, the first debounce after a failed load
 * would replace a real plan on the server with that empty one.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

import type {
    DashboardUiGlobalSnapshot,
    DashboardUiSnapshot,
    StoredDashboardUi,
} from "../../features/dashboard/index.ts";
import { fetchPlannerState, savePlannerState } from "../../lib/api.js";

/** How long the planner waits for the student to stop before it saves. */
const SAVE_DEBOUNCE_MS = 500;

/**
 * The document as it is stored. The planner state contributes most of it; the
 * two dashboard maps and the graph view are folded in here because they are
 * held outside the plan and would otherwise not survive a reload.
 */
export interface PersistSnapshot {
    graphViewByProgram?: Record<string, Record<string, unknown>>;
    dashboardUiByProgram?: Record<string, unknown>;
    dashboardUiGlobal?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface UsePlannerPersistenceInput {
    programCode: string;
    exportPlannerStateSnapshot: (() => PersistSnapshot | null | undefined) | undefined;
    importPlannerStateSnapshot: (state: unknown) => void;
    restoreDashboardUiFromPlannerState: (state: unknown) => void;
    dashboardUiForProgram: DashboardUiSnapshot;
    dashboardUiGlobal: DashboardUiGlobalSnapshot;
    /**
     * The panel state of every programme. The plan snapshot carries none of it,
     * so a save that did not read this would store the programme on screen and
     * nothing else.
     */
    storedDashboardUiRef: MutableRefObject<StoredDashboardUi>;
    /** The unsaved graph view of the programme on screen, or null. */
    latestGraphSnapshotRef: MutableRefObject<Record<string, unknown> | null>;
    /** Cleared by the load, so that the canvas is rebuilt from what arrived. */
    hydratedProgramRef: MutableRefObject<string | null>;
}

export interface UsePlannerPersistenceResult {
    /** True once the load has settled, whether it succeeded or not. */
    plannerHydrated: boolean;
    /** True only if the load succeeded. Saving depends on it. */
    plannerLoadOk: boolean;
    buildPersistSnapshot: () => PersistSnapshot;
    /** Cancels the pending save and writes at once. Sign-out waits on this. */
    flushPlannerStateSave: () => Promise<void>;
}

export function usePlannerPersistence({
    programCode,
    exportPlannerStateSnapshot,
    importPlannerStateSnapshot,
    restoreDashboardUiFromPlannerState,
    dashboardUiForProgram,
    dashboardUiGlobal,
    storedDashboardUiRef,
    latestGraphSnapshotRef,
    hydratedProgramRef,
}: UsePlannerPersistenceInput): UsePlannerPersistenceResult {
    const savePlannerTimerRef = useRef<number | null>(null);
    const [plannerHydrated, setPlannerHydrated] = useState(false);
    const [plannerLoadOk, setPlannerLoadOk] = useState(false);

    const buildPersistSnapshot = useCallback((): PersistSnapshot => {
        const snapshot = exportPlannerStateSnapshot?.() || {};
        const latestGraphSnapshot = latestGraphSnapshotRef.current;
        if (latestGraphSnapshot && typeof latestGraphSnapshot === "object") {
            snapshot.graphViewByProgram = {
                ...(snapshot.graphViewByProgram || {}),
                [programCode]: {
                    ...((snapshot.graphViewByProgram || {})[programCode] || {}),
                    ...latestGraphSnapshot,
                },
            };
        }
        const storedDashboardUi = storedDashboardUiRef.current;
        snapshot.dashboardUiByProgram = {
            ...storedDashboardUi.byProgram,
            [programCode]: dashboardUiForProgram,
        };
        snapshot.dashboardUiGlobal = {
            ...storedDashboardUi.global,
            ...dashboardUiGlobal,
        };
        return snapshot;
    }, [
        exportPlannerStateSnapshot,
        programCode,
        dashboardUiForProgram,
        dashboardUiGlobal,
    ]);

    useEffect(() => {
        let cancelled = false;
        setPlannerHydrated(false);
        setPlannerLoadOk(false);
        hydratedProgramRef.current = null;
        (async () => {
            try {
                const payload = await fetchPlannerState();
                if (cancelled) return;
                const state = payload?.state ?? {};
                importPlannerStateSnapshot(state);
                restoreDashboardUiFromPlannerState(state);
                setPlannerLoadOk(true);
            } catch (e) {
                if (cancelled) return;
                console.error("Failed to load planner state", e);
                setPlannerLoadOk(false);
            } finally {
                if (!cancelled) setPlannerHydrated(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [importPlannerStateSnapshot]);

    useEffect(() => {
        if (!plannerHydrated || !plannerLoadOk) return;
        if (savePlannerTimerRef.current) {
            window.clearTimeout(savePlannerTimerRef.current);
        }
        savePlannerTimerRef.current = window.setTimeout(async () => {
            try {
                await savePlannerState(buildPersistSnapshot());
            } catch (e) {
                console.error("Failed to save planner state", e);
            }
        }, SAVE_DEBOUNCE_MS);
        return () => {
            if (savePlannerTimerRef.current) {
                window.clearTimeout(savePlannerTimerRef.current);
                savePlannerTimerRef.current = null;
            }
        };
    }, [plannerHydrated, plannerLoadOk, buildPersistSnapshot]);

    const flushPlannerStateSave = useCallback(async () => {
        if (savePlannerTimerRef.current) {
            window.clearTimeout(savePlannerTimerRef.current);
            savePlannerTimerRef.current = null;
        }
        try {
            await savePlannerState(buildPersistSnapshot());
        } catch (e) {
            console.error("Failed to save planner state before sign out", e);
        }
    }, [buildPersistSnapshot]);

    return {
        plannerHydrated,
        plannerLoadOk,
        buildPersistSnapshot,
        flushPlannerStateSave,
    };
}
