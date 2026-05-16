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

function parseSinglePlayerOptions(body) {
    const color = body.color === "black" || body.color === "white" ? body.color : "white";
    const engine = runtime.normalizeEngine(body.engine);
    const difficulty = parseInt(body.difficulty, 10);
    const difficultyNum = difficulty >= 1 && difficulty <= 5 ? difficulty : 3;
    const mouse = body.mouse === "double" || body.mouse === "drag" ? body.mouse : "drag";
    const showAvailableMoves = body.showAvailableMoves !== false;
    const timeMinutesParsed = parseInt(body.timeMinutes, 10);
    const timeMinutes =
        Number.isFinite(timeMinutesParsed) && timeMinutesParsed >= 1 && timeMinutesParsed <= 180
            ? timeMinutesParsed
            : 90;
    return {
        color,
        engine,
        difficulty: difficultyNum,
        mouse,
        showAvailableMoves,
        timeMinutes,
        isPrivate: false,
    };
}

async function createSinglePlayerGame(username, userId, options, session) {
    syncDesktopPathsForSharedModules();
    if (runtime.normalizeEngine(options.engine) === "brain42") {
        require("../brain42").preloadOpeningBook();
    }
    const game = gameService.newGame(1, username, userId, options);
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
        difficulty: parseInt(req.query.difficulty, 10) || 3,
        mouse: req.query.mouse === "double" ? "double" : "drag",
        showAvailableMoves: req.query.showMoves !== "0",
        timeMinutes: parseInt(req.query.timeMinutes, 10) || 90,
        isPrivate: req.query.private === "1",
    };
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
    if (game.status === "reJoining") {
        game.status = "in progress";
        await gameStore.persistGame(game);
    }
    const payload = createGameInfo(game, req.session.user_name, req.session.user_id);
    res.send(payload);
});

exports.getGameMoves = catchAsync(async (req, res) => {
    const gameId = req.session.gameId;
    if (!gameId) {
        return res.redirect("/app/");
    }
    const movesObj = await gamesManagerService.findGameMoves(gameId);
    res.send(movesObj);
});

exports.rematch = catchAsync(async (req, res) => {
    validate(req.body, "id");
    req.session.gameId = req.body.id;
    res.send('{"status":"OK"}');
});
