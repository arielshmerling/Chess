/**
 * Slim Express app for Electron desktop (no web routes, WebSocket, MongoDB, or EJS).
 */
const express = require("express");
const cookieSession = require("cookie-session");
const helmet = require("helmet");
const crypto = require("crypto");
const ExpressError = require("./utils/ExpressError");
const configureDesktopApp = require("./desktop/configureApp");
const { mountClientStatic } = require("./clientStatic");
const { buildHelmetOptions } = require("./security/helmetOptions");

const app = express();
require("dotenv").config();

if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = "shmerling-desktop-local-session";
}

app.set("trust proxy", 1);
app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(32).toString("hex");
    next();
});
app.use(
    helmet(
        buildHelmetOptions({
            isProd: false,
            upgradeInsecureRequests: false,
        }),
    ),
);
app.use(cookieSession({
    name: "session1",
    keys: [process.env.SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
}));
mountClientStatic(app, __dirname);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

configureDesktopApp(app);

app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
    res.status(404).end();
});

app.get("*", (req, res, next) => {
    if (req.path.toLowerCase().endsWith(".map")) {
        return res.status(404).end();
    }
    next();
});

app.all("*", (req, res, next) => {
    next(new ExpressError("Page not found: " + req.path, 404));
});

module.exports = app;
