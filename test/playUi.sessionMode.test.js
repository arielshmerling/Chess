const assert = require("assert");

const SessionMode = require("../src/play-ui/session-mode");

describe("play-ui session mode", function () {
    describe("sessionTypeLabel", function () {
        it("prefers setup over config over review over play", function () {
            assert.strictEqual(
                SessionMode.sessionTypeLabel({ positionSetup: true, configuration: true }),
                "Position Setup",
            );
            assert.strictEqual(
                SessionMode.sessionTypeLabel({ configuration: true, review: true }),
                "Configuration mode",
            );
            assert.strictEqual(
                SessionMode.sessionTypeLabel({ reviewPlayback: true, review: true }),
                "Playback Mode",
            );
            assert.strictEqual(SessionMode.sessionTypeLabel({ review: true }), "Review Mode");
            assert.strictEqual(SessionMode.sessionTypeLabel({ watch: true }), "Watch Mode");
            assert.strictEqual(SessionMode.sessionTypeLabel({ practice: true }), "Practice Mode");
            assert.strictEqual(SessionMode.sessionTypeLabel({}), "Play Mode");
        });
    });

    describe("shouldShowGameRun", function () {
        it("shows during position setup", function () {
            assert.strictEqual(SessionMode.shouldShowGameRun({ positionSetup: true }), true);
        });

        it("shows for an idle loaded game with pieces", function () {
            assert.strictEqual(
                SessionMode.shouldShowGameRun({
                    gameActive: false,
                    hasLoadedSavedGame: true,
                    boardHasPieces: true,
                }),
                true,
            );
        });

        it("hides during an active game", function () {
            assert.strictEqual(
                SessionMode.shouldShowGameRun({
                    gameActive: true,
                    hasLoadedSavedGame: true,
                    boardHasPieces: true,
                }),
                false,
            );
        });
    });

    describe("canUsePositionSetup", function () {
        it("requires advanced tools and a game", function () {
            assert.strictEqual(
                SessionMode.canUsePositionSetup({
                    canPlayAdvancedTools: false,
                    hasGame: true,
                    moveCount: 0,
                }),
                false,
            );
            assert.strictEqual(
                SessionMode.canUsePositionSetup({
                    canPlayAdvancedTools: true,
                    hasGame: false,
                    moveCount: 0,
                }),
                false,
            );
        });

        it("allows game-over or zero-move positions", function () {
            assert.strictEqual(
                SessionMode.canUsePositionSetup({
                    canPlayAdvancedTools: true,
                    hasGame: true,
                    gameOver: true,
                    moveCount: 12,
                }),
                true,
            );
            assert.strictEqual(
                SessionMode.canUsePositionSetup({
                    canPlayAdvancedTools: true,
                    hasGame: true,
                    moveCount: 0,
                }),
                true,
            );
            assert.strictEqual(
                SessionMode.canUsePositionSetup({
                    canPlayAdvancedTools: true,
                    hasGame: true,
                    moveCount: 2,
                }),
                false,
            );
        });
    });

    describe("canUseBrainConfig", function () {
        it("blocks during setup or an active game", function () {
            assert.strictEqual(
                SessionMode.canUseBrainConfig({
                    canPlayAdvancedTools: true,
                    positionSetup: true,
                    gameActive: false,
                }),
                false,
            );
            assert.strictEqual(
                SessionMode.canUseBrainConfig({
                    canPlayAdvancedTools: true,
                    positionSetup: false,
                    gameActive: true,
                }),
                false,
            );
            assert.strictEqual(
                SessionMode.canUseBrainConfig({
                    canPlayAdvancedTools: true,
                    positionSetup: false,
                    gameActive: false,
                }),
                true,
            );
        });
    });

    describe("exclusiveDockModes", function () {
        it("clears the other dock when entering one", function () {
            assert.deepStrictEqual(
                SessionMode.exclusiveDockModes("positionSetup", {
                    positionSetup: false,
                    configuration: true,
                }),
                { positionSetup: true, configuration: false },
            );
            assert.deepStrictEqual(
                SessionMode.exclusiveDockModes("configuration", {
                    positionSetup: true,
                    configuration: false,
                }),
                { positionSetup: false, configuration: true },
            );
        });
    });
});
