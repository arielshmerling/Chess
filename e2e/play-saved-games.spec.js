// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsPartner } = require("./helpers/auth");
const {
    startGameAsWhite,
    playE4AndWaitForReply,
    resignToUnlockGamesPanel,
    openGamesSidebar,
    manualSavedGames,
} = require("./helpers/playPartner");

/**
 * The saved games sidebar is only shown to Admin and Partner users, so the
 * member-based smoke suite never reaches it.
 */
test.describe("play saved games sidebar", () => {
    test("saves a game, lists it, loads it, and deletes it", async ({ page }) => {
        test.setTimeout(120_000);

        await loginAsPartner(page);
        await startGameAsWhite(page);

        const manuals = manualSavedGames(page);
        const beforeManual = await manuals.count();

        await playE4AndWaitForReply(page);
        await page.locator("#saveBtn").click();
        await expect(manuals).toHaveCount(beforeManual + 1, { timeout: 15_000 });

        await resignToUnlockGamesPanel(page);
        await openGamesSidebar(page);

        const saved = manuals.first();
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
        await expect(manuals).toHaveCount(beforeManual, { timeout: 15_000 });
    });
});
