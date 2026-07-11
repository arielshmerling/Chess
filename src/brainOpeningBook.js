/**
 * Shared line-based opening book for brain42 / brain43.
 */
const { ChessGame } = require("./ChessGame");
const {
    loadOpeningBookPrefixIndex,
    movePrefixFromGame,
    candidateMovesForGame,
} = require("./openingBookLines");

/** @type {Map<string, Map<string, number>>|null} */
let prefixIndex = null;
/** @type {Promise<Map<string, Map<string, number>>>|null} */
let loadPromise = null;
let bookLineCount = 0;
let bookPrefixCount = 0;

function pickWeightedBookMove(options) {
    if (options.length === 0) {
        return null;
    }
    let total = 0;
    for (let i = 0; i < options.length; i++) {
        total += options[i].weight || 1;
    }
    let r = Math.random() * total;
    for (let i = 0; i < options.length; i++) {
        r -= options[i].weight || 1;
        if (r <= 0) {
            return options[i];
        }
    }
    return options[options.length - 1];
}

function beginOpeningBookLoad(logPrefix) {
    if (prefixIndex) {
        return Promise.resolve(prefixIndex);
    }
    if (!loadPromise) {
        loadPromise = loadOpeningBookPrefixIndex()
            .then((loaded) => {
                prefixIndex = loaded.prefixIndex;
                bookLineCount = loaded.lineCount;
                bookPrefixCount = loaded.prefixCount;
                console.log(
                    `${logPrefix} Opening book (lines): ${bookLineCount} game lines, `
                        + `${bookPrefixCount} prefixes`,
                );
                return prefixIndex;
            })
            .catch((err) => {
                console.error(`${logPrefix} Opening book load failed:`, err.message || err);
                prefixIndex = new Map();
                bookLineCount = 0;
                bookPrefixCount = 0;
                return prefixIndex;
            });
    }
    return loadPromise;
}

function preloadOpeningBook(logPrefix) {
    beginOpeningBookLoad(logPrefix);
}

function whenOpeningBookReady(logPrefix) {
    return beginOpeningBookLoad(logPrefix);
}

function boardsEqual(a, b) {
    if (!a || !b || a.length !== 8 || b.length !== 8) {
        return false;
    }
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const pa = a[row][col];
            const pb = b[row][col];
            if (pa == null && pb == null) {
                continue;
            }
            if (!pa || !pb || pa.color !== pb.color || pa.pieceType !== pb.pieceType) {
                return false;
            }
        }
    }
    return true;
}

/** @type {object[][]|null} */
let standardStartingBoards = null;

function getStandardStartingBoards() {
    if (!standardStartingBoards) {
        const upright = new ChessGame();
        upright.startNewGame(true);
        const flipped = new ChessGame();
        flipped.startNewGame(false);
        standardStartingBoards = [upright.GameState.board, flipped.GameState.board];
    }
    return standardStartingBoards;
}

function isStandardStartingPosition(game) {
    const board = game && game.GameState && game.GameState.board;
    if (!board) {
        return false;
    }
    const refs = getStandardStartingBoards();
    return boardsEqual(board, refs[0]) || boardsEqual(board, refs[1]);
}

/**
 * Line book needs SAN move history, except at the real starting position (empty move list).
 * Custom positions loaded without moves must not hit prefix "" (would play 1.e4 etc.).
 */
function shouldUseOpeningBook(game) {
    const moveCount = game && Array.isArray(game.Moves) ? game.Moves.length : 0;
    if (moveCount > 0) {
        return true;
    }
    return isStandardStartingPosition(game);
}

/**
 * @param {import("./ChessGame")} game
 * @param {string} logPrefix
 * @param {{ isBookMoveStillLegal: Function, bookMovePgn: Function, logOpeningBookOptions: Function }} helpers
 * @returns {object|null}
 */
function tryFindLineBookMove(game, logPrefix, helpers) {
    if (!shouldUseOpeningBook(game)) {
        console.log(
            `${logPrefix} Opening book skipped: no move history and not the standard start`,
        );
        return null;
    }

    const prefix = movePrefixFromGame(game);

    if (!prefixIndex) {
        console.log(
            `${logPrefix} Opening book search (book not loaded): turn=${game.Turn} prefix="${prefix}"`,
        );
        return null;
    }

    const { options } = candidateMovesForGame(game, prefixIndex);
    console.log(
        `${logPrefix} Opening book search: turn=${game.Turn}, prefixes=${bookPrefixCount}, `
            + `candidates=${options.length}, prefix="${prefix}"`,
    );

    if (options.length === 0) {
        console.log(
            `${logPrefix} Opening book miss: no line continuation for prefix (turn=${game.Turn})`,
        );
        return null;
    }

    helpers.logOpeningBookOptions(game, options);

    const legal = options.filter((m) => helpers.isBookMoveStillLegal(game, m));
    if (legal.length === 0) {
        console.warn(
            `${logPrefix} Opening book: ${options.length} stored move(s) but none legal at this position`,
        );
        return null;
    }

    const pick = pickWeightedBookMove(legal);
    console.log(
        `${logPrefix} Opening book pick: ${helpers.bookMovePgn(game, pick)}`
            + ` (weight ${pick.weight || 1}, ${legal.length} legal option(s))`,
    );
    return pick;
}

module.exports = {
    preloadOpeningBook,
    whenOpeningBookReady,
    tryFindLineBookMove,
    shouldUseOpeningBook,
    isStandardStartingPosition,
    pickWeightedBookMove,
    movePrefixFromGame,
};
