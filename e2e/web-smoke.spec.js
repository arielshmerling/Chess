// @ts-check
const { test, expect } = require("@playwright/test");
const {
    loginAsMember,
    MEMBER_USERNAME,
    MEMBER_PASSWORD,
    submitCredentials,
} = require("./helpers/auth");

const username = MEMBER_USERNAME;
const password = MEMBER_PASSWORD;

async function login(page) {
    await loginAsMember(page);
}

async function startPlayNowGame(page, { color = "white", engine = null } = {}) {
    await page.locator("#startAIGame").click();
    await expect(page).toHaveURL(/\/play(?:\/|\?|$)/);
    const dialog = page.locator(".desktop-play-dialog--new-game");
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await dialog
        .locator("label.desktop-option-pill")
        .filter({ has: page.locator(`input[name="color"][value="${color}"]`) })
        .click();
    if (engine) {
        await dialog.locator("#dlgEngine").selectOption(engine);
    }
    await dialog.locator("button.desktop-btn-gold", { hasText: "Start" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
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

    test("wrong password shows Sorry then returns to Who are you", async ({ page }) => {
        await page.goto("/login");
        await submitCredentials(page, username, "wrong-password");

        await expect(page.locator("#loginPrompt")).toHaveText(/Sorry/i, { timeout: 10_000 });
        await expect(page).toHaveURL(/\/login/);

        await expect(page.locator("#loginPrompt")).toHaveText(/Who are you/i, { timeout: 10_000 });
        await expect(page.locator("#username")).toBeVisible();
        await expect(page.locator("#username")).toHaveValue("");
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

        await submitCredentials(page, username, password);

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

    test("Play Now opens compact new-game dialog on play page", async ({ page }) => {
        await login(page);
        await page.locator("#startAIGame").click();
        await expect(page).toHaveURL(/\/play(?:\/|\?|$)/);
        const dialog = page.locator(".desktop-play-dialog--new-game");
        await expect(dialog).toBeVisible({ timeout: 30_000 });

        await dialog.locator("button.desktop-btn", { hasText: "Cancel" }).click();
        await expect(dialog).toBeHidden();
        await expect(page).toHaveURL(/\/play(?:\/|\?|$)/);
        await expect(page.locator("#homeBtn")).toBeVisible();
    });

    test("Play Now as Black loads the board", async ({ page }) => {
        await login(page);
        await startPlayNowGame(page, { color: "black" });

        await expect(page.locator("#chessboard")).toBeVisible();
        await expect(page.locator("#desktopPlayWhiteName")).toContainText(/Brain/i);
        await expect(page.locator("#desktopPlayBlackName")).toContainText(username);
    });

    test("Play Now with Brain 4.2 starts a game", async ({ page }) => {
        await login(page);
        await startPlayNowGame(page, {
            color: "white",
            engine: "brain42",
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

    test("home account menu opens Account page and preferences", async ({ page }) => {
        await login(page);
        await expect(page.locator(".web-user-menu-name")).toHaveText(username);
        await page.locator("#webUserMenuTrigger").click();
        await expect(page.locator("#webUserMenuPanel")).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Account" })).toBeEnabled();
        await page.getByRole("menuitem", { name: "Account" }).click();
        await expect(page).toHaveURL(/\/account/);
        await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
        await expect(page.locator("#accountUsername")).toHaveText(username);
        await page.goto("/home");
        await page.locator("#webUserMenuTrigger").click();
        await expect(page.getByRole("menuitem", { name: "Administrate" })).toHaveCount(0);
        await page.getByRole("menuitem", { name: "Preferences" }).click();
        await expect(page.locator("#desktopPrefsPanel")).toBeVisible();
        await expect(page.locator("#desktopCustomizeThemeBtn")).toBeHidden();
        await expect(page.locator("#startAIGame")).toBeVisible();
    });

    test("drag e2-e4 records a move on the board", async ({ page }) => {
        await login(page);
        await startPlayNowGame(page, { color: "white" });

        const from = page.locator('#innerBoard .square[data-row="6"][data-col="4"] img.draggable');
        const to = page.locator('#innerBoard .square[data-row="4"][data-col="4"]');
        await expect(from).toBeVisible({ timeout: 30_000 });
        await from.dragTo(to);

        await expect(page.locator("#movesDiv")).toContainText(/e4|E4|pawn/i, { timeout: 15_000 });
    });

    test("the clock of the side to move counts down", async ({ page }) => {
        await login(page);
        await startPlayNowGame(page, { color: "white" });

        const whiteClock = page.locator("#whiteClockTimeText");
        const blackClock = page.locator("#blackClockTimeText");
        /* Clocks may briefly show 00:00:00 before the game timer is applied. */
        await expect(whiteClock).toHaveText(/^01:\d{2}:\d{2}$/, { timeout: 15_000 });
        await expect(blackClock).toHaveText(/^01:\d{2}:\d{2}$/, { timeout: 15_000 });
        const startWhite = await whiteClock.textContent();
        const startBlack = await blackClock.textContent();

        await expect.poll(async () => whiteClock.textContent(), { timeout: 15_000 }).not.toBe(startWhite);
        await expect(blackClock).toHaveText(String(startBlack));
    });

    test("refreshing the play page resumes the game in progress", async ({ page }) => {
        await login(page);
        await startPlayNowGame(page, { color: "white" });

        const e2 = page.locator('#innerBoard .square[data-row="6"][data-col="4"] img.draggable');
        const e4 = page.locator('#innerBoard .square[data-row="4"][data-col="4"]');
        await expect(e2).toBeVisible({ timeout: 30_000 });
        await e2.dragTo(e4);
        await expect(page.locator("#movesDiv")).toContainText(/e4/i, { timeout: 15_000 });

        await page.reload();

        await expect(page.locator("#innerBoard")).toBeVisible({ timeout: 30_000 });
        await expect(page.locator("#movesDiv")).toContainText(/e4/i, { timeout: 30_000 });
        await expect(e4.locator("img")).toBeVisible();
        await expect(e2).toHaveCount(0);
    });

    test("drag d2-d4 after e2-e4 adds a second white move wait for engine", async ({ page }) => {
        test.setTimeout(90_000);
        await login(page);
        await startPlayNowGame(page, { color: "white" });

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

    test("play page loads Phase 3 OnlineMode session scripts", async ({ page }) => {
        await login(page);
        await page.goto("/play");
        await expect(page.locator("#homeBtn")).toBeVisible({ timeout: 30_000 });
        const onlineApis = await page.evaluate(() => ({
            onlineMode: typeof window.ShmerlingOnlineMode,
            wsTransport: typeof window.ShmerlingWsTransport,
            protocol: typeof window.ShmerlingOnlineProtocol,
            getGameId:
                window.PlayLaunchOptions &&
                typeof window.PlayLaunchOptions.getGameIdFromSearch,
        }));
        expect(onlineApis.onlineMode).toBe("object");
        expect(onlineApis.wsTransport).toBe("object");
        expect(onlineApis.protocol).toBe("object");
        expect(onlineApis.getGameId).toBe("function");
    });
});
