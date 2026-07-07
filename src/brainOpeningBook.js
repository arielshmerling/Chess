/**
 * Shared line-based opening book for brain42 / brain43.
 */
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

/**
 * @param {import("./ChessGame")} game
 * @param {string} logPrefix
 * @param {{ isBookMoveStillLegal: Function, bookMovePgn: Function, logOpeningBookOptions: Function }} helpers
 * @returns {object|null}
 */
function tryFindLineBookMove(game, logPrefix, helpers) {
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
    pickWeightedBookMove,
    movePrefixFromGame,
};
