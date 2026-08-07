const assert = require("assert");
const { JSDOM } = require("jsdom");

const EvaluationDisplay = require("../src/play-ui/evaluation-display");
const ActionButtonsPolicy = require("../src/play-ui/action-buttons-policy");
const LaunchOptions = require("../src/play-ui/launch-options");
const KeyboardShortcuts = require("../src/play-ui/keyboard-shortcuts");
const BookmarkHelpers = require("../src/play-ui/bookmark-helpers");

describe("play-ui evaluation display", function () {
    it("formats terminal and numeric totals", function () {
        assert.strictEqual(
            EvaluationDisplay.formatTotalText({ terminal: "checkmate" }),
            "Checkmate",
        );
        assert.strictEqual(EvaluationDisplay.formatTotalText({ total: 1.5 }), "+1.5");
        assert.strictEqual(EvaluationDisplay.formatTotalText({ total: -2 }), "-2");
    });

    it("builds status message and tooltip", function () {
        const msg = EvaluationDisplay.statusMessage({
            sideToMove: "black",
            total: 0.25,
        });
        assert.ok(msg.indexOf("Black") !== -1);
        assert.ok(msg.indexOf("+0.25") !== -1);

        const tip = EvaluationDisplay.formatSummaryTooltip(
            [{ label: "Material", value: 1, text: "even" }],
            "+1",
        );
        assert.ok(tip.indexOf("Material") !== -1);
        assert.ok(tip.indexOf("Total: +1") !== -1);
    });

    it("applies and clears the status-bar title", function () {
        const dom = new JSDOM("<body><div id=\"status\"></div></body>");
        const el = dom.window.document.getElementById("status");
        EvaluationDisplay.applyStatusTooltip(el, [{ label: "A", value: 1 }], "+1");
        assert.ok(el.getAttribute("title"));
        EvaluationDisplay.clearStatusTooltip(el);
        assert.strictEqual(el.getAttribute("title"), null);
    });
});

describe("play-ui action buttons policy", function () {
    it("disables setup tools before the session is ready", function () {
        const map = ActionButtonsPolicy.disabledMap({
            hasGame: false,
            playSessionReady: false,
        });
        assert.strictEqual(map.rematchBtn, true);
        assert.strictEqual(map.positionSetupBtn, true);
    });

    it("locks play actions while idle without setup/config", function () {
        const map = ActionButtonsPolicy.disabledMap({
            hasGame: true,
            playSessionReady: true,
            gameActive: false,
        });
        assert.strictEqual(map.resignBtn, true);
        assert.strictEqual(map.flipBtn, true);
        assert.strictEqual(map.rematchBtn, false);
    });

    it("enables resign during an active game on the human turn", function () {
        const map = ActionButtonsPolicy.disabledMap({
            hasGame: true,
            playSessionReady: true,
            gameActive: true,
            humanTurn: true,
            allowUndo: true,
            canUndoMovePair: true,
            redoPairAvailable: false,
            hasMoves: true,
            canUsePositionSetup: true,
            canUseBrainConfig: true,
        });
        assert.strictEqual(map.resignBtn, false);
        assert.strictEqual(map.drawBtn, false);
        assert.strictEqual(map.undoBtn, false);
        assert.strictEqual(map.redoBtn, true);
        assert.strictEqual(map.rematchBtn, true);
    });

    it("re-enables New game after the active game is over", function () {
        const map = ActionButtonsPolicy.disabledMap({
            hasGame: true,
            playSessionReady: true,
            gameActive: true,
            gameOver: true,
            humanTurn: false,
            allowUndo: false,
            canUndoMovePair: false,
            redoPairAvailable: false,
            hasMoves: true,
            canUsePositionSetup: true,
            canUseBrainConfig: true,
        });
        assert.strictEqual(map.rematchBtn, false);
        assert.strictEqual(map.resignBtn, true);
    });

    it("does not disable resign while the board is animating", function () {
        const map = ActionButtonsPolicy.disabledMap({
            hasGame: true,
            playSessionReady: true,
            gameActive: true,
            humanTurn: false,
            animating: true,
            hasMoves: true,
            allowUndo: false,
            canUndoMovePair: false,
            redoPairAvailable: false,
            canUsePositionSetup: false,
            canUseBrainConfig: false,
        });
        assert.strictEqual(map.resignBtn, false);
    });

    it("disables draw/undo when mode capabilities forbid them", function () {
        const map = ActionButtonsPolicy.disabledMap({
            hasGame: true,
            playSessionReady: true,
            gameActive: true,
            humanTurn: true,
            allowUndo: true,
            canUndoMovePair: true,
            redoPairAvailable: true,
            hasMoves: true,
            canUsePositionSetup: true,
            canUseBrainConfig: true,
            capabilities: {
                resign: true,
                draw: false,
                undo: false,
                redo: true,
                rematch: true,
            },
        });
        assert.strictEqual(map.resignBtn, false);
        assert.strictEqual(map.drawBtn, true);
        assert.strictEqual(map.undoBtn, true);
        assert.strictEqual(map.redoBtn, false);
    });

    it("online draw requires canOfferDraw; rematch requires canRematch", function () {
        const base = {
            hasGame: true,
            playSessionReady: true,
            gameActive: true,
            humanTurn: false,
            allowUndo: false,
            canUndoMovePair: false,
            redoPairAvailable: false,
            hasMoves: true,
            canUsePositionSetup: false,
            canUseBrainConfig: false,
            capabilities: {
                resign: true,
                draw: true,
                rematch: true,
                undo: false,
                redo: false,
                network: true,
            },
        };
        const blocked = ActionButtonsPolicy.disabledMap(base);
        assert.strictEqual(blocked.drawBtn, true);
        assert.strictEqual(blocked.rematchBtn, true);

        const offerOk = ActionButtonsPolicy.disabledMap(
            Object.assign({}, base, { canOfferDraw: true }),
        );
        assert.strictEqual(offerOk.drawBtn, false);

        const rematchOk = ActionButtonsPolicy.disabledMap(
            Object.assign({}, base, {
                gameOver: true,
                canRematch: true,
            }),
        );
        assert.strictEqual(rematchOk.rematchBtn, false);
        assert.strictEqual(rematchOk.drawBtn, true);
    });

    it("applies a map through setDisabled", function () {
        const seen = {};
        ActionButtonsPolicy.apply({ resignBtn: true, flipBtn: false }, function (id, disabled) {
            seen[id] = disabled;
        });
        assert.deepStrictEqual(seen, { resignBtn: true, flipBtn: false });
    });
});

describe("play-ui launch options", function () {
    const engineOpts = {
        promoteBrain41OnWeb: true,
        normalizeEngine: function (e) {
            return e || "brain43";
        },
    };

    it("promotes legacy engines on web", function () {
        assert.strictEqual(
            LaunchOptions.normalizeLaunchEngine("brain4", engineOpts),
            "brain43",
        );
        assert.strictEqual(
            LaunchOptions.normalizeLaunchEngine("brain41", engineOpts),
            "brain43",
        );
        assert.strictEqual(
            LaunchOptions.normalizeLaunchEngine("brain41", {
                promoteBrain41OnWeb: false,
                normalizeEngine: engineOpts.normalizeEngine,
            }),
            "brain41",
        );
    });

    it("merges stored and URL options", function () {
        const opts = { color: "white" };
        LaunchOptions.mergeStored(opts, { color: "black", difficulty: 4, mouse: "double" }, engineOpts);
        assert.strictEqual(opts.color, "black");
        assert.strictEqual(opts.thinkingTimeSeconds, 4);
        assert.strictEqual(opts.mouse, "double");

        LaunchOptions.mergeStored(opts, { thinkingTimeSeconds: 60, difficulty: 60 }, engineOpts);
        assert.strictEqual(opts.thinkingTimeSeconds, 60);

        LaunchOptions.applyUrlSearch(opts, "?engine=brain42&showMoves=0", engineOpts);
        assert.strictEqual(opts.engine, "brain42");
        assert.strictEqual(opts.showAvailableMoves, false);
    });

    it("merges private launch option from stored prefs and URL", function () {
        const opts = { isPrivate: false };
        LaunchOptions.mergeStored(opts, { isPrivate: true }, engineOpts);
        assert.strictEqual(opts.isPrivate, true);
        LaunchOptions.applyUrlSearch(opts, "?private=0", engineOpts);
        assert.strictEqual(opts.isPrivate, false);
        LaunchOptions.applyUrlSearch(opts, "?private=1", engineOpts);
        assert.strictEqual(opts.isPrivate, true);
    });

    it("detects newGame=1", function () {
        assert.ok(LaunchOptions.wantsNewGameDialog("?newGame=1"));
        assert.ok(!LaunchOptions.wantsNewGameDialog(""));
    });

    it("reads online id and joinGame from the query string", function () {
        assert.strictEqual(LaunchOptions.getGameIdFromSearch("?id=abc"), "abc");
        assert.strictEqual(LaunchOptions.getGameIdFromSearch(""), null);
        assert.strictEqual(
            LaunchOptions.getJoinGameIdFromSearch("?gameType=2&joinGame=xyz"),
            "xyz",
        );
        assert.strictEqual(LaunchOptions.getModeFromSearch("?id=abc&mode=watch"), "watch");
        assert.strictEqual(LaunchOptions.getModeFromSearch("?mode=review"), "review");
        assert.strictEqual(LaunchOptions.getModeFromSearch("?mode=practice"), "practice");
        assert.strictEqual(LaunchOptions.getModeFromSearch("?id=abc"), null);
        assert.strictEqual(LaunchOptions.getReviewTypeFromSearch("?type=history"), "history");
        assert.strictEqual(LaunchOptions.getReviewTypeFromSearch("?type=pgn&id=x"), "pgn");
        assert.strictEqual(LaunchOptions.getReviewTypeFromSearch("?id=x"), null);
    });
});

describe("play-ui keyboard shortcuts", function () {
    it("ignores typing targets", function () {
        const dom = new JSDOM("<body><input id=\"i\"></body>");
        const input = dom.window.document.getElementById("i");
        assert.ok(KeyboardShortcuts.shouldIgnoreTarget(input));
        assert.strictEqual(
            KeyboardShortcuts.resolve({ key: "F2", target: input }),
            null,
        );
    });

    it("resolves F2, Cmd/Ctrl+Shift+O, and Cmd/Ctrl+E", function () {
        assert.strictEqual(
            KeyboardShortcuts.resolve({ key: "F2", target: {} }),
            "logGameState",
        );
        assert.strictEqual(
            KeyboardShortcuts.resolve({
                key: "o",
                ctrlKey: true,
                shiftKey: true,
                target: {},
            }),
            "openGamesFolder",
        );
        assert.strictEqual(
            KeyboardShortcuts.resolve({ key: "e", metaKey: true, target: {} }),
            "evaluatePosition",
        );
    });
});

describe("play-ui bookmark helpers", function () {
    it("formats names and builds a create payload", function () {
        const session = {
            whitePlayerName: "Alice",
            blackPlayerName: "Bob",
            engine: "brain42",
            thinkingTimeSeconds: 5,
        };
        assert.strictEqual(BookmarkHelpers.formatAutoSaveGameName(session), "Alice vs. Bob");
        assert.strictEqual(
            BookmarkHelpers.formatManualSaveGameName(session),
            "Saved — Alice vs. Bob",
        );
        const payload = BookmarkHelpers.buildCreatePayload({
            gameState: { turn: "white" },
            name: "Test",
            moves: [{ moveStr: "e4" }],
            session: session,
            originState: "{}",
        });
        assert.strictEqual(payload.engine, "brain42");
        assert.strictEqual(payload.depth, 5);
        assert.strictEqual(payload.originState, "{}");
        assert.strictEqual(payload.whitePlayerName, "Alice");
    });

    it("formats a position setup default name", function () {
        const name = BookmarkHelpers.formatPositionSetupSaveName(
            new Date("2020-01-02T03:04:00Z"),
        );
        assert.ok(name.indexOf("Position —") === 0);
    });
});
