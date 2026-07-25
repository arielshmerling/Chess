// @ts-check
const { test, expect } = require("@playwright/test");

const username = process.env.E2E_USERNAME || "e2e_web_member";
const password = process.env.E2E_PASSWORD || "E2eTestPass!123";

async function login(page) {
    await page.goto("/login");
    await page.locator("#username").fill(username);
    await page.locator("#password").fill(password);
    await page.locator('form[action="/login"] button').click();
    await expect(page).toHaveURL(/\/home/i);
}

test.describe("web smoke", () => {
    test("login → Play Now → board → Home", async ({ page }) => {
        await login(page);
        await expect(page.locator("#startAIGame")).toBeVisible();

        await page.locator("#startAIGame").click();
        await expect(page.locator("#playNowModal")).toBeVisible();
        await page.locator(".play-now-btn-start").click();

        await expect(page).toHaveURL(/\/game\?/);
        await expect(page.locator("#chessboard")).toBeVisible();
        await expect(page.locator("#innerBoard")).toBeVisible({ timeout: 30_000 });
        await expect(page.locator("#homeBtn")).toBeVisible({ timeout: 30_000 });
        await expect(page.locator("#homeBtn")).toBeEnabled();

        // The logo is a plain navigation path and avoids coupling this smoke test
        // to the asynchronous resign/cancel behavior of the Exit button.
        await page.locator('a[aria-label="Home"]').click();
        await expect(page).toHaveURL(/\/home/i);
        await expect(page.locator("#startAIGame")).toBeVisible();
    });

    test("unauthenticated /home redirects to login", async ({ page }) => {
        await page.goto("/home");
        await expect(page).toHaveURL(/\/login/);
        await expect(page.locator("#username")).toBeVisible();
    });

    test("wrong password remains on login", async ({ page }) => {
        await page.goto("/login");
        await page.locator("#username").fill(username);
        await page.locator("#password").fill("wrong-password");
        await page.locator('form[action="/login"] button').click();

        await expect(page).toHaveURL(/\/login/);
        await expect(page.locator("#username")).toBeVisible();
    });

    test("logout clears the authenticated session", async ({ page }) => {
        await login(page);
        await page.getByRole("link", { name: "Log out" }).click();

        await expect(page).toHaveURL(/\/login/);
        await page.goto("/home");
        await expect(page).toHaveURL(/\/login/);
    });
});
