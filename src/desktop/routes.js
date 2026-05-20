const path = require("path");
const express = require("express");
const { requireLogin } = require("../utils");
const { ensureGuestSession } = require("./middleware");
const bookmarkApi = require("./bookmarkApi");
const brainConfigApi = require("./brainConfigApi");
const customThemeApi = require("./customThemeApi");

const UI_DIR = path.join(__dirname, "ui");

function sendUiPage(filename) {
    return (_req, res) => {
        res.sendFile(path.join(UI_DIR, filename));
    };
}

/**
 * Desktop-only UI and JSON API. Game play is in-process (Electron IPC), not HTTP/WS.
 * @param {import("express").Application} app
 */
function mountDesktopRoutes(app) {
    app.use(ensureGuestSession);

    app.get("/brain-config", requireLogin, brainConfigApi.get);
    app.post("/brain-config", requireLogin, brainConfigApi.save);

    app.get("/bookmark", requireLogin, bookmarkApi.list);
    app.post("/bookmark", requireLogin, bookmarkApi.create);
    app.post("/updateBookmark", requireLogin, bookmarkApi.update);
    app.post("/deleteBookmark", requireLogin, bookmarkApi.remove);

    app.use("/app/ui", express.static(UI_DIR));
    app.use("/vendor", express.static(path.join(__dirname, "..", "assets", "vendor")));

    app.get("/", (_req, res) => {
        res.redirect("/app/");
    });

    app.get(["/app", "/app/"], sendUiPage("index.html"));
    app.get("/app/new-game", (_req, res) => res.redirect(302, "/app/play"));
    app.get("/app/play", sendUiPage("play.html"));
    app.get("/app/error", sendUiPage("error.html"));

    app.get("/research", (_req, res) => res.redirect(302, "/app/play"));
    app.get("/game", (_req, res) => res.redirect(302, "/app/play"));
    app.get("/gameInfo", (_req, res) => res.redirect(302, "/app/play"));
    app.get("/gameMoves", (_req, res) => res.redirect(302, "/app/play"));

    app.get("/app/api/custom-themes", requireLogin, customThemeApi.get);
    app.post("/app/api/custom-themes", requireLogin, customThemeApi.save);

    app.get("/desktop", (_req, res) => res.redirect("/app/"));
    app.get("/desktop/", (_req, res) => res.redirect("/app/"));
    app.get("/login", (_req, res) => res.redirect("/app/"));
    app.get("/home", (_req, res) => res.redirect("/app/"));
    app.get("/mobile-home", (_req, res) => res.redirect("/app/"));
    app.get("/friends", (_req, res) => res.redirect("/app/"));
}

module.exports = { mountDesktopRoutes, UI_DIR };
