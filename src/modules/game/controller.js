/**
 * This module contains functions related to managing game state.
 *
 * @module GameManagement
 */

const { validate } = require("../../serverValidations");
const gameService = require("./service");
const gamesManagerService = require("../gamesManager/service");
const { Game } = require("./model");
const { Player } = require("./Player");
const { User } = require("../user/model");
const ExpressError = require("../../utils/ExpressError");
const mongoose = require("mongoose");
const presence = require("../../utils/presence");
const catchAsync = require("../../utils/catchAsync");

function setGamePageNoCache(res) {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
}

/**
 * 
 * Handles requests related to reviewing games.
 */
exports.review = catchAsync(async (req, res) => {
    validate(req.query, "review");
    const { id } = req.query; //type [history , pgn]    
    req.session.gameId = id;

    let game = gamesManagerService.getGameById(id);
    if (game == null) {
        const gameInfo = await gamesManagerService.findReviewGame(id, req.session.user_name);
        if (!gameInfo) {
            res.redirect("login");
            return;
        }
        //console.log(gameInfo);
        game = gameService.createReviewGame(req.session.user_id, req.session.user_name, gameInfo, "review");
        gamesManagerService.AddGame(game);
    }
    else {
        game.mode = "review";
    }

    setGamePageNoCache(res);
    res.render("game", { gameId: game && game.gameId != null ? game.gameId : undefined, hideTopbar: true });
});

/**
 * Research mode: renders the game page for analysis/research (no active game yet).
 */
exports.showResearch = (req, res) => {
    req.session.gameId = null;
    setGamePageNoCache(res);
    res.render("game", {
        username: req.session.user_name,
        gameId: undefined,
        hideTopbar: true,
        researchMode: true,
    });
};

exports.watchGame = catchAsync(async (req, res) => {
    //validate(req.query, "review");
    const { id } = req.query;
    req.session.gameId = id;
    const game = gamesManagerService.getGameById(id);
    if (game != null) {
        req.session.gameId = game.gameId;
        setGamePageNoCache(res);
        res.render("game", { gameId: game.gameId, hideTopbar: true });
        return;

    }
    else {
        res.redirect("Home");
    }
});

exports.getGameInfo = catchAsync(async (req, res) => {

    const { id } = req.query;
    const gameId = id || req.session.gameId;
    validate({ id: gameId }, "id");

    const game = gamesManagerService.getGameById(gameId);
    if (game) {
        let clientDate = {};
        if (game.status == "reJoining") {
            await rejoinGame(game, req.session.user_name, req.session.user_id);
        }
        clientDate = createGameInfo(game, req.session.user_name, req.session.user_id);
        res.send(clientDate);
    }
    else {
        res.redirect("/home");
    }
});

function createGameInfo(game, userName, userId) {
    let watcher = false;
    const clientDate = {
        id: game.gameId,
        username: userName,
        userId: userId,
        creatorId: game.createdBy.userId,
        whitePlayerName: game.whitePlayer ? game.whitePlayer.userName : "",
        blackPlayerName: game.blackPlayer ? game.blackPlayer.userName : "",
        gameType: game.constructor.name,
        mode: game.mode,
        reviewType: game.reviewType,
        whiteTimer: calculateTimer(game, true),
        blackTimer: calculateTimer(game, false),
        status: game.status,
    };
    if (game.options) {
        clientDate.mousePreference = game.options.mouse || "drag";
        clientDate.difficulty = game.options.difficulty;
        clientDate.engine = game.options.engine;
        clientDate.showAvailableMoves = game.options.showAvailableMoves !== false;
    }

    if (userName != clientDate.whitePlayerName && userName != clientDate.blackPlayerName) {
        watcher = true;
    }

    const stateForBoard =
        game.lastStatus === "in progress" ||
        game.status === "in progress" ||
        game.status === "pending" ||
        game.status === "establishing" ||
        game.status === "on hold" ||
        game.status === "reJoining";
    if (stateForBoard || watcher) {
        const gameState = game.chessGame.GameState;
        clientDate.gameState = gameState;
        clientDate.watcher = watcher;
    }
    return clientDate;
}

function calculateTimer(game, isWhite) {
    if (game.startedOn) {

        if (isWhite) {
            if (game.chessGame.Turn == "white") {
                const currentTime = new Date().getTime() / 1000;
                const seconds = game.lastMoveOn / 1000;
                return game.chessGame.GameTimeLength - Math.round(currentTime - seconds);;
            }
            else {
                const lastMove = game.moves[game.moves.length - 1];
                if (lastMove) {
                    return lastMove.moveTime;
                }
                else {
                    game.GameTimeLength;
                }
            }
        }
        else {
            if (game.chessGame.Turn == "black") {
                const currentTime = new Date().getTime() / 1000;
                const seconds = game.lastMoveOn / 1000;
                return game.chessGame.GameTimeLength - Math.round(currentTime - seconds);
            }
            else {
                const lastMove = game.moves[game.moves.length - 1];
                if (lastMove) {
                    return lastMove.moveTime;
                }
                else {
                    game.GameTimeLength;
                }
            }
        }
    }
    else {
        return game.chessGame.GameTimeLength;
    }
}

async function rejoinGame(game, userName, userId) {
    // 1. notify opponent and watchers
    const isWhite = (game.whitePlayer.userId == userId);
    const message = {
        type: "info",
        info: "opponent rejoined",
        gameId: game.gameId,
        rejoinedWasWhite: Boolean(isWhite),
    };
    if (game.sendMessageToOpponent) {
        game.sendMessageToOpponent(message, isWhite);
    }
    if (game.sendInfoToWatchers) {
        game.sendInfoToWatchers(message);
    }

    // 2. update game status
    const gameDoc = await gamesManagerService.findGameInDB(game);
    game.status = "in progress";
    gameDoc.state = game.status;
    await gameDoc.save();
}


exports.getGameMoves = async (req, res) => {
    const gameId = req.session.gameId;

    if (gameId) {
        const movesObj = await gamesManagerService.findGameMoves(gameId);
        res.send(movesObj);
    }
    else {
        res.redirect("/home");
    }
};


exports.rematch = async (req, res) => {
    validate(req.body, "id");
    const { id } = req.body;
    req.session.gameId = id;
    res.send("{ \"status\": \"OK\" }");
};

function isUserInGame(game, userId) {
    if (!game) {return false;}
    if (game.whitePlayer && game.whitePlayer.userId && String(game.whitePlayer.userId) === String(userId)) {return true;}
    if (game.blackPlayer && game.blackPlayer.userId && String(game.blackPlayer.userId) === String(userId)) {return true;}
    return false;
}

exports.startGame = catchAsync(async (req, res) => {

    const username = req.session.user_name;
    const userId = req.session.user_id;

    // Open specific game by id (e.g. from active games list)
    if (req.query.id) {
        const game = gamesManagerService.getGameById(req.query.id);
        if (!game) {
            return res.redirect("/home");
        }
        if (!isUserInGame(game, userId)) {
            return res.redirect("/watch?id=" + encodeURIComponent(req.query.id));
        }
        const state = game.status || game.lastStatus;
        if (state === "cancelled" || state === "game over") {
            return res.redirect("/friends");
        }
        const playableAsParticipant = [
            "pending",
            "establishing",
            "in progress",
            "on hold",
            "reJoining",
        ].includes(state);
        if (!playableAsParticipant) {
            return res.redirect("/watch?id=" + encodeURIComponent(req.query.id));
        }
        req.session.gameId = game.gameId;
        if (game.status === "on hold") {
            game.status = "reJoining";
            registerEvents(game);
        }
        setGamePageNoCache(res);
        res.render("game", { username, gameId: game.gameId, hideTopbar: true });
        return;
    }

    validate({ gameType: req.query.gameType }, "gameType");
    const gameTypeInt = parseInt(req.query.gameType);
    /* Debug (gameType 3 / Practice) is admin-only */
    if (gameTypeInt === 3 && !req.session.admin) {
        return res.redirect("/home");
    }
    const color = (req.query.color === "black" || req.query.color === "white") ? req.query.color : "white";
    const engine = typeof req.query.engine === "string" && req.query.engine.length <= 20 ? req.query.engine : "brain4";
    const difficulty = parseInt(req.query.difficulty, 10);
    const difficultyNum = (difficulty >= 1 && difficulty <= 5) ? difficulty : 3;
    const mouse = (req.query.mouse === "double" || req.query.mouse === "drag") ? req.query.mouse : "drag";
    const showAvailableMoves = req.query.showMoves !== "0";
    req.session.newGameOptions = { color, engine, difficulty: difficultyNum, mouse, showAvailableMoves };

    // When user picks options from Play Now modal (engine in query), they want a NEW game; don't reuse existing
    const wantsNewGameWithOptions = gameTypeInt === 1 && req.query.engine !== undefined;

    let gameDoc;
    let game;

    const joinFriendGameId = req.query.joinGame != null && String(req.query.joinGame).trim() !== ""
        ? String(req.query.joinGame).trim()
        : "";
    if (joinFriendGameId && !wantsNewGameWithOptions) {
        if (gameTypeInt !== 2) {
            return res.redirect("/home");
        }
        if (!mongoose.Types.ObjectId.isValid(joinFriendGameId)) {
            return res.redirect("/home");
        }
        const friendJoinGame = gamesManagerService.getGameById(joinFriendGameId);
        const isInvitedBlackJoiner =
            friendJoinGame &&
            friendJoinGame.constructor.name === "OnlineGame" &&
            friendJoinGame.blackPlayer &&
            String(friendJoinGame.blackPlayer.userId) === String(userId) &&
            friendJoinGame.createdBy &&
            String(friendJoinGame.createdBy.userId) !== String(userId);
        const alreadyJoinedOpenStates = new Set(["establishing", "in progress", "on hold", "reJoining"]);
        if (isInvitedBlackJoiner && alreadyJoinedOpenStates.has(friendJoinGame.status)) {
            req.session.gameId = friendJoinGame.gameId;
            registerEvents(friendJoinGame);
            setGamePageNoCache(res);
            res.render("game", { username, gameId: friendJoinGame.gameId, hideTopbar: true });
            return;
        }
        if (
            friendJoinGame &&
            friendJoinGame.constructor.name === "OnlineGame" &&
            friendJoinGame.status === "pending" &&
            friendJoinGame.invitedUserId &&
            String(friendJoinGame.invitedUserId) === String(userId) &&
            String(friendJoinGame.createdBy.userId) !== String(userId)
        ) {
            await joinPendingOnlineGameAsBlack(friendJoinGame, username, userId, req, res);
            return;
        }
        return res.redirect("/home");
    }

    // Game is in progress - for example, user refresh the game page (skip if they asked for new game with options)
    if (!wantsNewGameWithOptions) {
        game = gamesManagerService.findGameByStatus(gameTypeInt, userId, "in progress");
        if (game) {
            req.session.gameId = game.gameId;
            setGamePageNoCache(res);
            res.render("game", { username, gameId: game.gameId, hideTopbar: true });
            return;
        }
    }

    // Game is in on hold - for example, user disconnected and want to rejoin the game
    if (!wantsNewGameWithOptions) {
        game = gamesManagerService.findGameByStatus(gameTypeInt, userId, "on hold");
        if (game) {
            // rejoin a game
            game.status = "reJoining";
            req.session.gameId = game.gameId;
            registerEvents(game);
            setGamePageNoCache(res);
            res.render("game", { username, gameId: game.gameId, hideTopbar: true });
            return;
        }
    }

    // pending Game created by me - a user waiting for opponent refreshed the page
    if (!wantsNewGameWithOptions) {
        game = gamesManagerService.findPendingGameCreatedByMe(gameTypeInt, userId);
        if (game) {
            req.session.gameId = game.gameId;
            registerEvents(game);
            setGamePageNoCache(res);
            res.render("game", { username, gameId: game.gameId, hideTopbar: true });
            return;
        }
    }


    // Game is pending - a game was created. waiting for opponent to join the game
    game = gamesManagerService.findPendingGame(gameTypeInt, userId);
    if (game) {
        await joinPendingOnlineGameAsBlack(game, username, userId, req, res);
        return;
    }

    // Online multiplayer: games are started via friend invite only (no random open queue).
    if (gameTypeInt === 2) {
        return res.redirect("/friends");
    }

    // create a new game (pass options for single-player: color, engine, difficulty, mouse)
    const options = req.session.newGameOptions || {};
    game = gameService.newGame(gameTypeInt, username, userId, options);
    gamesManagerService.AddGame(game);
    // Practice (gameType 3): no DB storage or status tracking; client runs locally
    if (gameTypeInt !== 3) {
        gameDoc = await gamesManagerService.storeGameInDB(game);
        game.gameId = gameDoc.id;
        registerEvents(game);
    }
    req.session.gameId = game.gameId;
    // Save last game options for single-player so they become defaults next time
    if (gameTypeInt === 1 && options.engine != null) {
        await User.findByIdAndUpdate(userId, {
            lastGameOptions: {
                color: options.color || "white",
                engine: options.engine || "brain4",
                difficulty: options.difficulty != null ? options.difficulty : 3,
                mouse: options.mouse || "drag",
                showAvailableMoves: options.showAvailableMoves !== false,
            },
        });
    }
    setGamePageNoCache(res);
    res.render("game", { username, gameId: game.gameId, hideTopbar: true });
});

const onPracticeQuitMidGame = async (e) => {
    const { game } = e;
    try {
        const gameDoc = await Game.findOne({ _id: game.gameId });
        if (gameDoc) {
            // Quit practice mid-game: leave session as still in progress, no result/reason
            gameDoc.state = "in progress";
            gameDoc.reason = null;
            gameDoc.result = null;
            await gameDoc.save();
        }
    } catch (error) {
        console.error(error);
    }
};

function registerEvents(game) {

    game.OnMove = onMoveConfirmed;
    game.OnGameStateChanged = onGameStateChanged;
    game.OnGameOver = onGameOver;
    game.OnPracticeQuitMidGame = onPracticeQuitMidGame;
    game.OnRematch = onRematch;
    game.OnBookmarkLoaded = onBookmarkLoaded;
    game.OnMoveChanged = onMoveUpdated;

}

function broadcastActiveGameToLobby(type, game, extra = {}) {
    const broadcast = gamesManagerService.getLobbyBroadcast();
    if (!broadcast) {
        return;
    }
    const name = game.constructor.name;
    if (name !== "OnlineGame" && name !== "SinglePlayerGame") {
        return;
    }
    const gameIdStr = String(game.gameId);
    const whiteName = game.whitePlayer?.userName ?? "";
    const blackName = game.blackPlayer?.userName ?? "";
    const payload = {
        type,
        data: {
            gameId: gameIdStr,
            whitePlayerName: whiteName,
            blackPlayerName: blackName,
            ...extra,
        },
    };
    broadcast(payload);
}

/**
 * Second player joins (inviter is White; joiner is Black). Persists, registers, notifies inviter — no HTML response.
 */
async function joinPendingOnlineGameAsBlackCore(game, username, userId, req) {
    game.status = "establishing";
    const blackPlayer = new Player(userId, username, false);
    const gameDoc = await gamesManagerService.findGameInDB(game);
    gameDoc.blackPlayer = username;
    gameDoc.state = "in progress";
    await gameDoc.save();
    game.joinGame(blackPlayer);
    if (game.constructor.name === "OnlineGame") {
        const startedOn = game.createOn ? new Date(game.createOn).getTime() : Date.now();
        const minutesAgo = Math.floor((Date.now() - startedOn) / 1000 / 60);
        const startedText = minutesAgo >= 1 ? minutesAgo + " minutes ago" : "Just started";
        broadcastActiveGameToLobby("onlineGameInProgress", game, {
            gameId: String(game.gameId),
            Game: (game.whitePlayer?.userName || "") + " Vs. " + (game.blackPlayer?.userName || ""),
            Started: startedText,
            Moves: Math.ceil((game.moves || []).length / 2),
            status: "in progress",
            whitePlayerName: game.whitePlayer?.userName || "",
            blackPlayerName: game.blackPlayer?.userName || "",
        });
    }
    req.session.gameId = game.gameId;
    registerEvents(game);

    const inviterId = game.createdBy && game.createdBy.userId ? String(game.createdBy.userId) : "";
    if (inviterId && game.invitedUserId) {
        presence.sendToUser(inviterId, {
            type: "friendGameInviteAccepted",
            data: { gameId: String(game.gameId) },
        });
    }
}

/**
 * Second player joins an open online multiplayer game (inviter is White; joiner is Black).
 */
async function joinPendingOnlineGameAsBlack(game, username, userId, req, res) {
    await joinPendingOnlineGameAsBlackCore(game, username, userId, req);
    setGamePageNoCache(res);
    res.render("game", { username, gameId: game.gameId, hideTopbar: true });
}

/**
 * @param {string} inviterId
 * @param {string} inviterName
 * @param {string} targetUserId
 */
async function createFriendInviteGameForUser(inviterId, inviterName, targetUserId) {
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
        throw new ExpressError("Invalid user id", 400);
    }
    if (String(inviterId) === String(targetUserId)) {
        throw new ExpressError("Cannot invite yourself", 400);
    }

    const me = await User.findById(inviterId).select("friends");
    if (!me) {
        throw new ExpressError("User not found", 404);
    }
    const targetOid = new mongoose.Types.ObjectId(targetUserId);
    const isFriend = (me.friends || []).some((id) => id.equals(targetOid));
    if (!isFriend) {
        throw new ExpressError("You can only invite friends to a game", 403);
    }

    const pendingMine = gamesManagerService.findPendingGameCreatedByMe(gamesManagerService.GameTypes.ONLINE, inviterId);
    if (pendingMine) {
        if (pendingMine.invitedUserId && String(pendingMine.invitedUserId) === String(targetUserId)) {
            return { gameId: String(pendingMine.gameId) };
        }
        throw new ExpressError("You already have a multiplayer game waiting. Finish or cancel it first.", 409);
    }

    const game = gameService.newGame(2, inviterName, inviterId, { invitedUserId: targetUserId });
    /** Must be pending before WS connects so incoming/outgoing invite lists and DB state match. */
    game.status = "pending";
    /** So HTTP /gameInfo and any client that loads before WS see a real position, not an empty board. */
    game.chessGame.startNewGame();
    gamesManagerService.AddGame(game);
    const gameDoc = await gamesManagerService.storeGameInDB(game);
    game.gameId = gameDoc.id;
    registerEvents(game);

    presence.sendToUser(targetUserId, {
        type: "friendGameInvite",
        data: {
            gameId: String(game.gameId),
            fromUserId: String(inviterId),
            fromUsername: inviterName,
        },
    });

    return { gameId: String(game.gameId) };
}

/**
 * Invitee declines a pending friend game; notifies inviter over WebSocket.
 * @param {string} gameId
 * @param {string} userId Session user (must be the invited player).
 */
async function declineFriendInviteGame(gameId, userId) {
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
        throw new ExpressError("Invalid game id", 400);
    }
    const game = gamesManagerService.getGameById(gameId);
    if (!game || game.constructor.name !== "OnlineGame") {
        throw new ExpressError("Game not found", 404);
    }
    if (game.status !== "pending") {
        throw new ExpressError("This game is no longer available", 409);
    }
    if (!game.invitedUserId || String(game.invitedUserId) !== String(userId)) {
        throw new ExpressError("Not allowed", 403);
    }

    const inviterId = game.createdBy && game.createdBy.userId ? String(game.createdBy.userId) : "";
    game.status = "cancelled";

    const gameDoc = await Game.findOne({ _id: game.gameId });
    if (gameDoc) {
        gameDoc.state = "cancelled";
        await gameDoc.save();
    }

    broadcastActiveGameToLobby("onlineGameUpdated", game, { movesCount: 0, status: "cancelled" });

    if (inviterId) {
        let declinedByUsername = "";
        try {
            const decl = await User.findById(userId).select("username").lean();
            if (decl && decl.username != null) {
                declinedByUsername = String(decl.username);
            }
        } catch {
            /* ignore */
        }
        presence.sendToUser(inviterId, {
            type: "friendGameInviteDeclined",
            data: {
                gameId: String(game.gameId),
                declinedByUsername,
            },
        });
    }
}

/**
 * Inviter cancels a pending friend game before the invitee accepts.
 * @param {string} gameId
 * @param {string} userId Session user (must be the game creator / White).
 */
async function withdrawFriendInviteGame(gameId, userId) {
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
        throw new ExpressError("Invalid game id", 400);
    }
    const game = gamesManagerService.getGameById(gameId);
    if (!game || game.constructor.name !== "OnlineGame") {
        throw new ExpressError("Game not found", 404);
    }
    if (game.status !== "pending") {
        throw new ExpressError("This game is no longer pending", 409);
    }
    if (!game.invitedUserId) {
        throw new ExpressError("Not allowed", 403);
    }
    if (String(game.createdBy.userId) !== String(userId)) {
        throw new ExpressError("Not allowed", 403);
    }

    const inviteeId = String(game.invitedUserId);
    game.status = "cancelled";

    const gameDoc = await Game.findOne({ _id: game.gameId });
    if (gameDoc) {
        gameDoc.state = "cancelled";
        await gameDoc.save();
    }

    broadcastActiveGameToLobby("onlineGameUpdated", game, { movesCount: 0, status: "cancelled" });

    presence.sendToUser(inviteeId, {
        type: "friendGameInviteWithdrawn",
        data: { gameId: String(game.gameId) },
    });
}

const onMoveConfirmed = async (e) => {
    const { game, move } = e;
    try {
        const gameDoc = await Game.findOne({ _id: game.gameId });
        if (gameDoc) {
            gameDoc.moves.push(JSON.stringify(move));
            await gameDoc.save();
        }
        const movesCount = game.moves ? Math.ceil(game.moves.length / 2) : 0;
        broadcastActiveGameToLobby("onlineGameUpdated", game, { movesCount, status: game.status });
    } catch (error) {
        console.error(error);
    }
};

const onMoveUpdated = async (e) => {
    const { game, lastMove } = e;
    try {
        const gameDoc = await Game.findOne({ _id: game.gameId });
        if (gameDoc) {
            gameDoc.moves.pop();
            gameDoc.moves.push(JSON.stringify(lastMove));
            await gameDoc.save();
        }
    } catch (error) {
        console.error(error);
    }
};


const onBookmarkLoaded = async (e) => {
    const { game, moves } = e;
    try {
        const gameDoc = await Game.findOne({ _id: game.gameId });
        if (gameDoc) {
            gameDoc.moves = moves;
            await gameDoc.save();
        }
    } catch (error) {
        console.error(error);
    }
};

const onGameStateChanged = async (e) => {

    const { game, newState } = e;
    try {
        const gameDoc = await Game.findOne({ _id: game.gameId });
        if (gameDoc) {
            gameDoc.state = newState;
            await gameDoc.save();
        }
        if (game.constructor.name === "OnlineGame" && newState === "cancelled") {
            const movesCount = game.moves ? Math.ceil(game.moves.length / 2) : 0;
            broadcastActiveGameToLobby("onlineGameUpdated", game, { movesCount, status: game.status });
        }
        if ((game.constructor.name === "OnlineGame" || game.constructor.name === "SinglePlayerGame") && newState === "in progress") {
            const startedOn = game.createOn ? new Date(game.createOn).getTime() : Date.now();
            const minutesAgo = Math.floor((Date.now() - startedOn) / 1000 / 60);
            const startedText = minutesAgo >= 1 ? minutesAgo + " minutes ago" : "Just started";
            const blackName = game.blackPlayer?.userName ?? "";
            const whiteName = game.whitePlayer?.userName ?? "";
            broadcastActiveGameToLobby("onlineGameInProgress", game, {
                Game: whiteName + " Vs. " + blackName,
                Started: startedText,
                Moves: Math.ceil((game.moves || []).length / 2),
                status: game.status,
                whitePlayerName: whiteName,
                blackPlayerName: blackName,
            });
        }
    } catch (error) {
        console.error(error);
    }
};

const onGameOver = async (e) => {

    const { game, reason } = e;
    try {
        const gameDoc = await Game.findOne({ _id: game.gameId });
        if (gameDoc) {
            gameDoc.state = game.status;
            gameDoc.reason = reason;
            if (game.status === "game over") {
                const resultStr = game.chessGame.ResultMove?.moveStr;
                if (resultStr) {
                    gameDoc.result = resultStr;
                }
            }
            await gameDoc.save();
        }
        const movesCount = game.moves ? Math.ceil(game.moves.length / 2) : 0;
        broadcastActiveGameToLobby("onlineGameUpdated", game, { movesCount, status: game.status });
    } catch (error) {
        console.error(error);
    }
};


// Main purpose: Manages the rematch process by creating a new game instance.
// Functionality:
//  - Retrieves old game details and player information from the event object (e).
//  - Creates a new game instance using the `gameService.newGame` method.
//  - Stores the new game in the database using the `gamesManagerService.storeGameInDB` method.
//  - Updates the game state by setting the new game's status to "establishing" and notifying the players.

const onRematch = async (e) => {

    //old game details:
    const { oldGame, whitePlayer, blackPlayer, initiator, cb } = e;
    oldGame.OnMove = null;
    oldGame.OnBookmarkLoaded = null;
    oldGame.OnGameStateChanged = null;
    oldGame.OnGameOver = null;
    oldGame.OnPracticeQuitMidGame = null;
    oldGame.OnRematch = null;

    const newGame = gameService.newGame(oldGame.constructor.name, initiator.userName, initiator.userId);
    gamesManagerService.AddGame(newGame);

    //for now , keep same players colors
    newGame.whitePlayer = whitePlayer;
    newGame.blackPlayer = blackPlayer;

    const gameDoc = await gamesManagerService.storeGameInDB(newGame);
    newGame.gameId = gameDoc.id;
    newGame.OnMove = onMoveConfirmed;
    newGame.OnGameStateChanged = onGameStateChanged;
    newGame.OnGameOver = onGameOver;
    newGame.OnPracticeQuitMidGame = onPracticeQuitMidGame;
    newGame.OnRematch = onRematch;

    newGame.status = "establishing";
    gameDoc.state = newGame.status;
    await gameDoc.save();
    cb(newGame);
};

exports.createFriendInviteGameForUser = createFriendInviteGameForUser;
exports.declineFriendInviteGame = declineFriendInviteGame;
exports.withdrawFriendInviteGame = withdrawFriendInviteGame;

/**
 * Invitee accepts from the banner immediately (before navigating to /game). Notifies inviter right away.
 */
exports.acceptFriendGameInvite = catchAsync(async (req, res) => {
    const userId = req.session.user_id != null ? String(req.session.user_id) : "";
    const username = req.session.user_name != null ? String(req.session.user_name) : "";
    const gameIdRaw = req.body && req.body.gameId;
    if (gameIdRaw == null || String(gameIdRaw).trim() === "") {
        throw new ExpressError("gameId is required", 400);
    }
    const gid = String(gameIdRaw).trim();
    if (!mongoose.Types.ObjectId.isValid(gid)) {
        throw new ExpressError("Invalid game id", 400);
    }
    const game = gamesManagerService.getGameById(gid);
    if (
        !game ||
        game.constructor.name !== "OnlineGame" ||
        game.status !== "pending" ||
        !game.invitedUserId ||
        String(game.invitedUserId) !== userId ||
        String(game.createdBy.userId) === userId
    ) {
        throw new ExpressError("Cannot accept this invite", 400);
    }
    if (game.blackPlayer) {
        throw new ExpressError("Game already joined", 409);
    }
    await joinPendingOnlineGameAsBlackCore(game, username, userId, req);
    res.json({ ok: true, gameId: gid });
});

/**
 * Inviter or invitee leaves via Home / UI before any move — cancel (not resign); opponent notified immediately.
 */
exports.cancelBeforeMove = catchAsync(async (req, res) => {
    const userId = String(req.session.user_id);
    const gameIdRaw = req.body && req.body.gameId;
    if (gameIdRaw == null || String(gameIdRaw).trim() === "") {
        throw new ExpressError("gameId is required", 400);
    }
    const gameId = String(gameIdRaw).trim();
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
        throw new ExpressError("Invalid game id", 400);
    }
    const game = gamesManagerService.getGameById(gameId);
    if (!game || game.constructor.name !== "OnlineGame") {
        throw new ExpressError("Game not found", 404);
    }
    if (!isUserInGame(game, userId)) {
        throw new ExpressError("Not in this game", 403);
    }
    if (game.moves.length !== 0) {
        throw new ExpressError("Cannot cancel after moves were played", 400);
    }
    if (game.status === "cancelled" || game.status === "game over") {
        return res.json({ ok: true });
    }
    const leavingIsWhite = game.whitePlayer && String(game.whitePlayer.userId) === userId;
    game.applyCancelledNoMoves("Opponent left before the first move.", !leavingIsWhite);
    res.json({ ok: true });
});