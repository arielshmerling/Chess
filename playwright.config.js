// @ts-check
const { defineConfig, devices } = require("@playwright/test");
const { getWebE2EDatabaseUrl } = require("./test/helpers/webE2EUser");
require("dotenv").config();

const E2E_PORT = process.env.E2E_PORT || "5100";
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${E2E_PORT}`;

/** @type {Record<string, string>} */
const webServerEnv = {};
for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "SHMERLING_MODE") {
        webServerEnv[key] = value;
    }
}
webServerEnv.PORT = E2E_PORT;
webServerEnv.DATABASE_URL = getWebE2EDatabaseUrl();
/* Theme API must not rewrite the repo catalog during Playwright runs. */
webServerEnv.SHMERLING_SYNC_CUSTOM_THEMES = "";
process.env.SHMERLING_SYNC_CUSTOM_THEMES = "";

/**
 * Web UI smoke tests. Starts a dedicated server on E2E_PORT (default 5100)
 * so it does not collide with a local `npm start` on PORT from .env.
 */
module.exports = defineConfig({
    testDir: "./e2e",
    testMatch: "**/*.spec.js",
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [["list"]],
    globalSetup: require.resolve("./e2e/global-setup.js"),
    globalTeardown: require.resolve("./e2e/global-teardown.js"),
    timeout: 60_000,
    expect: {
        timeout: 15_000,
    },
    use: {
        baseURL,
        trace: "on-first-retry",
        screenshot: "only-on-failure",
        // Prefer desktop welcome (/home), not mobile-home UA redirects.
        userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ShmerlingE2E",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: {
        command: "node server.js",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: webServerEnv,
    },
});
