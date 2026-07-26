// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * The saved games sidebar is only shown to Admin and Partner users, so the
 * member-based smoke suite never reaches it.
 */
const username = process.env.E2E_PARTNER_USERNAME || "e2e_web_partner";
const password = process.env.E2E_PARTNER_PASSWORD || "E2eTestPass!123";

async function login(page) {
    await page.goto("/login");
    await page.locator("#username").fill(username);
    await page.locator("#password").fill(password);
    await page.locator('form[action="/login"] button').click();
    await expect(page).toHaveURL(/\/home/i);
}

async function startGameAsWhite(page) {
    await page.locator("#startAIGame").click();
    await expect(page).toHaveURL(/\/play(?:\/|\?|$)/);
    const dialog = page.locator(".desktop-play-dialog--new-game");
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await dialog
        .locator("label.desktop-option-pill")
        .filter({ has: page.locator('input[name="color"][value="white"]') })
        .click();
    await dialog.locator("button.desktop-btn-gold", { hasText: "Start" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(page.locator("#innerBoard")).toBeVisible({ timeout: 30_000 });
}

async function playE4AndWaitForReply(page) {
    const e2 = page.locator('#innerBoard .square[data-row="6"][data-col="4"] img.draggable');
    const e4 = page.locator('#innerBoard .square[data-row="4"][data-col="4"]');
    await expect(e2).toBeVisible({ timeout: 30_000 });
    await e2.dragTo(e4);
    /* Saving is refused while the engine is searching, so wait for black's reply. */
    await expect(page.locator("#movesDiv .tdMove").nth(1)).not.toHaveText("", { timeout: 60_000 });
}

/**
 * Expand the games sidebar when it is collapsed. Desktop prefs may already have
 * it open, in which case the expand tab is hidden and `#gamesDiv` is visible.
 */
async function openGamesSidebar(page) {
    const gamesDiv = page.locator("#gamesDiv");
    const expandTab = page.locator("#desktopPlaySidebarGames .desktop-play-sidebar-tab--expand");
    const sidebar = page.locator("#desktopPlaySidebarGames");

    if (await gamesDiv.isVisible()) {
        return;
    }
    if (await expandTab.isVisible()) {
        await expandTab.click();
    } else {
        /* Prefs may have left the panel open but still marked collapsed briefly. */
        await sidebar.evaluate((el) => el.classList.remove("desktop-play-sidebar--collapsed"));
    }
    await expect(gamesDiv).toBeVisible({ timeout: 15_000 });
}

test.describe("play saved games sidebar", () => {
    test("saves a game, lists it, loads it, and deletes it", async ({ page }) => {
        test.setTimeout(120_000);

        await login(page);
        await startGameAsWhite(page);
        await openGamesSidebar(page);

        const items = page.locator("#gamesDiv .desktop-play-saved-game");
        const before = await items.count();

        await playE4AndWaitForReply(page);
        await page.locator("#saveBtn").click();

        await expect(items).toHaveCount(before + 1, { timeout: 15_000 });
        const saved = items.first();
        await expect(saved.locator(".desktop-play-saved-game-name")).toContainText("Saved —");

        await saved.locator(".desktop-play-saved-game-expand").click();
        await expect(saved).toHaveClass(/expanded/);
        await expect(saved.locator(".desktop-play-saved-game-turn")).toContainText("Next move:");
        await expect(saved.locator(".desktop-play-saved-game-players")).toContainText("vs.");

        await saved.locator(".desktop-play-saved-game-name").click();
        await expect(page.locator("#desktopPlayMatchTitle")).toHaveText(/Review Mode/i, {
            timeout: 15_000,
        });
        await expect(page.locator("#desktopPlayReviewNav")).toBeVisible();

        await saved.locator('button[title="Delete saved game"]').click();
        await expect(items).toHaveCount(before, { timeout: 15_000 });
    });
});
