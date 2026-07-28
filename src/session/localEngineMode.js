/**
 * LocalEngineMode — single-player vs brain (Phase 2).
 *
 * Uses EnginePort.computeMove and play-ui engine-turn policy. The shell still
 * animates engine moves when it listens for `engineMoveReady` (optional) or
 * when playMove is applied directly without a board animator.
 */
(function (global) {
    "use strict";

    function loadPolicy() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("../play-ui/engine-turn");
            } catch {
                /* fall through */
            }
        }
        return global.PlayEngineTurn;
    }

    function loadT() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("../strings/t-bridge").t;
            } catch {
                /* fall through */
            }
        }
        return typeof global.ShmerlingT === "function" ? global.ShmerlingT : function (key) {
            return key;
        };
    }

    const t = loadT();

    function loadCapabilities() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./capabilities");
            } catch {
                /* fall through */
            }
        }
        return global.ShmerlingSessionCapabilities || null;
    }

    function loadContracts() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./contracts");
            } catch {
                /* fall through */
            }
        }
        return (
            global.ShmerlingSessionContracts || {
                MODE_IDS: { LOCAL_ENGINE: "localEngine" },
            }
        );
    }

    /**
     * @param {object} [options]
     * @param {object} [options.policy] - PlayEngineTurn-compatible policy
     * @param {() => boolean} [options.immediateResign]
     * @param {() => boolean} [options.canRun] - extra shell guards (animating, dialogs)
     * @param {(move: object) => Promise<boolean>|boolean} [options.applyEngineMove]
     *        If provided, mode will not call session.playMove; shell applies+animates.
     * @param {(msg: string, kind?: string) => void} [options.onStatus]
     */
    function create(options) {
        const opts = options || {};
        const policy = opts.policy || loadPolicy();
        const capsApi = loadCapabilities();
        const contracts = loadContracts();
        const modeId =
            (contracts.MODE_IDS && contracts.MODE_IDS.LOCAL_ENGINE) || "localEngine";

        let session = null;
        let thinking = false;
        let runToken = 0;

        function capabilities() {
            if (capsApi && typeof capsApi.getModeCapabilities === "function") {
                return capsApi.getModeCapabilities(modeId);
            }
            return {
                undo: true,
                redo: true,
                resign: true,
                draw: false,
                rematch: true,
                engine: true,
                network: false,
                reviewNav: false,
                positionSetup: false,
                watchers: false,
                chat: false,
            };
        }

        function isThinking() {
            return thinking;
        }

        function abort() {
            runToken += 1;
            thinking = false;
            const engine = session && session.getEngine && session.getEngine();
            if (engine && typeof engine.abortSearch === "function") {
                try {
                    engine.abortSearch();
                } catch {
                    /* ignore */
                }
            }
        }

        function shellAllowsRun() {
            if (typeof opts.canRun === "function" && !opts.canRun()) {
                return false;
            }
            return true;
        }

        function status(message, kind) {
            if (typeof opts.onStatus === "function") {
                opts.onStatus(message, kind);
            } else if (session) {
                session.emit("info", message, kind || "info");
            }
        }

        async function maybeRunEngine(reason) {
            if (!session || !session.isActive() || !session.isAiTurn()) {
                return;
            }
            if (thinking || !shellAllowsRun()) {
                return;
            }
            const game = session.getGame();
            const engine = session.getEngine();
            const meta = session.getMeta() || {};
            if (
                !policy.canStartTurn({
                    hasGame: !!game,
                    hasSession: true,
                    hasEngine: !!engine,
                    gameOver: !!(game && game.GameOver),
                    aiTurn: true,
                    engineThinking: thinking,
                })
            ) {
                return;
            }

            const token = ++runToken;
            thinking = true;
            session.emit("statusChanged", "engineThinking");
            status(t("session.engineThinking"), "info");

            try {
                const immediateResign =
                    typeof opts.immediateResign === "function"
                        ? opts.immediateResign() === true
                        : opts.immediateResign === true;
                const move = await engine.computeMove(
                    policy.buildComputeArgs({
                        gameState: game.GameState,
                        moves: Array.isArray(game.Moves) ? game.Moves : [],
                        engine: meta.engine,
                        thinkingTimeSeconds: meta.thinkingTimeSeconds,
                        difficulty: meta.difficulty,
                        pliesPlayed: game.Moves ? game.Moves.length : 0,
                        immediateResign: immediateResign,
                    }),
                );

                if (token !== runToken || !session.isActive()) {
                    return;
                }

                const decision = policy.decideAfterCompute(move, {
                    gameOver: !!game.GameOver,
                    immediateResign: immediateResign,
                    defaultPromotionPiece: game.QUEEN,
                });

                if (decision.action === "noop") {
                    return;
                }
                if (decision.action === "resign") {
                    thinking = false;
                    const resignSide =
                        game.Turn === "white" || game.Turn === "black"
                            ? game.Turn.charAt(0).toUpperCase() + game.Turn.slice(1)
                            : "Black";
                    session.resign(resignSide);
                    return;
                }
                if (decision.action === "error") {
                    status(decision.message || t("session.engineCouldNotFindMove"), "error");
                    session.emit("error", decision.message || t("session.engineCouldNotFindMove"));
                    return;
                }

                thinking = false;
                session.emit("engineMoveReady", decision.move, { reason: reason || "turn" });

                if (typeof opts.applyEngineMove === "function") {
                    await opts.applyEngineMove(decision.move);
                    return;
                }
                session.playMove(decision.move, { source: "engine" });
            } catch (err) {
                if (policy.isSearchAbortedError && policy.isSearchAbortedError(err)) {
                    return;
                }
                if (game.GameOver) {
                    return;
                }
                const message = (err && err.message) || t("session.engineError");
                status(message, "error");
                session.emit("error", message);
            } finally {
                if (token === runToken) {
                    thinking = false;
                }
            }
        }

        function afterMove(sess, executed, info) {
            if (!info || info.source === "engine") {
                return;
            }
            /* Defer so the shell can paint / switch clocks first. */
            Promise.resolve().then(function () {
                return maybeRunEngine("afterHumanMove");
            });
        }

        function onStarted(sess) {
            if (opts.autoRunOnAttach === false) {
                return;
            }
            Promise.resolve().then(function () {
                return maybeRunEngine("start");
            });
        }

        function onLoaded(sess) {
            if (opts.autoRunOnAttach === false) {
                return;
            }
            Promise.resolve().then(function () {
                return maybeRunEngine("load");
            });
        }

        function attach(sess) {
            session = sess;
        }

        function detach() {
            abort();
            session = null;
        }

        return {
            id: modeId,
            capabilities: capabilities,
            attach: attach,
            detach: detach,
            afterMove: afterMove,
            onStarted: onStarted,
            onLoaded: onLoaded,
            onGameOver: function () {
                abort();
            },
            maybeRunEngine: maybeRunEngine,
            abort: abort,
            isThinking: isThinking,
        };
    }

    const LocalEngineMode = { create: create };

    global.ShmerlingLocalEngineMode = LocalEngineMode;

    if (typeof module === "object" && module && module.exports) {
        module.exports = LocalEngineMode;
    }
})(typeof window !== "undefined" ? window : globalThis);
