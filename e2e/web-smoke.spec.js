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

async function startPlayNowGame(page, { color = "white", difficulty = "1", engine = null, isPrivate = false } = {}) {
    await page.locator("#startAIGame").click();
    await expect(page.locator("#playNowModal")).toBeVisible();
    await page
        .locator("#playNowModal label.play-now-radio")
        .filter({ has: page.locator(`input[name="color"][value="${color}"]`) })
        .click();
    if (engine) {
        await page.locator("#playNowEngine").selectOption(engine);
    }
    await page.locator("#playNowDifficulty").fill(String(difficulty));
    if (isPrivate) {
        await page.locator("label.play-now-checkbox-label").filter({ has: page.locator("#playNowPrivate") }).click();
    }
    await page.locator(".play-now-btn-start").click();
    await expect(page).toHaveURL(/\/play(?:\/|\?|$)/);
    await expect(page.locator("#innerBoard")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#homeBtn")).toBeVisible({ timeout: 30_000 });
}

test.describe("web smoke", () => {
    test("login → Play Now → board → Home", async ({ page }) => {
        await login(page);
        await expect(page.locator("#startAIGame")).toBeVisible();

        await startPlayNowGame(page);

        await page.getByRole("link", { name: /Shmerling Chess home/i }).click();
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
        await page.goto("/logout");

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

    test("home nav reaches Friends", async ({ page }) => {
        await login(page);

        await page.getByRole("link", { name: "Friends", exact: true }).click();
        await expect(page).toHaveURL(/\/friends/);
        await expect(page.getByRole("heading", { name: "Friends", exact: true })).toBeVisible();
        await expect(page.locator("#friendsEmpty")).toBeVisible();
    });

    test("home links reach Active games and All Games list", async ({ page }) => {
        await login(page);

        await page.locator('a[href="/active-games-list"]').first().click();
        await expect(page).toHaveURL(/\/active-games-list/);
        await expect(page.getByRole("heading", { name: "Active games", exact: true })).toBeVisible();

        await page.goto("/home");
        await page.locator('a[href="/list"]').first().click();
        await expect(page).toHaveURL(/\/list/);
        await expect(page.locator("#PlayerGameList")).toBeVisible();
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
        await expect(page.locator("#desktopPlayWhiteName")).toContainText(/Brain/i);
        await expect(page.locator("#desktopPlayBlackName")).toContainText(username);
    });

    test("Play Now with Brain 4.2 and Private starts a game", async ({ page }) => {
        await login(page);
        await startPlayNowGame(page, {
            color: "white",
            difficulty: "1",
            engine: "brain42",
            isPrivate: true,
        });
        await expect(page.locator("#desktopPlayWhiteName")).toContainText(username);
        await expect(page.locator("#desktopPlayBlackName")).toContainText(/Brain/i);
        await expect(page.locator("#resignBtn")).toBeEnabled();
        await expect(page.locator("#flipBtn")).toBeEnabled();
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
        await expect(page.locator("#searchResults")).toContainText("e2e_web_other", {
            timeout: 10_000,
        });
    });

    test("home account menu shows username and preferences", async ({ page }) => {
        await login(page);
        await expect(page.locator(".web-user-menu-name")).toHaveText(username);
        await page.locator("#webUserMenuTrigger").click();
        await expect(page.locator("#webUserMenuPanel")).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Account" })).toBeDisabled();
        await expect(page.getByRole("menuitem", { name: "Administrate" })).toHaveCount(0);
        await page.getByRole("menuitem", { name: "Preferences" }).click();
        await expect(page.locator("#desktopPrefsPanel")).toBeVisible();
        await expect(page.locator("#startAIGame")).toBeVisible();
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

    test("drag d2-d4 after e2-e4 adds a second white move wait for engine", async ({ page }) => {
        test.setTimeout(90_000);
        await login(page);
        await startPlayNowGame(page, { color: "white", difficulty: "1" });

        const e2 = page.locator('#innerBoard .square[data-row="6"][data-col="4"] img.draggable');
        const e4 = page.locator('#innerBoard .square[data-row="4"][data-col="4"]');
        await expect(e2).toBeVisible({ timeout: 30_000 });
        await e2.dragTo(e4);
        await expect(page.locator("#movesDiv")).toContainText(/e4/i, { timeout: 15_000 });

        // Wait until it is white's turn again (engine replied).
        await expect
            .poll(async () => page.locator("#movesDiv").innerText(), { timeout: 45_000 })
            .toMatch(/\S[\s\S]*\S/);

        const d2 = page.locator('#innerBoard .square[data-row="6"][data-col="3"] img.draggable');
        const d4 = page.locator('#innerBoard .square[data-row="4"][data-col="3"]');
        await expect(d2).toBeVisible({ timeout: 30_000 });
        await d2.dragTo(d4);
        await expect(page.locator("#movesDiv")).toContainText(/d4/i, { timeout: 15_000 });
    });
});
