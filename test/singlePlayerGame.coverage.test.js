/**
 * SinglePlayerGame behavior: seats, clientEngine, disconnect/rejoin, resign.
 */
"use strict";

const assert = require("assert");
const { SinglePlayerGame } = require("../src/modules/game/SinglePlayerGame");
const { Player } = require("../src/modules/game/Player");

describe("SinglePlayerGame coverage", function () {
    function makeSp(opts) {
        const player = new Player("human-1", "alice");
        return new SinglePlayerGame(
            {
                gameType: "SinglePlayerGame",
                playAsBlack: opts && opts.playAsBlack,
                options: Object.assign(
                    { engine: "brain41", difficulty: 1, clientEngine: true },
                    (opts && opts.options) || {},
                ),
            },
            player,
            "play",
        );
    }

    it("usesClientEngine and seat helpers", function () {
        const g = makeSp();
        assert.strictEqual(g.usesClientEngine(), true);
        assert.strictEqual(g.humanSeatIsWhite(), true);
        assert.strictEqual(g.humanHasMadeAnyMove(), false);
        g.moves.push({});
        assert.strictEqual(g.humanHasMadeAnyMove(), true);

        const asBlack = makeSp({ playAsBlack: true });
        assert.strictEqual(asBlack.humanSeatIsWhite(), false);
        assert.strictEqual(asBlack.humanHasMadeAnyMove(), false);
        asBlack.moves.push({}, {});
        assert.strictEqual(asBlack.humanHasMadeAnyMove(), true);
    });

    it("setHumanPlaysWhite swaps seats", function () {
        const g = makeSp();
        const human = g.whitePlayer;
        g.setHumanPlaysWhite(false);
        assert.strictEqual(g.blackPlayer, human);
        assert.strictEqual(g.whitePlayer.userId, null);
        g.setHumanPlaysWhite(true);
        assert.strictEqual(g.whitePlayer, human);
    });

    it("makeBrainMove is skipped for clientEngine", async function () {
        const g = makeSp();
        assert.strictEqual(await g.makeBrainMove(true), null);
        assert.strictEqual(await g.scheduleBrainMoveIfAiTurn(), null);
        assert.strictEqual(await g.scheduleInitialBrainMoveIfNeeded(), null);
    });

    it("onConnectionClosed cancels with no human moves", function () {
        const g = makeSp();
        g.status = "in progress";
        g.onConnectionClosed();
        assert.strictEqual(g.status, "cancelled");
    });

    it("onConnectionClosed holds when human has moved", function () {
        const g = makeSp();
        g.status = "in progress";
        g.moves.push({ moveStr: "e4" });
        const watchers = [];
        g.sendInfoToWatchers = (m) => watchers.push(m);
        g.waitForRejoin = () => {};
        g.onConnectionClosed();
        assert.strictEqual(g.status, "on hold");
        assert.ok(watchers.some((m) => m.info === "Opponent disconnected"));
    });

    it("resign cancels before human move and notifies after", async function () {
        const g = makeSp();
        g.status = "in progress";
        await g.resign("white");
        assert.strictEqual(g.status, "cancelled");

        const g2 = makeSp();
        g2.status = "in progress";
        g2.moves.push({ moveStr: "e4" });
        g2.chessGame.startNewGame(true);
        const sent = [];
        g2.sendMessage = (m) => sent.push(m);
        g2.sendMoveToWatchers = () => {};
        g2.sendInfoToWatchers = (m) => sent.push(m);
        await g2.resign("white");
        assert.ok(sent.some((m) => m.info === "Opponent resigned" || m.type === "move"));
    });

    it("updateLastMoveTime updates timers on last move", function () {
        const g = makeSp();
        g.moves.push({ moveStr: "e4" });
        let raised = null;
        g.raiseEvent = (_e, payload) => {
            raised = payload;
        };
        g.updateLastMoveTime(12, 100, 90);
        assert.strictEqual(g.moves[0].moveTime, 12);
        assert.strictEqual(g.moves[0].whiteTimer, 100);
        assert.ok(raised);
    });

    it("updateChannel announces rejoin from on-hold", function () {
        const g = makeSp();
        g.status = "on hold";
        g.lastStatus = "in progress";
        const watchers = [];
        g.sendInfoToWatchers = (m) => watchers.push(m);
        const human = g.whitePlayer;
        human.channel = { readyState: 3 };
        g.updateChannel(human, { readyState: 1, OPEN: 1 });
        assert.strictEqual(g.status, "in progress");
        assert.ok(watchers.some((m) => m.info === "opponent rejoined"));
    });

    it("review mode skips engine load", function () {
        const g = new SinglePlayerGame(
            {
                gameType: "SinglePlayerGame",
                whitePlayer: "W",
                blackPlayer: "B",
                options: {},
            },
            new Player("u", "rev"),
            "review",
        );
        assert.strictEqual(g._brainNextMoveFunc, null);
        g.setHumanPlaysWhite(false);
        assert.ok(g.whitePlayer);
    });
});
