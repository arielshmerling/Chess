const path = require("path");
const express = require("express");
const { requireLogin } = require("../utils");
const { canAccessPlayPage } = require("./playPaths");
const brainApi = require("./brainApi");
const { brainRateLimit } = require("./brainGuards");
const webCustomThemeApi = require("./webCustomThemeApi");
const webUiSettingsApi = require("./webUiSettingsApi");
const playPrefsApi = require("./playPrefsApi");
const { sendPlayHtml } = require("./servePlayHtml");
const { staticCacheOptions } = require("../clientStatic");

const DESKTOP_UI_DIR = path.join(__dirname, "../desktop/ui");
const PLAY_UI_DIR = path.join(__dirname, "../play-ui");
const STRINGS_DIR = path.join(__dirname, "../strings");
const SESSION_DIR = path.join(__dirname, "../session");
const MOBILE_DIR = path.join(__dirname, "../mobile");

/**
 * Web-only Play shell routes (desktop mode mounts its own /app/play).
 * @param {import("express").Application} app
 */
function mountWebPlayRoutes(app) {
    const cache = staticCacheOptions();

    app.use("/app/ui", express.static(DESKTOP_UI_DIR, cache));
    app.use("/app/strings", express.static(STRINGS_DIR, cache));
    app.use("/app/play-ui", express.static(PLAY_UI_DIR, cache));
    app.use("/app/session", express.static(SESSION_DIR, cache));
    app.use("/app/mobile", express.static(MOBILE_DIR, cache));
    app.use("/app/adapters", express.static(path.join(__dirname, "../adapters"), cache));

    app.post("/api/brain/compute-move", requireLogin, brainRateLimit, brainApi.computeMove);
    app.post("/api/brain/evaluate-position", requireLogin, brainRateLimit, brainApi.evaluatePosition);
    app.post("/api/brain/abort-search", requireLogin, brainRateLimit, brainApi.abortSearch);

    app.get("/app/api/custom-themes", requireLogin, webCustomThemeApi.get);
    app.post("/app/api/custom-themes", requireLogin, webCustomThemeApi.save);
    app.get("/app/api/ui-settings", requireLogin, webUiSettingsApi.get);
    app.post("/app/api/ui-settings", requireLogin, webUiSettingsApi.save);

    app.get("/api/play/launch-context", requireLogin, playPrefsApi.getLaunchContext);
    app.post("/api/play/last-game-options", requireLogin, playPrefsApi.setLastGameOptions);
    app.post(
        "/api/play/sp-game",
        requireLogin,
        require("../modules/game/controller").createPlaySpGameHandler,
    );

    app.get("/play", requireLogin, (req, res) => {
        if (!canAccessPlayPage(req)) {
            return res.redirect(302, "/home");
        }
        return sendPlayHtml(req, res);
    });
}

module.exports = {
    mountWebPlayRoutes,
    DESKTOP_UI_DIR,
};
