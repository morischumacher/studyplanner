import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end coverage of the planning flows the evaluation study identified.
 *
 * These are the tests that make the frontend refactor safe. Unit tests cover the
 * pure modules, but the risk in breaking up a 6,600-line component is that the
 * pieces stop talking to each other, and only a real browser against a real
 * backend catches that.
 *
 * Both servers are started here so `npx playwright test` works from a clean
 * checkout. The backend needs a database; `scripts/dev-db.sh up` provides one.
 */
// The backend reads DATABASE_URL at import time and refuses to start without
// it. Playwright launches webServer processes before globalSetup runs, so the
// database has to be provisioned here, while the config module is loading.
const devDb = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)), "../scripts/dev-db.sh"
);
if (!process.env.DATABASE_URL) {
    execFileSync(devDb, ["up"], { stdio: "inherit" });
    process.env.DATABASE_URL = execFileSync(devDb, ["url"], { encoding: "utf8" }).trim();
}

const API_PORT = process.env.E2E_API_PORT ?? "8100";
const WEB_PORT = process.env.E2E_WEB_PORT ?? "5273";

// Normally Playwright uses the browser it downloaded itself (`npx playwright
// install`). Set E2E_CHROMIUM_PATH to run against an existing Chromium instead,
// which is what sandboxed CI images with a preinstalled browser need.
const chromium = process.env.E2E_CHROMIUM_PATH
    ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH } }
    : {};

export default defineConfig({
    testDir: "./tests/e2e",
    // A failing flow is usually a genuine break rather than flake, but the first
    // run pays for a cold backend start, so one retry keeps CI honest.
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
    use: {
        baseURL: `http://127.0.0.1:${WEB_PORT}`,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], ...chromium } }],
    webServer: [
        {
            command: `python3 -m uvicorn app.main:app --host 127.0.0.1 --port ${API_PORT}`,
            cwd: "../backend",
            port: Number(API_PORT),
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            // The API allows a fixed list of development origins by default, and
            // the port used here is not among them.
            env: {
                DATABASE_URL: process.env.DATABASE_URL,
                CORS_ORIGIN: `http://127.0.0.1:${WEB_PORT}`,
            },
        },
        {
            command: `npx vite --port ${WEB_PORT} --strictPort`,
            port: Number(WEB_PORT),
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            env: { VITE_API_BASE: `http://127.0.0.1:${API_PORT}` },
        },
    ],
});
