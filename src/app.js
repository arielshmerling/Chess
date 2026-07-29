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

const app = express();
require("dotenv").config();

// Enable WebSocket support for Express app (must be before routes)
enableWs(app);

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));

app.set("trust proxy", 1); // trust first proxy
app.use(cookieSession({
    name: "session1",
    keys: [
        process.env.SESSION_SECRET
    ],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
}));
app.use(flash());
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, "src")));
app.use(express.static(path.join(__dirname, "assets")));

// Serve images from assets/Images directory
//app.use("/Images", express.static(path.join(__dirname, "assets", "Images")));
app.use("/images", express.static(path.join(__dirname, "assets", "images")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));

const scriptSrcUrl = [
    "https://cdnjs.cloudflare.com",
    "https://cdn.jsdelivr.net",
];

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
    canAccessPlayPage,
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
    res.locals.canUsePlayPage = canAccessPlayPage(req.session);
    res.locals.messages = req.flash("messages");
    res.locals.cspNonce = crypto.randomBytes(32).toString("hex");
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
                const gameId = msg.data.gameId;

                const game = gameManagerService.getGameById(gameId);
                if (game) {
                    game.init(ws, msg.data.userId);
                }
                return;
            }

            if (msg.type == "watch") {
                const gameId = msg.data && msg.data.gameId;
                const game = gameManagerService.getGameById(gameId);
                if (game) {
                    game.addWatcher(ws, msg.data.username);
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
    if (req.path && req.path.startsWith("/api/")) {
        res.status(statusCode).json({ ok: false, message });
        return next(err);
    }
    res.status(statusCode).render("error", { statusCode, message });
    next(err);
});

app.use(
    helmet({
        contentSecurityPolicy: {
            useDefaults: false,
            directives: {
                scriptSrc: ["'self'",
                    (req, res) => `'nonce-${res.locals.cspNonce}'`,
                    ...scriptSrcUrl],
                defaultSrc: ["'self'"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: [],
            },
        },
    }),
);

module.exports = app;
