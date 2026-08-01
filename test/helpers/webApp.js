/**
 * Load the Express app for web HTTP tests (not desktop mode).
 */
require("dotenv").config();

function loadWebApp() {
    if (process.env.SHMERLING_MODE === "desktop") {
        throw new Error(
            "Web API tests cannot run with SHMERLING_MODE=desktop. " +
                "Run them via: npm run test:web:api"
        );
    }
    delete process.env.SHMERLING_MODE;
    return require("../../src/app");
}

/**
 * Clear in-memory login / validateUsername rate-limit buckets (shared across mocha files).
 * @param {import("express").Application} app
 */
function resetWebRateLimits(app) {
    const limiters = app && typeof app.get === "function" ? app.get("rateLimiters") : null;
    if (!limiters) {
        return;
    }
    if (limiters.login && typeof limiters.login.reset === "function") {
        limiters.login.reset();
    }
    if (limiters.validateUsername && typeof limiters.validateUsername.reset === "function") {
        limiters.validateUsername.reset();
    }
}

module.exports = {
    loadWebApp,
    resetWebRateLimits,
};
