/**
 * PracticeMode + GameSession single-ply undo (Phase 6).
 */
/* eslint-disable */

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const {
    MODE_IDS,
    getModeCapabilities,
    GameSession,
    PracticeMode,
} = require("../src/session");

describe("PracticeMode", function () {
    it("exposes practice id and capabilities without engine", function () {
        const mode = PracticeMode.create();
        assert.strictEqual(mode.id, MODE_IDS.PRACTICE);
        assert.strictEqual(mode.undoPly, true);
        assert.strictEqual(mode.redoPly, true);
        const caps = mode.capabilities();
        assert.strictEqual(caps.engine, false);
        assert.strictEqual(caps.network, false);
        assert.deepStrictEqual(caps, getModeCapabilities(MODE_IDS.PRACTICE));
    });

    it("undo/redo one ply when PracticeMode is attached", function () {
        const game = new ChessGame(true);
        game.startNewGame(true);
        const session = GameSession.create({
            game: game,
            humanIsWhite: true,
            engine: null,
        });
        const mode = PracticeMode.create();
        session.attachMode(mode);
        session.load({ active: true, humanIsWhite: true });

        const e2 = { row: 6, col: 4 };
        const e4 = { row: 4, col: 4 };
        const move1 = session.applyMove(e2, e4);
        assert.ok(move1);
        session.humanMoveApplied(move1);
        assert.strictEqual(game.Moves.length, 1);

        const e7 = { row: 1, col: 4 };
        const e5 = { row: 3, col: 4 };
        const move2 = session.applyMove(e7, e5);
        assert.ok(move2);
        session.humanMoveApplied(move2);
        assert.strictEqual(game.Moves.length, 2);

        assert.strictEqual(session.undo(), true);
        assert.strictEqual(game.Moves.length, 1);
        assert.strictEqual(session.undo(), true);
        assert.strictEqual(game.Moves.length, 0);
        assert.ok(game.CanRedo);
        assert.strictEqual(game.RedoStackSize, 2);
        assert.strictEqual(session.redo(), true);
        assert.strictEqual(game.Moves.length, 1);
        assert.strictEqual(game.RedoStackSize, 1);
        assert.ok(game.CanRedo);
        assert.strictEqual(session.redo(), true);
        assert.strictEqual(game.Moves.length, 2);
        assert.strictEqual(game.RedoStackSize, 0);
        assert.strictEqual(game.CanRedo, false);
    });
});
