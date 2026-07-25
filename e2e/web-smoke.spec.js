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

async function startPlayNowGame(page, { color = "white", difficulty = "1" } = {}) {
    await page.locator("#startAIGame").click();
    await expect(page.locator("#playNowModal")).toBeVisible();
    // Radios are visually hidden; click the wrapping label.
    await page
        .locator("#playNowModal label.play-now-radio")
        .filter({ has: page.locator(`input[name="color"][value="${color}"]`) })
        .click();
    await page.locator("#playNowDifficulty").fill(String(difficulty));
    await page.locator(".play-now-btn-start").click();
    await expect(page).toHaveURL(/\/game\?/);
    await expect(page.locator("#innerBoard")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#homeBtn")).toBeVisible({ timeout: 30_000 });
}

test.describe("web smoke", () => {
    test("login → Play Now → board → Home", async ({ page }) => {
        await login(page);
        await expect(page.locator("#startAIGame")).toBeVisible();

        await startPlayNowGame(page);

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

    test("login returnTo restores the requested page", async ({ page }) => {
        await page.goto("/friends");
        await expect(page).toHaveURL(/\/login/);

        await page.locator("#username").fill(username);
        await page.locator("#password").fill(password);
        await page.locator('form[action="/login"] button').click();

        await expect(page).toHaveURL(/\/friends/);
        await expect(page.locator("#friendSearchInput")).toBeVisible();
    });

    test("home nav reaches Friends and Search", async ({ page }) => {
        await login(page);

        await page.getByRole("link", { name: "Friends", exact: true }).click();
        await expect(page).toHaveURL(/\/friends/);
        await expect(page.getByRole("heading", { name: "Friends", exact: true })).toBeVisible();
        await expect(page.locator("#friendsEmpty")).toBeVisible();

        await page.getByRole("link", { name: "Search", exact: true }).click();
        await expect(page).toHaveURL(/\/search/);
        await expect(page.locator("#search")).toBeVisible();
        await expect(page.locator("#searchButton")).toBeVisible();
    });

    test("Play Now modal cancel keeps user on home", async ({ page }) => {
        await login(page);
        await page.locator("#startAIGame").click();
        await expect(page.locator("#playNowModal")).toBeVisible();

        await page.locator(".play-now-btn-cancel").click();
        await expect(page.locator("#playNowModal")).toBeHidden();
        await expect(page).toHaveURL(/\/home/i);
        await expect(page.locator("#startAIGame")).toBeVisible();
    });

    test("Play Now as Black loads the board", async ({ page }) => {
        await login(page);
        await startPlayNowGame(page, { color: "black", difficulty: "1" });

        await expect(page.locator("#chessboard")).toBeVisible();
        await expect(page.locator("#whitePlayerName")).toContainText(/Brain/i);
        await expect(page.locator("#blackPlayerName")).toContainText(username);
    });

    test("Flip reverses board file labels", async ({ page }) => {
        await login(page);
        await startPlayNowGame(page);

        await expect(page.locator("#colA")).toHaveText("A");
        await page.locator("#flipBtn").click();
        await expect(page.locator("#colA")).toHaveText("H");
        await page.locator("#flipBtn").click();
        await expect(page.locator("#colA")).toHaveText("A");
    });

    test("member cannot open admin page", async ({ page }) => {
        await login(page);
        await page.goto("/admin");
        await expect(page).toHaveURL(/\/login/);
        await expect(page.locator("#username")).toBeVisible();
    });

    test("friends search input accepts a query", async ({ page }) => {
        await login(page);
        await page.goto("/friends");
        await page.locator("#friendSearchInput").fill("e2e");
        // Isolated e2e DB only has this member (excluded from own results).
        await expect(page.locator("#searchPlaceholder")).toHaveText("No matching users", {
            timeout: 10_000,
        });
    });

    test("drag e2-e4 records a move on the board", async ({ page }) => {
        await login(page);
        await startPlayNowGame(page, { color: "white", difficulty: "1" });

        const from = page.locator('#innerBoard .square[data-row="6"][data-col="4"] img.draggable');
        const to = page.locator('#innerBoard .square[data-row="4"][data-col="4"]');
        await expect(from).toBeVisible({ timeout: 30_000 });
        await from.dragTo(to);

        await expect(page.locator("#movesDiv")).toContainText(/e4|E4|pawn/i, { timeout: 15_000 });
    });
});
