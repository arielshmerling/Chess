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

app.use((req, res, next) => {
    res.locals.username = req.session.user_name;
    res.locals.admin = req.session.admin;
    res.locals.messages = req.flash("messages");
    res.locals.cspNonce = crypto.randomBytes(32).toString("hex");
    next();
});

app.use("/", userRoutes);
app.use("/", gamesManagerRoutes);
app.use("/", gameRoutes);

//production script
app.use(express.static("./client/build"));

// WebSocket route handler (must be before catch-all route)
// Note: gameManagerService will be set up in server.js after app is created
let gameManagerService = null;
const lobbyClients = [];
app.setWebSocketService = (service) => {
    gameManagerService = service;
};

app.broadcastToLobby = (data) => {
    const payload = JSON.stringify(data);
    const ready = lobbyClients.filter((c) => c.readyState === 1);
    console.log("[broadcastToLobby]", data.type, "->", ready.length, "clients");
    ready.forEach((clientWs) => {
        try {
            clientWs.send(payload);
        } catch (err) {
            console.error("broadcastToLobby send error:", err);
        }
    });
};

app.ws("/ws", async (ws, req) => {
    console.log("ws connection request arrived");

    if (!gameManagerService) {
        console.error("gameManagerService not initialized");
        ws.close();
        return;
    }

    ws.on("message", async (recivedData) => {
        try {
            const msg = JSON.parse(recivedData);

            if (msg.type === "subscribeLobby") {
                lobbyClients.push(ws);
                console.log("[ws] subscribeLobby – lobby clients:", lobbyClients.length);
                return;
            }

            if (msg.type == "connection") {
                const gameId = msg.data.gameId;

                const game = gameManagerService.getGameById(gameId);
                if (game) {
                    game.init(ws, msg.data.userId);
                }
            }

            if (msg.type == "watch") {
                const gameId = msg.data && msg.data.gameId;
                console.log("[watch] received gameId=" + gameId + " username=" + (msg.data && msg.data.username));
                const game = gameManagerService.getGameById(gameId);
                if (game) {
                    game.addWatcher(ws, msg.data.username);
                } else {
                    console.log("[watch] game not found for gameId=" + gameId);
                }
            }
        } catch (error) {
            console.error("Error processing WebSocket message:", error);
        }
    });

    ws.on("close", async (data) => {
        const idx = lobbyClients.indexOf(ws);
        if (idx !== -1) lobbyClients.splice(idx, 1);
        console.log("ws close connection: " + data);
    });

    ws.on("error", (error) => {
        console.log("ws error:", error);
    });

    console.log("ws connection established");
});

app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
    res.status(404).end();
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