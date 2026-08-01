/**
 * Serve only browser-facing assets — never modules/, db/, brains, engines, etc.
 */
const path = require("path");
const express = require("express");
const fs = require("fs");

const ROOT_CLIENT_FILES = [
    "ChessGame.js",
    "chessboard.js",
    "lobby.js",
    "pieceSets.js",
    "themes.js",
    "customValidation.js",
    "siteDialogs.js",
    "lobbyPresence.js",
    "friendInviteOptions.js",
    "friendGameInvite.js",
    "activeGamesHome.js",
    "loginFlow.js",
    "formValidations.js",
    "mobile-game-ui.js",
    "favicon.ico",
];

/**
 * @param {import("express").Application} app
 * @param {string} srcRoot - absolute path to src/
 */
function mountClientStatic(app, srcRoot) {
    const assetsRoot = path.join(srcRoot, "assets");

    app.use(express.static(assetsRoot));
    app.use("/images", express.static(path.join(assetsRoot, "images")));
    app.use("/strings", express.static(path.join(srcRoot, "strings")));
    app.use("/validation", express.static(path.join(srcRoot, "validation")));

    for (const name of ROOT_CLIENT_FILES) {
        const filePath = path.join(srcRoot, name);
        if (!fs.existsSync(filePath)) {
            continue;
        }
        app.get("/" + name, (req, res) => {
            res.sendFile(filePath);
        });
    }
}

module.exports = {
    ROOT_CLIENT_FILES,
    mountClientStatic,
};
