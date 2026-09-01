/**
 * Shared driving code for the end-to-end suite.
 *
 * Two things here are worth knowing before reading a test.
 *
 * Each test signs up its own user. The planner is entirely per-user state, and a
 * shared account would make the tests order-dependent for no benefit; sign-up is
 * two requests and costs less than the isolation is worth.
 *
 * Dropping a course is native HTML5 drag-and-drop, which Playwright's mouse API
 * does not produce. `dropCourse` dispatches the drag events directly with a
 * shared DataTransfer, which is what the application's own handlers listen for.
 */
import { expect } from "@playwright/test";

export const MASTER = "066 937";
export const BACHELOR = "033 521";

/**
 * Where the API answers. The config picks the port and hands it to the bundle
 * at build time, so a test that wants to talk to the API directly has to work
 * it out the same way rather than read it back out of the page.
 */
const API_BASE = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "8100"}`;

async function authHeaders(page) {
    const token = await page.evaluate(() => localStorage.getItem("study_planner_auth_token"));
    return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

/**
 * The planner document as the server holds it.
 *
 * Some of what the planner stores belongs to a programme the student is not
 * looking at, and there is no screen that shows it. The stored document is
 * where it can be seen, so it is what those tests assert on.
 */
export async function readPlannerDocument(page) {
    const response = await page.request.get(`${API_BASE}/planner-state`, {
        headers: await authHeaders(page),
    });
    expect(response.ok()).toBeTruthy();
    return (await response.json())?.state ?? {};
}

export async function writePlannerDocument(page, state) {
    const response = await page.request.put(`${API_BASE}/planner-state`, {
        headers: { ...(await authHeaders(page)), "Content-Type": "application/json" },
        data: { state },
    });
    expect(response.ok()).toBeTruthy();
}

/** Create a fresh account and land in the signup setup modal. */
export async function signUp(page) {
    const username = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto("/");
    await page.getByRole("button", { name: "Need an account? Sign Up" }).click();
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill("correct horse");
    await page.getByRole("button", { name: "Sign Up", exact: true }).click();
    await expect(page.getByText("Complete Signup Setup")).toBeVisible();
    return username;
}

/**
 * Complete the first-run setup. The start season fixes the parity of every lane,
 * so tests that care about term rules must set it rather than inherit a default.
 */
export async function completeSetup(page, { program = MASTER, season = "winter", year = 2026 } = {}) {
    const modal = page.getByText("Complete Signup Setup").locator("..");
    await modal.locator("select").first().selectOption(program);
    await modal.locator("select").last().selectOption(season);
    await modal.locator('input[type="number"]').fill(String(year));
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Complete Signup Setup")).toBeHidden();
    await expect(page.locator("#semester-lane-1")).toBeVisible();
}

/** Sign up and set up in one step; the common preamble of every flow. */
export async function startPlanning(page, options) {
    const username = await signUp(page);
    await completeSetup(page, options);
    return username;
}

/**
 * Open the exam-subject groups in the catalogue sidebar.
 *
 * The group headings are captured before any of them is clicked, because
 * expanding one adds buttons and would otherwise shift the indices underneath.
 */
export async function expandCatalog(page, groups = 3) {
    const headings = page.locator("#course-catalog-sidebar button").filter({ hasText: /\d+ Module/ });
    const subjects = (await headings.allInnerTexts())
        .map((text) => text.split("\n").find((line) => /[a-z]/.test(line))?.trim())
        .filter(Boolean)
        .slice(0, groups);
    for (const subject of subjects) {
        await page.locator("#course-catalog-sidebar button", { hasText: subject }).first().click();
    }
    await expect(page.locator("#course-catalog-sidebar [data-course-code]").first()).toBeVisible();
}

/** A catalogue entry that is offered in the given term only. */
export function catalogCourse(page, { term } = {}) {
    const suffix = term ? `:has([title="Available in ${term}"])` : "";
    return page.locator(`#course-catalog-sidebar [data-course-code]${suffix}`);
}

/** The planned or parked card for a course code, as rendered on the canvas. */
export function plannedCard(page, code) {
    return page.locator(`[data-testid="course-card"][data-course-code="${code}"]`);
}

/** The transient banner the planner uses for accepted and rejected changes. */
export function feedback(page) {
    return page.locator('[data-testid="planner-feedback"]');
}

/**
 * Drag a catalogue entry onto a lane.
 *
 * The application reads the payload from `dataTransfer` and falls back to a ref
 * captured on dragstart, so both halves of the gesture have to be dispatched:
 * dragstart on the source, then dragover and drop on the canvas at coordinates
 * that fall inside the target lane. The lane is what the drop handler projects
 * the pointer position onto, so the coordinates are the assertion, not a detail.
 */
export async function dropCourse(page, source, laneSelector) {
    const handle = await source.elementHandle();
    await page.evaluate(
        ({ handle, laneSelector }) => {
            const lane = document.querySelector(laneSelector);
            if (!lane) throw new Error(`no lane matching '${laneSelector}'`);
            const box = lane.getBoundingClientRect();
            const transfer = new DataTransfer();
            const at = {
                bubbles: true,
                cancelable: true,
                dataTransfer: transfer,
                clientX: box.left + box.width / 2,
                clientY: box.top + box.height * 0.35,
            };
            handle.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
            const canvas = document.querySelector(".rf-wrapper");
            canvas.dispatchEvent(new DragEvent("dragover", at));
            canvas.dispatchEvent(new DragEvent("drop", at));
            handle.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: transfer }));
        },
        { handle, laneSelector }
    );
}

/**
 * Assert the ECTS total a lane prints in its header.
 *
 * This is the plan's own arithmetic rather than a restatement of what the test
 * just did, so it is worth asserting separately from the card being on screen.
 * The read polls: the header is recomputed a tick after the drop settles, and a
 * single read is a race that fails perhaps one run in ten.
 */
export async function expectLaneEcts(page, laneSelector, expected) {
    await expect
        .poll(async () => {
            const text = await page.locator(laneSelector).innerText();
            const match = text.match(/·\s*([\d.]+)\s*ECTS/);
            return match ? Number(match[1]) : null;
        }, { message: `ECTS printed by ${laneSelector}` })
        .toBe(expected);
}

/**
 * Bring the lanes into view.
 *
 * The canvas opens scrolled so that the first row of cards sits above the
 * viewport, and a card that is not on screen cannot be dragged. Panning is
 * itself a drag on the canvas background.
 */
export async function panIntoView(page) {
    const pane = await page.locator(".react-flow__pane").boundingBox();
    await page.mouse.move(pane.x + pane.width - 40, pane.y + 60);
    await page.mouse.down();
    await page.mouse.move(pane.x + pane.width - 40, pane.y + 360, { steps: 12 });
    await page.mouse.up();
}

/**
 * Move a course already on the canvas into another lane.
 *
 * This is React Flow's own pointer drag rather than HTML5 drag-and-drop, and it
 * is the gesture that matters most: a course's horizontal position *is* its
 * semester, so this is where the plan is really edited.
 */
export async function dragCardToLane(page, code, laneSelector) {
    const node = page.locator(".react-flow__node").filter({
        has: page.locator(`[data-course-code="${code}"]`),
    });
    const card = await node.boundingBox();
    const lane = await page.locator(laneSelector).boundingBox();

    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
    await page.mouse.down();
    await page.mouse.move(lane.x + lane.width / 2, card.y + card.height / 2, { steps: 15 });
    await page.mouse.up();
}

/** A button on a course card, addressed by its accessible name. */
export function cardAction(page, code, name) {
    return page
        .locator(`[data-testid="course-card"][data-course-code="${code}"]`)
        .getByRole("button", { name });
}

export async function openDashboard(page) {
    await page.locator("#open-dashboard-btn").click();
    await expect(page.locator("#planner-dashboard-container")).toBeVisible();
}
