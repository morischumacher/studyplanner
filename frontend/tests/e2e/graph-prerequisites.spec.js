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

    test("a node reveals its own expected knowledge, and hides it again", async ({ page }) => {
        await startPlanning(page, { program: BACHELOR });
        await openGraph(page);
        await expandEverything(page);

        // Exactly the nodes the curriculum names carry the control: the module
        // that states expected knowledge, and the three modules that teach it.
        const toggles = page.locator('[data-testid="recommended-prereq-toggle"]');
        await expect(toggles).toHaveCount(4);

        const target = toggles.filter({ hasText: "⇠3" }).first();
        await target.click();
        await expect(prerequisiteEdges(page)).toHaveCount(3);
        await expect(target).toHaveAttribute("aria-pressed", "true");

        await target.click();
        await expect(prerequisiteEdges(page)).toHaveCount(0);
        await expect(target).toHaveAttribute("aria-pressed", "false");
    });

    test("every press changes the picture, including on a relation already drawn", async ({ page }) => {
        // The regression: with a set of revealed nodes, an edge was drawn if
        // either of its endpoints was revealed, so switching on the node at one
        // end of an already-drawn edge, and switching it off again, left the
        // canvas untouched and the control looked dead. One node at a time.
        await startPlanning(page, { program: BACHELOR });
        await openGraph(page);
        await expandEverything(page);

        const toggles = page.locator('[data-testid="recommended-prereq-toggle"]');
        const target = toggles.filter({ hasText: "⇠3" }).first();
        const source = toggles.filter({ hasText: "⇠1" }).first();

        await target.click();
        await expect(prerequisiteEdges(page)).toHaveCount(3);

        await source.click();
        await expect(prerequisiteEdges(page)).toHaveCount(1);
        await expect(target).toHaveAttribute("aria-pressed", "false");

        await source.click();
        await expect(prerequisiteEdges(page)).toHaveCount(0);
    });

    test("the filter panel names what is revealed and can hide it", async ({ page }) => {
        await startPlanning(page, { program: BACHELOR });
        await openGraph(page);
        await expandEverything(page);

        await page.locator('[data-testid="recommended-prereq-toggle"]').filter({ hasText: "⇠3" }).first().click();
        await expect(page.getByText("Abstrakte Maschinen", { exact: false }).first()).toBeVisible();
        await page.getByRole("button", { name: "Hide", exact: true }).click();
        await expect(prerequisiteEdges(page)).toHaveCount(0);
    });
});
