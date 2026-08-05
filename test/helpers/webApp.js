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
 * Clear in-memory rate-limit buckets (shared across mocha files).
 * @param {import("express").Application} app
 */
function resetWebRateLimits(app) {
    const limiters = app && typeof app.get === "function" ? app.get("rateLimiters") : null;
    if (!limiters) {
        return;
    }
    Object.keys(limiters).forEach(function (name) {
        const limiter = limiters[name];
        if (limiter && typeof limiter.reset === "function") {
            limiter.reset();
        }
    });
}

module.exports = {
    loadWebApp,
    resetWebRateLimits,
};
