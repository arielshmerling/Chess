/**
 * Line-based opening book: one space-separated SAN line per game (first N plies).
 * Lookup uses the current move list as a prefix and picks a weighted continuation.
 */
const fs = require("fs").promises;
const path = require("path");
const {
    transformBookMoveToGame,
} = require("./openingBookJson");

const { ChessGame } = require("./ChessGame");

const OPENING_BOOK_LINES_BASENAME = "opening-book-lines.txt";
/** Half-moves (SAN tokens) stored per game line. */
const DEFAULT_MAX_LINE_PLIES = 15;

function resolveOpeningBookLinesPath() {
    if (process.env.SHMERLING_MODE === "desktop") {
        const runtime = require("./desktop/runtime");
        runtime.ensureInitialized();
        return runtime.resolveOpeningBookLinesPath();
    }
    return path.join(__dirname, "..", "data", OPENING_BOOK_LINES_BASENAME);
}

function normalizeSanToken(san) {
    return typeof san === "string" ? san.trim() : "";
}

function movePrefixFromSans(sans) {
    return sans.filter((s) => normalizeSanToken(s)).join(" ");
}

function movePrefixFromGame(game) {
    if (!game || !Array.isArray(game.Moves) || game.Moves.length === 0) {
        return "";
    }
    const sans = [];
    for (let i = 0; i < game.Moves.length; i++) {
        const move = game.Moves[i];
        let san = move && move.moveStr ? move.moveStr : "";
        if (!san && typeof game.getPGNMoveNotation === "function") {
            try {
                san = game.getPGNMoveNotation(move);
            } catch {
                san = "";
            }
        }
        san = normalizeSanToken(san);
        if (san) {
            sans.push(san);
        }
    }
    return movePrefixFromSans(sans);
}

/**
 * @param {string[]} lines - raw book lines (no comments)
 * @returns {{ prefixIndex: Map<string, Map<string, number>>, lineCount: number, prefixCount: number }}
 */
function buildPrefixIndex(lines) {
    const prefixIndex = new Map();
    let lineCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const tokens = lines[i].split(/\s+/).map(normalizeSanToken).filter(Boolean);
        if (tokens.length === 0) {
            continue;
        }
        lineCount += 1;
        for (let ply = 0; ply < tokens.length; ply++) {
            const prefix = movePrefixFromSans(tokens.slice(0, ply));
            const nextSan = tokens[ply];
            let bucket = prefixIndex.get(prefix);
            if (!bucket) {
                bucket = new Map();
                prefixIndex.set(prefix, bucket);
            }
            bucket.set(nextSan, (bucket.get(nextSan) || 0) + 1);
        }
    }

    return {
        prefixIndex,
        lineCount,
        prefixCount: prefixIndex.size,
    };
}

function parseOpeningBookLinesText(text) {
    const lines = [];
    const rawLines = text.split("\n");
    for (let i = 0; i < rawLines.length; i++) {
        const row = rawLines[i].trim();
        if (!row || row.startsWith("#")) {
            continue;
        }
        lines.push(row);
    }
    return lines;
}

async function loadOpeningBookLines(filePath) {
    const linesPath = filePath || resolveOpeningBookLinesPath();
    try {
        const text = await fs.readFile(linesPath, "utf8");
        return parseOpeningBookLinesText(text);
    } catch (e) {
        if (e && e.code === "ENOENT") {
            return [];
        }
        console.warn(
            `[opening book] Failed to read ${path.basename(linesPath)}:`,
            e.message || e,
        );
        return [];
    }
}

async function loadOpeningBookPrefixIndex(filePath) {
    const lines = await loadOpeningBookLines(filePath);
    const built = buildPrefixIndex(lines);
    return {
        ...built,
        linesPath: filePath || resolveOpeningBookLinesPath(),
    };
}

function sansFromPrefix(prefix) {
    if (!prefix) {
        return [];
    }
    return prefix.split(/\s+/).map(normalizeSanToken).filter(Boolean);
}

function gameNeedsBookMoveFlip(game) {
    return !!(game && game.GameState && game.GameState.whitePlayerView === false);
}

function replaySansOnUprightGame(sans) {
    const upright = new ChessGame();
    upright.startNewGame(true);
    for (let i = 0; i < sans.length; i++) {
        const san = sans[i];
        const move = upright.convertPGNMove({ moveStr: san, color: upright.Turn });
        const actual = upright.makeMove(move.source, move.target);
        if (!actual || actual.valid === false) {
            throw new Error(`opening book: illegal replay ${san} at ply ${i + 1}`);
        }
        if (actual.promotion) {
            actual.selectedPiece = upright.QUEEN;
            upright.completePromotion(actual);
        }
    }
    return upright;
}

function resolveSanOnReplayedGame(replayedGame, san) {
    const converted = replayedGame.convertPGNMove({ moveStr: san, color: replayedGame.Turn });
    if (!converted || converted.source == null || converted.target == null) {
        return null;
    }
    return {
        source: { row: converted.source.row, col: converted.source.col },
        target: { row: converted.target.row, col: converted.target.col },
        pgn: san,
    };
}

/**
 * @param {import("./ChessGame")} game
 * @param {Map<string, Map<string, number>>} prefixIndex
 * @returns {{ prefix: string, options: Array<{ pgn: string, weight: number, source: object, target: object }> }}
 */
function candidateMovesForGame(game, prefixIndex) {
    const prefix = movePrefixFromGame(game);
    const bucket = prefixIndex.get(prefix);
    if (!bucket || bucket.size === 0) {
        return { prefix, options: [] };
    }

    const prefixSans = sansFromPrefix(prefix);
    let replayed;
    try {
        replayed = replaySansOnUprightGame(prefixSans);
    } catch {
        return { prefix, options: [] };
    }

    const flipMoves = gameNeedsBookMoveFlip(game);
    const options = [];
    for (const [san, weight] of bucket.entries()) {
        const resolved = resolveSanOnReplayedGame(replayed, san);
        if (!resolved) {
            continue;
        }
        const mapped = transformBookMoveToGame(resolved, flipMoves);
        if (!mapped || mapped.source == null || mapped.target == null) {
            continue;
        }
        options.push({
            source: { row: mapped.source.row, col: mapped.source.col },
            target: { row: mapped.target.row, col: mapped.target.col },
            pgn: san,
            weight: weight || 1,
        });
    }
    return { prefix, options };
}

function extractLineFromPgnGame(pgnGame, maxPlies) {
    const chess = new ChessGame();
    chess.startNewGame();
    const sans = [];

    for (let i = 0; i < pgnGame.moves.length; i++) {
        const pgnMove = pgnGame.moves[i];
        if (chess.isResultMove(pgnMove)) {
            break;
        }
        let move;
        try {
            move = chess.convertPGNMove(pgnMove);
        } catch {
            break;
        }
        if (!move || move.source == null || move.target == null) {
            break;
        }
        const actual = chess.makeMove(move.source, move.target);
        if (!actual || actual.valid === false) {
            break;
        }
        if (actual.promotion) {
            actual.selectedPiece = chess.letterToPiece(move.promotedTo);
            chess.completePromotion(actual);
        }
        const san = normalizeSanToken(actual.moveStr || move.moveStr || pgnMove.moveStr);
        if (!san) {
            break;
        }
        sans.push(san);
        if (sans.length >= maxPlies) {
            break;
        }
    }

    return movePrefixFromSans(sans);
}

/**
 * @param {object[]} pgnGames
 * @param {{ maxPlies?: number, maxGames?: number }} [opts]
 * @returns {string[]}
 */
function buildLinesFromPgnGames(pgnGames, opts) {
    const maxPlies = opts && Number.isFinite(opts.maxPlies) ? opts.maxPlies : DEFAULT_MAX_LINE_PLIES;
    const maxGames = opts && Number.isFinite(opts.maxGames) ? opts.maxGames : pgnGames.length;
    const lines = [];

    for (let i = 0; i < pgnGames.length && i < maxGames; i++) {
        const line = extractLineFromPgnGame(pgnGames[i], maxPlies);
        if (line) {
            lines.push(line);
        }
    }
    return lines;
}

async function writeOpeningBookLinesFile(lines, outputPath, meta) {
    const outPath = outputPath || resolveOpeningBookLinesPath();
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const tempPath = `${outPath}.${process.pid}.${Date.now()}.tmp`;
    const header = [
        "# Shmerling opening book (line / prefix format)",
        `# plies-per-line: ${meta && meta.maxPlies != null ? meta.maxPlies : DEFAULT_MAX_LINE_PLIES}`,
        `# generated-at: ${meta && meta.generatedAt ? meta.generatedAt : new Date().toISOString()}`,
        `# game-lines: ${lines.length}`,
        "",
    ].join("\n");
    await fs.writeFile(tempPath, `${header}${lines.join("\n")}\n`, "utf8");
    await fs.rename(tempPath, outPath);
    return outPath;
}

module.exports = {
    OPENING_BOOK_LINES_BASENAME,
    DEFAULT_MAX_LINE_PLIES,
    resolveOpeningBookLinesPath,
    movePrefixFromGame,
    buildPrefixIndex,
    parseOpeningBookLinesText,
    loadOpeningBookLines,
    loadOpeningBookPrefixIndex,
    candidateMovesForGame,
    extractLineFromPgnGame,
    buildLinesFromPgnGames,
    writeOpeningBookLinesFile,
};
