const path = require("path");
const express = require("express");
const { requireLogin } = require("../utils");
const { ensureGuestSession } = require("./middleware");
const gameApi = require("./gameApi");
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
 * Desktop-only UI and JSON API. Web routes are not mounted when SHMERLING_MODE=desktop.
 * @param {import("express").Application} app
 */
function mountDesktopRoutes(app) {
    app.use(ensureGuestSession);

    app.get("/gameInfo", requireLogin, gameApi.getGameInfo);
    app.get("/gameMoves", requireLogin, gameApi.getGameMoves);
    app.get("/game", requireLogin, gameApi.startFromQuery);
    app.get("/brain-config", requireLogin, brainConfigApi.get);
    app.post("/brain-config", requireLogin, brainConfigApi.save);
    app.post("/rematch", requireLogin, gameApi.rematch);

    app.get("/bookmark", requireLogin, bookmarkApi.list);
    app.post("/bookmark", requireLogin, bookmarkApi.create);
    app.post("/updateBookmark", requireLogin, bookmarkApi.update);
    app.post("/deleteBookmark", requireLogin, bookmarkApi.remove);
    app.post("/applyBookmark", requireLogin, bookmarkApi.apply);

    app.post("/app/api/game", requireLogin, gameApi.createGame);
    app.post("/app/api/game/sync-state", requireLogin, gameApi.syncGameState);

    app.get("/app/api/custom-themes", requireLogin, customThemeApi.get);
    app.post("/app/api/custom-themes", requireLogin, customThemeApi.save);

    app.use("/app/ui", express.static(UI_DIR));
    app.use("/vendor", express.static(path.join(__dirname, "..", "assets", "vendor")));

    app.get("/", (_req, res) => {
        res.redirect("/app/");
    });

    app.get(["/app", "/app/"], sendUiPage("index.html"));
    app.get("/app/new-game", sendUiPage("new-game.html"));
    app.get("/app/play", (req, res) => {
        const page = req.query.research === "1" ? "play-research.html" : "play.html";
        res.sendFile(path.join(UI_DIR, page));
    });
    app.get("/app/error", sendUiPage("error.html"));

    app.get("/research", (_req, res) => res.redirect("/app/play?research=1"));

    app.get("/desktop", (_req, res) => res.redirect("/app/"));
    app.get("/desktop/", (_req, res) => res.redirect("/app/"));
    app.get("/login", (_req, res) => res.redirect("/app/"));
    app.get("/home", (_req, res) => res.redirect("/app/"));
    app.get("/mobile-home", (_req, res) => res.redirect("/app/"));
    app.get("/friends", (_req, res) => res.redirect("/app/"));
}

module.exports = { mountDesktopRoutes, UI_DIR };
