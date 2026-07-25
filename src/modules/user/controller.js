
const catchAsync = require("../../utils/catchAsync");
const ExpressError = require("../../utils/ExpressError");
const userService = require("./service");
const gamesManagerService = require("../gamesManager/service");

exports.showLoginPage = (req, res) => {

    const { f } = req.query;
    let errorMessage = "";
    if (f == "error") {
        errorMessage = "Wrong username or password";

    }
    res.locals.username = "";
    // const username = req.session.user_name || "Guest";
    const game = { username: "" };

    res.render("login", { errorMessage, game });
};

exports.logout = async (req, res) => {
    req.session.user_id = null;
    req.session = null;

    res.redirect("/login"); // or home
};

exports.validateUsername = catchAsync(async (req, res) => {
    const { username } = req.query;
    const foundUser = await userService.userExist(username);
    if (foundUser) {
        res.send("FOUND USER");
    }
    else {
        res.send("NOT FOUND");
    }
});

exports.getBookmarks = catchAsync(async (req, res) => {
    const userId = req.session.user_id;

    if (userId) {
        const userBookmarks = await userService.getAllUserBookmarks(userId);
        res.send(userBookmarks);
    }
});

exports.setBookmark = catchAsync(async (req, res) => {
    const userId = req.session.user_id;
    const {
        gameState,
        name,
        gameType,
        moves,
        engine,
        depth,
        originState,
        whitePlayerName,
        blackPlayerName,
    } = req.body;

    if (userId) {
        const bookmark = await userService.addBookmark(
            userId,
            gameState,
            name,
            gameType,
            moves,
            engine,
            depth,
            originState,
            whitePlayerName,
            blackPlayerName,
        );
        if (!bookmark) {
            res.status(400).json({ ok: false, message: "Could not save bookmark" });
            return;
        }
        res.json(bookmark);
    }
    else {
        console.log("Bad request. No userId");
        res.send("ERROR");
    }
});

exports.updateBookmark = catchAsync(async (req, res) => {
    const userId = req.session.user_id;
    const {
        id,
        name,
        gameType,
        date,
        gameState,
        moves,
        engine,
        depth,
        originState,
        whitePlayerName,
        blackPlayerName,
    } = req.body;

    if (id) {
        await userService.updateBookmark(
            userId,
            id,
            date,
            name,
            gameType,
            gameState,
            moves,
            engine,
            depth,
            originState,
            whitePlayerName,
            blackPlayerName,
        );
        res.send("{ \"status\": \"OK\" }");
    }
    else {
        console.log("Bad request. No bookmarkId");
        res.send("ERROR");
    }
});

exports.applyBookmark = catchAsync(async (req, res) => {
    const userId = req.session.user_id;
    const { gameId, bookarkId } = req.body;

    if (userId && gameId && bookarkId) {
        await userService.applyBookmark(userId, gameId, bookarkId);
        res.send("{ \"status\": \"OK\" }");
    }
    else {
        console.log("Bad request. No userID, gameId or bookmarkId");
        res.send("ERROR");
    }
});


exports.deleteBookmark = catchAsync(async (req, res) => {
    //const userId = req.session.user_id;
    const { id } = req.body;
    // const { name, gameType, date } = req.body;

    if (id) {
        var success = await userService.deleteBookmark(id);
        if (success) {
            res.send("{ \"status\": \"OK\" }");
        }
    }
});

exports.login = catchAsync(async (req, res) => {
    const { username, password } = req.body;
    const foundUser = await userService.findUser(username, password);
    if (foundUser) {
        req.session.user_id = foundUser.id;
        req.session.user_name = foundUser.username;
        req.session.admin = foundUser.admin;
        if (foundUser.admin) {
            foundUser.userType = "Admin";
        } else if (!foundUser.userType) {
            foundUser.userType = "Member";
        }
        req.session.userType = foundUser.userType;
        foundUser.lastLogin = Date.now();
        await foundUser.save();
        const redirectUrl = res.locals.returnTo || "/Home";
        delete req.session.returnTo;
        res.locals.returnTo = null;
        return res.redirect(redirectUrl);
    }
    else {
        req.flash("messages", "Wrong username or password");
        console.log("login failed");
        res.redirect("/login");
    }
});

exports.showAdminPage = catchAsync(async (req, res) => {
    const [adminUsers, adminGames, openingBookEntryCount] = await Promise.all([
        userService.listUsersForAdmin(),
        gamesManagerService.getAllGamesForAdmin(2000),
        gamesManagerService.getOpeningBookEntryCount(),
    ]);
    res.render("admin", { adminUsers, adminGames, openingBookEntryCount });
});

exports.showGenerateStatePage = (req, res) => {
    res.render("admin-generate-state", {});
};

exports.stopGenerateState = (req, res) => {
    gamesManagerService.requestGenerateStateStop();
    res.json({ ok: true });
};

/**
 * Server-Sent Events: replay PGNs into Mongo (`mode=mongo`) or line opening book (`mode=book`).
 */
exports.generateStateStream = async (req, res) => {
    if (!gamesManagerService.tryAcquireGenerateStateLock()) {
        res.status(200);
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.write(`data: ${JSON.stringify({
            type: "error",
            message: "Another generation job is already running. Wait for it to finish or open this page in one tab only.",
        })}\n\n`);
        res.end();
        return;
    }

    gamesManagerService.resetGenerateStateStop();
    const checkAbort = () => gamesManagerService.isGenerateStateStopRequested();

    const mode = req.query.mode === "book" ? "book" : "mongo";
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
    }

    const send = (obj) => {
        res.write(`data: ${JSON.stringify(obj)}\n\n`);
    };

    try {
        send({ type: "start", mode });
        send({ type: "phase", phase: "scanning", message: "Listing PGN files…" });
        const files = mode === "book"
            ? await gamesManagerService.getOpeningBookPGNFiles()
            : await gamesManagerService.getPGNFiles();
        if (checkAbort()) {
            send({
                type: "done",
                ok: true,
                mode,
                stopped: true,
                cancelledBeforeRead: true,
                file: mode === "book" ? gamesManagerService.getOpeningBookLinesPath() : null,
            });
            return;
        }
        send({
            type: "phase",
            phase: "reading",
            message: `Reading ${files.length} PGN file(s)…`,
            fileCount: files.length,
        });
        const pgnGames = await gamesManagerService.readPGNGames(files, {
            onProgress: (e) => send({ type: "progress", segment: "reading", ...e }),
            checkAbort,
        });
        if (gamesManagerService.wasLastPgnReadInterrupted()) {
            gamesManagerService.resetGenerateStateStop();
        } else if (checkAbort()) {
            send({
                type: "done",
                ok: true,
                mode,
                stopped: true,
                cancelledAfterRead: true,
                file: mode === "book" ? gamesManagerService.getOpeningBookLinesPath() : null,
            });
            return;
        }
        send({
            type: "phase",
            phase: "replay",
            message: `Replaying ${pgnGames.length} games…`,
            totalGames: pgnGames.length,
        });
        const result = mode === "book"
            ? await gamesManagerService.regenerateOpeningBookLines(pgnGames, {
                onProgress: (e) => send({ type: "progress", segment: "replay", ...e }),
                checkAbort,
            })
            : await gamesManagerService.replayPGNGames(pgnGames, {
                saveToDB: true,
                onProgress: (e) => send({ type: "progress", segment: "replay", ...e }),
                checkAbort,
            });
        send({
            type: "done",
            ok: true,
            mode,
            stopped: !!(result && result.stopped),
            gamesCompleted: result && result.gamesCompleted != null ? result.gamesCompleted : undefined,
            entryCount: result && result.positionCount != null ? result.positionCount : undefined,
            bookUnchanged: mode === "book" && result && result.stopped && result.positionCount == null,
            file: mode === "book" ? gamesManagerService.getOpeningBookLinesPath() : null,
        });
    } catch (err) {
        console.error("[generateStateStream]", err);
        send({ type: "error", message: err.message || String(err) });
    } finally {
        gamesManagerService.resetGenerateStateStop();
        gamesManagerService.releaseGenerateStateLock();
        res.end();
    }
};

exports.updateUserAdmin = async (req, res, next) => {
    try {
        const result = await userService.updateUserByAdmin(req.params.id, req.body, {
            actorUsername: req.session.user_name || "unknown",
        });
        if (req.session.user_id && String(req.session.user_id) === String(req.params.id)) {
            if (result.username !== undefined) {req.session.user_name = result.username;}
            if (result.admin !== undefined) {req.session.admin = result.admin;}
            if (result.userType !== undefined) {req.session.userType = result.userType;}
        }
        res.json({ ok: true, user: result });
    } catch (err) {
        if (err instanceof ExpressError) {
            return res.status(err.statusCode).json({ ok: false, message: err.message });
        }
        if (err.name === "CastError") {
            return res.status(400).json({ ok: false, message: "Invalid user id" });
        }
        next(err);
    }
};

exports.showRegistrationPage = async (req, res) => {
    res.render("register");
};

exports.register = catchAsync(async (req, res) => {
    const { username, password, email, level } = req.body;
    const user = await userService.registerNewUser(username, password, email, level);
    if (!req.session.admin) {
        req.session.user_id = user._id;
        req.session.user_name = username;
        req.session.admin = user.admin;
        req.session.userType = user.userType || "Member";
    }
    else {
        req.flash("messages", "User added Successfully");
    }


    res.redirect("/home");
});