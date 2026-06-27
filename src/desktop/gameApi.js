/**
 * Desktop HTTP handlers for single-player games (no shared game controller).
 */

const { validate } = require("../serverValidations");
const catchAsync = require("../utils/catchAsync");
const gameService = require("../modules/game/service");
const gamesManagerService = require("../modules/gamesManager/service");
const runtime = require("./runtime");
const gameStore = require("./gameStore");
const { createGameInfo } = require("./gameInfo");
const { registerDesktopGameEvents } = require("./registerGameEvents");
const { syncDesktopPathsForSharedModules } = require("./syncDataPaths");
const { normalizeThinkingTimeSeconds } = require("../modules/game/brainConfigService");

function parseSinglePlayerOptions(body) {
    const color = body.color === "black" || body.color === "white" ? body.color : "white";
    const engine = runtime.normalizeEngine(body.engine);
    const thinkingTimeSeconds = normalizeThinkingTimeSeconds(
        body.thinkingTimeSeconds != null ? body.thinkingTimeSeconds : body.difficulty,
    );
    const mouse = body.mouse === "double" || body.mouse === "drag" ? body.mouse : "drag";
    const showAvailableMoves = body.showAvailableMoves !== false;
    const allowUndo = body.allowUndo === true || body.allowUndo === "1" || body.allowUndo === 1;
    const timeMinutesParsed = parseInt(body.timeMinutes, 10);
    const timeMinutes =
        Number.isFinite(timeMinutesParsed) && timeMinutesParsed >= 1 && timeMinutesParsed <= 180
            ? timeMinutesParsed
            : 90;
    return {
        color,
        engine,
        thinkingTimeSeconds,
        difficulty: thinkingTimeSeconds,
        mouse,
        showAvailableMoves,
        allowUndo,
        timeMinutes,
        isPrivate: false,
    };
}

async function createSinglePlayerGame(username, userId, options, session) {
    syncDesktopPathsForSharedModules();
    const game = gameService.newGame(1, username, userId, options);
    game.options = game.options || {};
    game.options.allowUndo = options.allowUndo === true;
    gamesManagerService.AddGame(game);
    const gameDoc = await gameStore.assignGameIdFromStore(game);
    game.gameId = gameDoc.id;
    registerDesktopGameEvents(game);
    if (session) {
        session.gameId = game.gameId;
    }
    return game;
}

exports.createGame = catchAsync(async (req, res) => {
    const options = parseSinglePlayerOptions(req.body || {});
    const game = await createSinglePlayerGame(
        req.session.user_name,
        req.session.user_id,
        options,
        req.session
    );
    res.json({ ok: true, gameId: String(game.gameId) });
});

/**
 * GET /game — create game or redirect browser to play UI.
 */
exports.startFromQuery = catchAsync(async (req, res) => {
    if (req.query.id && req.query.newGame !== "1") {
        return res.redirect(302, "/app/play?id=" + encodeURIComponent(String(req.query.id)));
    }
    if (req.query.gameType !== "1" || req.query.newGame !== "1") {
        return res.redirect(302, "/app/new-game");
    }
    validate({ gameType: req.query.gameType }, "gameType");
    const options = {
        color: req.query.color === "black" ? "black" : "white",
        engine: runtime.normalizeEngine(req.query.engine),
        thinkingTimeSeconds: normalizeThinkingTimeSeconds(
            req.query.thinkingTimeSeconds != null ? req.query.thinkingTimeSeconds : req.query.difficulty,
        ),
        mouse: req.query.mouse === "double" ? "double" : "drag",
        showAvailableMoves: req.query.showMoves !== "0",
        allowUndo: req.query.allowUndo === "1",
        timeMinutes: parseInt(req.query.timeMinutes, 10) || 90,
        isPrivate: req.query.private === "1",
    };
    options.difficulty = options.thinkingTimeSeconds;
    const game = await createSinglePlayerGame(
        req.session.user_name,
        req.session.user_id,
        options,
        req.session
    );
    res.redirect(302, "/app/play?id=" + encodeURIComponent(String(game.gameId)));
});

exports.getGameInfo = catchAsync(async (req, res) => {
    const { id } = req.query;
    const gameId = id || req.session.gameId;
    validate({ id: gameId }, "id");
    const game = gamesManagerService.getGameById(gameId);
    if (!game) {
        return res.redirect("/app/");
    }
    if (req.session) {
        req.session.gameId = gameId;
    }
    if (game.status === "reJoining") {
        game.status = "in progress";
        await gameStore.persistGame(game);
    }
    const payload = createGameInfo(game, req.session.user_name, req.session.user_id);
    res.send(payload);
});

exports.getGameMoves = catchAsync(async (req, res) => {
    const gameId = req.query.id || req.session.gameId;
    if (!gameId) {
        return res.redirect("/app/");
    }
    if (req.session) {
        req.session.gameId = gameId;
    }
    const movesObj = await gamesManagerService.findGameMoves(gameId);
    res.send(movesObj);
});

exports.rematch = catchAsync(async (req, res) => {
    validate(req.body, "id");
    req.session.gameId = req.body.id;
    res.send("{\"status\":\"OK\"}");
});

/**
 * Desktop-only: sync server SinglePlayerGame after client undo/redo (not used by web).
 */
exports.syncGameState = catchAsync(async (req, res) => {
    const gameId = req.body && req.body.gameId != null ? req.body.gameId : req.session.gameId;
    validate({ id: gameId }, "id");
    if (req.session) {
        req.session.gameId = gameId;
    }
    const game = gamesManagerService.getGameById(gameId);
    if (!game) {
        return res.status(404).json({ ok: false, message: "Game not found" });
    }
    const { state, moves, turn, humanPlaysWhite } = req.body || {};
    if (!state) {
        return res.status(400).json({ ok: false, message: "Missing state" });
    }
    game.load(state);
    if (Array.isArray(moves)) {
        game.moves = moves;
    }
    game.turn = turn || game.chessGame.Turn;
    if (typeof humanPlaysWhite === "boolean" && typeof game.setHumanPlaysWhite === "function") {
        game.setHumanPlaysWhite(humanPlaysWhite);
    }
    if (typeof game.scheduleBrainMoveIfAiTurn === "function") {
        await game.scheduleBrainMoveIfAiTurn();
    }
    await gameStore.persistGame(game);
    res.json({
        ok: true,
        state: game.chessGame.GameState,
        moves: game.moves,
        turn: game.chessGame.Turn,
    });
});
