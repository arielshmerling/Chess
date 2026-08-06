// @ts-check
const { expect } = require("@playwright/test");

/**
 * Shared Play helpers for Partner/Admin e2e specs that use the Games sidebar.
 * The Games panel is minimized and locked while a non-online game is in progress
 * (`expandGamesLocked`); open it only after the game has ended.
 *
 * Completing a game also auto-saves as "{{white}} vs. {{black}}". Manual Save uses
 * "Saved — …" — prefer that marker so tests do not pick the auto-save.
 */

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
 * End the live game so the Games sidebar unlocks (Partner/Admin advanced tools).
 * @param {import("@playwright/test").Page} page
 */
async function resignToUnlockGamesPanel(page) {
    const resignBtn = page.locator("#resignBtn");
    await expect(resignBtn).toBeEnabled({ timeout: 15_000 });
    await resignBtn.click();
    const confirm = page.locator(".desktop-play-dialog--confirm");
    await expect(confirm).toBeVisible({ timeout: 10_000 });
    await confirm.getByRole("button", { name: /^Yes$/i }).click();
    await expect(confirm).toBeHidden({ timeout: 10_000 });
    const expandTab = page.locator("#desktopPlaySidebarGames .desktop-play-sidebar-tab--expand");
    await expect(expandTab).toBeEnabled({ timeout: 15_000 });
}

/**
 * Expand the Games sidebar when it is collapsed. Must not be expand-locked.
 * @param {import("@playwright/test").Page} page
 */
async function openGamesSidebar(page) {
    const gamesDiv = page.locator("#gamesDiv");
    const expandTab = page.locator("#desktopPlaySidebarGames .desktop-play-sidebar-tab--expand");

    if (await gamesDiv.isVisible()) {
        return;
    }
    await expect(expandTab).toBeEnabled({ timeout: 15_000 });
    await expandTab.click();
    await expect(gamesDiv).toBeVisible({ timeout: 15_000 });
}

/** @param {import("@playwright/test").Page} page */
function manualSavedGames(page) {
    return page.locator("#gamesDiv .desktop-play-saved-game").filter({
        has: page.locator(".desktop-play-saved-game-name", { hasText: /^Saved —/ }),
    });
}

/**
 * Save mid-game, resign to unlock the Games dock, then load the manual save into Review.
 * @param {import("@playwright/test").Page} page
 * @param {{ expandDetails?: boolean }} [opts]
 */
async function saveResignAndLoadReview(page, opts = {}) {
    const expandDetails = opts.expandDetails !== false;
    const items = page.locator("#gamesDiv .desktop-play-saved-game");
    const manuals = manualSavedGames(page);
    const beforeManual = await manuals.count();

    await playE4AndWaitForReply(page);
    await page.locator("#saveBtn").click();
    await expect(manuals).toHaveCount(beforeManual + 1, { timeout: 15_000 });

    await resignToUnlockGamesPanel(page);
    await openGamesSidebar(page);

    const saved = manuals.first();
    await expect(saved.locator(".desktop-play-saved-game-name")).toBeVisible();
    await expect(saved.locator(".desktop-play-saved-game-name")).toContainText("Saved —");

    if (expandDetails) {
        await saved.locator(".desktop-play-saved-game-expand").click();
        await expect(saved).toHaveClass(/expanded/);
    }

    await saved.locator(".desktop-play-saved-game-name").click();
    await expect(page.locator("#desktopPlayMatchTitle")).toHaveText(/Review Mode/i, {
        timeout: 15_000,
    });
    await expect(page.locator("#desktopPlayReviewNav")).toBeVisible();
    return { saved, items, manuals, beforeManual };
}

module.exports = {
    startGameAsWhite,
    playE4AndWaitForReply,
    resignToUnlockGamesPanel,
    openGamesSidebar,
    manualSavedGames,
    saveResignAndLoadReview,
};
