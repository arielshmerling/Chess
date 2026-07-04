/**
 * Brain 4.2 search regression cases (horizon / iterative deepening).
 * Run: npx mocha ./test/brain42.searchRegression.test.js
 */
/* eslint-disable */

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const brain42 = require("../src/brain42");

function playSan(game, san) {
    const turn = game.Turn;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = game.GameState.board[row][col];
            if (!piece || piece.color !== turn) {
                continue;
            }
            const source = game.square(row, col);
            const options = game.possibleMoves(source);
            for (let i = 0; i < options.length; i++) {
                const move = options[i];
                game.makeMove(move.source, move.target);
                if (move.promotion && move.selectedPiece != null) {
                    game.completePromotion(move);
                }
                const notation = game.Moves[game.Moves.length - 1].moveStr;
                if (notation === san || notation.replace(/[+#]/g, "") === san.replace(/[+#]/g, "")) {
                    return;
                }
                game.undo();
            }
        }
    }
    throw new Error(`SAN not found: ${san} (turn=${turn})`);
}

function buildQe3HorizonGame() {
    const moves = [
        "e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4", "Nxd4", "Qxd4", "Nf6", "Kd2", "Ng4",
    ];
    const game = new ChessGame(true);
    game.startNewGame(false);
    for (let i = 0; i < moves.length; i++) {
        playSan(game, moves[i]);
    }
    return game;
}

function buildKingWalkGame() {
    const moves = [
        "e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4", "Nxd4", "Qxd4", "Nf6", "Kd2", "Ng4",
        "f4", "Qf6", "Qxf6", "gxf6", "Ke1", "Bb4+", "Ke2", "b6", "Kd3", "Nf2+", "Kc4", "Nxh1",
        "Be3", "a5", "Kb5", "c6+", "Kxb6", "Rb8+", "Ka7", "Rb7+", "Ka8", "d5", "Ba6", "Rc7",
        "Bb6", "Bb7+", "Bxb7", "Rxb7",
    ];
    const game = new ChessGame(true);
    game.startNewGame(false);
    for (let i = 0; i < moves.length; i++) {
        playSan(game, moves[i]);
    }
    return game;
}

function moveNotation(game, move) {
    game.makeMove(move.source, move.target);
    if (move.promotion && move.selectedPiece != null) {
        game.completePromotion(move);
    }
    return game.Moves[game.Moves.length - 1].moveStr;
}

describe("Brain 4.2 search regression", () => {
    after(() => {
        brain42.shutdownWorkers();
    });

    it("does not play Qe3 when depth 4 regresses after f4 at depth 3 (10s search)", async function () {
        this.timeout(20000);
        const game = buildQe3HorizonGame();
        const move = await brain42.brainNextMoveFunc(game, { thinkingTimeMs: 10000 });
        assert.ok(move, "expected a move");
        const trial = buildQe3HorizonGame();
        const san = moveNotation(trial, move);
        assert.ok(!san.startsWith("Qe3"), `expected not Qe3, got ${san}`);
    });

    it("prefers Kxb7 over Bg1 after ...Rxb7 (depth 4)", async function () {
        this.timeout(20000);
        const game = buildKingWalkGame();
        const move = await brain42.brainNextMoveFunc(game, { maxDepth: 4 });
        assert.ok(move, "expected a move");
        const trial = buildKingWalkGame();
        const san = moveNotation(trial, move);
        assert.ok(
            san.startsWith("Kxb7") || san === "Kxb7",
            `expected Kxb7 (free rook), got ${san}`,
        );
        assert.ok(
            Math.abs(move.score) < 50,
            `expected sane eval after quiescence fix, got score=${move.score}`,
        );
    });

    it("Kxb7 is legal and bishop cannot capture rook on b7", () => {
        const game = buildKingWalkGame();
        let kxb7 = false;
        let bishopCapturesRookOnB7 = false;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = game.GameState.board[row][col];
                if (!piece || piece.color !== game.Turn) {
                    continue;
                }
                const options = game.possibleMoves(game.square(row, col));
                for (let i = 0; i < options.length; i++) {
                    const move = options[i];
                    game.makeMove(move.source, move.target);
                    const san = game.Moves[game.Moves.length - 1].moveStr;
                    const captured = game.Moves[game.Moves.length - 1].capturedPiece;
                    game.undo();
                    if (san.startsWith("Kxb7") || san === "Kxb7") {
                        kxb7 = true;
                    }
                    if (
                        piece.pieceType === game.BISHOP
                        && captured
                        && captured.pieceType === game.ROOK
                        && san.includes("b7")
                    ) {
                        bishopCapturesRookOnB7 = true;
                    }
                }
            }
        }
        assert.strictEqual(kxb7, true, "Kxb7 should be legal");
        assert.strictEqual(bishopCapturesRookOnB7, false, "bishop cannot take rook on adjacent b7");
    });
});
