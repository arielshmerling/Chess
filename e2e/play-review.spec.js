// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsPartner } = require("./helpers/auth");
const {
    startGameAsWhite,
    saveResignAndLoadReview,
} = require("./helpers/playPartner");

/**
 * Review navigation is reached by loading a saved game (Partner/Admin only).
 * Covers the ply bar before extracting it from desktop-play.js.
 */
test.describe("play review navigation", () => {
    test("Start / Forward / Back move through the saved game", async ({ page }) => {
        test.setTimeout(120_000);

        await loginAsPartner(page);
        await startGameAsWhite(page);
        const { saved, manuals, beforeManual } = await saveResignAndLoadReview(page);

        const nav = page.locator("#desktopPlayReviewNav");
        const startBtn = nav.getByRole("button", { name: "Start" });
        const backBtn = nav.getByRole("button", { name: "Back" });
        const forwardBtn = nav.getByRole("button", { name: "Forward" });
        const endBtn = nav.getByRole("button", { name: "End" });

        const e2 = page.locator('#innerBoard .square[data-row="6"][data-col="4"]');
        const e4 = page.locator('#innerBoard .square[data-row="4"][data-col="4"]');

        await startBtn.click();
        await expect(e2.locator("img")).toBeVisible({ timeout: 10_000 });

        await forwardBtn.click();
        await expect(e4.locator("img")).toBeVisible({ timeout: 10_000 });

        await backBtn.click();
        await expect(e2.locator("img")).toBeVisible({ timeout: 10_000 });

        await endBtn.click();
        await expect(e4.locator("img")).toBeVisible({ timeout: 10_000 });

        await saved.locator('button[title="Delete saved game"]').click();
        await expect(manuals).toHaveCount(beforeManual, { timeout: 15_000 });
    });
});
