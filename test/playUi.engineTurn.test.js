const assert = require("assert");

const EngineTurn = require("../src/play-ui/engine-turn");

describe("play-ui engine turn policy", function () {
    describe("isSearchAbortedError", function () {
        it("recognizes abort by name or message", function () {
            assert.ok(EngineTurn.isSearchAbortedError({ name: "SearchAbortedError" }));
            assert.ok(EngineTurn.isSearchAbortedError({ message: "Search aborted" }));
            assert.ok(!EngineTurn.isSearchAbortedError({ message: "timeout" }));
            assert.ok(!EngineTurn.isSearchAbortedError(null));
        });
    });

    describe("isEngineSessionBusyError", function () {
        it("recognizes concurrency busy-key by code or message", function () {
            assert.ok(
                EngineTurn.isEngineSessionBusyError({ code: "CONCURRENCY_BUSY_KEY" }),
            );
            assert.ok(
                EngineTurn.isEngineSessionBusyError({
                    message: "An engine search is already running for your session.",
                }),
            );
            assert.ok(
                !EngineTurn.isEngineSessionBusyError({
                    code: "CONCURRENCY_BUSY_GLOBAL",
                    message: "The engine is busy. Try again in a moment.",
                }),
            );
            assert.ok(!EngineTurn.isEngineSessionBusyError({ message: "boom" }));
            assert.ok(!EngineTurn.isEngineSessionBusyError(null));
        });
    });

    describe("canStartTurn", function () {
        it("requires game, session, engine, and an AI turn", function () {
            assert.ok(
                EngineTurn.canStartTurn({
                    hasGame: true,
                    hasSession: true,
                    hasEngine: true,
                    aiTurn: true,
                }),
            );
            assert.ok(
                !EngineTurn.canStartTurn({
                    hasGame: true,
                    hasSession: true,
                    hasEngine: true,
                    aiTurn: false,
                }),
            );
        });

        it("blocks setup, config, animation, thinking, and dialogs", function () {
            const base = {
                hasGame: true,
                hasSession: true,
                hasEngine: true,
                aiTurn: true,
            };
            assert.ok(!EngineTurn.canStartTurn(Object.assign({}, base, { positionSetup: true })));
            assert.ok(!EngineTurn.canStartTurn(Object.assign({}, base, { configuration: true })));
            assert.ok(!EngineTurn.canStartTurn(Object.assign({}, base, { animating: true })));
            assert.ok(!EngineTurn.canStartTurn(Object.assign({}, base, { engineThinking: true })));
            assert.ok(!EngineTurn.canStartTurn(Object.assign({}, base, { dialogOn: true })));
            assert.ok(!EngineTurn.canStartTurn(Object.assign({}, base, { gameOver: true })));
        });
    });

    describe("buildComputeArgs", function () {
        it("prefers thinkingTimeSeconds over difficulty", function () {
            const args = EngineTurn.buildComputeArgs({
                gameState: { turn: "black" },
                moves: [{ moveStr: "e4" }],
                engine: "brain43",
                thinkingTimeSeconds: 4,
                difficulty: 2,
                pliesPlayed: 1,
                immediateResign: true,
            });
            assert.strictEqual(args.thinkingTimeSeconds, 4);
            assert.strictEqual(args.pliesPlayed, 1);
            assert.strictEqual(args.immediateResign, true);
            assert.strictEqual(args.engine, "brain43");
        });

        it("falls back to difficulty when thinking time is missing", function () {
            const args = EngineTurn.buildComputeArgs({
                gameState: {},
                difficulty: 3,
            });
            assert.strictEqual(args.thinkingTimeSeconds, 3);
            assert.strictEqual(args.immediateResign, false);
            assert.deepStrictEqual(args.moves, []);
        });
    });

    describe("decideAfterCompute", function () {
        it("noops when the game ended or the search was aborted", function () {
            assert.strictEqual(
                EngineTurn.decideAfterCompute({ source: {} }, { gameOver: true }).action,
                "noop",
            );
            assert.strictEqual(
                EngineTurn.decideAfterCompute({ searchAborted: true }, {}).action,
                "noop",
            );
        });

        it("resigns on forced loss when immediate resign is on", function () {
            const decision = EngineTurn.decideAfterCompute(
                { opponentMateDetected: true, opponentMateIn: 2 },
                { immediateResign: true },
            );
            assert.strictEqual(decision.action, "resign");
            assert.strictEqual(decision.mateNote, " (mate in 2)");
        });

        it("still applies a move on forced loss when immediate resign is off", function () {
            const decision = EngineTurn.decideAfterCompute(
                {
                    opponentMateDetected: true,
                    source: { row: 1, col: 0 },
                    target: { row: 0, col: 0 },
                    score: 1.5,
                },
                { immediateResign: false, defaultPromotionPiece: 5 },
            );
            assert.strictEqual(decision.action, "apply");
            assert.ok(decision.logScore);
            assert.ok(decision.mateNote !== undefined);
        });

        it("errors when there is no move", function () {
            const decision = EngineTurn.decideAfterCompute(null, {});
            assert.strictEqual(decision.action, "error");
        });

        it("fills a default promotion piece when needed", function () {
            const decision = EngineTurn.decideAfterCompute(
                { promotion: true, source: {}, target: {} },
                { defaultPromotionPiece: 9 },
            );
            assert.strictEqual(decision.action, "apply");
            assert.strictEqual(decision.move.selectedPiece, 9);
        });
    });

    describe("resignStatusMessage", function () {
        it("uses player names when provided", function () {
            assert.strictEqual(
                EngineTurn.resignStatusMessage("white", { white: "Alice", black: "Bob" }),
                "Game over. Alice resign.",
            );
            assert.strictEqual(
                EngineTurn.resignStatusMessage("Black", { white: "Alice", black: "Bob" }),
                "Game over. Bob resign.",
            );
        });

        it("falls back to White/Black", function () {
            assert.strictEqual(EngineTurn.resignStatusMessage("white"), "Game over. White resign.");
        });
    });
});
