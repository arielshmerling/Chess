const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
    buildPgnRecord,
    formatPgnMoveText,
    appendCompletedGame,
    getGamesLogPath,
    GAMES_LOG_FILE,
} = require("../src/desktop/gameHistoryStore");
const {
    createDesktopTestRuntime,
    destroyDesktopTestRuntime,
} = require("./helpers/desktopRuntime");

describe("gameHistoryStore", function () {
    describe("formatting", function () {
        it("formats move text like standard PGN", function () {
            const text = formatPgnMoveText([
                { moveStr: "e4", turn: "white" },
                { moveStr: "c5", turn: "black" },
                { moveStr: "Nf3", turn: "white" },
                { moveStr: "d6", turn: "black" },
            ]);
            assert.strictEqual(text, "1.e4 c5 2.Nf3 d6");
        });

        it("formats a lone black move when white is missing from the list", function () {
            const text = formatPgnMoveText([{ moveStr: "e5", turn: "black" }]);
            assert.strictEqual(text, "1...e5");
        });

        it("builds a PGN record with headers and result", function () {
            const pgn = buildPgnRecord({
                whitePlayer: "Player",
                blackPlayer: "Brain 4.2",
                result: "1-0",
                date: "2026.06.27",
                engine: "brain42",
                thinkingTimeSeconds: 10,
                moves: [
                    { moveStr: "e4", turn: "white" },
                    { moveStr: "e5", turn: "black" },
                ],
                termination: "Checkmate. white won.",
            });

            assert.match(pgn, /\[White "Player"\]/);
            assert.match(pgn, /\[Black "Brain 4\.2"\]/);
            assert.match(pgn, /\[Result "1-0"\]/);
            assert.match(pgn, /\[Engine "brain42"\]/);
            assert.match(pgn, /\[ThinkingTime "10s"\]/);
            assert.match(pgn, /1\.e4 e5 1-0/);
        });

        it("escapes quotes in PGN tag values", function () {
            const pgn = buildPgnRecord({
                whitePlayer: 'A "quoted" name',
                blackPlayer: "Brain",
                result: "1/2-1/2",
                moves: [],
            });
            assert.match(pgn, /\[White "A \\\"quoted\\\" name"\]/);
        });
    });

    describe("appendCompletedGame", function () {
        let tempDir;

        beforeEach(function () {
            const ctx = createDesktopTestRuntime();
            tempDir = ctx.tempDir;
        });

        afterEach(function () {
            destroyDesktopTestRuntime(tempDir);
            tempDir = null;
        });

        it("appends completed games to played-games.pgn in userData", async function () {
            const filePath = getGamesLogPath();
            assert.strictEqual(path.basename(filePath), GAMES_LOG_FILE);
            assert.strictEqual(path.dirname(filePath), tempDir);

            await appendCompletedGame({
                whitePlayer: "Alice",
                blackPlayer: "Engine",
                result: "1-0",
                date: "2026.06.28",
                engine: "brain42",
                thinkingTimeSeconds: 10,
                moves: [
                    { moveStr: "d4", turn: "white" },
                    { moveStr: "d5", turn: "black" },
                ],
                termination: "Checkmate",
            });

            const raw = await fs.promises.readFile(filePath, "utf8");
            assert.match(raw, /\[White "Alice"\]/);
            assert.match(raw, /1\.d4 d5 1-0/);

            await appendCompletedGame({
                whitePlayer: "Bob",
                blackPlayer: "Engine",
                result: "0-1",
                moves: [{ moveStr: "e4", turn: "white" }],
            });

            const raw2 = await fs.promises.readFile(filePath, "utf8");
            assert.match(raw2, /\[White "Bob"\]/);
            assert.ok(raw2.indexOf('[White "Alice"]') < raw2.indexOf('[White "Bob"]'));
        });
    });
});
