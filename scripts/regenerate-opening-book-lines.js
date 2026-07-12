#!/usr/bin/env node
/**
 * Rebuild data/opening-book-lines.txt from all PGN files under
 * src/modules/gamesManager/pgn/ and .../pgn/Opennings/.
 *
 * One line per game: first 15 half-moves (SAN tokens), space-separated.
 *
 * Usage: node scripts/regenerate-opening-book-lines.js [--max-games=N]
 */

const fs = require("fs").promises;
const path = require("path");
const gamesManagerService = require("../src/modules/gamesManager/service");
const {
    DEFAULT_MAX_LINE_PLIES,
    extractLineFromPgnGame,
    writeOpeningBookLinesFile,
} = require("../src/openingBookLines");

const PGN_ROOT = path.join(__dirname, "..", "src", "modules", "gamesManager", "pgn");
const OPENINGS_SUBDIR = path.join(PGN_ROOT, "Opennings");
const OUT_PATH = path.join(__dirname, "..", "data", "opening-book-lines.txt");

function parseMaxGamesArg() {
    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        const match = arg.match(/^--max-games=(\d+)$/);
        if (match) {
            return parseInt(match[1], 10);
        }
        if (arg === "--max-games" && process.argv[i + 1]) {
            return parseInt(process.argv[i + 1], 10);
        }
    }
    if (process.env.MAX_GAMES) {
        const n = parseInt(process.env.MAX_GAMES, 10);
        if (Number.isFinite(n) && n > 0) {
            return n;
        }
    }
    return null;
}

async function listPgnFiles(dir) {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    return dirents
        .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".pgn"))
        .map((d) => path.resolve(dir, d.name))
        .sort((a, b) => a.localeCompare(b));
}

function formatGameLabel(pgnGame, gameIndexInFile) {
    const white = pgnGame.white || "?";
    const black = pgnGame.black || "?";
    const event = pgnGame.event ? ` — ${pgnGame.event}` : "";
    return `game ${gameIndexInFile}: ${white} vs ${black}${event}`;
}

/** Log every game for small files; sample on large ones so the console stays usable. */
function shouldLogGameProgress(gameIndexInFile, gamesInFile) {
    if (gamesInFile <= 50) {
        return true;
    }
    if (gameIndexInFile === 1 || gameIndexInFile === gamesInFile) {
        return true;
    }
    return gameIndexInFile % 25 === 0;
}

async function main() {
    const maxGames = parseMaxGamesArg();
    const mainFiles = await listPgnFiles(PGN_ROOT);
    const openingFiles = await listPgnFiles(OPENINGS_SUBDIR);
    const allFiles = [...mainFiles, ...openingFiles];

    if (allFiles.length === 0) {
        console.error("No PGN files found under", PGN_ROOT);
        process.exit(1);
    }

    console.log(
        `[opening-book-lines] ${mainFiles.length} main PGN file(s), `
            + `${openingFiles.length} Opennings file(s), max ${DEFAULT_MAX_LINE_PLIES} plies/line`,
    );
    if (maxGames) {
        console.log(`[opening-book-lines] --max-games=${maxGames}`);
    }

    const lines = [];
    let gamesRead = 0;
    const gamesBudget = maxGames || Infinity;
    const fileTotal = allFiles.length;

    for (let f = 0; f < allFiles.length && gamesRead < gamesBudget; f++) {
        const filePath = allFiles[f];
        const fileName = path.basename(filePath);
        const fileNum = f + 1;

        console.log(
            `[opening-book-lines] file ${fileNum}/${fileTotal}: ${fileName} — reading...`,
        );

        const remaining = gamesBudget - gamesRead;
        const fileGames = await gamesManagerService.readPGNGames([filePath], {
            maxGames: Number.isFinite(remaining) ? remaining : undefined,
        });
        if (!fileGames.length) {
            console.log(
                `[opening-book-lines] file ${fileNum}/${fileTotal}: ${fileName} — no games, skipping`,
            );
            continue;
        }

        console.log(
            `[opening-book-lines] file ${fileNum}/${fileTotal}: ${fileName} — `
                + `processing ${fileGames.length} game(s)...`,
        );

        let fileLines = 0;
        for (let g = 0; g < fileGames.length; g++) {
            const gameNum = g + 1;
            if (shouldLogGameProgress(gameNum, fileGames.length)) {
                console.log(
                    `[opening-book-lines] file ${fileNum}/${fileTotal}: ${fileName}, `
                        + `${formatGameLabel(fileGames[g], gameNum)}/${fileGames.length}, `
                        + `overall game ${gamesRead + gameNum}, lines so far ${lines.length}`,
                );
            }

            const line = extractLineFromPgnGame(fileGames[g], DEFAULT_MAX_LINE_PLIES);
            if (line) {
                lines.push(line);
                fileLines += 1;
            }
        }

        gamesRead += fileGames.length;

        console.log(
            `[opening-book-lines] file ${fileNum}/${fileTotal}: ${fileName} — done: `
                + `${fileGames.length} game(s), ${fileLines} line(s), total ${lines.length} line(s)`,
        );
    }

    const outPath = await writeOpeningBookLinesFile(lines, OUT_PATH, {
        maxPlies: DEFAULT_MAX_LINE_PLIES,
        generatedAt: new Date().toISOString(),
    });

    console.log(`[opening-book-lines] Wrote ${lines.length} lines -> ${outPath}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
