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

/** The expected-knowledge control on the node card carrying a given title. */
const toggleOn = (page, title) =>
    page.locator(".react-flow__node", { hasText: title }).first()
        .locator('[data-testid="recommended-prereq-toggle"]');

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

        // The curriculum states expected knowledge for a large minority of its
        // modules, which is why the graph reveals it per node rather than at once.
        const toggles = page.locator('[data-testid="recommended-prereq-toggle"]');
        await expect.poll(async () => toggles.count()).toBeGreaterThan(20);

        // Abstrakte Maschinen: "Diese Voraussetzungen werden in folgenden Modulen
        // vermittelt: Einführung in die Programmierung, Programmierparadigmen,
        // Übersetzerbau."
        const target = toggleOn(page, "Abstrakte Maschinen");
        await expect(target).toHaveText("⇠3");
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

        const target = toggleOn(page, "Abstrakte Maschinen");
        const source = toggleOn(page, "Übersetzerbau");

        await target.click();
        await expect(prerequisiteEdges(page)).toHaveCount(3);

        // Übersetzerbau is one of the three, and states three of its own, so the
        // picture changes rather than staying put.
        await source.click();
        await expect(prerequisiteEdges(page)).toHaveCount(4);
        await expect(target).toHaveAttribute("aria-pressed", "false");

        await source.click();
        await expect(prerequisiteEdges(page)).toHaveCount(0);
    });

    test("the filter panel names what is revealed and can hide it", async ({ page }) => {
        await startPlanning(page, { program: BACHELOR });
        await openGraph(page);
        await expandEverything(page);

        await toggleOn(page, "Abstrakte Maschinen").click();
        await expect(page.getByText("expects to be known already")).toBeVisible();
        await page.getByRole("button", { name: "Hide", exact: true }).click();
        await expect(prerequisiteEdges(page)).toHaveCount(0);
    });
});
