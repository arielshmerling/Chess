// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Position Setup and Configuration docks are Partner/Admin only. This covers the
 * mutual-exclusion chrome before extracting it from desktop-play.js.
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
    return { saved, items, before };
}

test.describe("play setup and config docks", () => {
    test("Position Setup and Config are mutually exclusive in the moves sidebar", async ({
        page,
    }) => {
        test.setTimeout(120_000);

        await login(page);
        await startGameAsWhite(page);
        const { saved, items, before } = await saveAndLoadIntoReview(page);

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
        await expect(configBtn).not.toHaveClass(/desktop-play-action--active/);

        await saved.locator('button[title="Delete saved game"]').click();
        await expect(items).toHaveCount(before, { timeout: 15_000 });
    });
});
