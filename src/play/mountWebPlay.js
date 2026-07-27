const path = require("path");
const express = require("express");
const { requireLogin } = require("../utils");
const { canAccessPlayPage } = require("./playPaths");
const brainApi = require("./brainApi");
const webCustomThemeApi = require("./webCustomThemeApi");
const webUiSettingsApi = require("./webUiSettingsApi");
const playPrefsApi = require("./playPrefsApi");

const DESKTOP_UI_DIR = path.join(__dirname, "../desktop/ui");
const PLAY_UI_DIR = path.join(__dirname, "../play-ui");
const SESSION_DIR = path.join(__dirname, "../session");
const MOBILE_DIR = path.join(__dirname, "../mobile");

function setPlayPageNoCache(res) {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
}

/**
 * Web-only Play shell routes (desktop mode mounts its own /app/play).
 * @param {import("express").Application} app
 */
function mountWebPlayRoutes(app) {
    app.use("/app/ui", express.static(DESKTOP_UI_DIR));
    app.use("/app/play-ui", express.static(PLAY_UI_DIR));
    app.use("/app/session", express.static(SESSION_DIR));
    app.use("/app/mobile", express.static(MOBILE_DIR));
    app.use("/app/adapters", express.static(path.join(__dirname, "../adapters")));

    app.post("/api/brain/compute-move", requireLogin, brainApi.computeMove);
    app.post("/api/brain/evaluate-position", requireLogin, brainApi.evaluatePosition);
    app.post("/api/brain/abort-search", requireLogin, brainApi.abortSearch);

    app.get("/app/api/custom-themes", requireLogin, webCustomThemeApi.get);
    app.post("/app/api/custom-themes", requireLogin, webCustomThemeApi.save);
    app.get("/app/api/ui-settings", requireLogin, webUiSettingsApi.get);
    app.post("/app/api/ui-settings", requireLogin, webUiSettingsApi.save);

    app.get("/api/play/launch-context", requireLogin, playPrefsApi.getLaunchContext);
    app.post("/api/play/last-game-options", requireLogin, playPrefsApi.setLastGameOptions);

    app.get("/play", requireLogin, (req, res) => {
        if (!canAccessPlayPage(req)) {
            return res.redirect(302, "/game");
        }
        setPlayPageNoCache(res);
        res.sendFile(path.join(DESKTOP_UI_DIR, "play.html"));
    });
}

module.exports = {
    mountWebPlayRoutes,
    DESKTOP_UI_DIR,
};
