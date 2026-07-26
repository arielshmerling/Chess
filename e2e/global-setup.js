/**
 * Playwright global setup: ensure Mongo e2e users exist before browser tests.
 */
const mongoose = require("mongoose");
const { ensureWebE2EUsers, ensureWebE2EPartner } = require("../test/helpers/webE2EUser");

module.exports = async function globalSetup() {
    const { primary } = await ensureWebE2EUsers();
    const partner = await ensureWebE2EPartner();
    console.log(`[e2e] ready users "${primary.username}" (+ secondary, "${partner.username}")`);
    await mongoose.disconnect();
};
