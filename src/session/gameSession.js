/**
 * GameSession — application orchestrator (Phase 2).
 *
 * Owns a ChessGame instance (injected) and talks to the shell only through
 * SessionCommands / SessionEvents. Mode plugins (LocalEngineMode, …) attach here.
 */
(function (global) {
    "use strict";

    function loadEventBus() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./eventBus");
            } catch {
                /* fall through */
            }
        }
        return global.ShmerlingSessionEventBus;
    }

    function loadCapabilities() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./capabilities");
            } catch {
                /* fall through */
            }
        }
        return null;
    }

    function loadT() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("../strings/t-bridge").t;
            } catch {
                /* fall through */
            }
        }
        return typeof global.ShmerlingT === "function"
            ? global.ShmerlingT
            : function (key) {
                  return key;
              };
    }

    /**
     * @param {object} options
     * @param {object} options.game - ChessGame instance
     * @param {boolean} [options.humanIsWhite=true]
     * @param {object} [options.meta] - engine id, player names, etc.
     * @param {import("./contracts").EnginePort} [options.engine]
     * @param {{ onTurn?: Function, stop?: Function, get?: Function }} [options.clocks]
     * @param {{ create: Function }} [options.eventBus]
     */
    function create(options) {
        const opts = options || {};
        const game = opts.game;
        if (!game) {
            throw new Error("GameSession requires a ChessGame instance");
        }

        const EventBus = opts.eventBus || loadEventBus();
        const bus = EventBus.create();
        const capsApi = loadCapabilities();
        const t = loadT();
        let clocks = opts.clocks || null;

        let humanIsWhite = opts.humanIsWhite !== false;
        let meta = Object.assign({}, opts.meta || {});
        let engine = opts.engine || null;
        let mode = null;
        let active = false;
        let disposed = false;

        function snapshot() {
            return {
                active: active,
                humanIsWhite: humanIsWhite,
                turn: game.Turn || (game.GameState && game.GameState.turn) || "white",
                gameOver: !!game.GameOver,
                gameState: game.GameState || null,
                moves: Array.isArray(game.Moves) ? game.Moves.slice() : [],
                meta: Object.assign({}, meta),
                modeId: mode && mode.id ? mode.id : null,
                capabilities: mode && typeof mode.capabilities === "function"
                    ? mode.capabilities()
                    : capsApi
                      ? capsApi.getModeCapabilities(null)
                      : null,
            };
        }

        function emitBoardAndTurn(extra) {
            const state = game.GameState;
            bus.emit("boardChanged", state, extra || {});
            const turn = game.Turn || (state && state.turn) || "white";
            bus.emit("turnChanged", turn, extra || {});
            if (clocks && typeof clocks.onTurn === "function" && active && !game.GameOver) {
                clocks.onTurn(turn, extra || {});
            }
            const snapshotClocks =
                clocks && typeof clocks.get === "function" ? clocks.get() : null;
            bus.emit(
                "clocksUpdated",
                snapshotClocks || { turn: turn },
                extra || {},
            );
        }

        function stopClocks() {
            if (clocks && typeof clocks.stop === "function") {
                clocks.stop();
            }
        }

        function emitStatusFromGame() {
            const state = game.GameState || {};
            if (state.draw) {
                stopClocks();
                bus.emit("gameOver", {
                    kind: "draw",
                    reason: state.drawReason || "Draw",
                });
                bus.emit("statusChanged", "draw");
                return;
            }
            if (state.checkmate) {
                stopClocks();
                const mated = game.Turn;
                const winner =
                    typeof game.opponent === "function" ? game.opponent(mated) : null;
                bus.emit("gameOver", {
                    kind: "checkmate",
                    mated: mated,
                    winner: winner,
                });
                bus.emit("statusChanged", "checkmate");
                return;
            }
            if (state.check) {
                bus.emit("statusChanged", "check");
            }
        }

        function isHumanTurn() {
            const turn = game.Turn || (game.GameState && game.GameState.turn);
            return (
                (turn === "white" && humanIsWhite) || (turn === "black" && !humanIsWhite)
            );
        }

        function isAiTurn() {
            return active && !game.GameOver && !isHumanTurn();
        }

        function setMeta(partial) {
            meta = Object.assign({}, meta, partial || {});
        }

        function setHumanIsWhite(next) {
            humanIsWhite = next !== false;
        }

        function setEngine(next) {
            engine = next || null;
        }

        function getEngine() {
            return engine;
        }

        function attachMode(nextMode) {
            if (mode && typeof mode.detach === "function") {
                mode.detach();
            }
            mode = nextMode || null;
            if (mode && typeof mode.attach === "function") {
                mode.attach(api);
            }
            const caps =
                mode && typeof mode.capabilities === "function"
                    ? mode.capabilities()
                    : null;
            if (caps) {
                bus.emit("capabilitiesChanged", caps);
            }
        }

        /**
         * Start a new game from the initial position.
         * @param {object} [startOpts]
         * @param {boolean} [startOpts.humanIsWhite]
         * @param {object} [startOpts.meta]
         */
        function start(startOpts) {
            if (disposed) {
                return;
            }
            const so = startOpts || {};
            if (typeof so.humanIsWhite === "boolean") {
                humanIsWhite = so.humanIsWhite;
            }
            if (so.meta) {
                setMeta(so.meta);
            }
            if (typeof game.startNewGame === "function") {
                game.startNewGame(humanIsWhite);
            }
            active = true;
            bus.emit("info", t("play.status.gameStarted"), "info");
            emitBoardAndTurn({ reason: "start" });
            bus.emit("statusChanged", "inProgress");
            if (mode && typeof mode.onStarted === "function") {
                mode.onStarted(api);
            }
        }

        /**
         * Load an existing position/moves (resume / setup → play).
         * @param {object} loadOpts
         * @param {string|object} [loadOpts.state]
         * @param {Array} [loadOpts.moves]
         * @param {boolean} [loadOpts.humanIsWhite]
         * @param {object} [loadOpts.meta]
         * @param {boolean} [loadOpts.active=true]
         */
        function load(loadOpts) {
            if (disposed) {
                return;
            }
            const lo = loadOpts || {};
            if (typeof lo.humanIsWhite === "boolean") {
                humanIsWhite = lo.humanIsWhite;
            }
            if (lo.meta) {
                setMeta(lo.meta);
            }
            if (lo.state != null) {
                const stateStr =
                    typeof lo.state === "string" ? lo.state : JSON.stringify(lo.state);
                if (typeof game.loadGame === "function") {
                    game.loadGame(stateStr);
                }
            }
            if (Array.isArray(lo.moves) && typeof game.loadMoves === "function") {
                game.loadMoves(lo.moves);
            }
            active = lo.active !== false;
            emitBoardAndTurn({ reason: "load" });
            if (mode && typeof mode.onLoaded === "function") {
                mode.onLoaded(api);
            }
        }

        /**
         * Apply a legal board move onto ChessGame without emitting session events.
         * The Play board calls this instead of ChessGame.makeMove; the shell then
         * calls {@link humanMoveApplied} after paint so clocks/engine stay timed.
         *
         * @param {{row:number,col:number}} source
         * @param {{row:number,col:number}} target
         * @returns {object|null}
         */
        function applyMove(source, target) {
            if (disposed || !active || game.GameOver) {
                return null;
            }
            if (!source || !target || typeof game.makeMove !== "function") {
                return null;
            }
            const executed = game.makeMove(source, target);
            if (!executed || executed.valid === false) {
                return null;
            }
            if (game.GameState && game.GameState.promoting) {
                bus.emit(
                    "promotionNeeded",
                    game.Turn || (game.GameState && game.GameState.turn),
                    executed,
                );
            }
            return executed;
        }

        /**
         * Apply a move onto ChessGame (engine / non-board paths) and emit events.
         * Human board moves use {@link applyMove} + {@link humanMoveApplied}.
         *
         * @param {object} move
         * @param {object} [metaInfo]
         * @returns {object|null} last move / executed move
         */
        function playMove(move, metaInfo) {
            if (disposed || !move || game.GameOver) {
                return null;
            }
            const info = Object.assign({ source: "session" }, metaInfo || {});
            if (move.promotion && move.selectedPiece != null && typeof game.completePromotion === "function") {
                /* Engine/promotion path: makeMove then completePromotion when needed. */
            }
            if (!move.source || !move.target || typeof game.makeMove !== "function") {
                bus.emit("error", t("play.status.invalidMove"));
                return null;
            }
            let executed;
            if (move.promotion && move.selectedPiece != null) {
                executed = game.makeMove(move.source, move.target);
                if (executed) {
                    executed.selectedPiece = move.selectedPiece;
                    executed.promotion = true;
                    if (executed.piece && move.piece) {
                        executed.piece.color = move.piece.color;
                    }
                    if (typeof game.completePromotion === "function") {
                        game.completePromotion(executed);
                    }
                }
            } else {
                executed = game.makeMove(move.source, move.target);
            }
            if (!executed || executed.valid === false) {
                bus.emit("error", t("play.status.moveNotApplied"));
                return null;
            }
            bus.emit("moveApplied", executed, info);
            emitBoardAndTurn(info);
            emitStatusFromGame();
            if (mode && typeof mode.afterMove === "function") {
                mode.afterMove(api, executed, info);
            }
            return executed;
        }

        /**
         * Human board move was applied (via {@link applyMove} or legacy makeMove).
         * Emit session events and let the mode request an engine reply.
         *
         * @param {object} executed
         */
        function humanMoveApplied(executed) {
            if (disposed || !active) {
                return;
            }
            const info = { source: "human" };
            bus.emit("moveApplied", executed, info);
            emitBoardAndTurn(info);
            emitStatusFromGame();
            if (mode && typeof mode.afterMove === "function") {
                mode.afterMove(api, executed, info);
            }
        }

        /**
         * Board/shell already applied a move (e.g. animated engine move).
         * Emits events + clocks; does not re-trigger mode.afterMove.
         *
         * @param {object} executed
         * @param {object} [metaInfo]
         */
        function externalMoveApplied(executed, metaInfo) {
            if (disposed || !active) {
                return;
            }
            const info = Object.assign({ source: "external" }, metaInfo || {});
            bus.emit("moveApplied", executed, info);
            emitBoardAndTurn(info);
            emitStatusFromGame();
        }

        /**
         * Complete a pending human promotion on ChessGame.LastMove.
         * @param {*} piece - ChessGame piece type constant
         * @returns {boolean}
         */
        function selectPromotion(piece) {
            if (disposed || !active || game.GameOver) {
                return false;
            }
            const pending = game.LastMove;
            if (!pending || !pending.promotion) {
                bus.emit("error", t("play.status.noPendingPromotion"));
                return false;
            }
            const knight = game.KNIGHT;
            const queen = game.QUEEN;
            if (
                typeof piece !== "number" ||
                (knight != null && piece < knight) ||
                (queen != null && piece > queen)
            ) {
                bus.emit("error", t("play.status.invalidPromotionPiece"));
                return false;
            }
            pending.selectedPiece = piece;
            if (typeof game.completePromotion !== "function") {
                bus.emit("error", t("play.status.promotionUnavailable"));
                return false;
            }
            game.completePromotion(pending);
            const info = { source: "promotion" };
            bus.emit("moveApplied", pending, info);
            emitBoardAndTurn(info);
            emitStatusFromGame();
            if (mode && typeof mode.afterMove === "function") {
                mode.afterMove(api, pending, { source: "human" });
            }
            return true;
        }

        function resign(side) {
            if (disposed || !active || game.GameOver) {
                return false;
            }
            const resigned =
                side ||
                (humanIsWhite ? "White" : "Black");
            if (typeof game.resign === "function") {
                game.resign(resigned);
            }
            stopClocks();
            bus.emit("gameOver", { kind: "resign", resigned: resigned });
            bus.emit("statusChanged", "resign");
            emitBoardAndTurn({ reason: "resign" });
            if (mode && typeof mode.onGameOver === "function") {
                mode.onGameOver(api, { kind: "resign", resigned: resigned });
            }
            return true;
        }

        /**
         * Accept a draw offer (local ChessGame terminal + session events).
         * @param {string} offeredBy - "white" | "black" (side that offered)
         * @returns {boolean}
         */
        function acceptDraw(offeredBy) {
            if (disposed || !active || game.GameOver) {
                return false;
            }
            const by =
                offeredBy === "black" || offeredBy === "Black" ? "black" : "white";
            if (typeof game.drawOfferAccepted === "function") {
                game.drawOfferAccepted(by);
            } else if (game.GameState) {
                game.GameState.draw = true;
                game.GameState.drawReason = by + " player's draw offer accepted";
            }
            stopClocks();
            bus.emit("gameOver", {
                kind: "draw",
                reason:
                    (game.GameState && game.GameState.drawReason) ||
                    by + " player's draw offer accepted",
            });
            bus.emit("statusChanged", "draw");
            emitBoardAndTurn({ reason: "draw" });
            if (mode && typeof mode.onGameOver === "function") {
                mode.onGameOver(api, { kind: "draw" });
            }
            return true;
        }

        /**
         * Undo one human+engine half-move pair (two ChessGame undos).
         * @returns {boolean}
         */
        function undoPair() {
            if (disposed || !active || game.GameOver) {
                return false;
            }
            if (typeof game.undo !== "function") {
                return false;
            }
            if (mode && typeof mode.abort === "function") {
                mode.abort();
            }
            game.undo();
            game.undo();
            bus.emit("undone", { pair: true });
            emitBoardAndTurn({ reason: "undo" });
            bus.emit("statusChanged", "inProgress");
            return true;
        }

        /**
         * Undo a single ply (Practice / Debug).
         * @returns {boolean}
         */
        function undoPly() {
            if (disposed || !active || game.GameOver) {
                return false;
            }
            if (typeof game.undo !== "function") {
                return false;
            }
            const moveCount = game.Moves ? game.Moves.length : 0;
            if (moveCount < 1) {
                return false;
            }
            if (mode && typeof mode.abort === "function") {
                mode.abort();
            }
            game.undo();
            bus.emit("undone", { pair: false });
            emitBoardAndTurn({ reason: "undo" });
            bus.emit("statusChanged", "inProgress");
            return true;
        }

        /**
         * Redo one human+engine half-move pair (two ChessGame redos).
         * @returns {boolean}
         */
        function redoPair() {
            if (disposed || !active || game.GameOver) {
                return false;
            }
            if (typeof game.redo !== "function") {
                return false;
            }
            game.redo();
            game.redo();
            bus.emit("redone", { pair: true });
            emitBoardAndTurn({ reason: "redo" });
            emitStatusFromGame();
            return true;
        }

        /**
         * Redo a single ply (Practice / Debug).
         * @returns {boolean}
         */
        function redoPly() {
            if (disposed || !active || game.GameOver) {
                return false;
            }
            if (typeof game.redo !== "function") {
                return false;
            }
            game.redo();
            bus.emit("redone", { pair: false });
            emitBoardAndTurn({ reason: "redo" });
            emitStatusFromGame();
            return true;
        }

        /**
         * Undo — single ply when PracticeMode is attached, else a pair.
         * @returns {boolean}
         */
        function undo() {
            if (mode && mode.undoPly === true) {
                return undoPly();
            }
            return undoPair();
        }

        /**
         * Redo — single ply when PracticeMode is attached, else a pair.
         * @returns {boolean}
         */
        function redo() {
            if (mode && mode.redoPly === true) {
                return redoPly();
            }
            return redoPair();
        }

        /**
         * Flag a side for running out of time.
         * @param {string} [side] - white/black (defaults to side to move)
         * @returns {boolean}
         */
        function flagTimeout(side) {
            if (disposed || !active || game.GameOver) {
                return false;
            }
            const turn = game.Turn || (game.GameState && game.GameState.turn) || "white";
            const loser = side || turn;
            if (typeof game.OutOfTime !== "undefined") {
                game.OutOfTime = loser;
            } else if (game.GameState) {
                game.GameState.outOfTime = loser;
            }
            stopClocks();
            if (mode && typeof mode.abort === "function") {
                mode.abort();
            }
            bus.emit("gameOver", { kind: "timeout", loser: loser });
            bus.emit("statusChanged", "timeout");
            emitBoardAndTurn({ reason: "timeout" });
            if (mode && typeof mode.onGameOver === "function") {
                mode.onGameOver(api, { kind: "timeout", loser: loser });
            }
            return true;
        }

        function leave() {
            active = false;
            if (mode && typeof mode.detach === "function") {
                mode.detach();
            }
            mode = null;
            bus.emit("statusChanged", "left");
        }

        function dispose() {
            leave();
            bus.clear();
            disposed = true;
        }

        const api = {
            /* inspection */
            getGame: function () {
                return game;
            },
            getEngine: getEngine,
            setEngine: setEngine,
            setClocks: function (next) {
                clocks = next || null;
            },
            getMeta: function () {
                return Object.assign({}, meta);
            },
            setMeta: setMeta,
            setHumanIsWhite: setHumanIsWhite,
            snapshot: snapshot,
            isHumanTurn: isHumanTurn,
            isAiTurn: isAiTurn,
            isActive: function () {
                return active && !disposed;
            },
            /* mode */
            attachMode: attachMode,
            /* commands */
            start: start,
            load: load,
            applyMove: applyMove,
            playMove: playMove,
            humanMoveApplied: humanMoveApplied,
            externalMoveApplied: externalMoveApplied,
            selectPromotion: selectPromotion,
            resign: resign,
            acceptDraw: acceptDraw,
            undo: undo,
            redo: redo,
            undoPair: undoPair,
            redoPair: redoPair,
            undoPly: undoPly,
            redoPly: redoPly,
            flagTimeout: flagTimeout,
            leave: leave,
            dispose: dispose,
            /* events */
            on: function (event, handler) {
                return bus.on(event, handler);
            },
            emit: function () {
                if (disposed) {
                    return;
                }
                bus.emit.apply(bus, arguments);
            },
        };

        return api;
    }

    const GameSession = { create: create };

    global.ShmerlingGameSession = GameSession;

    if (typeof module === "object" && module && module.exports) {
        module.exports = GameSession;
    }
})(typeof window !== "undefined" ? window : globalThis);
