const fs = require("fs").promises;
const path = require("path");
const pgnReader = require("./pgnReader");
const { ChessGame } = require("../../ChessGame");
const { Game, State } = require("../game/model");
const catchAsync = require("../../utils/catchAsync");
const {
    OPENING_BOOK_LINES_BASENAME,
    DEFAULT_MAX_LINE_PLIES,
    loadOpeningBookLines,
    extractLineFromPgnGame,
    writeOpeningBookLinesFile,
} = require("../../openingBookLines");

function getOpeningBookLinesPath() {
    return path.join(__dirname, "..", "..", "..", "data", OPENING_BOOK_LINES_BASENAME);
}

exports.getOpeningBookLinesPath = getOpeningBookLinesPath;
exports.OPENING_BOOK_LINES_BASENAME = OPENING_BOOK_LINES_BASENAME;

/**
 * @returns {Promise<number>}
 */
exports.getOpeningBookEntryCount = async () => {
    const lines = await loadOpeningBookLines(getOpeningBookLinesPath());
    return lines.length;
};

/** Not yet finished (same set used for stale cleanup and “active” counts). */
const NON_TERMINAL_GAME_STATES = ["new", "pending", "establishing", "on hold", "in progress"];

const games = [];
let pgnGames = [];
let lobbyBroadcast = null;

exports.setLobbyBroadcast = (fn) => {
    lobbyBroadcast = fn;
};

exports.getLobbyBroadcast = () => lobbyBroadcast;

exports.GameTypes = {
    AI: 1,
    ONLINE: 2,
    PRACTICE: 3,
    REVIEW: 4,
    RESEARCH: 5,
};

/**
 * Stores a game document in the database.
 *
 * @param {Object} game - The game object to be saved, containing information such as game type, status, and player names.
 * @returns {Promise<Object>} - DB gameDoc. A promise resolving to the saved game document in the database, which includes properties such as `id`, `createdAt`, `updatedAt`.
 */
exports.storeGameInDB = catchAsync(async (game) => {

    const gameDoc = new Game({
        createBy: game.createdBy.userName,
        createByUserId: game.createdBy.userId,
        state: game.status,
        gameType: game.constructor.name,
        whitePlayer: game.whitePlayer ? game.whitePlayer.userName : "",
        blackPlayer: game.blackPlayer ? game.blackPlayer.userName : "",
        isPrivate: game.isPrivate === true,
    });

    await gameDoc.save();
    return gameDoc;
});


/**
 * Retrieves a game document from the database by its unique ID, including additional information such as the user who created it.
 *
 * @param {string} gameId - The unique ID of the game to be retrieved, which corresponds to the `gameId` property in the Game model.
 * @returns {Promise<Object>} A promise resolving to the retrieved game document in the database.
 */
exports.findGameInDB = catchAsync(async (game) => {
    if (game) {
        const gameDoc = await Game.findById(game.gameId);
        return gameDoc;
    }
    return null;
});

/**
 * Retrieves a list of recent games played by a specific user.
 *
 * @param {string} username - The username of the user whose recent games are to be retrieved.
 * @returns {Promise<Object[]>} A promise resolving to an array of game objects, each containing information about a recent game played by the specified user.
 */
exports.getRecentGamesByUsername = catchAsync(async (username, amount) => {

    const gameDocs = await Game.find(
        {
            $or:
                [{ blackPlayer: username },
                { whitePlayer: username }]
        })
        .sort({ _id: -1 })
        .limit(amount);
    const playerGames = this.parseGames(gameDocs);
    return playerGames;
});

/**
 * All persisted games (admin). Same shape as list page via parseGames.
 * @param {number} amount - max rows (capped at 2000)
 */
exports.getAllGamesForAdmin = catchAsync(async (amount) => {
    const limit = Math.min(Math.max(Number(amount) || 1000, 1), 2000);
    const gameDocs = await Game.find({})
        .sort({ _id: -1 })
        .limit(limit);
    return exports.parseGames(gameDocs);
});

/**
 * Retrieves recent games by username that finished with state "game over" only.
 * Used for "My Games" on home page; for all statuses use getRecentGamesByUsername (e.g. list page).
 */
exports.getRecentFinishedGamesByUsername = catchAsync(async (username, amount) => {
    const gameDocs = await Game.find({
        $or: [
            { blackPlayer: username },
            { whitePlayer: username },
        ],
        state: "game over",
    })
        .sort({ _id: -1 })
        .limit(amount);
    return this.parseGames(gameDocs);
});


/**
 * Retrieves ongoing online games for the home page. Reads from the database so the list
 * stays in sync when games are added/removed in the DB (e.g. after clearing all games).
 * Includes: in-progress games, and "on hold" games only from the last hour.
 *
 * @param {number} amount - Maximum number of games to return.
 * @param {{ publicOnly?: boolean }} [options] - When publicOnly is not false, exclude private games (missing isPrivate counts as public).
 * @returns {Promise<Object[]>} Array of game objects with gameId, whitePlayer, blackPlayer, startedOn, moves.
 */
exports.getOnGoingOnlineGames = catchAsync(async (amount, options = {}) => {
    const publicOnly = options.publicOnly !== false;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const stateOr = {
        $or: [
            { state: "in progress" },
            { state: "on hold", created: { $gte: oneHourAgo } },
        ],
    };
    const query = publicOnly ? { $and: [stateOr, { isPrivate: { $ne: true } }] } : stateOr;
    const gameDocs = await Game.find(query)
        .sort({ created: -1 })
        .limit(amount)
        .lean();
    return gameDocs.map((doc) => ({
        gameId: doc._id.toString(),
        state: doc.state || "in progress",
        whitePlayer: { userName: doc.whitePlayer || "" },
        blackPlayer: { userName: doc.blackPlayer || "" },
        startedOn: doc.created ? new Date(doc.created).getTime() : null,
        moves: doc.moves || [],
    }));
});

/**
 * Parse a move stored on a Game document (string or object).
 * @param {unknown} raw
 * @returns {object|null}
 */
function parseStoredMove(raw) {
    if (raw == null) {
        return null;
    }
    if (typeof raw === "object") {
        return raw;
    }
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Replay persisted online moves onto a ChessGame and return board + turn for previews.
 * Prefers the in-memory OnlineGame when present (fresher than DB between writes).
 * @param {string} gameId
 * @param {unknown[]} dbMoves
 * @returns {{ board: unknown[][], turn: string } | null}
 */
exports.getActiveGameBoardSnapshot = (gameId, dbMoves) => {
    try {
        const live = exports.getGameById(gameId);
        if (live && live.chessGame) {
            const gs = live.chessGame.GameState;
            if (gs && gs.board) {
                return { board: gs.board, turn: gs.turn || "white" };
            }
        }
        return exports.replayStoredMovesToBoardState(dbMoves);
    } catch (err) {
        console.error(`[getActiveGameBoardSnapshot] Error for game ${gameId} — returning null:`, err.message);
        return null;
    }
};

/**
 * @param {unknown[]} movesRaw
 * @returns {{ board: unknown[][], turn: string } | null}
 */
exports.replayStoredMovesToBoardState = (movesRaw) => {
    try {
        const { ChessGame } = require("../../ChessGame");
        const chess = new ChessGame(true);
        chess.startNewGame(true);
        const moves = (movesRaw || []).map(parseStoredMove).filter(Boolean);
        for (const m of moves) {
            if (!m.source || !m.target) {
                continue;
            }
            if (chess.isResultMove(m)) {
                break;
            }
            try {
                // Validate before making the move — catches corrupted/empty-square moves
                // without triggering the async #performMove error path in ChessGame.
                const validation = chess.validateMove(m.source, m.target, chess.Turn);
                if (!validation || !validation.valid) {
                    break;
                }
                const actual = chess.makeMove(m.source, m.target);
                if (!actual) {
                    break;
                }
                if (actual.promotion) {
                    if (m.selectedPiece != null) {
                        actual.selectedPiece = m.selectedPiece;
                        chess.completePromotion(actual);
                    } else {
                        break;
                    }
                }
            } catch {
                break;
            }
            if (chess.GameOver) {
                break;
            }
        }
        const gs = chess.GameState;
        if (!gs || !gs.board) {
            return null;
        }
        return { board: gs.board, turn: gs.turn || "white" };
    } catch (err) {
        console.error("[replayStoredMovesToBoardState] Unexpected error — skipping game snapshot:", err.message);
        return null;
    }
};

/**
 * Retrieves recent games that finished with state "game over" from the database.
 * Excludes in progress, on hold, new, pending, etc.
 *
 * @param {number} amount - Maximum number of games to return.
 * @returns {Promise<Object[]>} Array of game objects with gameId, whitePlayer, blackPlayer, moves, created.
 */
exports.getFinishedGames = catchAsync(async (amount) => {
    const gameDocs = await Game.find({ state: "game over" })
        .sort({ created: -1 })
        .limit(amount)
        .lean();
    return gameDocs.map((doc) => ({
        gameId: doc._id.toString(),
        whitePlayer: { userName: doc.whitePlayer || "" },
        blackPlayer: { userName: doc.blackPlayer || "" },
        moves: doc.moves || [],
        created: doc.created,
    }));
});

/**
 * Counts persisted games per username where the game is still non-terminal (in progress, on hold, etc.).
 * @returns {Promise<Map<string, number>>} Map of username → number of active games
 */
exports.countActiveGamesPerUsername = async () => {
    const [byWhite, byBlack] = await Promise.all([
        Game.aggregate([
            { $match: { state: { $in: NON_TERMINAL_GAME_STATES }, whitePlayer: { $nin: [null, ""] } } },
            { $group: { _id: "$whitePlayer", n: { $sum: 1 } } },
        ]),
        Game.aggregate([
            { $match: { state: { $in: NON_TERMINAL_GAME_STATES }, blackPlayer: { $nin: [null, ""] } } },
            { $group: { _id: "$blackPlayer", n: { $sum: 1 } } },
        ]),
    ]);
    const counts = new Map();
    for (const row of byWhite) {
        counts.set(row._id, (counts.get(row._id) || 0) + row.n);
    }
    for (const row of byBlack) {
        counts.set(row._id, (counts.get(row._id) || 0) + row.n);
    }
    return counts;
};

/**
 * Updates stored player names when an account username changes (games reference usernames as strings).
 */
exports.renameUsernameInGames = async (oldUsername, newUsername) => {
    if (!oldUsername || !newUsername || oldUsername === newUsername) {return;}
    await Promise.all([
        Game.updateMany({ whitePlayer: oldUsername }, { $set: { whitePlayer: newUsername } }),
        Game.updateMany({ blackPlayer: oldUsername }, { $set: { blackPlayer: newUsername } }),
        Game.updateMany({ createBy: oldUsername }, { $set: { createBy: newUsername } }),
    ]);
};

/**
 * Retrieves an array of games in PGN (Portable Game Notation) format.
 *
 * @returns {Promise<Object[]>} A promise resolving to an array of game objects, each containing information about a game played according to PGN notation rules.
 */
exports.getPGNGames = catchAsync(async () => {
    if (pgnGames.length == 0) {
        const files = await this.getPGNFiles();
        pgnGames = await this.readPGNGames(files);
    }
    return pgnGames;
});


/**
 * Retrieves a game object by its unique ID.
 *
 * @param {string} id - The unique ID of the game to be retrieved.
 * @returns {Object|null} A single game object if found, or null if no matching record is found.
 */
exports.getGameById = (id) => {
    if (id == null) {return undefined;}
    const idStr = String(id);
    return games.filter(g => String(g.gameId) === idStr)[0];
};

/**
 * In-memory online game where both players are seated (white + black), non-terminal.
 * @param {string} userIdA
 * @param {string} userIdB
 * @returns {string|null} gameId
 */
exports.findSharedOnlineGameIdBetweenUsers = (userIdA, userIdB) => {
    const a = String(userIdA);
    const b = String(userIdB);
    for (const g of games) {
        if (!g || g.constructor.name !== "OnlineGame" || g.mode === "review") {
            continue;
        }
        const st = g.status;
        if (st === "game over" || st === "cancelled") {
            continue;
        }
        const wid = g.whitePlayer && g.whitePlayer.userId != null ? String(g.whitePlayer.userId) : "";
        const bid = g.blackPlayer && g.blackPlayer.userId != null ? String(g.blackPlayer.userId) : "";
        if (!wid || !bid) {
            continue;
        }
        if ((wid === a && bid === b) || (wid === b && bid === a)) {
            return String(g.gameId);
        }
    }
    return null;
};

/**
 * DB fallback when in-memory list is empty (e.g. after restart): ongoing OnlineGame with both usernames.
 */
exports.findSharedOnlineGameIdByUsernames = catchAsync(async (usernameA, usernameB) => {
    const ua = String(usernameA || "").trim();
    const ub = String(usernameB || "").trim();
    if (!ua || !ub) {
        return null;
    }
    const doc = await Game.findOne({
        state: { $in: NON_TERMINAL_GAME_STATES },
        gameType: "OnlineGame",
        whitePlayer: { $nin: [null, ""] },
        blackPlayer: { $nin: [null, ""] },
        $or: [
            { whitePlayer: ua, blackPlayer: ub },
            { whitePlayer: ub, blackPlayer: ua },
        ],
    })
        .select("_id")
        .lean();
    return doc && doc._id ? doc._id.toString() : null;
});


/**
 * Finds and returns information about a specific review game, either by its unique ID in the database or by PGN notation.
 *
 * @param {string|object} id - The unique ID of the game to be retrieved (optional) or an object containing 'Id' and 'userId' properties for a PGN game.
 *   If providing an ID, it is expected to match the format `^[0-9a-fA-F]{24}$` for a hexadecimal string representation of a MongoDB ID.
 * @param {string} userName - The username of the user who is supposed to be playing (optional).
 *
 * @returns {Object} An object containing properties such as:
 *   - `id`: the unique ID of the game
 *   - `whitePlayer`: the name of the white player
 *   - `blackPlayer`: the name of the black player
 *   - `gameType`: the type of game (e.g. "OnlineGame")
 *   - `reviewType`: the type of review being performed ("history" or "pgn")
 *   - `moves`: an array of moves in the game
 *   - `whitePlayerView`: a boolean indicating whether the user is playing white
 *
 * @throws {Error} If no matching record is found in the database for the provided ID.
 */
exports.findReviewGame = catchAsync(async (id, userName) => {
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
        const gameDoc = await Game.findOne({ _id: id });
        const gameInfo = {
            id,
            whitePlayer: gameDoc.whitePlayer,
            blackPlayer: gameDoc.blackPlayer,
            gameType: gameDoc.gameType,
            reviewType: "history",
            moves: gameDoc.moves.map(g => JSON.parse(g)),
            whitePlayerView: (userName == gameDoc.whitePlayer),
        };
        return gameInfo;
    }
    else {
        const pgnGame = pgnGames.filter(g => g.Id == id)[0];
        if (pgnGame) {
            const gameInfo = {
                id,
                whitePlayer: pgnGame.white,
                blackPlayer: pgnGame.black,
                gameType: "OnlineGame",
                reviewType: "pgn",
                moves: pgnGame.moves,
                whitePlayerView: true,
                /* Event Site Date Round Result WhiteElo BlackElo ECO */
            };
            return gameInfo;
        }
    }
});


exports.deleteGame = catchAsync(async (id) => {
    await Game.findByIdAndDelete(id);
});

/**
 * Cleans up games created more than 24 hours ago that are still in non-terminal states.
 * - Games that already have moves: set state to "cancelled" (preserve history).
 * - Games with no moves: delete (never really started).
 * Runs at server startup.
 */
exports.deleteStaleNonTerminalGames = catchAsync(async () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleFilter = {
        state: { $in: NON_TERMINAL_GAME_STATES },
        created: { $lt: twentyFourHoursAgo },
    };

    const updateResult = await Game.updateMany(
        {
            ...staleFilter,
            $expr: { $gt: [{ $size: { $ifNull: ["$moves", []] } }, 0] },
        },
        { $set: { state: "cancelled" } }
    );
    const deleteResult = await Game.deleteMany({
        ...staleFilter,
        $or: [
            { moves: { $exists: false } },
            { moves: { $size: 0 } },
        ],
    });

    if (updateResult.modifiedCount > 0 || deleteResult.deletedCount > 0) {
        console.log(
            "Database cleanup: cancelled " + updateResult.modifiedCount + " game(s) with moves, deleted " +
            deleteResult.deletedCount + " game(s) without moves."
        );
    }
});

exports.AddGame = (serverGame) => {
    if (serverGame) {
        games.push(serverGame);
    }
};

exports.findGameMoves = async (gameID) => {
    const gameInfo = games.filter(g =>
        g.gameId == gameID)[0];

    if (gameInfo) {

        return { moves: gameInfo.moves, type: gameInfo.reviewType };
    }
    else {
        return await this.findReviewGame(gameID);
    }
};


exports.findPendingGame = (gameTypeInt, userId) => {
    return games.filter(
        g => g.createdBy.userId != userId &&
            g.constructor.name == this.gameTypeToText(gameTypeInt) &&
            g.status == "pending" &&
            (g.invitedUserId == null || String(g.invitedUserId) === String(userId)))[0];
};

exports.findPendingGameCreatedByMe = (gameTypeInt, userId) => {
    return games.filter(
        g => g.createdBy.userId == userId &&
            g.constructor.name == this.gameTypeToText(gameTypeInt) &&
            g.mode != "review" &&
            (g.status == "pending" || (g.status == "new" && g.invitedUserId)))[0];
};

/**
 * Friend game invites sent to this user (pending OnlineGame with invitedUserId set).
 * @param {string} userId
 * @returns {object[]}
 */
exports.findPendingIncomingFriendGameInvites = (userId) => {
    if (userId == null || userId === "") {
        return [];
    }
    const uid = String(userId);
    return games.filter((g) => {
        if (g.constructor.name !== "OnlineGame" || !g.invitedUserId) {
            return false;
        }
        if (String(g.invitedUserId) !== uid) {
            return false;
        }
        const st = g.status;
        return st === "pending" || st === "new";
    });
};

exports.findGameByStatus = (gameTypeInt, userId, status) => {
    return games.filter(
        g => (userInGame(g, userId)) &&
            g.constructor.name == this.gameTypeToText(gameTypeInt) &&
            g.mode != "review" &&
            g.status == status)[0];
};


function userInGame(game, userId) {
    if (game) {
        if (game.whitePlayer) {
            if (game.whitePlayer.userId == userId) { return true; }
        }
        if (game.blackPlayer) {
            if (game.blackPlayer.userId == userId) { return true; }
        }
    }
    return false;

}


exports.gameTypeToText = (gameTypeInt) => {
    switch (gameTypeInt) {
        case this.GameTypes.AI:
            return "SinglePlayerGame";
        case this.GameTypes.ONLINE:
            return "OnlineGame";
        case this.GameTypes.PRACTICE:
            return "PracticeGame";
        //   case this.GameTypes.REVIEW:
        //         return "REVIEW";
        default:
            throw new Error("Unknown game type");

    }
};


/** PGN-style result for DB → compact display in game lists (1-0, 0-1, ½-½). */
function formatGameListResult(result, state) {
    if (state === "cancelled") {
        return "Cancelled";
    }
    const r = result && String(result).trim();
    if (!r) {
        return "-";
    }
    if (r === "1/2-1/2") {
        return "½-½";
    }
    return r;
}

exports.parseGames = (gameDocs) => {

    return gameDocs.map(function (gameDoc) {

        const created = gameDoc.created ? new Date(gameDoc.created).getTime() : 0;
        return {
            Id: gameDoc._id,
            Date: new Date(gameDoc.created).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
            }),
            Time: new Date(gameDoc.created).toLocaleTimeString("en-US"),
            _sortableDate: created,
            White: gameDoc.whitePlayer,
            Black: gameDoc.blackPlayer,
            Result: formatGameListResult(gameDoc.result, gameDoc.state),
            Status: gameDoc.state || "-",
            Reason: gameDoc.reason,
            Type: gameDoc.gameType,
            Moves: gameDoc.state === "cancelled" ? 0 : Math.ceil(gameDoc.moves.length / 2),
        };
    });
};


async function listPgnFilesInDirectory(dir) {
    const fs = require("fs").promises;
    const path = require("path");
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    return dirents
        .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".pgn"))
        .map((d) => path.resolve(dir, d.name))
        .sort((a, b) => a.localeCompare(b));
}

/**
 * PGN files shown in web Search / optional DB import.
 * Top-level `pgn/*.pgn` only — not `pgn/Opennings/` (opening-book source material).
 */
exports.getPGNFiles = catchAsync(async () => {
    const path = require("path");
    const rootDir = path.join(__dirname, "./pgn/");
    const files = await listPgnFilesInDirectory(rootDir);
    return files.sort((a, b) => a.localeCompare(b));
});

/**
 * PGN files used only to rebuild the opening book (includes `pgn/Opennings/`).
 */
exports.getOpeningBookPGNFiles = catchAsync(async () => {
    const path = require("path");
    const rootDir = path.join(__dirname, "./pgn/");
    const openingsDir = path.join(rootDir, "Opennings");
    const files = await listPgnFilesInDirectory(rootDir);
    try {
        const openingFiles = await listPgnFilesInDirectory(openingsDir);
        files.push(...openingFiles);
    } catch (e) {
        if (!e || e.code !== "ENOENT") {
            throw e;
        }
    }
    return files.sort((a, b) => a.localeCompare(b));
});

exports.readPGNGames = catchAsync(async (files, readOptions = {}) => {
    const onProgress = typeof readOptions.onProgress === "function" ? readOptions.onProgress : null;
    const checkAbort = typeof readOptions.checkAbort === "function" ? readOptions.checkAbort : null;
    lastPgnReadInterrupted = false;
    let fileList = files.slice().filter((filePath) => /\.pgn$/i.test(path.basename(filePath)));
    if (fileList.length === 0) {
        console.warn("[PGN] No .pgn files in file list");
        pgnGames = [];
        return pgnGames;
    }
    if (readOptions.firstFileOnly && fileList.length > 1) {
        fileList = fileList.sort().slice(0, 1);
        console.log(`[PGN] firstFileOnly: using ${path.basename(fileList[0])} only`);
    }
    const fileTotal = fileList.length;
    let local = [];
    for (let i = 0; i < fileTotal; i++) {
        if (checkAbort && checkAbort()) {
            lastPgnReadInterrupted = true;
            break;
        }
        console.log("Adding games from:" + fileList[i]);
        const games = await pgnReader.readFile(fileList[i]);
        local = local.concat(games);
        if (typeof readOptions.maxGames === "number" && readOptions.maxGames > 0 && local.length >= readOptions.maxGames) {
            local = local.slice(0, readOptions.maxGames);
            console.log(`[PGN] maxGames=${readOptions.maxGames}: stopping after ${local.length} games`);
            if (onProgress) {
                onProgress({ phase: "reading", fileIndex: i + 1, fileTotal, gamesLoaded: local.length });
            }
            break;
        }
        console.log(`added ${games.length} games`);
        console.log(`total ${local.length} games`);
        if (onProgress) {
            onProgress({ phase: "reading", fileIndex: i + 1, fileTotal, gamesLoaded: local.length });
        }
    }
    pgnGames = local;
    return pgnGames;
});


/** @type {boolean} */
let generateStateStopRequested = false;

exports.requestGenerateStateStop = () => {
    generateStateStopRequested = true;
};

exports.resetGenerateStateStop = () => {
    generateStateStopRequested = false;
};

exports.isGenerateStateStopRequested = () => generateStateStopRequested;

/** @type {boolean} */
let lastPgnReadInterrupted = false;

exports.wasLastPgnReadInterrupted = () => lastPgnReadInterrupted;

/** @type {boolean} */
let generateStateJobLocked = false;

exports.tryAcquireGenerateStateLock = () => {
    if (generateStateJobLocked) {
        return false;
    }
    generateStateJobLocked = true;
    return true;
};

exports.releaseGenerateStateLock = () => {
    generateStateJobLocked = false;
};

/**
 * Replays PGN games through ChessGame (same logic as addGamesToDB).
 * When saveToDB is true, each state is persisted; when false, no DB writes (for tests).
 * When saveToDB is true, each state is persisted; when false, no DB writes (for tests).
 * @param {Object[]} games - PGN game objects from readPGNGames
 * @param {{ saveToDB?: boolean, maxGames?: number, maxMovesPerGame?: number, onProgress?: (e: object) => void, checkAbort?: () => boolean }} [options]
 * @returns {Promise<{ gamesCompleted: number, stopped?: boolean }|void>}
 */
exports.replayPGNGames = catchAsync(async (games, options = {}) => {
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
    const checkAbort = typeof options.checkAbort === "function" ? options.checkAbort : null;
    const maxGames = options.maxGames;
    const maxMovesPerGame = options.maxMovesPerGame;
    let gamesToReplay = games;
    if (typeof maxGames === "number" && maxGames > 0 && games.length > maxGames) {
        gamesToReplay = games.slice(0, maxGames);
        console.log(`[replayPGNGames] maxGames=${maxGames}: replaying first ${maxGames} of ${games.length} games`);
    }
    if (typeof maxMovesPerGame === "number" && maxMovesPerGame > 0) {
        console.log(`[replayPGNGames] maxMovesPerGame=${maxMovesPerGame}: first ${maxMovesPerGame} half-moves per game`);
    }
    const saveToDB = options.saveToDB === true;
    const totalGames = gamesToReplay.length;
    let gameNum = 0;
    let game;
    const movesArr = [];
    let replayStoppedByUser = false;

    if (onProgress) {
        onProgress({ phase: "replaying", current: 0, total: totalGames, gamesCompleted: 0 });
    }

    replayLoop: for (let gameIndex = 0; gameIndex < gamesToReplay.length; gameIndex++) {
        if (checkAbort && checkAbort()) {
            replayStoppedByUser = true;
            break replayLoop;
        }
        game = gamesToReplay[gameIndex];
        const gameNumber = gameIndex + 1;
        console.log(`Replay game ${gameNumber}/${totalGames}`);
        let gameMove = 0;
        let pliesPlayed = 0;
        movesArr.length = 0;
        try {
            const chess = new ChessGame();
            chess.startNewGame();

            for (const pgnMove of game.moves) {
                if (checkAbort && checkAbort()) {
                    replayStoppedByUser = true;
                    break replayLoop;
                }
                if (!chess.isResultMove(pgnMove)) {
                    const move = chess.convertPGNMove(pgnMove);
                    movesArr.push(move.moveStr);
                    const gameStateBeforeMove = chess.SavedGameState;
                    const actual = chess.makeMove(move.source, move.target);
                    if (actual.promotion) {
                        actual.selectedPiece = chess.letterToPiece(move.promotedTo);
                        chess.completePromotion(actual);
                    }
                    const moveStr = JSON.stringify(actual);
                    if (saveToDB) {
                        const stateDoc = new State({
                            state: gameStateBeforeMove,
                            move: moveStr,
                        });
                        await stateDoc.save();
                    }
                    pliesPlayed += 1;
                    if (typeof maxMovesPerGame === "number" && maxMovesPerGame > 0 && pliesPlayed >= maxMovesPerGame) {
                        break;
                    }
                }

                gameMove++;

                if (chess.GameOver) {
                    break;
                }
            }
            gameNum++;
        }
        catch (e) {
            console.log(`Failed on game:${gameNum}( ${game.eco},${game.event}, ${game.site}, ${game.round}, ${game.date}) move: ${gameMove}. ${e.stack}`);
            console.log(movesArr.join(" "));
        }
        if (onProgress) {
            onProgress({
                phase: "replaying",
                current: gameIndex + 1,
                total: totalGames,
                gamesCompleted: gameNum,
            });
        }
    }

    if (replayStoppedByUser) {
        console.log(`Replay stopped by user after ${gameNum}/${totalGames} games completed ok (partial).`);
    } else {
        console.log(`Replay finished. Completed ${gameNum}/${totalGames} games successfully.`);
    }
    if (saveToDB) {
        console.log(gameNum + " games added");
    }
    return { gamesCompleted: gameNum, stopped: replayStoppedByUser };
});

exports.addGamesToDB = catchAsync(async (games) => {
    await exports.replayPGNGames(games, { saveToDB: true });
});

/**
 * Rebuild the line-based opening book from PGN games (one SAN line per game).
 * @param {Object[]} games
 * @param {{ maxGames?: number, maxMovesPerGame?: number, onProgress?: (e: object) => void, checkAbort?: () => boolean }} [options]
 */
exports.regenerateOpeningBookLines = catchAsync(async (games, options = {}) => {
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
    const checkAbort = typeof options.checkAbort === "function" ? options.checkAbort : null;
    const maxPlies = typeof options.maxMovesPerGame === "number" && options.maxMovesPerGame > 0
        ? options.maxMovesPerGame
        : DEFAULT_MAX_LINE_PLIES;
    let gamesToProcess = games;
    if (typeof options.maxGames === "number" && options.maxGames > 0 && games.length > options.maxGames) {
        gamesToProcess = games.slice(0, options.maxGames);
    }

    const totalGames = gamesToProcess.length;
    const lines = [];
    let stopped = false;

    if (onProgress) {
        onProgress({ phase: "replaying", current: 0, total: totalGames, gamesCompleted: 0 });
    }

    for (let i = 0; i < gamesToProcess.length; i++) {
        if (checkAbort && checkAbort()) {
            stopped = true;
            break;
        }
        const line = extractLineFromPgnGame(gamesToProcess[i], maxPlies);
        if (line) {
            lines.push(line);
        }
        if (onProgress) {
            onProgress({
                phase: "replaying",
                current: i + 1,
                total: totalGames,
                gamesCompleted: lines.length,
            });
        }
    }

    const shouldWrite = !stopped || lines.length > 0;
    let lineCount = null;
    if (shouldWrite) {
        if (onProgress) {
            onProgress({
                phase: "writing",
                current: totalGames,
                total: totalGames,
                gamesCompleted: lines.length,
                message: "Writing opening book lines…",
            });
        }
        const outPath = getOpeningBookLinesPath();
        await writeOpeningBookLinesFile(lines, outPath, {
            maxPlies,
            generatedAt: new Date().toISOString(),
        });
        lineCount = lines.length;
        console.log(`Opening book lines written: ${outPath} (${lineCount} game lines${stopped ? ", stopped early" : ""})`);
    } else {
        console.log("[regenerateOpeningBookLines] Stopped before any lines; existing book unchanged.");
    }

    return {
        gamesCompleted: lines.length,
        positionCount: shouldWrite ? lineCount : undefined,
        stopped,
    };
});

/**
 * @param {Object[]} games
 * @param {{ maxGames?: number, maxMovesPerGame?: number }} [options]
 */
exports.addGamesToOpeningBook = catchAsync(async (games, options = {}) => {
    return await exports.regenerateOpeningBookLines(games, options);
});
