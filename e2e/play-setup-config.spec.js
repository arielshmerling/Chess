// @ts-check
const { test, expect } = require("@playwright/test");
const { loginAsPartner } = require("./helpers/auth");
const { startGameAsWhite, saveResignAndLoadReview } = require("./helpers/playPartner");

/**
 * Position Setup and Configuration docks are Partner/Admin only. This covers the
 * mutual-exclusion chrome before extracting it from desktop-play.js.
 */
test.describe("play setup and config docks", () => {
    test("Position Setup and Config are mutually exclusive in the moves sidebar", async ({
        page,
    }) => {
        test.setTimeout(120_000);

        await loginAsPartner(page);
        await startGameAsWhite(page);
        const { saved, manuals, beforeManual } = await saveResignAndLoadReview(page);

        const movesSidebar = page.locator("#desktopPlaySidebarMoves");
        const title = page.locator("#desktopPlayMatchTitle");
        const setupBtn = page.locator("#positionSetupBtn");
        const configBtn = page.locator("#configurationBtn");

        await expect(setupBtn).toBeVisible();
        await expect(configBtn).toBeVisible();

        /* Review leaves gameActive false, so Position setup opens from the menu path. */
        await setupBtn.click();
        await expect(title).toHaveText(/Position Setup/i, { timeout: 15_000 });
        await expect(movesSidebar).toHaveClass(/desktop-play-sidebar--position-setup/);
        await expect(movesSidebar).not.toHaveClass(/desktop-play-sidebar--brain-config/);
        await expect(setupBtn).toHaveClass(/desktop-play-action--active/);
        /* Config is disabled while Position Setup is open. */
        await expect(configBtn).toBeDisabled();

        await setupBtn.click();
        await expect(movesSidebar).not.toHaveClass(/desktop-play-sidebar--position-setup/);
        await expect(configBtn).toBeEnabled({ timeout: 15_000 });

        await configBtn.click();
        await expect(title).toHaveText(/Configuration mode/i, { timeout: 15_000 });
        await expect(movesSidebar).toHaveClass(/desktop-play-sidebar--brain-config/);
        await expect(movesSidebar).not.toHaveClass(/desktop-play-sidebar--position-setup/);
        await expect(configBtn).toHaveClass(/desktop-play-action--active/);
        await expect(setupBtn).toBeDisabled();

        await configBtn.click();
        await expect(movesSidebar).not.toHaveClass(/desktop-play-sidebar--brain-config/);

        await saved.locator('button[title="Delete saved game"]').click();
        await expect(manuals).toHaveCount(beforeManual, { timeout: 15_000 });
    });
});
