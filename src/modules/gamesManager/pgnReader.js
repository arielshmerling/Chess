const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");
const pgnParser = {};

const RESULT_TOKENS = new Set(["1-0", "0-1", "1/2-1/2", "*"]);

/**
 * @param {string} pgnString
 * @param {{ headersOnly?: boolean }} [options]
 * @returns {object[]}
 */
pgnParser.parsePGN = function (pgnString, options) {
    const headersOnly = !!(options && options.headersOnly);
    const games = [];
    const lines = pgnString.split("\n");

    let game = {};
    game.moves = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!line) {
            continue;
        }

        if (line.startsWith("[")) {
            const tag = line.substring(1, line.indexOf("]")).replaceAll(/"/g, "");
            const tagName = tag.substring(0, tag.indexOf(" ")).toLowerCase();
            game[tagName] = tag.substring(tag.indexOf(" ") + 1);
        } else {
            const moves = line.split(" ");
            for (let j = 0; j < moves.length; j++) {
                const move = moves[j];
                if (RESULT_TOKENS.has(move)) {
                    if (!headersOnly) {
                        game.moves.push({ moveStr: move });
                        game.Id = uuidv4();
                    } else {
                        /* Search catalog: keep Result tag if missing; drop move objects. */
                        if (game.result == null) {
                            game.result = move;
                        }
                        game.moves = [];
                    }
                    games.push(game);
                    game = {};
                    game.moves = [];
                    continue;
                }
                if (headersOnly) {
                    continue;
                }
                let gameMove;
                if (move.indexOf(".") > 0) {
                    gameMove = { moveStr: move.substring(move.indexOf(".") + 1), color: "white" };
                } else {
                    gameMove = { moveStr: move, color: "black" };
                }

                if (move != "") {
                    game.moves.push(gameMove);
                }
            }
        }
    }

    return games;
};

/**
 * @param {string} filename
 * @param {{ headersOnly?: boolean }} [options]
 * @returns {Promise<object[]|undefined>}
 */
pgnParser.readFile = async function (filename, options) {
    try {
        const data = await fs.readFile(filename, "utf8");
        const pgn = pgnParser.parsePGN(data.toString(), options);
        return pgn;
    } catch (error) {
        console.log(error);
    }
};

/**
 * Load a single game (with moves) from a PGN file by 0-based index.
 * @param {string} filename
 * @param {number} gameIndex
 * @returns {Promise<object|null>}
 */
pgnParser.readGameAtIndex = async function (filename, gameIndex) {
    const games = await pgnParser.readFile(filename);
    if (!Array.isArray(games) || gameIndex < 0 || gameIndex >= games.length) {
        return null;
    }
    return games[gameIndex];
};

module.exports = pgnParser;
