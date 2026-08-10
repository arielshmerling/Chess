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
    await expect(page.locator("#resignBtn")).toBeEnabled({ timeout: 30_000 });
}

/**
 * Drag a piece using page.mouse so desktop-board's document-level
 * mousedown/mousemove handlers update the piece rect before mouseup.
 * Playwright's locator.dragTo({ force }) is flaky with that custom drag path.
 */
async function dragSquareToSquare(page, fromImg, toSquare) {
    const fromBox = await fromImg.boundingBox();
    const toBox = await toSquare.boundingBox();
    if (!fromBox || !toBox) {
        throw new Error("dragSquareToSquare: missing bounding box");
    }
    const fromX = fromBox.x + fromBox.width / 2;
    const fromY = fromBox.y + fromBox.height / 2;
    const toX = toBox.x + toBox.width / 2;
    const toY = toBox.y + toBox.height / 2;
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(toX, toY, { steps: 12 });
    await page.mouse.up();
}

/**
 * Play e2-e4 and wait until the engine has answered.
 * Do not assert on `#movesDiv` visibility — the Moves dock starts collapsed
 * (`display: none`), so Playwright text assertions on `.tdMove` time out even
 * when moves were applied.
 */
async function playE4AndWaitForReply(page) {
    await expect(page.locator("#resignBtn")).toBeEnabled({ timeout: 30_000 });

    /* Partner prefs may be click-to-move; e2e always uses drag. */
    await page.evaluate(() => {
        const Settings = window.DesktopGameSettings;
        if (Settings && typeof Settings.saveGamePreferences === "function") {
            Settings.saveGamePreferences({ mouse: "drag" });
        }
    });
    await expect(page.locator("#innerBoard")).not.toHaveClass(/move-mode-double/, {
        timeout: 5_000,
    });

    const e2 = page.locator('#innerBoard .square[data-row="6"][data-col="4"] img.draggable');
    const e4 = page.locator('#innerBoard .square[data-row="4"][data-col="4"]');
    await expect(e2).toBeVisible({ timeout: 30_000 });

    await dragSquareToSquare(page, e2, e4);
    /* One retry: custom board drag occasionally drops back to the source square. */
    if ((await e4.locator("img").count()) === 0) {
        await expect(e2).toBeVisible({ timeout: 5_000 });
        await dragSquareToSquare(page, e2, e4);
    }

    /* Confirm white's ply on the board (works whether Moves is expanded or not). */
    await expect(e4.locator("img")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#innerBoard .square[data-row="6"][data-col="4"] img')).toHaveCount(0);

    /* Engine reply: White's clock becomes active again. */
    await expect(page.locator("#desktopPlayHeaderWhite")).toHaveClass(
        /desktop-play-header-clock--active/,
        { timeout: 60_000 },
    );
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
 * Wait until Save is usable (engine idle), then save and assert a new manual entry.
 * Retries because onSaveGame no-ops silently while engineThinking/animating.
 * @param {import("@playwright/test").Page} page
 * @param {import("@playwright/test").Locator} manuals
 * @param {number} expectedCount
 */
async function saveManualGameExpectCount(page, manuals, expectedCount) {
    const saveBtn = page.locator("#saveBtn");
    const status = page.locator("#desktopPlayStatusBar");

    await expect(saveBtn).toBeEnabled({ timeout: 30_000 });
    await expect(page.locator("#desktopPlayHeaderWhite")).toHaveClass(
        /desktop-play-header-clock--active/,
        { timeout: 60_000 },
    );
    await expect(status).not.toHaveText(/Engine thinking/i, { timeout: 60_000 });

    for (let attempt = 0; attempt < 5; attempt += 1) {
        await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
        await saveBtn.click();
        try {
            await expect(manuals).toHaveCount(expectedCount, { timeout: 4_000 });
            return;
        } catch {
            await expect(status).not.toHaveText(/Engine thinking/i, { timeout: 30_000 });
            await new Promise(function (resolve) {
                setTimeout(resolve, 400);
            });
        }
    }

    await expect(manuals).toHaveCount(expectedCount, { timeout: 15_000 });
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
    await saveManualGameExpectCount(page, manuals, beforeManual + 1);

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
    saveManualGameExpectCount,
    saveResignAndLoadReview,
};
