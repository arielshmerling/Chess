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

module.exports = {
    loadWebApp,
};
