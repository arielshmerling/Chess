// @ts-check
const { expect } = require("@playwright/test");

const MEMBER_USERNAME = process.env.E2E_USERNAME || "e2e_web_member";
const MEMBER_PASSWORD = process.env.E2E_PASSWORD || "E2eTestPass!123";
const PARTNER_USERNAME = process.env.E2E_PARTNER_USERNAME || "e2e_web_partner";
const PARTNER_PASSWORD = process.env.E2E_PARTNER_PASSWORD || "E2eTestPass!123";

/**
 * Stepped login UI: username → Continue → password → Continue.
 * @param {import("@playwright/test").Page} page
 * @param {string} username
 * @param {string} password
 */
async function submitCredentials(page, username, password) {
    await page.locator("#username").fill(username);
    await page.locator("#loginNext").click();
    await expect(page.locator("#password")).toBeVisible();
    await page.locator("#password").fill(password);
    await page.locator("#loginNext").click();
}

/**
 * @param {import("@playwright/test").Page} page
 * @param {{ username?: string, password?: string }} [creds]
 */
async function loginAs(page, creds = {}) {
    const username = creds.username || MEMBER_USERNAME;
    const password = creds.password || MEMBER_PASSWORD;
    await page.goto("/login");
    await submitCredentials(page, username, password);
    await expect(page).toHaveURL(/\/home/i);
}

/** @param {import("@playwright/test").Page} page */
async function loginAsMember(page) {
    await loginAs(page, { username: MEMBER_USERNAME, password: MEMBER_PASSWORD });
}

/** @param {import("@playwright/test").Page} page */
async function loginAsPartner(page) {
    await loginAs(page, { username: PARTNER_USERNAME, password: PARTNER_PASSWORD });
}

module.exports = {
    MEMBER_USERNAME,
    MEMBER_PASSWORD,
    PARTNER_USERNAME,
    PARTNER_PASSWORD,
    submitCredentials,
    loginAs,
    loginAsMember,
    loginAsPartner,
};
