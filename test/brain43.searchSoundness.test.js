/**
 * Brain 4.3 search soundness.
 *
 * Covers the two search fixes:
 *  1. Alpha-beta pruning returns the *same* best move and backed-up score as an exhaustive
 *     (unpruned) minimax. This guards against the unsound pruning that used to let an inferior
 *     quiet move outrank a winning capture once alpha was raised.
 *  2. A capture's backed-up value is counted once (in the leaf evaluation), not twice. Older
 *     revisions folded the captured-piece value into the move score *and* the leaf, roughly
 *     doubling material along the principal variation.
 *
 * Run: npx mocha ./test/brain43.searchSoundness.test.js
 */
/* eslint-disable */

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const brain43 = require("../src/brain43");
const { getDefaultConfig } = require("../src/modules/game/brainConfigService");
const { endTimedSearch } = require("../src/brainSearchTime");

const H = brain43.__testHooks;
const APPROX = 1e-6;

/**
 * Position reported in the field: white to move, white king on the square diagonally adjacent to
 * an undefended black rook. Correct play is King x Rook. The board uses the internal orientation
 * (whitePlayerView:false, white starts at row 0). The white king is [7,7]; the black rook is [6,6].
 */
const KING_TAKES_ROOK_BOARD = [
    [{ color: "black", pieceType: 2 }, null, null, null, null, null, { color: "white", pieceType: 2 }, { color: "white", pieceType: 4 }],
    [{ color: "white", pieceType: 0 }, { color: "white", pieceType: 0 }, null, null, null, { color: "white", pieceType: 0 }, { color: "white", pieceType: 0 }, { color: "white", pieceType: 0 }],
    [null, null, null, null, null, null, null, null],
    [null, null, { color: "white", pieceType: 0 }, { color: "white", pieceType: 0 }, null, null, { color: "black", pieceType: 3 }, null],
    [null, null, null, null, { color: "black", pieceType: 0 }, null, null, { color: "black", pieceType: 0 }],
    [null, null, { color: "black", pieceType: 0 }, null, null, { color: "black", pieceType: 0 }, { color: "white", pieceType: 3 }, null],
    [{ color: "black", pieceType: 0 }, null, { color: "black", pieceType: 0 }, null, null, null, { color: "black", pieceType: 4 }, null],
    [{ color: "black", pieceType: 4 }, null, null, { color: "black", pieceType: 1 }, null, null, null, { color: "white", pieceType: 1 }],
];

function kingTakesRookState() {
    return {
        board: JSON.parse(JSON.stringify(KING_TAKES_ROOK_BOARD)),
        turn: "white",
        capturedPiecesList: [],
        check: false, checkmate: false, draw: false, drawReason: "", resigned: "", outOfTime: "",
        whiteKingMoved: true, blackKingMoved: false, whitePlayerView: false, fiftyMovesCounter: 1,
        gameOver: false, promoting: false,
        kingsideWhiteRookMoved: false, queensideWhiteRookMoved: false,
        kingsideBlackRookMoved: false, queensideBlackRookMoved: true,
    };
}

/**
 * Minimal position (whitePlayerView:true): white rook a1 can capture an undefended black rook a8
 * on the open a-file. Used to check that winning a rook scores about +5, not about +10.
 * row 0 = rank 8, row 7 = rank 1; column 0 = a-file.
 */
function winRookState() {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[0][0] = { color: "black", pieceType: 4 }; // rook a8
    board[3][7] = { color: "black", pieceType: 1 }; // king h5
    board[7][0] = { color: "white", pieceType: 4 }; // rook a1
    board[7][4] = { color: "white", pieceType: 1 }; // king e1
    return {
        board,
        turn: "white",
        capturedPiecesList: [],
        check: false, checkmate: false, draw: false, drawReason: "", resigned: "", outOfTime: "",
        whiteKingMoved: true, blackKingMoved: true, whitePlayerView: true, fiftyMovesCounter: 0,
        gameOver: false, promoting: false,
        kingsideWhiteRookMoved: true, queensideWhiteRookMoved: true,
        kingsideBlackRookMoved: true, queensideBlackRookMoved: true,
    };
}

function load(state) {
    const game = new ChessGame();
    game.loadGame(JSON.stringify(state));
    return game;
}

function search(state, depth) {
    const game = load(state);
    H.applyRuntimeConfigForGame(game);
    return H.searchAtFixedDepthSequential(game, depth);
}

function findMove(state, srcRow, srcCol, tgtRow, tgtCol) {
    const game = load(state);
    H.applyRuntimeConfigForGame(game);
    const moves = H.collectLegalMoves(game);
    return moves.find((m) => m.source.row === srcRow && m.source.col === srcCol
        && m.target.row === tgtRow && m.target.col === tgtCol);
}

/** All pseudo/legal moves for the side to move, flattened. */
function legalMovesOf(game) {
    let moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = game.GameState.board[r][c];
            if (!p || p.color !== game.Turn) continue;
            for (const g of game.possibleMoves(game.square(r, c))) {
                if (Array.isArray(g)) moves = moves.concat(g);
                else moves.push(g);
            }
        }
    }
    return moves;
}

/** Apply a move identified by its simple notation (e.g. "e2e4", "Qd8d5"). */
function playNotation(game, notation) {
    const move = legalMovesOf(game).find((m) => game.getSimpleNotation(m) === notation);
    if (!move) throw new Error(`move ${notation} not legal`);
    game.makeMove(move.source, move.target);
    if (move.promotion) game.completePromotion(move);
}

/**
 * Position after 1.e4 Nf6 2.d3 d5 3.exd5 Qxd5 4.c4 (black to move, whitePlayerView:true).
 * White's c4 attacks the black queen on d5; every safe queen retreat keeps material even, while
 * Qxd3 wins a pawn but hangs the queen to Bxd3 / Qxd3.
 */
function queenAttackedState() {
    const game = new ChessGame();
    game.startNewGame(true);
    for (const mv of ["e2e4", "Ng8f6", "d2d3", "d7d5", "e4d5", "Qd8d5", "c2c4"]) {
        playNotation(game, mv);
    }
    return JSON.parse(JSON.stringify(game.GameState));
}

/** Exact (full-window) negamax value of a single root move at the given depth. */
function exactRootValue(state, depth, move) {
    const game = load(state);
    H.applyRuntimeConfigForGame(game);
    const legal = H.collectLegalMoves(game);
    const target = legal.find((m) => m.source.row === move.source.row && m.source.col === move.source.col
        && m.target.row === move.target.row && m.target.col === move.target.col);
    return H.evaluateSearchMove(game, target, Math.max(0, depth - 1), -Infinity, Infinity, 1);
}

/** Highest exact value achievable over all root moves at the given depth. */
function bestExactRootValue(state, depth) {
    const game = load(state);
    H.applyRuntimeConfigForGame(game);
    const legal = H.collectLegalMoves(game);
    let best = -Infinity;
    for (const m of legal) {
        const v = H.evaluateSearchMove(game, m, Math.max(0, depth - 1), -Infinity, Infinity, 1);
        if (v > best) best = v;
    }
    return best;
}

describe("Brain 4.3 search soundness", () => {
    beforeEach(() => {
        endTimedSearch();
        H.setBrain43SearchContext(getDefaultConfig("brain43"), 39);
        H.setSearchPruningEnabled(true);
    });

    afterEach(() => {
        H.setSearchPruningEnabled(true);
    });

    after(() => {
        brain43.shutdownWorkers();
    });

    describe("alpha-beta pruning matches exhaustive minimax", () => {
        const cases = [
            { name: "king-takes-rook position", state: kingTakesRookState, depths: [2, 3] },
            { name: "win-a-rook position", state: winRookState, depths: [2, 3] },
        ];

        for (const { name, state, depths } of cases) {
            for (const depth of depths) {
                it(`${name} @ depth ${depth}: same move and score with/without pruning`, function () {
                    this.timeout(60000);

                    H.setSearchPruningEnabled(true);
                    const pruned = search(state(), depth);

                    H.setSearchPruningEnabled(false);
                    const unpruned = search(state(), depth);

                    H.setSearchPruningEnabled(true);

                    assert.ok(pruned && unpruned, "both searches return a move");
                    assert.strictEqual(pruned.source.row, unpruned.source.row);
                    assert.strictEqual(pruned.source.col, unpruned.source.col);
                    assert.strictEqual(pruned.target.row, unpruned.target.row);
                    assert.strictEqual(pruned.target.col, unpruned.target.col);
                    assert.ok(
                        Math.abs(pruned.score - unpruned.score) < APPROX,
                        `scores differ: pruned=${pruned.score} unpruned=${unpruned.score}`,
                    );
                });
            }
        }
    });

    describe("chooses the winning capture (regression for unsound pruning)", () => {
        for (const depth of [2, 3, 4]) {
            it(`king captures the undefended rook at depth ${depth}`, function () {
                this.timeout(60000);
                const pick = search(kingTakesRookState(), depth);
                assert.ok(pick, "search returns a move");
                // white king [7,7] x black rook [6,6]
                assert.strictEqual(pick.source.row, 7, "king moves from row 7");
                assert.strictEqual(pick.source.col, 7, "king moves from col 7");
                assert.strictEqual(pick.target.row, 6, "king captures on row 6");
                assert.strictEqual(pick.target.col, 6, "king captures on col 6");
            });
        }
    });

    describe("captured material is counted once (no double counting)", () => {
        it("a capture's depth-1 value equals the leaf eval of the resulting position", () => {
            const state = winRookState();
            const capture = findMove(state, 7, 0, 0, 0); // Ra1 x a8
            assert.ok(capture, "capture move exists");

            // depthRemaining = 0 -> after the move the child returns the leaf directly.
            const game = load(state);
            H.applyRuntimeConfigForGame(game);
            const searchValue = H.evaluateSearchMove(game, capture, 0, -Infinity, Infinity, 1);

            // Independently compute the mover's static eval of the resulting position.
            const after = load(state);
            after.makeMove(capture.source, capture.target);
            H.applyRuntimeConfigForGame(after);
            const leafFromOpponent = H.materialDifferenceForSideToMove(after)
                + H.positionalBonusesForSideToMove(after);
            const expectedMoverValue = -leafFromOpponent;

            assert.ok(
                Math.abs(searchValue - expectedMoverValue) < APPROX,
                `single-count expected ${expectedMoverValue}, got ${searchValue}`,
            );

            // Winning one rook is worth ~5, so the value must be far from the ~10 a double count gives.
            const capturedBonus = H.staticMoveBonus(game, capture);
            assert.ok(capturedBonus >= 5 - APPROX, `captured rook should be worth >= 5, got ${capturedBonus}`);
            const doubleCountValue = expectedMoverValue + capturedBonus;
            assert.ok(
                Math.abs(searchValue - doubleCountValue) > 4,
                `value ${searchValue} is suspiciously close to the double-counted ${doubleCountValue}`,
            );
        });

        it("winning a rook scores about +5 at depth 2, not about +10", function () {
            this.timeout(60000);
            const pick = search(winRookState(), 2);
            assert.ok(pick, "search returns a move");
            assert.strictEqual(pick.target.row, 0, "captures on rank 8");
            assert.strictEqual(pick.target.col, 0, "captures on the a-file");
            assert.ok(pick.score > 3 && pick.score < 8, `expected ~+5, got ${pick.score}`);
        });
    });

    describe("root does not merge fail-low bounds (no queen sac)", () => {
        // Queen d5 -> d3 in whitePlayerView:true coordinates (row 0 = rank 8).
        const QUEEN = { source: { row: 3, col: 3 }, target: { row: 5, col: 3 } };

        for (const depth of [2, 3, 4]) {
            it(`does not sacrifice the queen with Qxd3 at depth ${depth}`, function () {
                this.timeout(60000);
                const state = queenAttackedState();
                const pick = search(state, depth);
                assert.ok(pick, "search returns a move");

                const isQxd3 = pick.source.row === QUEEN.source.row && pick.source.col === QUEEN.source.col
                    && pick.target.row === QUEEN.target.row && pick.target.col === QUEEN.target.col;
                assert.ok(!isQxd3, `depth ${depth} chose the losing queen sac Qxd3`);

                // The picked move must actually be optimal under a full-window search, not a
                // fail-low bound that got merged and won the tie-break.
                const pickValue = exactRootValue(state, depth, pick);
                const bestValue = bestExactRootValue(state, depth);
                assert.ok(
                    Math.abs(pickValue - bestValue) < APPROX,
                    `depth ${depth} picked a non-optimal move: exact value ${pickValue}, best ${bestValue}`,
                );

                // Qxd3 really is much worse than the best (sanity check on the position).
                const qxd3Value = exactRootValue(state, depth, QUEEN);
                assert.ok(
                    qxd3Value < bestValue - 4,
                    `Qxd3 should be far worse than best (Qxd3=${qxd3Value}, best=${bestValue})`,
                );
            });
        }
    });
});
