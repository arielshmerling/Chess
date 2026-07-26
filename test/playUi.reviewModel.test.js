const assert = require("assert");

const ReviewModel = require("../src/play-ui/review-model");
const MovesPanel = require("../src/play-ui/moves-panel");

describe("play-ui review model", function () {
    describe("cloneMove / cloneMoves", function () {
        it("parses JSON string moves and shallow-copies objects", function () {
            const original = { moveStr: "e4", turn: "white" };
            const fromObject = ReviewModel.cloneMove(original);
            const fromString = ReviewModel.cloneMove(JSON.stringify(original));

            assert.deepStrictEqual(fromObject, original);
            assert.notStrictEqual(fromObject, original);
            assert.deepStrictEqual(fromString, original);
        });

        it("clones a list of moves", function () {
            const moves = ReviewModel.cloneMoves([
                JSON.stringify({ moveStr: "e4" }),
                { moveStr: "e5" },
            ]);
            assert.deepStrictEqual(moves, [{ moveStr: "e4" }, { moveStr: "e5" }]);
        });
    });

    describe("clampPly", function () {
        it("clamps into [0, moveCount]", function () {
            assert.strictEqual(ReviewModel.clampPly(-1, 3), 0);
            assert.strictEqual(ReviewModel.clampPly(2, 3), 2);
            assert.strictEqual(ReviewModel.clampPly(9, 3), 3);
            assert.strictEqual(ReviewModel.clampPly("x", 3), 0);
        });
    });

    describe("resignedColorFromState", function () {
        it("reads a resigned side from a state string", function () {
            assert.strictEqual(
                ReviewModel.resignedColorFromState('{"resigned":"White"}'),
                "white",
            );
            assert.strictEqual(ReviewModel.resignedColorFromState("{}"), null);
            assert.strictEqual(ReviewModel.resignedColorFromState("{oops"), null);
        });
    });

    describe("originTurn / nextTurnAfterPly", function () {
        it("defaults the origin turn to white", function () {
            assert.strictEqual(ReviewModel.originTurn("{}"), "white");
            assert.strictEqual(
                ReviewModel.originTurn('{"turn":"black"}'),
                "black",
            );
        });

        it("flips after a coloured move", function () {
            const moves = [
                { moveStr: "e4", turn: "white" },
                { moveStr: "e5", turn: "black" },
            ];
            assert.strictEqual(
                ReviewModel.nextTurnAfterPly({
                    moves: moves,
                    ply: 0,
                    moveColor: MovesPanel.moveColor,
                }),
                "white",
            );
            assert.strictEqual(
                ReviewModel.nextTurnAfterPly({
                    moves: moves,
                    ply: 1,
                    moveColor: MovesPanel.moveColor,
                }),
                "black",
            );
            assert.strictEqual(
                ReviewModel.nextTurnAfterPly({
                    moves: moves,
                    ply: 2,
                    moveColor: MovesPanel.moveColor,
                }),
                "white",
            );
        });

        it("falls back to alternating when colours are unknown", function () {
            const moves = [{ moveStr: "e4" }, { moveStr: "e5" }];
            assert.strictEqual(
                ReviewModel.nextTurnAfterPly({
                    moves: moves,
                    ply: 1,
                    originStateStr: '{"turn":"black"}',
                }),
                "white",
            );
        });
    });

    describe("chessMoveCount", function () {
        it("skips result moves when a predicate is supplied", function () {
            const moves = [
                { moveStr: "e4" },
                { moveStr: "1-0" },
            ];
            assert.strictEqual(ReviewModel.chessMoveCount(moves), 2);
            assert.strictEqual(
                ReviewModel.chessMoveCount(moves, function (m) {
                    return m.moveStr === "1-0";
                }),
                1,
            );
        });
    });

    describe("selectedPly", function () {
        it("only returns a ply while branching in review", function () {
            assert.strictEqual(
                ReviewModel.selectedPly({
                    reviewMode: true,
                    branchPly: 2,
                    plyIndex: 2,
                }),
                2,
            );
            assert.strictEqual(
                ReviewModel.selectedPly({
                    reviewMode: true,
                    branchPly: null,
                    plyIndex: 2,
                }),
                null,
            );
            assert.strictEqual(
                ReviewModel.selectedPly({
                    reviewMode: false,
                    branchPly: 2,
                    plyIndex: 2,
                }),
                null,
            );
        });
    });

    describe("navButtonState", function () {
        it("disables start/back at the first ply", function () {
            const state = ReviewModel.navButtonState({
                plyIndex: 0,
                moveCount: 4,
                playing: false,
            });
            assert.strictEqual(state.start, false);
            assert.strictEqual(state.back, false);
            assert.strictEqual(state.forward, true);
            assert.strictEqual(state.end, true);
            assert.strictEqual(state.playPause, true);
        });

        it("disables forward/end at the last ply", function () {
            const state = ReviewModel.navButtonState({
                plyIndex: 4,
                moveCount: 4,
                playing: false,
            });
            assert.strictEqual(state.forward, false);
            assert.strictEqual(state.end, false);
            assert.strictEqual(state.playPause, false);
            assert.strictEqual(state.start, true);
        });

        it("disables navigation while playing", function () {
            const state = ReviewModel.navButtonState({
                plyIndex: 2,
                moveCount: 4,
                playing: true,
            });
            assert.strictEqual(state.start, false);
            assert.strictEqual(state.back, false);
            assert.strictEqual(state.forward, false);
            assert.strictEqual(state.end, false);
            assert.strictEqual(state.playPause, true);
        });
    });
});
