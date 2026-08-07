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

function staticCacheOptions() {
    const isProd = process.env.NODE_ENV === "production";
    if (!isProd) {
        return {};
    }
    return {
        maxAge: "1d",
        etag: true,
        lastModified: true,
        setHeaders: function (res, filePath) {
            if (/\.(?:js|css|png|jpg|jpeg|gif|webp|ico|woff2?)$/i.test(filePath)) {
                res.setHeader("Cache-Control", "public, max-age=86400");
            }
        },
    };
}

/**
 * @param {import("express").Application} app
 * @param {string} srcRoot - absolute path to src/
 */
function mountClientStatic(app, srcRoot) {
    const assetsRoot = path.join(srcRoot, "assets");
    const cache = staticCacheOptions();

    app.use(express.static(assetsRoot, cache));
    app.use("/images", express.static(path.join(assetsRoot, "images"), cache));
    app.use("/strings", express.static(path.join(srcRoot, "strings"), cache));
    app.use("/validation", express.static(path.join(srcRoot, "validation"), cache));
    app.use("/a11y", express.static(path.join(srcRoot, "a11y"), cache));

    for (const name of ROOT_CLIENT_FILES) {
        const filePath = path.join(srcRoot, name);
        if (!fs.existsSync(filePath)) {
            continue;
        }
        app.get("/" + name, (req, res) => {
            if (process.env.NODE_ENV === "production") {
                res.set("Cache-Control", "public, max-age=86400");
            }
            res.sendFile(filePath);
        });
    }
}

module.exports = {
    ROOT_CLIENT_FILES,
    mountClientStatic,
    staticCacheOptions,
};
