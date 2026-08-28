import { defineConfig } from "vitest/config";

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
