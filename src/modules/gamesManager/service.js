
const pgnReader = require("./pgnReader");
const { ChessGame } = require("../../ChessGame");
const { Game, State } = require("../game/model");
const catchAsync = require("../../utils/catchAsync");

const games = [];
let pgnGames = [];

exports.GameTypes = {
    AI: 1,
    ONLINE: 2,
    PRACTICE: 3,
    REVIEW: 4,
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
 * Retrieves a list of recent games played.
 *
 * @param {string} username - The username of the user whose recent games are to be retrieved.
 * @returns {Promise<Object[]>} A promise resolving to an array of game objects, each containing information about a recent game played by the specified user.
 */
exports.getOnGoingOnlineGames = catchAsync(async (amount) => {

    let ongoing = games.filter(g => g.status == "in progress");
    ongoing = ongoing.slice(0, amount);
    return ongoing;
});

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
    return games.filter(g => g.gameId == id)[0];
};


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
            g.status == "pending")[0];
};

exports.findPendingGameCreatedByMe = (gameTypeInt, userId) => {
    return games.filter(
        g => g.createdBy.userId == userId &&
            g.constructor.name == this.gameTypeToText(gameTypeInt) &&
            g.mode != "review" &&
            g.status == "pending")[0];
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
            Result: gameDoc.state === "cancelled" ? "Cancelled" : (gameDoc.result || "-"),
            Status: gameDoc.state || "-",
            Reason: gameDoc.reason,
            Type: gameDoc.gameType,
            Moves: gameDoc.state === "cancelled" ? 0 : Math.ceil(gameDoc.moves.length / 2),
        };
    });
};


exports.getPGNFiles = catchAsync(async () => {
    const fs = require("fs").promises;
    const path = require("path");
    const dir = path.join(__dirname, "./pgn/");
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map(async (dirent) => {
        const res = path.resolve(dir, dirent.name);
        return res;
    }));
    return Array.prototype.concat(...files);
});

exports.readPGNGames = catchAsync(async (files) => {

    for (let i = 0; i < files.length; i++) {
        console.log("Adding games from:" + files[i]);
        const games = await pgnReader.readFile(files[i]);//, function (err, games) {      
        pgnGames = pgnGames.concat(games);
        console.log(`added ${games.length} games`);
        console.log(`total ${pgnGames.length} games`);

    }
    return pgnGames;
});


/**
 * Replays PGN games through ChessGame (same logic as addGamesToDB).
 * When saveToDB is true, each state is persisted; when false, no DB writes (for tests).
 * @param {Object[]} games - PGN game objects from readPGNGames
 * @param {{ saveToDB?: boolean }} [options] - saveToDB: persist State docs (default true)
 * @returns {Promise<void>}
 */
exports.replayPGNGames = catchAsync(async (games, options = {}) => {
    const saveToDB = options.saveToDB !== false;
    const totalGames = games.length;
    let gameNum = 0;
    let game;
    const movesArr = [];

    for (let gameIndex = 0; gameIndex < games.length; gameIndex++) {
        game = games[gameIndex];
        const gameNumber = gameIndex + 1;
        console.log(`Replay game ${gameNumber}/${totalGames}`);
        let gameMove = 0;
        try {
            const chess = new ChessGame();
            chess.startNewGame();

            for (const pgnMove of game.moves) {
                if (!chess.isResultMove(pgnMove)) {
                    const move = chess.convertPGNMove(pgnMove);
                    movesArr.push(move.moveStr);
                    const gameStateBeforeMove = chess.SavedGameState;
                    const actual = chess.makeMove(move.source, move.target);
                    if (actual.promotion) {
                        actual.selectedPiece = chess.letterToPiece(move.promotedTo);
                        chess.completePromotion(actual);
                    }
                    const stateDoc = new State({
                        state: gameStateBeforeMove,
                        move: JSON.stringify(actual),
                    });
                    if (saveToDB) {
                        await stateDoc.save();
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
    }

    console.log(`Replay finished. Completed ${gameNum}/${totalGames} games successfully.`);
    if (saveToDB) {
        console.log(gameNum + " games added");
    }
});

exports.addGamesToDB = catchAsync(async (games) => {
    await exports.replayPGNGames(games, { saveToDB: true });
});
