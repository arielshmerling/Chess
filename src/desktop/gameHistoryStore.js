/**
 * Append completed desktop games to a PGN log in userData.
 */

const fs = require("fs").promises;
const path = require("path");
const runtime = require("./runtime");

const GAMES_LOG_FILE = "played-games.pgn";

function getGamesLogPath() {
    runtime.ensureInitialized();
    return path.join(runtime.getUserDataRoot(), GAMES_LOG_FILE);
}

function formatPgnDate(date) {
    const d = date instanceof Date ? date : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
}

function escapeTagValue(value) {
    return String(value == null ? "" : value)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');
}

function formatTag(name, value) {
    return `[${name} "${escapeTagValue(value)}"]`;
}

function moveColor(move) {
    if (!move) {
        return null;
    }
    if (move.turn === "white" || move.turn === "black") {
        return move.turn;
    }
    if (move.piece && (move.piece.color === "white" || move.piece.color === "black")) {
        return move.piece.color;
    }
    return null;
}

/**
 * @param {{ moveStr?: string, turn?: string, piece?: { color?: string } }[]} moves
 */
function formatPgnMoveText(moves) {
    if (!Array.isArray(moves) || moves.length === 0) {
        return "";
    }

    const parts = [];
    let moveNumber = 1;

    for (let i = 0; i < moves.length; ) {
        const current = moves[i];
        const currentColor = moveColor(current);
        const currentStr = current.moveStr || "";

        if (currentColor === "black") {
            parts.push(`${moveNumber}...${currentStr}`);
            i += 1;
            moveNumber += 1;
            continue;
        }

        const next = i + 1 < moves.length ? moves[i + 1] : null;
        if (next && moveColor(next) === "black") {
            parts.push(`${moveNumber}.${currentStr} ${next.moveStr || ""}`);
            i += 2;
        } else {
            parts.push(`${moveNumber}.${currentStr}`);
            i += 1;
        }
        moveNumber += 1;
    }

    return parts.join(" ");
}

/**
 * @param {{
 *   whitePlayer?: string,
 *   blackPlayer?: string,
 *   result?: string,
 *   moves?: { moveStr?: string, turn?: string, piece?: { color?: string } }[],
 *   engine?: string,
 *   thinkingTimeSeconds?: number,
 *   date?: string,
 *   termination?: string,
 * }} record
 */
function buildPgnRecord(record) {
    const {
        whitePlayer = "White",
        blackPlayer = "Black",
        result = "*",
        moves = [],
        engine,
        thinkingTimeSeconds,
        date,
        termination,
    } = record || {};

    const headers = [
        formatTag("Event", "Shmerling Chess"),
        formatTag("Site", "Desktop"),
        formatTag("Date", date || formatPgnDate()),
        formatTag("Round", "?"),
        formatTag("White", whitePlayer),
        formatTag("Black", blackPlayer),
        formatTag("Result", result),
        formatTag("WhiteElo", ""),
        formatTag("BlackElo", ""),
        formatTag("ECO", ""),
    ];

    if (engine) {
        headers.push(formatTag("Engine", engine));
    }
    if (thinkingTimeSeconds != null) {
        headers.push(formatTag("ThinkingTime", `${thinkingTimeSeconds}s`));
    }
    if (termination) {
        headers.push(formatTag("Termination", termination));
    }

    const moveText = formatPgnMoveText(moves);
    const resultToken = result || "*";
    const body = moveText ? `${moveText} ${resultToken}` : resultToken;
    return `${headers.join("\n")}\n\n${body}\n\n`;
}

/**
 * @param {Parameters<typeof buildPgnRecord>[0]} record
 */
async function appendCompletedGame(record) {
    runtime.ensureInitialized();
    const pgn = buildPgnRecord(record);
    const filePath = getGamesLogPath();
    await fs.appendFile(filePath, pgn, "utf8");
    return filePath;
}

module.exports = {
    GAMES_LOG_FILE,
    getGamesLogPath,
    buildPgnRecord,
    formatPgnMoveText,
    appendCompletedGame,
};
