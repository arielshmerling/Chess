/**
 * PGN reader parse coverage.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const pgnReader = require("../src/modules/gamesManager/pgnReader");

describe("pgnReader", function () {
    it("parses tags, numbered moves, and results", function () {
        const pgn = [
            '[Event "Test"]',
            '[White "A"]',
            '[Black "B"]',
            "",
            "1.e4 e5 2.Nf3 Nc6 1-0",
            "",
            '[Event "Draw"]',
            "1.d4 d5 1/2-1/2",
        ].join("\n");
        const games = pgnReader.parsePGN(pgn);
        assert.strictEqual(games.length, 2);
        assert.strictEqual(games[0].event, "Test");
        assert.strictEqual(games[0].white, "A");
        assert.ok(games[0].moves.some((m) => m.moveStr === "e4"));
        assert.ok(games[0].moves.some((m) => m.moveStr === "1-0"));
        assert.ok(games[1].moves.some((m) => m.moveStr === "1/2-1/2"));
    });

    it("headersOnly skips move objects but keeps tags and result", function () {
        const pgn = [
            '[Event "Test"]',
            '[White "A"]',
            '[Black "B"]',
            "1.e4 e5 2.Nf3 Nc6 1-0",
        ].join("\n");
        const games = pgnReader.parsePGN(pgn, { headersOnly: true });
        assert.strictEqual(games.length, 1);
        assert.strictEqual(games[0].event, "Test");
        assert.strictEqual(games[0].white, "A");
        assert.strictEqual(games[0].result, "1-0");
        assert.deepStrictEqual(games[0].moves, []);
        assert.strictEqual(games[0].Id, undefined);
    });

    it("readFile loads a temp pgn", async function () {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pgn-"));
        const file = path.join(dir, "sample.pgn");
        fs.writeFileSync(file, '[Event "X"]\n1.e4 e5 0-1\n');
        const games = await pgnReader.readFile(file);
        assert.ok(Array.isArray(games));
        assert.strictEqual(games.length, 1);
        assert.ok(games[0].moves.some((m) => m.moveStr === "0-1"));
    });

    it("readGameAtIndex returns one full game", async function () {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pgn-"));
        const file = path.join(dir, "two.pgn");
        fs.writeFileSync(
            file,
            '[Event "One"]\n1.e4 e5 1-0\n\n[Event "Two"]\n1.d4 d5 0-1\n',
        );
        const second = await pgnReader.readGameAtIndex(file, 1);
        assert.ok(second);
        assert.strictEqual(second.event, "Two");
        assert.ok(second.moves.some((m) => m.moveStr === "0-1"));
        const missing = await pgnReader.readGameAtIndex(file, 99);
        assert.strictEqual(missing, null);
    });
});
