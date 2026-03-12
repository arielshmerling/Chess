/**
 * App-level tests (quit flow, game type branching) — not ChessGame engine tests.
 * Run: npx mocha ./test/chess.app.test.js
 */
/* eslint-disable */

const assert = require("assert");
const {
    humanHasMoved,
    shouldNavigateHomeWithoutConfirm,
    getQuitConfirmText,
    getBackToHomePlan,
} = require("../src/utils/quitFlow");

describe("quitFlow / backToHome logic", () => {
    describe("humanHasMoved", () => {
        it("white player has moved when at least one move exists", () => {
            assert.strictEqual(humanHasMoved(true, 0), false);
            assert.strictEqual(humanHasMoved(true, 1), true);
            assert.strictEqual(humanHasMoved(true, 2), true);
        });
        it("black player has moved only when at least two half-moves exist", () => {
            assert.strictEqual(humanHasMoved(false, 0), false);
            assert.strictEqual(humanHasMoved(false, 1), false);
            assert.strictEqual(humanHasMoved(false, 2), true);
        });
    });

    describe("shouldNavigateHomeWithoutConfirm", () => {
        it("navigates without confirm when game is over", () => {
            assert.strictEqual(
                shouldNavigateHomeWithoutConfirm({
                    gameOver: true,
                    mode: "play",
                    currentPlayerIsWhite: true,
                    movesLength: 5,
                }),
                true
            );
        });
        it("navigates without confirm in review mode regardless of moves", () => {
            assert.strictEqual(
                shouldNavigateHomeWithoutConfirm({
                    gameOver: false,
                    mode: "review",
                    currentPlayerIsWhite: true,
                    movesLength: 0,
                }),
                true
            );
            assert.strictEqual(
                shouldNavigateHomeWithoutConfirm({
                    gameOver: false,
                    mode: "review",
                    currentPlayerIsWhite: true,
                    movesLength: 100,
                }),
                true
            );
        });
        it("navigates without confirm when human has not moved yet (cancelled game feel)", () => {
            assert.strictEqual(
                shouldNavigateHomeWithoutConfirm({
                    gameOver: false,
                    mode: "play",
                    currentPlayerIsWhite: true,
                    movesLength: 0,
                }),
                true
            );
            assert.strictEqual(
                shouldNavigateHomeWithoutConfirm({
                    gameOver: false,
                    mode: "play",
                    currentPlayerIsWhite: false,
                    movesLength: 1,
                }),
                true
            );
        });
        it("navigates without confirm when watcher (watch mode)", () => {
            assert.strictEqual(
                shouldNavigateHomeWithoutConfirm({
                    gameOver: false,
                    mode: "play",
                    watcher: true,
                    currentPlayerIsWhite: true,
                    movesLength: 10,
                }),
                true
            );
        });
        it("requires confirm when in play, not over, and human has moved", () => {
            assert.strictEqual(
                shouldNavigateHomeWithoutConfirm({
                    gameOver: false,
                    mode: "play",
                    currentPlayerIsWhite: true,
                    movesLength: 1,
                }),
                false
            );
            assert.strictEqual(
                shouldNavigateHomeWithoutConfirm({
                    gameOver: false,
                    mode: "play",
                    currentPlayerIsWhite: false,
                    movesLength: 2,
                }),
                false
            );
        });
    });

    describe("getQuitConfirmText", () => {
        it("PracticeGame uses Are you sure?", () => {
            assert.strictEqual(getQuitConfirmText("PracticeGame"), "Are you sure?");
        });
        it("OnlineGame and SinglePlayerGame use Resign?", () => {
            assert.strictEqual(getQuitConfirmText("OnlineGame"), "Resign?");
            assert.strictEqual(getQuitConfirmText("SinglePlayerGame"), "Resign?");
        });
        it("unknown types default to Resign?", () => {
            assert.strictEqual(getQuitConfirmText(undefined), "Resign?");
            assert.strictEqual(getQuitConfirmText("PracticeGameX"), "Resign?");
        });
    });

    describe("getBackToHomePlan", () => {
        it("noop when home button disabled", () => {
            const plan = getBackToHomePlan({
                homeBtnDisabled: true,
                gameOver: false,
                mode: "play",
                gameType: "OnlineGame",
                currentPlayerIsWhite: true,
                movesLength: 5,
            });
            assert.deepStrictEqual(plan, { action: "noop" });
        });
        it("navigate when watcher even with many moves (watch mode no confirm)", () => {
            const plan = getBackToHomePlan({
                homeBtnDisabled: false,
                gameOver: false,
                mode: "play",
                watcher: true,
                gameType: "OnlineGame",
                currentPlayerIsWhite: true,
                movesLength: 50,
            });
            assert.deepStrictEqual(plan, { action: "navigate" });
        });
        it("navigate when review mode (no confirm)", () => {
            const plan = getBackToHomePlan({
                homeBtnDisabled: false,
                gameOver: false,
                mode: "review",
                gameType: "OnlineGame",
                currentPlayerIsWhite: true,
                movesLength: 10,
            });
            assert.deepStrictEqual(plan, { action: "navigate" });
        });
        it("navigate when game over", () => {
            const plan = getBackToHomePlan({
                homeBtnDisabled: false,
                gameOver: true,
                mode: "play",
                gameType: "SinglePlayerGame",
                currentPlayerIsWhite: true,
                movesLength: 3,
            });
            assert.deepStrictEqual(plan, { action: "navigate" });
        });
        it("navigate when no human move (fresh game)", () => {
            const plan = getBackToHomePlan({
                homeBtnDisabled: false,
                gameOver: false,
                mode: "play",
                gameType: "PracticeGame",
                currentPlayerIsWhite: true,
                movesLength: 0,
            });
            assert.deepStrictEqual(plan, { action: "navigate" });
        });
        it("confirm with Are you sure? for PracticeGame after human moved", () => {
            const plan = getBackToHomePlan({
                homeBtnDisabled: false,
                gameOver: false,
                mode: "play",
                gameType: "PracticeGame",
                currentPlayerIsWhite: true,
                movesLength: 1,
            });
            assert.deepStrictEqual(plan, {
                action: "confirm",
                confirmText: "Are you sure?",
            });
        });
        it("confirm with Resign? for SinglePlayerGame after human moved", () => {
            const plan = getBackToHomePlan({
                homeBtnDisabled: false,
                gameOver: false,
                mode: "play",
                gameType: "SinglePlayerGame",
                currentPlayerIsWhite: true,
                movesLength: 1,
            });
            assert.deepStrictEqual(plan, {
                action: "confirm",
                confirmText: "Resign?",
            });
        });
        it("confirm with Resign? for OnlineGame after human moved", () => {
            const plan = getBackToHomePlan({
                homeBtnDisabled: false,
                gameOver: false,
                mode: "play",
                gameType: "OnlineGame",
                currentPlayerIsWhite: false,
                movesLength: 2,
            });
            assert.deepStrictEqual(plan, {
                action: "confirm",
                confirmText: "Resign?",
            });
        });
    });
});
