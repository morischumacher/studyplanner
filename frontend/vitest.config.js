import { defineConfig } from "vitest/config";

// The application runs on Node 20. These tests do not: the ones that render a
// hook need jsdom, and jsdom 30 throws out of its own import below Node 22,
// with a message about undici that names neither jsdom nor Node. Saying so here
// costs one line and saves the half hour it otherwise takes to work out.
const [major] = process.versions.node.split(".").map(Number);
if (major < 22) {
    throw new Error(
        `The unit tests need Node 22 or newer (jsdom requires it); this is Node ${process.versions.node}. ` +
        "The application itself runs on Node 20."
    );
}

export default defineConfig({
    test: {
        environment: "node",
        // Under Actions the log is not readable without downloading it, so
        // failures are also emitted as annotations, which are.
        reporters: process.env.GITHUB_ACTIONS ? ["default", "github-actions"] : ["default"],
        include: ["src/**/*.test.{js,jsx,ts,tsx}", "tests/**/*.test.{js,jsx,ts,tsx}"],
        // Playwright drives a real browser and is run separately; keeping it out
        // of the unit run means `npm test` stays fast enough to sit in a loop.
        exclude: ["tests/e2e/**", "node_modules/**"],
    },
});
