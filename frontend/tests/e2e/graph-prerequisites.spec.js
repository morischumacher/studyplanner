/**
 * The two ways the graph draws prerequisite relations.
 *
 * The enforced and advisory relations belong to the whole graph and are switched
 * on together from the filter panel. The curriculum's expected prior knowledge is
 * stated per module, so it is revealed from the node that has it. This is the
 * first end-to-end coverage of the graph view; the flows above it exercise the
 * table, and a graph regression would otherwise reach a study participant before
 * it reached CI.
 */
import { test, expect } from "@playwright/test";
import { startPlanning, BACHELOR } from "./support/planner.js";

const prerequisiteEdges = (page) => page.locator('.react-flow__edge[data-testid^="rf__edge-prereq-"]');

async function openGraph(page) {
    await page.getByRole("button", { name: /Graph View/i }).click();
    await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 20000 });
}

/** Open every subject, so course and module nodes are on the canvas to draw between. */
async function expandEverything(page) {
    await page.getByRole("button", { name: /▾ Expand/ }).click();
    await expect
        .poll(async () => page.locator(".react-flow__node").count(), { timeout: 15000 })
        .toBeGreaterThan(50);
}

test.describe("prerequisite relations in the graph", () => {
    test("the filter panel draws the curriculum's two advisory pairs, and nothing until asked", async ({ page }) => {
        await startPlanning(page, { program: BACHELOR });
        await openGraph(page);
        await expandEverything(page);

        await expect(prerequisiteEdges(page)).toHaveCount(0);

        await page.getByText(/Show prerequisites/).click();
        await expect(prerequisiteEdges(page)).toHaveCount(2);
    });

    test("a node reveals its own expected knowledge, and only its own", async ({ page }) => {
        await startPlanning(page, { program: BACHELOR });
        await openGraph(page);
        await expandEverything(page);

        // Exactly the nodes the curriculum names carry the control: the module
        // that states expected knowledge, and the three modules that teach it.
        const toggles = page.locator('[data-testid="recommended-prereq-toggle"]');
        await expect(toggles).toHaveCount(4);

        await toggles.first().click();
        const revealed = await prerequisiteEdges(page).count();
        expect(revealed).toBeGreaterThan(0);

        // A second node adds its own relations rather than replacing the first's.
        await toggles.nth(1).click();
        await expect
            .poll(async () => prerequisiteEdges(page).count())
            .toBeGreaterThanOrEqual(revealed);

        await page.getByRole("button", { name: /Hide all/ }).click();
        await expect(prerequisiteEdges(page)).toHaveCount(0);
    });
});
