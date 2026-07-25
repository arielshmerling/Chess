/**
 * Playwright global setup: ensure Mongo e2e user exists before browser tests.
 */
const mongoose = require("mongoose");
const { ensureWebE2EUser } = require("../test/helpers/webE2EUser");

module.exports = async function globalSetup() {
    const creds = await ensureWebE2EUser();
    console.log(`[e2e] ready user "${creds.username}"`);
    await mongoose.disconnect();
};
