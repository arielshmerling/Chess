const express = require("express");
const cookieSession = require("cookie-session");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const path = require("path");
const ExpressError = require("./utils/ExpressError");
const ejsMate = require("ejs-mate");
const helmet = require("helmet");
const crypto = require("crypto");
const enableWs = require("express-ws");
const presence = require("./utils/presence");
const { mountClientStatic } = require("./clientStatic");
const { csrfSameOrigin } = require("./security/csrfOrigin");
const { createRateLimiter } = require("./security/rateLimit");
const { canReadLiveGame } = require("./security/gameAccess");
const { buildHelmetOptions } = require("./security/helmetOptions");

const app = express();
require("dotenv").config();

const isProd = process.env.NODE_ENV === "production";
if (!process.env.SESSION_SECRET || String(process.env.SESSION_SECRET).trim() === "") {
    if (isProd) {
        console.error("FATAL: SESSION_SECRET is required in production");
        process.exit(1);
    }
    console.warn("WARNING: SESSION_SECRET missing — using insecure development default");
    process.env.SESSION_SECRET = "dev-only-insecure-session-secret-change-me";
}

// Enable WebSocket support for Express app (must be before routes)
enableWs(app);

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));

app.set("trust proxy", 1); // trust first proxy

const scriptSrcUrl = [
    "https://cdnjs.cloudflare.com",
    "https://cdn.jsdelivr.net",
];

app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(32).toString("hex");
    next();
});

app.use(
    helmet(
        buildHelmetOptions({
            isProd,
            scriptSrcUrl,
        }),
    ),
);

const cookieSecure =
    isProd ||
    process.env.SESSION_COOKIE_SECURE === "1" ||
    process.env.SESSION_COOKIE_SECURE === "true";

app.use(cookieSession({
    name: "session1",
    keys: [
        process.env.SESSION_SECRET,
    ],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax",
}));
app.use(flash());

mountClientStatic(app, __dirname);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(csrfSameOrigin);

const loginRateLimitMax = Math.max(
    1,
    Number(process.env.LOGIN_RATE_LIMIT_MAX) || 40,
);
const validateUsernameRateLimitMax = Math.max(
    1,
    Number(process.env.VALIDATE_USERNAME_RATE_LIMIT_MAX) || 60,
);

const loginRateLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: loginRateLimitMax,
    keyFn: (req) => {
        const user =
            req.body && typeof req.body.username === "string"
                ? req.body.username.trim().toLowerCase()
                : "";
        return String(req.ip || "") + "|" + user;
    },
    message: "Too many login attempts. Try again later.",
});

const validateUsernameRateLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: validateUsernameRateLimitMax,
    message: "Too many requests. Try again later.",
});

app.set("rateLimiters", {
    login: loginRateLimit,
    validateUsername: validateUsernameRateLimit,
});

const userRoutes = require("./modules/user"); // Import the user routes
const gamesManagerRoutes = require("./modules/gamesManager"); // Import the games manager routes
const gameRoutes = require("./modules/game"); // Import the games manager routes
const friendsRoutes = require("./modules/friends");

if (process.env.SHMERLING_MODE === "desktop") {
    require("./desktop/configureApp")(app);
}

const {
    resolveSessionUserType,
    isAdminSession,
    canAccessDebug,
    canUsePlayAdvancedTools,
    canCustomizeThemes,
} = require("./modules/user/roles");

const {
    t,
    getHtmlLang,
    getHtmlDir,
    getLocale,
    DEFAULT_LOCALE,
    resolveRequestLocale,
} = require("./strings");

// Available to every EJS view (including error pages / includes).
app.locals.t = t;
app.locals.htmlLang = getHtmlLang();
app.locals.htmlDir = getHtmlDir();
app.locals.locale = getLocale();
app.locals.defaultLocale = DEFAULT_LOCALE;

app.use((req, res, next) => {
    const locale = resolveRequestLocale(req);
    res.locals.username = req.session.user_name;
    res.locals.admin = isAdminSession(req.session);
    res.locals.userType = resolveSessionUserType(req.session);
    res.locals.canDebug = canAccessDebug(req.session);
    res.locals.canPlayAdvanced = canUsePlayAdvancedTools(req.session);
    res.locals.canCustomizeThemes = canCustomizeThemes(req.session);
    res.locals.messages = req.flash("messages");
    if (!res.locals.cspNonce) {
        res.locals.cspNonce = crypto.randomBytes(32).toString("hex");
    }
    res.locals.locale = locale;
    res.locals.htmlLang = getHtmlLang(locale);
    res.locals.htmlDir = getHtmlDir(locale);
    res.locals.t = function (key, params) {
        return t(key, params, locale);
    };
    next();
});

if (process.env.SHMERLING_MODE !== "desktop") {
    require("./play/mountWebPlay").mountWebPlayRoutes(app);
    app.post("/login", loginRateLimit);
    app.post("/api/login", loginRateLimit);
    app.get("/validateUsername", validateUsernameRateLimit);
    app.use("/", userRoutes);
    app.use("/", gamesManagerRoutes);
    app.use("/", gameRoutes);
    app.use("/", friendsRoutes);
}

// WebSocket route handler (must be before catch-all route)
// Note: gameManagerService will be set up in server.js after app is created
let gameManagerService = null;
const lobbyClients = [];
/** WebSockets that called presenceSubscribe — receive friendPresence broadcasts. */
const presenceBroadcastClients = [];

presence.setFriendPresenceBroadcaster((payload) => {
    const message = JSON.stringify({
        type: "friendPresence",
        data: payload,
    });
    const ready = presenceBroadcastClients.filter((c) => c.readyState === 1);
    ready.forEach((clientWs) => {
        try {
            clientWs.send(message);
        } catch (err) {
            console.error("broadcast friendPresence send error:", err);
        }
    });
});

app.setWebSocketService = (service) => {
    gameManagerService = service;
};

app.broadcastToLobby = (data) => {
    const payload = JSON.stringify(data);
    const ready = lobbyClients.filter((c) => c.readyState === 1);
    ready.forEach((clientWs) => {
        try {
            clientWs.send(payload);
        } catch (err) {
            console.error("broadcastToLobby send error:", err);
        }
    });
};

app.ws("/ws", async (ws, req) => {

    if (!gameManagerService) {
        console.error("gameManagerService not initialized");
        ws.close();
        return;
    }

    ws.on("message", async (recivedData) => {
        try {
            const msg = JSON.parse(recivedData);

            if (msg.type === "subscribeLobby") {
                if (!(req.session && req.session.user_id)) {
                    return;
                }
                if (lobbyClients.indexOf(ws) === -1) {
                    lobbyClients.push(ws);
                }
                return;
            }

            if (msg.type === "presenceSubscribe") {
                if (ws._presenceSubscribed) {
                    return;
                }
                const uid = req.session && req.session.user_id;
                if (!uid) {
                    return;
                }
                const uname = (req.session && req.session.user_name) != null
                    ? String(req.session.user_name)
                    : "";
                ws._presenceSubscribed = true;
                presence.attachPresenceWebSocket(ws, String(uid), uname);
                if (presenceBroadcastClients.indexOf(ws) === -1) {
                    presenceBroadcastClients.push(ws);
                }
                return;
            }

            if (msg.type == "connection") {
                const sessionUserId = req.session && req.session.user_id;
                if (!sessionUserId) {
                    try {
                        ws.close();
                    } catch (err) {
                        /* ignore */
                    }
                    return;
                }
                const claimedId = msg.data && msg.data.userId;
                if (claimedId != null && String(claimedId) !== String(sessionUserId)) {
                    try {
                        ws.close();
                    } catch (err) {
                        /* ignore */
                    }
                    return;
                }
                const gameId = msg.data && msg.data.gameId;
                const game = gameManagerService.getGameById(gameId);
                if (game) {
                    game.init(ws, sessionUserId);
                }
                return;
            }

            if (msg.type == "watch") {
                const sessionUserId = req.session && req.session.user_id;
                if (!sessionUserId) {
                    try {
                        ws.close();
                    } catch (err) {
                        /* ignore */
                    }
                    return;
                }
                const gameId = msg.data && msg.data.gameId;
                const game = gameManagerService.getGameById(gameId);
                if (game && canReadLiveGame(game, req.session)) {
                    const watchName =
                        (req.session && req.session.user_name) ||
                        (msg.data && msg.data.username) ||
                        "";
                    game.addWatcher(ws, watchName);
                }
                return;
            }
        } catch (error) {
            console.error("Error processing WebSocket message:", error);
        }
    });

    ws.on("close", async () => {
        const idx = lobbyClients.indexOf(ws);
        if (idx !== -1) {
            lobbyClients.splice(idx, 1);
        }
        const pIdx = presenceBroadcastClients.indexOf(ws);
        if (pIdx !== -1) {
            presenceBroadcastClients.splice(pIdx, 1);
        }
        if (ws._presenceSubscribed) {
            presence.detachPresenceWebSocket(ws);
            ws._presenceSubscribed = false;
        }
    });

    ws.on("error", () => {
        /* ignore client socket errors */
    });

});

app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
    res.status(404).end();
});

/* Normalize accidental protocol-relative / double-slash paths (e.g. //game). */
app.use((req, res, next) => {
    if (typeof req.url === "string" && req.url.startsWith("//")) {
        return res.redirect(302, req.url.replace(/^\/+/, "/"));
    }
    next();
});

// Optional source maps and similar assets: 404 without error page or logging
app.get("*", (req, res, next) => {
    if (req.path.toLowerCase().endsWith(".map")) {
        return res.status(404).end();
    }
    next();
});

app.all("*", (req, res, next) => {
    next(new ExpressError("Page not found: " + req.path, 404));
});

app.use((err, req, res, next) => {
    const { statusCode = 500, message = "Sorry, Something went wrong" } = err;
    if (res.headersSent) {
        return next(err);
    }
    if (req.path && req.path.startsWith("/api/")) {
        return res.status(statusCode).json({ ok: false, message });
    }
    return res.status(statusCode).render("error", { statusCode, message });
});

module.exports = app;
