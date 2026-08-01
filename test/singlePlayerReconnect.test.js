const assert = require("assert");
const { describe, it } = require("mocha");
const { Player } = require("../src/modules/game/Player");
const { SinglePlayerGame } = require("../src/modules/game/SinglePlayerGame");

describe("SinglePlayerGame reconnect countdown", function () {
    function makeSpGame() {
        const human = new Player("69ac2cc393c4f39bea834f00", "tester");
        const game = new SinglePlayerGame(
            {
                gameType: 1,
                options: { clientEngine: true, engine: "brain43", difficulty: 1 },
            },
            human,
            "play",
        );
        game.chessGame.startNewGame(true);
        game.status = "in progress";
        game.options = { clientEngine: true, engine: "brain43", difficulty: 1 };
        return game;
    }

    function closedChannel() {
        return { readyState: 3, OPEN: 1, on() {}, off() {}, send() {} };
    }

    function openChannel(sent) {
        return {
            readyState: 1,
            OPEN: 1,
            on() {},
            off() {},
            send(data) {
                sent.push(JSON.parse(data));
            },
        };
    }

    it("notifies watchers and starts on-hold wait when human disconnects after a move", function () {
        const game = makeSpGame();
        const humanMove = game.chessGame.makeMove({ row: 6, col: 4 }, { row: 4, col: 4 });
        humanMove.moveTime = 100;
        game.moves.push(humanMove);
        game.whitePlayer.channel = closedChannel();

        const watcherSent = [];
        game.watchers.push({ ws: openChannel(watcherSent), userName: "spec" });

        game.onConnectionClosed();

        assert.strictEqual(game.status, "on hold");
        assert.ok(game._rejoinWaitHandle != null);
        const disc = watcherSent.find(function (m) {
            return m.info === "Opponent disconnected";
        });
        assert.ok(disc);
        assert.strictEqual(disc.disconnectedWasWhite, true);

        game.clearRejoinWaitIfAny();
    });

    it("clears wait and notifies watchers on rejoin", function () {
        const game = makeSpGame();
        const humanMove = game.chessGame.makeMove({ row: 6, col: 4 }, { row: 4, col: 4 });
        humanMove.moveTime = 100;
        game.moves.push(humanMove);
        game.whitePlayer.channel = closedChannel();
        game.onConnectionClosed();
        assert.strictEqual(game.status, "on hold");

        const watcherSent = [];
        game.watchers.push({ ws: openChannel(watcherSent), userName: "spec" });

        const newWs = openChannel([]);
        game.updateChannel(game.whitePlayer, newWs);

        assert.strictEqual(game.status, "in progress");
        assert.strictEqual(game._rejoinWaitHandle, null);
        const rejoined = watcherSent.find(function (m) {
            return m.info === "opponent rejoined";
        });
        assert.ok(rejoined);
        assert.strictEqual(rejoined.rejoinedWasWhite, true);
    });

    it("resigns the human seat when reconnect deadline expires", async function () {
        const game = makeSpGame();
        const humanMove = game.chessGame.makeMove({ row: 6, col: 4 }, { row: 4, col: 4 });
        humanMove.moveTime = 100;
        game.moves.push(humanMove);
        game.whitePlayer.channel = closedChannel();

        const watcherSent = [];
        game.watchers.push({ ws: openChannel(watcherSent), userName: "spec" });

        game.onConnectionClosed();
        assert.strictEqual(game.status, "on hold");

        /* Fire the deadline immediately by replacing the timer callback path. */
        game.clearRejoinWaitIfAny();
        game.waitForRejoin(true, 1);
        await new Promise(function (resolve) {
            setTimeout(resolve, 20);
        });

        assert.strictEqual(game.status, "game over");
        assert.ok(game.chessGame.GameOver);
        const failed = watcherSent.find(function (m) {
            return m.info === "Opponent failed to reconnect";
        });
        assert.ok(failed);
        assert.strictEqual(failed.disconnectedWasWhite, true);
    });
});
