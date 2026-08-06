// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsPartner } = require("./helpers/auth");

/**
 * Review navigation is reached by loading a saved game (Partner/Admin only).
 * Covers the ply bar before extracting it from desktop-play.js.
 */
async function login(page) {
    await loginAsPartner(page);
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
    await expect(page.locator("#movesDiv .tdMove").nth(1)).not.toHaveText("", { timeout: 60_000 });
}

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
        await sidebar.evaluate((el) => el.classList.remove("desktop-play-sidebar--collapsed"));
    }
    await expect(gamesDiv).toBeVisible({ timeout: 15_000 });
}

async function saveAndLoadIntoReview(page) {
    await openGamesSidebar(page);
    const items = page.locator("#gamesDiv .desktop-play-saved-game");
    const before = await items.count();

    await playE4AndWaitForReply(page);
    await page.locator("#saveBtn").click();
    await expect(items).toHaveCount(before + 1, { timeout: 15_000 });

    const saved = items.first();
    await saved.locator(".desktop-play-saved-game-expand").click();
    await expect(saved).toHaveClass(/expanded/);
    await saved.locator(".desktop-play-saved-game-name").click();
    await expect(page.locator("#desktopPlayMatchTitle")).toHaveText(/Review Mode/i, {
        timeout: 15_000,
    });
    await expect(page.locator("#desktopPlayReviewNav")).toBeVisible();
    return { saved, items, before };
}

test.describe("play review navigation", () => {
    test("Start / Forward / Back move through the saved game", async ({ page }) => {
        test.setTimeout(120_000);

        await login(page);
        await startGameAsWhite(page);
        const { saved, items, before } = await saveAndLoadIntoReview(page);

        const nav = page.locator("#desktopPlayReviewNav");
        const startBtn = nav.getByRole("button", { name: "Start" });
        const backBtn = nav.getByRole("button", { name: "Back" });
        const forwardBtn = nav.getByRole("button", { name: "Forward" });
        const endBtn = nav.getByRole("button", { name: "End" });

        /* Loaded at the final ply: can go to start, cannot go forward. */
        await expect(startBtn).toBeEnabled();
        await expect(backBtn).toBeEnabled();
        await expect(forwardBtn).toBeDisabled();
        await expect(endBtn).toBeDisabled();

        const e2 = page.locator('#innerBoard .square[data-row="6"][data-col="4"]');
        const e4 = page.locator('#innerBoard .square[data-row="4"][data-col="4"]');

        await startBtn.click();
        await expect(e2.locator("img")).toBeVisible({ timeout: 10_000 });
        await expect(e4.locator("img")).toHaveCount(0);
        await expect(startBtn).toBeDisabled();
        await expect(backBtn).toBeDisabled();
        await expect(forwardBtn).toBeEnabled();

        await forwardBtn.click();
        await expect(e4.locator("img")).toBeVisible({ timeout: 10_000 });
        await expect(e2.locator("img")).toHaveCount(0);
        await expect(backBtn).toBeEnabled();

        await backBtn.click();
        await expect(e2.locator("img")).toBeVisible({ timeout: 10_000 });
        await expect(e4.locator("img")).toHaveCount(0);

        await endBtn.click();
        await expect(forwardBtn).toBeDisabled();
        await expect(endBtn).toBeDisabled();

        await saved.locator('button[title="Delete saved game"]').click();
        await expect(items).toHaveCount(before, { timeout: 15_000 });
    });
});
