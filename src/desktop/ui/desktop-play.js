/**
 * Play shell coordinator (Phase 1 complete).
 *
 * Presentation/policy live under `src/play-ui/`. This file still owns mode
 * enter/exit, ChessGame wiring, and API calls until Phase 2 GameSession.
 *
 * Desktop/web Play shell — local engine (SP) or OnlineMode (Phase 3) over /ws.
 */
(function () {
    "use strict";

    function t(key, params) {
        if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
            return window.ShmerlingStrings.t(key, params);
        }
        return key;
    }

    function localizeDrawReason(reason) {
        if (
            window.ShmerlingStrings
            && typeof window.ShmerlingStrings.localizeDrawReason === "function"
        ) {
            return window.ShmerlingStrings.localizeDrawReason(reason);
        }
        return reason == null || reason === "" ? t("common.draw") : String(reason);
    }

    function localizeColorName(color) {
        if (
            window.ShmerlingStrings
            && typeof window.ShmerlingStrings.localizeColorName === "function"
        ) {
            return window.ShmerlingStrings.localizeColorName(color);
        }
        const raw = color == null ? "" : String(color).trim().toLowerCase();
        if (raw === "white") {
            return t("common.white");
        }
        if (raw === "black") {
            return t("common.black");
        }
        return color == null ? "" : String(color);
    }

    const Api = window.DesktopApi;
    const Board = window.DesktopBoard;
    const Setup = window.DesktopPositionSetup;
    const BrainConfig = window.DesktopBrainConfig;
    const GameRun = window.DesktopGameRun;
    const PositionValidation = window.DesktopPositionValidation;
    const MovesPanel = window.PlayMovesPanel;
    const SavedGames = window.PlaySavedGamesModel;
    const SavedGamesList = window.PlaySavedGamesList;
    const ReviewModel = window.PlayReviewModel;
    const ReviewNav = window.PlayReviewNav;
    const SessionMode = window.PlaySessionMode;
    const DockModeChrome = window.PlayDockModeChrome;
    const ActionRail = window.PlayActionRail;
    const StatusBar = window.PlayStatusBar;
    const EngineTurn = window.PlayEngineTurn;
    const EvaluationDisplay = window.PlayEvaluationDisplay;
    const ActionButtonsPolicy = window.PlayActionButtonsPolicy;
    const LaunchOptions = window.PlayLaunchOptions;
    const KeyboardShortcuts = window.PlayKeyboardShortcuts;
    const BookmarkHelpers = window.PlayBookmarkHelpers;
    const GameSessionApi = window.ShmerlingGameSession;
    const LocalEngineModeApi = window.ShmerlingLocalEngineMode;
    const ReviewModeApi = window.ShmerlingReviewMode;
    const PracticeModeApi = window.ShmerlingPracticeMode;
    const PositionSetupModeApi = window.ShmerlingPositionSetupMode;
    const ConfigurationModeApi = window.ShmerlingConfigurationMode;
    const OnlineModeApi = window.ShmerlingOnlineMode;
    const WsTransportApi = window.ShmerlingWsTransport;
    const SpServerSyncApi = window.ShmerlingSpServerSync;
    const Clocks = window.PlayClocksController.create({
        getElement: function (color) {
            return $(color === "black" ? "blackClockTimeText" : "whiteClockTimeText");
        },
        isStopped: function () {
            return (
                !!(game && game.GameOver) ||
                !!reviewMode ||
                !gameActive ||
                !!positionSetupMode
            );
        },
        onFlag: function () {
            outOfTime();
        },
    });
    const Status = StatusBar.create({
        getElement: function () {
            return $("desktopPlayStatusBar");
        },
        getDefaultText: function () {
            return StatusBar.defaultStatusText({
                hasGame: !!game,
                gameActive: gameActive,
                positionSetup: positionSetupMode,
                configuration: configurationMode,
                review: reviewMode,
                boardHasPieces: boardHasPieces(),
                gameOver: !!(game && game.GameOver),
                canPlayAdvancedTools: canPlayAdvancedTools,
            });
        },
        onAfterRender: function (event) {
            headerEventMessage = event.message;
            headerEventKind = event.kind;
            updateHeaderClockHighlight();
        },
    });

    let game = null;
    const Settings = window.DesktopGameSettings;
    const Engine = window.DesktopEngine;
    const GameLog = window.DesktopGameLog;
    const Dialog = window.DesktopDialog;
    const NewGameDialog = window.DesktopNewGameDialog;
    const Resume = window.DesktopPlayResume;

    let session = null;
    let gameActive = false;
    let currentPlayerIsWhite = true;
    let lastMove = null;
    let autoCompletePromotion = false;
    let dialogOn = false;
    let lastCheckNotifySide = null;
    let alertMode = false;
    let headerEventMessage = null;
    let headerEventKind = null;
    let animating = false;
    let engineThinking = false;
    let redoPairAvailable = false;
    let allowUndo = true;
    /** Position Setup + Config — always on for Electron; web uses launch-context. */
    let canPlayAdvancedTools = true;
    /** Debug / Practice — Admin/Partner only (web launch-context). */
    let canDebug = true;
    let launchContextPromise = null;
    /** Username from /api/play/launch-context (web); used when New Game dialog omits it. */
    let webLaunchUsername = null;
    let batchUndoRedo = false;
    let loadingBookmark = false;
    let savedGames = [];
    /** @type {"games"|"positions"} */
    const SAVED_LIST_FILTER_STORAGE_KEY = "shmerlingSavedListFilter";

    function loadPersistedSavedListFilter() {
        try {
            const stored = localStorage.getItem(SAVED_LIST_FILTER_STORAGE_KEY);
            if (stored === "positions" || stored === "games") {
                return stored;
            }
        } catch {
            /* ignore */
        }
        return "games";
    }

    function persistSavedListFilter(filter) {
        try {
            localStorage.setItem(SAVED_LIST_FILTER_STORAGE_KEY, filter);
        } catch {
            /* ignore */
        }
    }

    let savedListFilter = loadPersistedSavedListFilter();
    let expandedSavedGameId = null;
    let lastLoadedSavedGameId = null;
    let editingSavedGameId = null;
    let renamingSavedGameId = null;
    /** @type {Set<string>} */
    const selectedSavedGameIds = new Set();
    /** @type {Map<string, ReturnType<typeof setTimeout>>} */
    const savedGameSingleClickTimers = new Map();
    let positionSetupMode = false;
    let configurationMode = false;
    let reviewMode = false;
    /** Local self-play / Debug on /play (Phase 6). */
    let practiceMode = false;
    let reviewFullMoves = [];
    let reviewOriginStateStr = null;
    /** Starting position for the active game; survives exitReviewMode for auto-save. */
    let playOriginStateStr = null;
    /** Full move list from a loaded bookmark, shown in the panel until play adds moves. */
    let loadedBookmarkDisplayMoves = null;
    let reviewFinalStateStr = null;
    /** Game result (1-0, 0-1, etc.) from loaded bookmark; kept for review at earlier plies. */
    let reviewResultMoveStr = null;
    /** @type {"resign"|"draw"|"checkmate"|"timeout"|null} */
    let reviewEndKind = null;
    /** Resigning side from the loaded bookmark final state (for review playback). */
    let reviewResignedColor = null;
    let reviewPlyIndex = 0;
    /** When set, Play continues from this ply and drops later moves. */
    let reviewBranchPly = null;
    let reviewPlaybackPlaying = false;
    let reviewPlaybackToken = 0;
    let reviewNavMounted = false;
    /** @type {{ start?: HTMLButtonElement, back?: HTMLButtonElement, playPause?: HTMLButtonElement, forward?: HTMLButtonElement, end?: HTMLButtonElement, playIcon?: HTMLElement, pauseIcon?: HTMLElement }|null} */
    let reviewNavEls = null;
    const REVIEW_PLAYBACK_STEP_DELAY_MS = 500;
    let positionSetupSnapshot = null;
    let playSessionReady = false;
    let positionSetupPanelMounted = false;
    let configurationPanelMounted = false;
    let gameRunPanelMounted = false;
    let currentGameId = null;
    let gameHistoryLogged = false;
    let gameAutoBookmarked = false;
    /** @type {ReturnType<typeof GameSessionApi.create>|null} */
    let playGameSession = null;
    /** @type {ReturnType<typeof LocalEngineModeApi.create>|null} */
    let playLocalEngineMode = null;
    /** @type {ReturnType<typeof OnlineModeApi.create>|null} */
    let playOnlineMode = null;
    /** @type {object|null} server gameInfo for OnlineGame on /play */
    let onlineGameInfo = null;
    /** Prefer-Play public SP mirrored to server for Active Games + watch */
    let spServerSync = null;
    let spServerGameMeta = null;
    /** Opponent left the WS (Phase 4 chrome: red name, hide clock). */
    let opponentConnectionLost = false;
    /** @type {boolean|null} which seat is disconnected (from server); used for watchers + chrome */
    let disconnectedSeatIsWhite = null;
    /** @type {"history"|"pgn"|null} last server review launch type (for URL keep) */
    let lastServerReviewType = null;
    /** @type {ReturnType<typeof ReviewModeApi.create>|null} */
    let playReviewMode = null;
    /** @type {ReturnType<typeof PracticeModeApi.create>|null} */
    let playPracticeMode = null;
    /** @type {ReturnType<typeof PositionSetupModeApi.create>|null} */
    let playPositionSetupMode = null;
    /** @type {ReturnType<typeof ConfigurationModeApi.create>|null} */
    let playConfigurationMode = null;
    /** @type {import("../../session/contracts").ModeCapabilities|null} */
    let playCapabilities = null;

    function $(id) {
        return document.getElementById(id);
    }

    function generateGameId() {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }
        return (
            Date.now().toString(36) +
            "-" +
            Math.random().toString(36).slice(2, 10)
        );
    }

    function assignNewGameId() {
        currentGameId = generateGameId();
        updateGameModeTooltip();
    }

    function setCurrentGameId(id) {
        currentGameId = id ? String(id) : null;
        updateGameModeTooltip();
    }

    function detachSpServerSync() {
        if (spServerSync && typeof spServerSync.detach === "function") {
            try {
                spServerSync.detach();
            } catch {
                /* ignore */
            }
        }
        spServerSync = null;
        spServerGameMeta = null;
    }

    function spSyncClockPayload(moverIsWhite) {
        const clocks = Clocks.get();
        const whiteTimer = clocks && typeof clocks.white === "number" ? clocks.white : 0;
        const blackTimer = clocks && typeof clocks.black === "number" ? clocks.black : 0;
        return {
            whiteTimer: whiteTimer,
            blackTimer: blackTimer,
            moveTime: moverIsWhite ? whiteTimer : blackTimer,
        };
    }

    function movePayloadForSpServer(move, source) {
        if (!move || !game) {
            return move;
        }
        const toPayload =
            SpServerSyncApi && typeof SpServerSyncApi.toServerMovePayload === "function"
                ? SpServerSyncApi.toServerMovePayload
                : null;
        if (toPayload) {
            return toPayload(move, {
                source: source || "",
                whitePlayerView: game.WhitePlayerView,
                flipMove: typeof game.flipMove === "function" ? game.flipMove.bind(game) : null,
            });
        }
        /* Fallback if older spServerSync bundle is cached without helper. */
        if (
            (source || "") === "engine" &&
            game.WhitePlayerView === false &&
            typeof game.flipMove === "function"
        ) {
            return game.flipMove(Object.assign({}, move, { valid: move.valid !== false }));
        }
        return Object.assign({}, move, { valid: move.valid !== false });
    }

    function syncSpMoveToServer(executed, source) {
        if (!spServerSync || !spServerSync.isReady || !spServerSync.isReady() || !executed) {
            return;
        }
        const src = source || "";
        const payload = movePayloadForSpServer(executed, src);
        if (src === "engine") {
            spServerSync.sendEngineMove(payload, spSyncClockPayload(!currentPlayerIsWhite));
        } else if (src === "human" || src === "promotion" || src === "session") {
            spServerSync.sendHumanMove(payload, spSyncClockPayload(currentPlayerIsWhite));
        }
        spServerSync.sendClockSync(spSyncClockPayload(currentPlayerIsWhite));
    }

    async function createPublicSpServerGame(launchOpts) {
        if (!isWebPlayPage() || !Api || typeof Api.post !== "function") {
            return null;
        }
        if (launchOpts && launchOpts.isPrivate === true) {
            return null;
        }
        try {
            const res = await Api.post("/api/play/sp-game", {
                color: launchOpts.color === "black" ? "black" : "white",
                engine: launchOpts.engine || "brain43",
                difficulty:
                    launchOpts.thinkingTimeSeconds != null
                        ? launchOpts.thinkingTimeSeconds
                        : launchOpts.difficulty,
                thinkingTimeSeconds: launchOpts.thinkingTimeSeconds,
                mouse: launchOpts.mouse || "drag",
                showAvailableMoves: launchOpts.showAvailableMoves !== false,
                timeMinutes: launchOpts.timeMinutes != null ? launchOpts.timeMinutes : 90,
                isPrivate: false,
            });
            if (!res || !res.ok || !res.gameId) {
                return null;
            }
            return res;
        } catch (err) {
            console.warn("[Play] Could not register public SP game:", err);
            return null;
        }
    }

    async function attachSpServerSync(meta, humanIsWhite) {
        detachSpServerSync();
        if (!SpServerSyncApi || typeof SpServerSyncApi.create !== "function" || !meta || !meta.gameId) {
            return false;
        }
        const username = resolveHumanUsername(meta.username) || webLaunchUsername || "Player";
        spServerGameMeta = meta;
        spServerSync = SpServerSyncApi.create({
            gameInfo: {
                id: meta.gameId,
                username: username,
                userId: meta.userId != null ? meta.userId : undefined,
                creatorId: meta.creatorId != null ? meta.creatorId : undefined,
            },
            humanIsWhite: humanIsWhite !== false,
            wsUrl: WsTransportApi && typeof WsTransportApi.defaultWsUrl === "function"
                ? WsTransportApi.defaultWsUrl()
                : undefined,
        });
        try {
            await spServerSync.connect();
            return true;
        } catch (err) {
            console.warn("[Play] SP server sync connect failed:", err);
            detachSpServerSync();
            return false;
        }
    }

    function updateGameModeTooltip() {
        const titleEl = $("desktopPlayMatchTitle");
        if (!titleEl) {
            return;
        }
        if (currentGameId) {
            titleEl.title = "Game ID: " + currentGameId;
        } else {
            titleEl.removeAttribute("title");
        }
    }

    /** Let the browser paint (clear move highlights) before heavy work. */
    function yieldForPaint() {
        return new Promise(function (resolve) {
            requestAnimationFrame(function () {
                requestAnimationFrame(resolve);
            });
        });
    }

    function initialClockSeconds() {
        if (session && typeof session.gameTimeMinutes === "number" && session.gameTimeMinutes >= 1) {
            return Math.round(session.gameTimeMinutes * 60);
        }
        return 90 * 60;
    }

    function resetClocks() {
        const white = initialClockSeconds();
        const black =
            session &&
            typeof session.blackTimer === "number" &&
            session.blackTimer > 0
                ? session.blackTimer
                : white;
        Clocks.reset({ white: white, black: black });
    }

    function setClocksToInitialTime() {
        Clocks.set({ white: initialClockSeconds(), black: initialClockSeconds() });
    }

    function updateHeaderClockHighlight() {
        if (!game) {
            return;
        }
        StatusBar.applyClockHighlight(
            {
                headerBlack: $("desktopPlayHeaderBlack"),
                headerWhite: $("desktopPlayHeaderWhite"),
            },
            {
                hasGame: true,
                gameOver: !!game.GameOver,
                suppressForAlert: Status.isNonInfoAlert(),
                turn: game.Turn || (game.GameState && game.GameState.turn),
            },
        );
    }

    function clearHeaderEvent() {
        Status.clear();
    }

    function refreshStatusBar() {
        Status.refresh();
    }

    function updateHeaderTurn() {
        refreshStatusBar();
    }

    function formatSessionTypeLabel() {
        return SessionMode.sessionTypeLabel({
            positionSetup: positionSetupMode,
            configuration: configurationMode,
            reviewPlayback: reviewPlaybackPlaying,
            review: reviewMode,
            watch: !!(onlineGameInfo && onlineGameInfo.watcher),
            practice: practiceMode,
        });
    }

    function updateMatchHeader() {
        StatusBar.applyMatchHeader(
            {
                titleEl: $("desktopPlayMatchTitle"),
                whiteNameEl: $("desktopPlayWhiteName"),
                blackNameEl: $("desktopPlayBlackName"),
            },
            {
                title: formatSessionTypeLabel(),
                updateNames: !!session,
                whiteName: session && session.whitePlayerName,
                blackName: session && session.blackPlayerName,
            },
        );
        applyOpponentConnectionChrome();
        updateGameModeTooltip();
    }

    function applyOpponentConnectionChrome() {
        const whiteClock = $("desktopPlayHeaderWhite");
        const blackClock = $("desktopPlayHeaderBlack");
        const whiteName = $("desktopPlayWhiteName");
        const blackName = $("desktopPlayBlackName");
        const clsClock = "desktop-play-header-clock--disconnected";
        const clsName = "desktop-play-header-player--disconnected";
        if (whiteClock) {
            whiteClock.classList.remove(clsClock);
        }
        if (blackClock) {
            blackClock.classList.remove(clsClock);
        }
        if (whiteName) {
            whiteName.classList.remove(clsName);
        }
        if (blackName) {
            blackName.classList.remove(clsName);
        }
        if (!opponentConnectionLost || !onlineGameInfo) {
            return;
        }
        /* Prefer server-reported seat; fall back to "the opponent" for participants. */
        let markWhiteDisconnected;
        if (typeof disconnectedSeatIsWhite === "boolean") {
            markWhiteDisconnected = disconnectedSeatIsWhite;
        } else if (onlineGameInfo.watcher) {
            return;
        } else {
            markWhiteDisconnected = !currentPlayerIsWhite;
        }
        if (markWhiteDisconnected) {
            if (whiteClock) {
                whiteClock.classList.add(clsClock);
            }
            if (whiteName) {
                whiteName.classList.add(clsName);
            }
        } else {
            if (blackClock) {
                blackClock.classList.add(clsClock);
            }
            if (blackName) {
                blackName.classList.add(clsName);
            }
        }
    }

    function setOpponentConnectionLost(lost, seatIsWhite) {
        opponentConnectionLost = !!lost;
        if (!lost) {
            disconnectedSeatIsWhite = null;
        } else if (typeof seatIsWhite === "boolean") {
            disconnectedSeatIsWhite = seatIsWhite;
        }
        applyOpponentConnectionChrome();
    }

    function syncPrimaryGameButtonLabel() {
        const btn = $("rematchBtn");
        if (!btn) {
            return;
        }
        const isOnline = !!(
            onlineGameInfo &&
            onlineGameInfo.gameType === "OnlineGame" &&
            playOnlineMode
        );
        const text = isOnline
            ? t("play.status.rematchTitle")
            : t("play.actions.newGame");
        btn.title = text;
        const label = btn.querySelector(".desktop-play-action-label");
        if (label) {
            label.textContent = text;
        }
    }

    function switchClocks() {
        Clocks.stop();
        updateHeaderTurn();
        Clocks.startFor(game.Turn);
    }

    function outOfTime() {
        if (reviewMode || !gameActive || positionSetupMode || configurationMode) {
            Clocks.stop();
            return;
        }
        if (playOnlineMode && typeof playOnlineMode.reportOutOfTime === "function") {
            playOnlineMode.reportOutOfTime(game && game.Turn);
            return;
        }
        if (spServerSync && spServerSync.isReady && spServerSync.isReady() && game && game.Turn) {
            spServerSync.sendOutOfTime(game.Turn, spSyncClockPayload(game.Turn === "white"));
        }
        const gs = ensurePlayGameSession();
        if (gs && typeof gs.flagTimeout === "function") {
            gs.flagTimeout(game.Turn);
            return;
        }
        const loser = game.Turn;
        showStatus(t("play.status.timesUpLost", { loser: localizeColorName(loser) }), 5000, "timeout");
        game.OutOfTime = loser;
        updateMovesTable(tableMovesFromGame());
        updateActionButtons();
        tryLogCompletedGame();
    }

    function canProcessCompletedGame() {
        return (
            game &&
            game.GameOver &&
            gameActive &&
            !reviewMode &&
            !positionSetupMode &&
            !configurationMode &&
            tableMovesFromGame().length > 0
        );
    }

    async function tryAutoSaveCompletedGame() {
        if (gameAutoBookmarked || !canProcessCompletedGame() || !session || !Api.post) {
            return;
        }
        const state = game.GameState;
        if (!state) {
            return;
        }
        gameAutoBookmarked = true;
        try {
            const bookmark = await Api.post(
                "/bookmark",
                bookmarkPayloadFromCurrentState(formatAutoSaveGameName(), bookmarkMovesPayload()),
            );
            await mergeBookmarkIntoList(bookmark);
            updateSavedListFilterUi();
            renderSavedGamesList();
        } catch (err) {
            gameAutoBookmarked = false;
            console.error("Could not auto-save completed game:", err);
        }
    }

    function tryLogCompletedGame() {
        if (!canProcessCompletedGame()) {
            return;
        }
        if (!gameHistoryLogged && GameLog && typeof GameLog.appendCompletedGame === "function") {
            const moves = tableMovesFromGame();
            const resultMove = game.ResultMove;
            const payload = {
                whitePlayer: session && session.whitePlayerName ? session.whitePlayerName : "White",
                blackPlayer: session && session.blackPlayerName ? session.blackPlayerName : "Black",
                result: resultMove && resultMove.moveStr ? resultMove.moveStr : "*",
                moves: moves.map(function (m) {
                    return {
                        moveStr: m.moveStr || "",
                        turn: m.turn,
                        piece: m.piece,
                    };
                }),
                engine: session && session.engine ? session.engine : undefined,
                thinkingTimeSeconds:
                    session && session.thinkingTimeSeconds != null
                        ? session.thinkingTimeSeconds
                        : session && session.difficulty != null
                          ? session.difficulty
                          : undefined,
                termination: game.GameOverReason || "",
            };

            gameHistoryLogged = true;
            GameLog.appendCompletedGame(payload).catch(function (err) {
                gameHistoryLogged = false;
                console.error("Could not append game to PGN log:", err);
            });
        }
        tryAutoSaveCompletedGame();
    }

    /**
     * Show a game event in the bottom status bar.
     * @param {string} message
     * @param {number} [durationMs] Auto-clear after ms; omit to keep until cleared.
     * @param {string} [kind] check | checkmate | draw | promotion | info | timeout | error
     */
    function showStatus(message, durationMs, kind) {
        if (!message) {
            clearHeaderEvent();
            return;
        }
        Status.show(message, durationMs, kind);
        alertMode = (kind || "info") !== "info";
    }

    function setButtonDisabled(id, disabled) {
        ActionRail.setDisabled(id, disabled, document);
    }

    function resolveAllowUndo(info) {
        if (info && info.allowUndo === true) {
            return true;
        }
        if (info && info.allowUndo === false) {
            return false;
        }
        try {
            const raw = localStorage.getItem("shmerling.desktop.lastGameOptions");
            if (raw) {
                const last = JSON.parse(raw);
                if (last.allowUndo === true) {
                    return true;
                }
                if (last.allowUndo === false) {
                    return false;
                }
            }
        } catch (e) {
            /* ignore */
        }
        return false;
    }

    function pauseClocksForSetup() {
        Clocks.stop();
    }

    function capturePositionSetupSnapshot() {
        const clocks = Clocks.get();
        return {
            stateStr: JSON.stringify(game.GameState),
            moves: tableMovesFromGame(),
            whiteTimer: clocks.white,
            blackTimer: clocks.black,
            clocksWereRunning: Clocks.isRunning(),
            currentPlayerIsWhite: currentPlayerIsWhite,
            whitePlayerView: game.WhitePlayerView,
        };
    }

    function restorePositionSetupSnapshot() {
        if (!positionSetupSnapshot) {
            return;
        }
        game.loadGame(positionSetupSnapshot.stateStr);
        game.loadMoves(positionSetupSnapshot.moves);
        if (typeof positionSetupSnapshot.currentPlayerIsWhite === "boolean") {
            currentPlayerIsWhite = positionSetupSnapshot.currentPlayerIsWhite;
            if (Board.setHumanColor) {
                Board.setHumanColor(currentPlayerIsWhite);
            }
        }
        if (typeof positionSetupSnapshot.whitePlayerView === "boolean") {
            game.WhitePlayerView = positionSetupSnapshot.whitePlayerView;
            Board.setPlayerView(positionSetupSnapshot.whitePlayerView);
        }
        Clocks.set({
            white: positionSetupSnapshot.whiteTimer,
            black: positionSetupSnapshot.blackTimer,
        });
        Board.syncFromGameState();
        updateMovesTable(positionSetupSnapshot.moves);
        updateHeaderTurn();
        if (positionSetupSnapshot.clocksWereRunning && !game.GameOver) {
            switchClocks();
        }
        positionSetupSnapshot = null;
    }

    function applySetupTurn(turn) {
        if (!game || !game.GameState) {
            return;
        }
        const next = turn === "black" ? "black" : "white";
        if (positionSetupMode) {
            Board.mutateSetupBoard(
                function (state) {
                    state.turn = next;
                },
                { skipKingRookSync: true },
            );
            if (Setup && Setup.syncStatusFlagsFromGame) {
                Setup.syncStatusFlagsFromGame();
            }
        } else if (!gameActive && boardHasPieces()) {
            const state = JSON.parse(JSON.stringify(game.GameState));
            state.turn = next;
            game.loadGame(JSON.stringify(state));
            Board.syncFromGameState();
        }
        if (Setup && Setup.syncTurnSelection) {
            Setup.syncTurnSelection(next);
        }
        updateHeaderTurn();
    }

    function applySetupComputerColor(isComputerWhite) {
        currentPlayerIsWhite = !isComputerWhite;
        if (Board.setHumanColor) {
            Board.setHumanColor(currentPlayerIsWhite);
        }
        syncSessionPlayerNames();
        updateMatchHeader();
        updateActionButtons();
    }

    function applySetupThinkingTime(seconds) {
        if (!session) {
            return;
        }
        const next = Settings.normalizeThinkingTimeSeconds
            ? Settings.normalizeThinkingTimeSeconds(seconds)
            : parseInt(seconds, 10) || 10;
        session = Object.assign({}, session, {
            thinkingTimeSeconds: next,
            difficulty: next,
        });
    }

    /** @deprecated */
    function applySetupDepth(depth) {
        applySetupThinkingTime(depth);
    }

    function applySetupEngine(engine) {
        if (!session) {
            return;
        }
        const engineId =
            Settings.normalizeEngine && engine
                ? Settings.normalizeEngine(engine)
                : engine === "brain41"
                  ? "brain41"
                  : "brain43";
        session = Settings.buildSession({
            color: currentPlayerIsWhite ? "white" : "black",
            engine: engineId,
            thinkingTimeSeconds: session.thinkingTimeSeconds != null
                ? session.thinkingTimeSeconds
                : session.difficulty,
            difficulty: session.thinkingTimeSeconds != null
                ? session.thinkingTimeSeconds
                : session.difficulty,
            mouse: session.mousePreference,
            showAvailableMoves: session.showAvailableMoves,
            allowUndo: session.allowUndo,
            timeMinutes: session.gameTimeMinutes,
            username: resolveHumanUsername(session.username),
        });
        if (Settings.saveNewGameOptions) {
            Settings.saveNewGameOptions({
                color: currentPlayerIsWhite ? "white" : "black",
                engine: engineId,
                allowUndo: session.allowUndo !== false,
                timeMinutes: session.gameTimeMinutes,
                mouse: session.mousePreference,
                thinkingTimeSeconds: session.thinkingTimeSeconds,
                showAvailableMoves: session.showAvailableMoves,
            });
        }
        updateMatchHeader();
    }

    function applyGameRunPanelOptions(setupOpts) {
        currentPlayerIsWhite = setupOpts.humanIsWhite !== false;
        if (setupOpts.engine != null) {
            applySetupEngine(setupOpts.engine);
        }
        if (setupOpts.thinkingTimeSeconds != null || setupOpts.depth != null || setupOpts.difficulty != null) {
            applySetupThinkingTime(
                setupOpts.thinkingTimeSeconds != null
                    ? setupOpts.thinkingTimeSeconds
                    : setupOpts.depth != null
                      ? setupOpts.depth
                      : setupOpts.difficulty,
            );
        }
        if (Board.setHumanColor) {
            Board.setHumanColor(currentPlayerIsWhite);
        }
    }

    function clearSetupBoard() {
        Board.mutateSetupBoard(function (state) {
            state.board = Array.from({ length: game.BOARD_ROWS }, function () {
                return Array(game.BOARD_COLUMNS).fill(null);
            });
            state.capturedPiecesList = [];
        });
    }

    function syncEmptyBoard() {
        if (!game) {
            return;
        }
        const whiteView = game.WhitePlayerView !== false;
        if (!game.GameState) {
            game.startNewGame(whiteView);
        }
        Board.mutateSetupBoard(function (state) {
            state.board = Array.from({ length: game.BOARD_ROWS }, function () {
                return Array(game.BOARD_COLUMNS).fill(null);
            });
            state.capturedPiecesList = [];
            state.gameOver = false;
            state.promoting = false;
            state.check = false;
            state.checkmate = false;
            state.draw = false;
        });
        game.loadMoves([]);
        Board.syncFromGameState();
        if (Board.updateCaptureLists) {
            Board.updateCaptureLists([]);
        }
        if (Board.clearKingHighlights) {
            Board.clearKingHighlights();
        }
    }

    function loadDefaultSetupBoard() {
        const wv = game.GameState && game.GameState.whitePlayerView !== false;
        game.startNewGame(wv);
        Board.syncFromGameState();
        if (Board.mutateSetupBoard) {
            Board.mutateSetupBoard(function () {}, {});
        }
    }

    function updateSetupCursor() {
        if (!Setup || !Setup.applySetupCursor) {
            return;
        }
        Setup.applySetupCursor(document.getElementById("innerBoard"), Setup.getSelection());
    }

    function setPositionSetupUi(active) {
        const on = !!active;
        if (on && configurationMode) {
            setConfigurationUi(false);
        }
        positionSetupMode = on;
        DockModeChrome.applyDockModes(
            {
                sidebar: $("desktopPlaySidebarMoves"),
                positionSetupBtn: $("positionSetupBtn"),
                configurationBtn: $("configurationBtn"),
            },
            {
                positionSetup: positionSetupMode,
                configuration: configurationMode,
            },
        );
        updateMatchHeader();
        updateActionButtons();
    }

    function setConfigurationUi(active) {
        const on = !!active;
        if (on && positionSetupMode) {
            Board.setSetupMode(false);
            positionSetupMode = false;
        }
        configurationMode = on;
        DockModeChrome.applyDockModes(
            {
                sidebar: $("desktopPlaySidebarMoves"),
                positionSetupBtn: $("positionSetupBtn"),
                configurationBtn: $("configurationBtn"),
            },
            {
                positionSetup: positionSetupMode,
                configuration: configurationMode,
            },
        );
        updateMatchHeader();
        updateActionButtons();
    }

    function exitConfigurationMode() {
        if (!configurationMode) {
            return;
        }
        if (BrainConfig && BrainConfig.hasUnsavedChanges && BrainConfig.hasUnsavedChanges()) {
            const proceed = window.confirm(t("play.dialogs.discardUnsavedBrainConfig"));
            if (!proceed) {
                return false;
            }
        }
        setConfigurationUi(false);
        playConfigurationMode = null;
        showStatus("");
        restoreModeAfterDockExit();
        updateActionButtons();
        restoreSidebarPreferences();
        updateMatchHeader();
        return true;
    }

    function enterConfigurationMode() {
        if (!game || !playSessionReady) {
            showStatus(t("play.status.boardLoading"), 2500, "info");
            return;
        }
        if (!canUseBrainConfig()) {
            if (isNetworkSessionActive()) {
                showStatus(t("play.status.leaveOnlineBeforeConfiguration"), 3500, "info");
            } else if (practiceMode) {
                showStatus(t("play.status.configurationNotInPractice"), 3500, "info");
            }
            return;
        }
        exitReviewMode();
        if (positionSetupMode) {
            exitPositionSetupMode(false);
        }
        clearOnlineSessionForLocalTools();
        setConfigurationUi(true);
        expandMovesSidebar();
        ensureConfigurationPanel();
        if (BrainConfig && BrainConfig.syncEngine) {
            const engine = session && session.engine ? session.engine : "brain43";
            BrainConfig.syncEngine(engine);
        }
        ensurePlayGameSession();
        attachPlayConfigurationMode();
        showStatus(t("play.status.configurationModeEdit"), 0, "info");
        updateActionButtons();
    }

    function ensureConfigurationPanel() {
        if (configurationPanelMounted || !BrainConfig) {
            return;
        }
        const panel = $("desktopPlayConfigPanel");
        if (!panel) {
            return;
        }
        BrainConfig.mountPanel(panel, {
            initialEngine: session && session.engine ? session.engine : "brain43",
        });
        configurationPanelMounted = true;
    }

    function onConfigurationToggle() {
        const btn = $("configurationBtn");
        if (btn && btn.disabled) {
            return;
        }
        if (!playSessionReady || !game) {
            showStatus(t("play.status.boardLoading"), 2500, "info");
            return;
        }
        if (configurationMode) {
            exitConfigurationMode();
            return;
        }
        if (!canUseBrainConfig()) {
            return;
        }
        enterConfigurationMode();
    }

    function restoreSidebarPreferences() {
        if (window.DesktopDockPanels && typeof DesktopDockPanels.applySavedPreferences === "function") {
            DesktopDockPanels.applySavedPreferences();
        }
    }

    function expandMovesSidebar() {
        const sidebar = $("desktopPlaySidebarMoves");
        if (!sidebar) {
            return;
        }
        if (window.DesktopDockPanels && DesktopDockPanels.setSidebarCollapsed) {
            DesktopDockPanels.setSidebarCollapsed(sidebar, false, { persist: false });
            return;
        }
        sidebar.classList.remove("desktop-play-sidebar--collapsed");
        const expandTab = sidebar.querySelector(".desktop-play-sidebar-tab--expand");
        if (expandTab) {
            expandTab.hidden = true;
        }
        sidebar.querySelectorAll(".desktop-play-dock-toggle--collapse").forEach(function (btn) {
            btn.hidden = false;
        });
        if (window.DesktopBoardScale && typeof window.DesktopBoardScale.refresh === "function") {
            window.DesktopBoardScale.refresh();
        }
    }

    function setGameRunPanelVisible(visible) {
        DockModeChrome.setGameRunVisible($("desktopPlayHeaderRun"), visible);
    }

    function updateGameRunPanelVisibility() {
        setGameRunPanelVisible(
            SessionMode.shouldShowGameRun({
                positionSetup: positionSetupMode,
                gameActive: gameActive,
                hasLoadedSavedGame: !!lastLoadedSavedGameId,
                boardHasPieces: boardHasPieces(),
            }),
        );
    }

    function ensureGameRunPanel() {
        if (gameRunPanelMounted || !GameRun) {
            return;
        }
        const panel = $("desktopPlayGameRun");
        if (!panel) {
            return;
        }
        GameRun.mount(panel, {
            initialTurn: game && game.Turn ? game.Turn : "white",
            initialComputerIsWhite: !currentPlayerIsWhite,
            initialEngine:
                session && session.engine
                    ? session.engine
                    : Settings.loadLastOptions().engine,
            initialThinkingTimeSeconds:
                session && session.thinkingTimeSeconds != null
                    ? session.thinkingTimeSeconds
                    : session && session.difficulty != null
                      ? session.difficulty
                      : Settings.loadLastOptions().thinkingTimeSeconds,
            onPlay: runGameFromPanel,
            onTurnChange: applySetupTurn,
            onComputerColorChange: applySetupComputerColor,
            onThinkingTimeChange: applySetupThinkingTime,
            onDepthChange: applySetupThinkingTime,
            onEngineChange: applySetupEngine,
        });
        gameRunPanelMounted = true;
        setGameRunPanelVisible(false);
    }

    function syncGameRunPanelOptions() {
        if (!GameRun || !GameRun.syncOptions) {
            return;
        }
        let turn = "white";
        if (reviewMode && reviewFullMoves.length) {
            turn = reviewNextTurnAfterPly(reviewPlyIndex);
        } else if (
            game &&
            (game.Turn || (game.GameState && game.GameState.turn))
        ) {
            turn = game.Turn || game.GameState.turn;
        }
        GameRun.syncOptions({
            turn: turn,
            computerIsWhite: !currentPlayerIsWhite,
            engine:
                session && session.engine
                    ? session.engine
                    : Settings.loadLastOptions().engine,
            thinkingTimeSeconds:
                session && session.thinkingTimeSeconds != null
                    ? session.thinkingTimeSeconds
                    : session && session.difficulty != null
                      ? session.difficulty
                      : Settings.loadLastOptions().thinkingTimeSeconds,
            depth:
                session && session.thinkingTimeSeconds != null
                    ? session.thinkingTimeSeconds
                    : session && session.difficulty != null
                      ? session.difficulty
                      : Settings.loadLastOptions().thinkingTimeSeconds,
        });
    }

    function boardHasPieces() {
        if (!game || !game.GameState || !game.GameState.board) {
            return false;
        }
        const board = game.GameState.board;
        for (let r = 0; r < board.length; r++) {
            const row = board[r];
            if (!row) {
                continue;
            }
            for (let c = 0; c < row.length; c++) {
                if (row[c]) {
                    return true;
                }
            }
        }
        return false;
    }

    async function runGameFromPanel() {
        if (positionSetupMode) {
            await applyPositionSetup();
            return;
        }
        if (!boardHasPieces()) {
            showStatus(
                t("play.status.selectSavedOrSetup"),
                3000,
                "info",
            );
            return;
        }
        if (gameActive) {
            showStatus(t("play.status.gameAlreadyInProgress"), 2500, "info");
            return;
        }
        await startGameFromLoadedPosition();
    }

    async function startGameFromLoadedPosition() {
        if (!game || !game.GameState) {
            return;
        }
        if (!validatePositionSetup("play")) {
            return;
        }
        const setupOpts =
            GameRun && GameRun.getOptions
                ? GameRun.getOptions()
                : { turn: "white", humanIsWhite: currentPlayerIsWhite };
        const state = cloneSetupStateForPlay();
        state.turn = setupOpts.turn === "black" ? "black" : "white";
        state.gameOver = false;
        state.promoting = false;
        state.capturedPiecesList = state.capturedPiecesList || [];
        const branchPly = reviewMode && reviewBranchPly != null ? reviewBranchPly : null;
        let continuedMoves;
        if (branchPly != null) {
            continuedMoves = reviewFullMoves.slice(0, branchPly).map(cloneReviewMove);
        } else {
            continuedMoves = reviewFullMoves.length
                ? reviewFullMoves.map(cloneReviewMove)
                : Array.isArray(game.Moves) && game.Moves.length
                  ? game.Moves.slice()
                  : [];
        }
        game.loadGame(JSON.stringify(state));
        game.loadMoves(continuedMoves);
        const playOriginSnapshot =
            reviewOriginStateStr ||
            (continuedMoves.length === 0 ? JSON.stringify(state) : null);
        applyGameRunPanelOptions(setupOpts);
        assignNewGameId();
        gameHistoryLogged = false;
        gameAutoBookmarked = false;
        setClocksToInitialTime();
        redoPairAvailable = false;
        lastCheckNotifySide = null;
        alertMode = false;
        Board.syncFromGameState();
        if (Board.updateCaptureLists && game.GameState.capturedPiecesList) {
            Board.updateCaptureLists(game.GameState.capturedPiecesList);
        }
        exitReviewMode();
        if (playOriginSnapshot) {
            setPlayOriginState(playOriginSnapshot);
        }
        updateMovesTable(movesForMovesTable(movesForPanelDisplay()));
        updateMatchHeader();
        updateHeaderTurn();
        gameActive = true;
        exitConfigurationIfGameStarting();
        document.body.classList.add("desktop-play-has-active-game");
        if (Board.setHumanPlayEnabled) {
            Board.setHumanPlayEnabled(true);
        }
        updateActionButtons();
        editingSavedGameId = null;
        updateGameRunPanelVisibility();
        persistActiveGame();
        ensurePlayGameSession();
        if (!game.GameOver && isHumanTurn()) {
            switchClocks();
            showStatus(t("play.status.yourMove"), 2000, "info");
        } else if (!game.GameOver && isAiTurn()) {
            switchClocks();
            showStatus(t("play.status.engineToMove"), 0, "info");
            await runEngineMove();
        }
    }

    function ensurePositionSetupPanel() {
        if (positionSetupPanelMounted || !Setup) {
            return;
        }
        const panel = $("desktopPlaySetupPanel");
        if (!panel) {
            return;
        }
        Setup.mountPanel(panel, {
            game: game,
            initialTurn: game.Turn || (game.GameState && game.GameState.turn) || "white",
            initialHumanIsWhite: currentPlayerIsWhite,
            onClearBoard: clearSetupBoard,
            onDefaultBoard: loadDefaultSetupBoard,
            onSavePosition: saveSetupPosition,
            onSavePositionAs: saveSetupPositionAs,
            onValidatePosition: validateSetupPosition,
            onSelectTool: updateSetupCursor,
            onTurnChange: applySetupTurn,
        });
        positionSetupPanelMounted = true;
    }

    function enterPositionSetupMode() {
        if (!game || !game.GameState) {
            showStatus(t("play.status.boardNotReady"), 3000, "info");
            return;
        }
        if (!canUsePositionSetup()) {
            if (isNetworkSessionActive()) {
                showStatus(t("play.status.leaveOnlineBeforePositionSetup"), 3500, "info");
            } else if (practiceMode) {
                showStatus(t("play.status.positionSetupNotInPractice"), 3500, "info");
            }
            return;
        }
        if (configurationMode) {
            if (!exitConfigurationMode()) {
                return;
            }
        }
        exitReviewMode();
        clearOnlineSessionForLocalTools();
        setPositionSetupUi(true);
        setCurrentGameId(null);
        positionSetupSnapshot = capturePositionSetupSnapshot();
        pauseClocksForSetup();
        Board.clearArrows();
        expandMovesSidebar();
        ensurePositionSetupPanel();
        Board.setSetupMode(true, {
            getSelection: function () {
                return Setup ? Setup.getSelection() : null;
            },
            onCursorUpdate: updateSetupCursor,
        });
        if (Setup && Setup.resetDefaultSelection) {
            Setup.resetDefaultSelection();
        } else {
            updateSetupCursor();
        }
        const moveCount = game.Moves ? game.Moves.length : 0;
        if (moveCount === 0 && !game.GameOver && !boardHasPieces()) {
            clearSetupBoard();
        } else {
            Board.syncFromGameState();
        }
        syncGameRunPanelOptions();
        updateGameRunPanelVisibility();
        if (Setup && Setup.syncTurnSelection) {
            const setupTurn =
                game.GameState && game.GameState.turn === "black" ? "black" : "white";
            Setup.syncTurnSelection(setupTurn);
        }
        if (Board.mutateSetupBoard) {
            Board.mutateSetupBoard(function () {}, {});
        } else if (Setup && Setup.refreshFlagCheckboxes) {
            Setup.refreshFlagCheckboxes();
        }
        ensurePlayGameSession();
        attachPlayPositionSetupMode();
        showStatus(t("play.status.positionSetupPlacePieces"), 0, "info");
        updateActionButtons();
    }

    function syncPositionSetupStatusLine() {
        if (!positionSetupMode || !game || !game.GameState) {
            return;
        }
        const gameState = game.GameState;
        if (gameState.draw) {
            showStatus(t("play.status.drawWithReason", { reason: localizeDrawReason(gameState.drawReason) }), 0, "draw");
            return;
        }
        if (gameState.checkmate) {
            const winner = game.opponent(game.Turn);
            showStatus(t("play.status.checkmateWins", { winner: localizeColorName(winner) }), 0, "checkmate");
            return;
        }
        if (gameState.check) {
            showStatus(t("play.status.check"), 0, "check");
            return;
        }
        showStatus(t("play.status.positionSetupPlacePieces"), 0, "info");
    }

    function exitPositionSetupMode(restore) {
        Board.setSetupMode(false);
        clearDisplayedEvaluation();
        setPositionSetupUi(false);
        playPositionSetupMode = null;
        showStatus("");
        if (restore && positionSetupSnapshot) {
            restorePositionSetupSnapshot();
            editingSavedGameId = null;
        } else {
            positionSetupSnapshot = null;
        }
        if (!restore) {
            /* Playing from setup — LocalEngine attaches via ensurePlayGameSession. */
        } else {
            restoreModeAfterDockExit();
        }
        updateGameRunPanelVisibility();
        updateActionButtons();
        restoreSidebarPreferences();
        updateMatchHeader();
    }

    function clearDisplayedEvaluation() {
        if (Board && Board.clearEvaluationOverlay) {
            Board.clearEvaluationOverlay();
        }
        EvaluationDisplay.clearStatusTooltip($("desktopPlayStatusBar"));
    }

    async function displayPositionEvaluation() {
        if (!game || !game.GameState) {
            showStatus(t("play.status.boardNotReady"), 3000, "info");
            return;
        }
        if (animating || engineThinking) {
            showStatus(t("play.status.waitBeforeEvaluate"), 2500, "info");
            return;
        }
        if (!validatePositionSetup("play")) {
            clearDisplayedEvaluation();
            return;
        }
        if (!Engine || typeof Engine.evaluatePosition !== "function") {
            showStatus(t("play.status.evaluationUnavailable"), 0, "error");
            return;
        }
        const state = JSON.parse(JSON.stringify(game.GameState));
        state.fiftyMovesCounter = 0;
        state.promoting = false;
        const useGameRunTurn =
            positionSetupMode ||
            (!gameActive && !!lastLoadedSavedGameId && boardHasPieces());
        const setupOpts =
            useGameRunTurn && GameRun && GameRun.getOptions
                ? GameRun.getOptions()
                : { turn: game.Turn || "white" };
        state.turn = setupOpts.turn === "black" ? "black" : "white";
        try {
            showStatus(t("play.status.evaluatingPosition"), 0, "info");
            const result = await Engine.evaluatePosition({
                gameState: state,
                engine: (session && session.engine) || "brain43",
                pliesPlayed: game.Moves ? game.Moves.length : 0,
            });
            if (Board && Board.showEvaluationOverlay) {
                Board.showEvaluationOverlay(result);
            }
            const scoreText = EvaluationDisplay.formatTotalText(result);
            showStatus(EvaluationDisplay.statusMessage(result), 0, "info");
            EvaluationDisplay.applyStatusTooltip(
                $("desktopPlayStatusBar"),
                result.summary,
                scoreText,
            );
        } catch (err) {
            clearDisplayedEvaluation();
            showStatus(err.message || t("play.status.evaluationFailed"), 0, "error");
        }
    }

    function logGameState() {
        if (!game || !game.GameState) {
            return;
        }
        console.log(JSON.stringify(game.GameState));
    }

    async function openSavedGamesPgnFolder() {
        if (!GameLog || typeof GameLog.openGamesLogFolder !== "function") {
            showStatus(t("play.status.openFolderDesktopOnly"), 3000, "info");
            return;
        }
        try {
            await GameLog.openGamesLogFolder();
        } catch (err) {
            showStatus(err.message || t("play.status.couldNotOpenGamesLogFolder"), 0, "error");
        }
    }

    function handleKeyboardShortcuts(ev) {
        const action = KeyboardShortcuts.resolve(ev);
        if (!action) {
            return;
        }
        ev.preventDefault();
        if (action === "logGameState") {
            logGameState();
            return;
        }
        if (action === "openGamesFolder") {
            openSavedGamesPgnFolder();
            return;
        }
        if (action === "evaluatePosition") {
            displayPositionEvaluation();
        }
    }

    function handleDismissEvaluationOnClick(ev) {
        if (!Board || !Board.isEvaluationOverlayActive || !Board.isEvaluationOverlayActive()) {
            return;
        }
        clearDisplayedEvaluation();
    }

    function validateSetupPosition() {
        if (!game || !game.GameState) {
            return;
        }
        if (validatePositionSetup("play")) {
            showStatus(t("play.status.positionValid"), 2500, "info");
        }
    }

    async function applyPositionSetup() {
        if (!game || !game.GameState) {
            return;
        }
        if (!validatePositionSetup("play")) {
            return;
        }
        clearOnlineSessionForLocalTools();
        practiceMode = false;
        playPracticeMode = null;
        if (Board.setBothSidesHuman) {
            Board.setBothSidesHuman(false);
        }
        assignNewGameId();
        gameHistoryLogged = false;
        gameAutoBookmarked = false;
        const setupOpts =
            GameRun && GameRun.getOptions
                ? GameRun.getOptions()
                : { turn: "white", humanIsWhite: currentPlayerIsWhite };
        const state = cloneSetupStateForPlay();
        state.turn = setupOpts.turn === "black" ? "black" : "white";
        state.gameOver = false;
        state.promoting = false;
        state.capturedPiecesList = state.capturedPiecesList || [];
        game.loadGame(JSON.stringify(state));
        game.loadMoves([]);
        const playOriginSnapshot = JSON.stringify(state);
        applyGameRunPanelOptions(setupOpts);
        setClocksToInitialTime();
        redoPairAvailable = false;
        positionSetupSnapshot = null;
        clearDisplayedEvaluation();
        exitPositionSetupMode(false);
        Board.syncFromGameState();
        updateMatchHeader();
        updateMovesTable([]);
        updateHeaderTurn();
        gameActive = true;
        exitConfigurationIfGameStarting();
        exitReviewMode();
        setPlayOriginState(playOriginSnapshot);
        document.body.classList.add("desktop-play-has-active-game");
        if (Board.setHumanPlayEnabled) {
            Board.setHumanPlayEnabled(true);
        }
        ensurePlayGameSession();
        if (!playLocalEngineMode && LocalEngineModeApi) {
            attachPlayLocalEngineMode();
        }
        updateActionButtons();
        editingSavedGameId = null;
        updateGameRunPanelVisibility();
        if (!game.GameOver) {
            switchClocks();
            if (isHumanTurn()) {
                showStatus(t("play.status.playingFromCustomPosition"), 3000, "info");
            } else {
                showStatus(t("play.status.engineToMove"), 0, "info");
                await runEngineMove();
            }
        }
    }

    function canUsePositionSetup() {
        return SessionMode.canUsePositionSetup({
            canPlayAdvancedTools: canPlayAdvancedTools,
            hasGame: !!game,
            gameOver: !!(game && game.GameOver),
            moveCount: game && game.Moves ? game.Moves.length : 0,
            practice: practiceMode,
            online: !!(onlineGameInfo && onlineGameInfo.gameType === "OnlineGame"),
            watch: !!(onlineGameInfo && onlineGameInfo.watcher),
            network: !!(playCapabilities && playCapabilities.network === true),
        });
    }

    function canUseBrainConfig() {
        return SessionMode.canUseBrainConfig({
            canPlayAdvancedTools: canPlayAdvancedTools,
            positionSetup: positionSetupMode,
            gameActive: gameActive,
            practice: practiceMode,
            online: !!(onlineGameInfo && onlineGameInfo.gameType === "OnlineGame"),
            watch: !!(onlineGameInfo && onlineGameInfo.watcher),
            network: !!(playCapabilities && playCapabilities.network === true),
        });
    }

    function isNetworkSessionActive() {
        return !!(
            playOnlineMode ||
            (onlineGameInfo && onlineGameInfo.gameType === "OnlineGame") ||
            (playCapabilities && playCapabilities.network === true)
        );
    }

    function clearOnlineSessionForLocalTools() {
        if (playOnlineMode && typeof playOnlineMode.detach === "function") {
            try {
                playOnlineMode.detach();
            } catch {
                /* ignore */
            }
        }
        playOnlineMode = null;
        onlineGameInfo = null;
        setOpponentConnectionLost(false);
    }

    function restoreModeAfterDockExit() {
        if (!playGameSession || !game) {
            return;
        }
        if (reviewMode && ReviewModeApi) {
            attachPlayReviewMode();
            return;
        }
        if (practiceMode && PracticeModeApi) {
            attachPlayPracticeMode();
            return;
        }
        if (isNetworkSessionActive()) {
            return;
        }
        if (LocalEngineModeApi && gameActive !== false) {
            attachPlayLocalEngineMode();
        }
    }

    function exitConfigurationIfGameStarting() {
        if (!configurationMode) {
            return;
        }
        setConfigurationUi(false);
        playConfigurationMode = null;
    }

    function exitConfigurationSilently() {
        if (!configurationMode) {
            return;
        }
        setConfigurationUi(false);
        playConfigurationMode = null;
    }

    function enterReviewMode() {
        exitConfigurationSilently();
        if (positionSetupMode) {
            Board.setSetupMode(false);
            setPositionSetupUi(false);
            playPositionSetupMode = null;
        }
        reviewMode = true;
        attachPlayReviewMode();
        expandMovesSidebar();
        updateMatchHeader();
        updateActionButtons();
        updateGameRunPanelVisibility();
        refreshReviewMovesTable();
        updateReviewNavBar();
    }

    function exitReviewMode() {
        if (!reviewMode) {
            stopReviewPlayback();
            updateReviewNavBar();
            return;
        }
        stopReviewPlayback();
        reviewMode = false;
        clearReviewNavigation();
        detachPlayReviewMode();
        updateMatchHeader();
        updateActionButtons();
        updateGameRunPanelVisibility();
        restoreSidebarPreferences();
        updateReviewNavBar();
    }

    function clearReviewNavigation() {
        if (playReviewMode && typeof playReviewMode.clearNavigation === "function") {
            playReviewMode.clearNavigation();
            syncReviewShellFromMode();
            reviewResultMoveStr = null;
            reviewEndKind = null;
            return;
        }
        reviewFullMoves = [];
        reviewOriginStateStr = null;
        reviewFinalStateStr = null;
        reviewResultMoveStr = null;
        reviewEndKind = null;
        reviewResignedColor = null;
        reviewPlyIndex = 0;
        reviewBranchPly = null;
    }

    function syncReviewResultMoveFromGame() {
        if (
            game &&
            game.GameOver &&
            game.ResultMove &&
            game.ResultMove.moveStr
        ) {
            reviewResultMoveStr = game.ResultMove.moveStr;
        }
        /* Do not clear reviewResultMoveStr when replaying mid-game positions. */
    }

    /**
     * Capture result / resign from a finished review position + move list.
     * @param {string} finalStateStr
     * @param {object[]} moves
     * @returns {{ resultStr: string|null, resignedColor: string|null, endKind: string|null }}
     */
    function captureReviewOutcome(finalStateStr, moves) {
        let resultStr = null;
        let resignedColor = resignedColorFromStateStr(finalStateStr);
        let endKind = null;
        try {
            const st = finalStateStr ? JSON.parse(finalStateStr) : null;
            if (st) {
                if (st.draw) {
                    resultStr = "1/2-1/2";
                    endKind = "draw";
                } else if (st.outOfTime) {
                    const loser = String(st.outOfTime).toLowerCase();
                    resultStr = loser === "black" ? "1-0" : "0-1";
                    endKind = "timeout";
                } else if (st.checkmate) {
                    const turn = st.turn === "black" ? "black" : "white";
                    resultStr = turn === "black" ? "1-0" : "0-1";
                    endKind = "checkmate";
                } else if (st.resigned) {
                    const r = String(st.resigned).toLowerCase();
                    resignedColor = r === "black" || r === "white" ? r : resignedColor;
                    resultStr = r === "black" ? "1-0" : "0-1";
                    endKind = "resign";
                }
            }
        } catch {
            /* ignore */
        }
        const list = Array.isArray(moves) ? moves : [];
        for (let i = list.length - 1; i >= 0; i--) {
            const m = list[i];
            if (m && m.moveStr && isTableResultMove(m)) {
                resultStr = m.moveStr;
                break;
            }
        }
        if (!endKind && resultStr === "1/2-1/2") {
            endKind = "draw";
        } else if (!endKind && resignedColor) {
            endKind = "resign";
        } else if (!endKind && (resultStr === "1-0" || resultStr === "0-1")) {
            endKind = "checkmate";
        }
        return {
            resultStr: resultStr,
            resignedColor: resignedColor,
            endKind: endKind,
        };
    }

    function formatReviewOutcomeStatus() {
        const str = reviewResultMoveStr;
        if (!str) {
            return "Review mode";
        }
        if (str === "1/2-1/2") {
            return "Result: Draw (1/2-1/2)";
        }
        if (str === "1-0") {
            if (reviewEndKind === "resign" || reviewResignedColor === "black") {
                return "Result: Black resigned — White wins (1-0)";
            }
            if (reviewEndKind === "timeout") {
                return "Result: Black lost on time — White wins (1-0)";
            }
            if (reviewEndKind === "checkmate") {
                return "Result: Checkmate — White wins (1-0)";
            }
            return "Result: White wins (1-0)";
        }
        if (str === "0-1") {
            if (reviewEndKind === "resign" || reviewResignedColor === "white") {
                return "Result: White resigned — Black wins (0-1)";
            }
            if (reviewEndKind === "timeout") {
                return "Result: White lost on time — Black wins (0-1)";
            }
            if (reviewEndKind === "checkmate") {
                return "Result: Checkmate — Black wins (0-1)";
            }
            return "Result: Black wins (0-1)";
        }
        return "Result: " + str;
    }

    function reviewOutcomeStatusKind() {
        if (reviewResultMoveStr === "1/2-1/2") {
            return "draw";
        }
        if (reviewResultMoveStr === "1-0" || reviewResultMoveStr === "0-1") {
            if (reviewEndKind === "checkmate") {
                return "checkmate";
            }
            if (reviewEndKind === "timeout") {
                return "timeout";
            }
            return "info";
        }
        return "info";
    }

    function showReviewOutcomeStatus() {
        showStatus(formatReviewOutcomeStatus(), 0, reviewOutcomeStatusKind());
    }

    /**
     * Show clocks as stored on the move (stopped). Prefer whiteTimer/blackTimer; else moveTime.
     * @param {object|null|undefined} move
     * @param {number} [plyIndexZeroBased]
     */
    function applyReviewClockDisplays(move, plyIndexZeroBased) {
        Clocks.stop();
        if (
            move &&
            typeof move.whiteTimer === "number" &&
            Number.isFinite(move.whiteTimer) &&
            typeof move.blackTimer === "number" &&
            Number.isFinite(move.blackTimer)
        ) {
            Clocks.set({
                white: Math.max(0, Math.round(move.whiteTimer)),
                black: Math.max(0, Math.round(move.blackTimer)),
            });
            return;
        }
        if (!move || !Number.isFinite(move.moveTime)) {
            return;
        }
        const clocks = Clocks.get();
        const next = { white: clocks.white, black: clocks.black };
        const parity =
            typeof plyIndexZeroBased === "number" ? plyIndexZeroBased : 0;
        if (parity % 2 === 0) {
            next.white = Math.max(0, Math.round(move.moveTime));
        } else {
            next.black = Math.max(0, Math.round(move.moveTime));
        }
        Clocks.set(next);
    }

    /** Sync header clocks to the position after `reviewPlyIndex` plies. */
    function syncReviewClocksForCurrentPly() {
        if (!reviewMode) {
            return;
        }
        Clocks.stop();
        if (reviewPlyIndex <= 0) {
            resetClocks();
            return;
        }
        for (let i = reviewPlyIndex - 1; i >= 0; i--) {
            const m = reviewFullMoves[i];
            if (!m || isTableResultMove(m)) {
                continue;
            }
            applyReviewClockDisplays(m, i);
            return;
        }
        resetClocks();
    }

    function resignedColorFromStateStr(stateStr) {
        return ReviewModel.resignedColorFromState(stateStr);
    }

    function reviewChessMoveCount() {
        return ReviewModel.chessMoveCount(reviewFullMoves, function (move) {
            return typeof game.isResultMove === "function" && game.isResultMove(move);
        });
    }

    function shouldApplyReviewResignationHighlight() {
        return (
            reviewMode
            && reviewResignedColor
            && reviewPlyIndex >= reviewChessMoveCount()
        );
    }

    function applyReviewResignationHighlightIfNeeded() {
        if (!shouldApplyReviewResignationHighlight() || !reviewResignedColor) {
            return;
        }
        if (game && game.GameState && !game.GameState.resigned) {
            game.resign(reviewResignedColor);
        }
        if (Board.applyResignedKingTilt) {
            Board.applyResignedKingTilt(reviewResignedColor);
        }
    }

    function setPlayOriginState(stateOrStr) {
        if (stateOrStr == null) {
            playOriginStateStr = null;
            return;
        }
        playOriginStateStr =
            typeof stateOrStr === "string" ? stateOrStr : JSON.stringify(stateOrStr);
    }

    function clearPlayOriginState() {
        playOriginStateStr = null;
    }

    function syncLoadedBookmarkDisplayMoves(moves) {
        loadedBookmarkDisplayMoves =
            moves && moves.length ? ReviewModel.cloneMoves(moves) : null;
    }

    function clearLoadedBookmarkDisplayMoves() {
        loadedBookmarkDisplayMoves = null;
    }

    function movesForPanelDisplay() {
        if (reviewMode && reviewFullMoves.length) {
            return reviewFullMoves;
        }
        const played = tableMovesFromGame();
        if (
            played.length === 0 &&
            loadedBookmarkDisplayMoves &&
            loadedBookmarkDisplayMoves.length
        ) {
            return loadedBookmarkDisplayMoves;
        }
        return played;
    }

    function reviewBoardIsWhiteView() {
        if (game && typeof game.WhitePlayerView === "boolean") {
            return game.WhitePlayerView;
        }
        try {
            const state = JSON.parse(reviewFinalStateStr || "{}");
            if (typeof state.whitePlayerView === "boolean") {
                return state.whitePlayerView;
            }
        } catch {
            /* ignore */
        }
        return currentPlayerIsWhite;
    }

    function savedStateHumanIsWhite(stateStr) {
        try {
            const state = JSON.parse(stateStr || "{}");
            if (typeof state.whitePlayerView === "boolean") {
                return state.whitePlayerView;
            }
        } catch {
            /* ignore */
        }
        return true;
    }

    function moveRecordWhitePlayerView(move) {
        if (move && typeof move.whitePlayerView === "boolean") {
            return move.whitePlayerView;
        }
        if (game && typeof game.WhitePlayerView === "boolean") {
            return game.WhitePlayerView;
        }
        try {
            const state = JSON.parse(reviewFinalStateStr || reviewOriginStateStr || "{}");
            if (typeof state.whitePlayerView === "boolean") {
                return state.whitePlayerView;
            }
        } catch {
            /* ignore */
        }
        return true;
    }

    function moveNeedsCoordinateFlipForReplay(chess, move) {
        return moveRecordWhitePlayerView(move) !== chess.WhitePlayerView;
    }

    function applySavedBoardOrientation(humanIsWhite) {
        currentPlayerIsWhite = !!humanIsWhite;
        if (Board.setPlayerView) {
            Board.setPlayerView(currentPlayerIsWhite);
        }
        if (Board.setHumanColor) {
            Board.setHumanColor(currentPlayerIsWhite);
        }
    }

    function prepareReviewStartPosition(chess) {
        if (
            reviewOriginStateStr
            && reviewFinalStateStr
            && reviewOriginStateStr !== reviewFinalStateStr
        ) {
            chess.loadGame(reviewOriginStateStr);
        } else {
            chess.startNewGame(reviewBoardIsWhiteView());
        }
        chess.loadMoves([]);
    }

    function resolveReviewPromotionPiece(chess, raw) {
        if (!raw) {
            return null;
        }
        if (raw.selectedPiece != null) {
            return raw.selectedPiece;
        }
        if (raw.promotedTo && typeof chess.letterToPiece === "function") {
            const letter = String(raw.promotedTo).charAt(0);
            return chess.letterToPiece(letter);
        }
        return null;
    }

    function reviewMoveNeedsPromotion(chess, raw, replayMove, moveResult) {
        return (
            (chess.GameState && chess.GameState.promoting) ||
            raw.promotion === true ||
            replayMove.promotion === true ||
            (moveResult && moveResult.promotion === true)
        );
    }

    function applyReviewMove(chess, move) {
        const previousOnUpdate = chess.OnUpdate;
        const previousOnPromotion = chess.OnPromotion;
        chess.OnUpdate = null;
        chess.OnPromotion = null;
        try {
            const raw = ReviewModel.cloneMove(move);
            if (!raw || raw.source == null || raw.target == null) {
                return false;
            }
            if (typeof chess.isResultMove === "function" && chess.isResultMove(raw)) {
                return false;
            }
            let m = typeof chess.cloneMove === "function" ? chess.cloneMove(raw) : raw;
            if (moveNeedsCoordinateFlipForReplay(chess, raw)) {
                m = chess.flipMove(m);
            }
            const result = chess.makeMove(m.source, m.target);
            if (!result || result.valid === false) {
                return false;
            }
            if (reviewMoveNeedsPromotion(chess, raw, m, result)) {
                const promotionMove =
                    typeof chess.cloneMove === "function" ? chess.cloneMove(m) : Object.assign({}, m);
                const selectedPiece = resolveReviewPromotionPiece(chess, raw);
                promotionMove.promotion = true;
                promotionMove.selectedPiece = selectedPiece != null ? selectedPiece : chess.QUEEN;
                if (result.piece) {
                    promotionMove.piece = result.piece;
                }
                if (result.target) {
                    promotionMove.target = result.target;
                }
                chess.completePromotion(promotionMove);
            }
            return true;
        } catch (err) {
            console.warn("[desktop-play] Review move failed:", err);
            return false;
        } finally {
            chess.OnUpdate = previousOnUpdate;
            chess.OnPromotion = previousOnPromotion;
        }
    }

    function replayReviewMovesUpTo(ply) {
        autoCompletePromotion = true;
        try {
            prepareReviewStartPosition(game);
            const limit = ReviewModel.clampPly(ply, reviewFullMoves.length);
            for (let i = 0; i < limit; i += 1) {
                if (!applyReviewMove(game, reviewFullMoves[i])) {
                    console.warn("[desktop-play] Review replay stopped at ply", i + 1);
                    break;
                }
            }
            const previousOnUpdate = game.OnUpdate;
            game.OnUpdate = null;
            try {
                game.loadMoves(ReviewModel.cloneMoves(reviewFullMoves.slice(0, limit)));
            } finally {
                game.OnUpdate = previousOnUpdate;
            }
        } finally {
            autoCompletePromotion = false;
        }
    }

    function cloneReviewMove(move) {
        return ReviewModel.cloneMove(move);
    }

    function initReviewNavigation(finalStateStr, moves, bookmarkOrigin) {
        const loaded = moves && moves.length ? moves : tableMovesFromGame();
        let origin =
            bookmarkOrigin && String(bookmarkOrigin).trim()
                ? String(bookmarkOrigin)
                : null;
        if (!origin) {
            if (!loaded.length) {
                origin = finalStateStr;
            } else {
                const trial = new ChessGame(true);
                trial.startNewGame(reviewBoardIsWhiteView());
                origin = JSON.stringify(trial.GameState);
            }
        }
        if (playReviewMode && typeof playReviewMode.loadNavigation === "function") {
            playReviewMode.loadNavigation({
                moves: loaded,
                finalStateStr: finalStateStr,
                originStateStr: origin,
            });
            syncReviewShellFromMode();
            return;
        }
        reviewFullMoves = ReviewModel.cloneMoves(loaded);
        reviewFinalStateStr = finalStateStr;
        reviewResignedColor = resignedColorFromStateStr(finalStateStr);
        reviewOriginStateStr = origin;
        reviewPlyIndex = reviewFullMoves.length;
        reviewBranchPly = null;
    }

    function syncReviewBoardFromGame() {
        Board.clearArrows();
        if (shouldApplyReviewResignationHighlight() && reviewResignedColor) {
            if (game && game.GameState && !game.GameState.resigned) {
                game.resign(reviewResignedColor);
            }
        }
        Board.syncFromGameState();
        applyReviewResignationHighlightIfNeeded();
        if (Board.applyEndgameKingHighlights) {
            Board.applyEndgameKingHighlights();
        }
        clearDisplayedEvaluation();
        if (game.GameState && game.GameState.capturedPiecesList) {
            Board.updateCaptureLists(game.GameState.capturedPiecesList);
        }
        updateHeaderTurn();
    }

    function reviewMoveForAnimation(move) {
        let m = cloneReviewMove(move);
        if (!m || m.source == null || m.target == null) {
            return null;
        }
        if (moveNeedsCoordinateFlipForReplay(game, move)) {
            m = game.flipMove(m);
        }
        return m;
    }

    function stopReviewPlayback() {
        if (!reviewPlaybackPlaying) {
            updateReviewNavBar();
            return;
        }
        reviewPlaybackPlaying = false;
        reviewPlaybackToken += 1;
        updateMatchHeader();
        updateReviewNavBar();
    }

    function reviewPlaybackDelay(ms) {
        const token = reviewPlaybackToken;
        return new Promise(function (resolve) {
            setTimeout(function () {
                resolve(token === reviewPlaybackToken && reviewPlaybackPlaying);
            }, ms);
        });
    }

    function commitReviewPlyToMode() {
        if (!playReviewMode || typeof playReviewMode.setPly !== "function") {
            return;
        }
        playReviewMode.setPly(reviewPlyIndex);
        syncReviewShellFromMode();
    }

    async function animateReviewStepForward() {
        if (!reviewMode || reviewPlyIndex >= reviewFullMoves.length) {
            return false;
        }
        const raw = reviewFullMoves[reviewPlyIndex];
        if (typeof game.isResultMove === "function" && game.isResultMove(raw)) {
            reviewPlyIndex += 1;
            reviewBranchPly =
                reviewPlyIndex < reviewFullMoves.length ? reviewPlyIndex : null;
            commitReviewPlyToMode();
            const previousOnUpdateResult = game.OnUpdate;
            game.OnUpdate = null;
            try {
                game.loadMoves(ReviewModel.cloneMoves(reviewFullMoves.slice(0, reviewPlyIndex)));
            } finally {
                game.OnUpdate = previousOnUpdateResult;
            }
            syncReviewBoardFromGame();
            refreshReviewMovesTable();
            return true;
        }
        const animMove = reviewMoveForAnimation(raw);
        if (!animMove) {
            return false;
        }
        animating = true;
        autoCompletePromotion = true;
        try {
            await Board.animateMove(animMove, { skipFinalSync: true });
            if (!applyReviewMove(game, raw)) {
                Board.syncFromGameState();
                return false;
            }
            reviewPlyIndex += 1;
            reviewBranchPly =
                reviewPlyIndex < reviewFullMoves.length ? reviewPlyIndex : null;
            commitReviewPlyToMode();
            const previousOnUpdateStep = game.OnUpdate;
            game.OnUpdate = null;
            try {
                game.loadMoves(ReviewModel.cloneMoves(reviewFullMoves.slice(0, reviewPlyIndex)));
            } finally {
                game.OnUpdate = previousOnUpdateStep;
            }
            syncReviewBoardFromGame();
            refreshReviewMovesTable();
            syncReviewClocksForCurrentPly();
            return true;
        } catch (err) {
            console.warn("[desktop-play] Review playback step failed:", err);
            Board.syncFromGameState();
            return false;
        } finally {
            autoCompletePromotion = false;
            animating = false;
            if (Board.clearBoardAnimating) {
                Board.clearBoardAnimating();
            }
        }
    }

    async function startReviewPlayback() {
        if (
            !reviewMode
            || !reviewFullMoves.length
            || reviewPlaybackPlaying
            || reviewPlyIndex >= reviewFullMoves.length
        ) {
            return;
        }
        reviewPlaybackPlaying = true;
        const token = reviewPlaybackToken;
        updateMatchHeader();
        updateReviewNavBar();
        while (
            reviewPlaybackPlaying
            && token === reviewPlaybackToken
            && reviewPlyIndex < reviewFullMoves.length
        ) {
            const ok = await animateReviewStepForward();
            if (!ok || !reviewPlaybackPlaying || token !== reviewPlaybackToken) {
                break;
            }
            if (reviewPlyIndex >= reviewFullMoves.length) {
                break;
            }
            const stillPlaying = await reviewPlaybackDelay(REVIEW_PLAYBACK_STEP_DELAY_MS);
            if (!stillPlaying) {
                break;
            }
        }
        if (token === reviewPlaybackToken) {
            stopReviewPlayback();
        }
    }

    function ensureReviewNavBar() {
        const nav = $("desktopPlayReviewNav");
        if (!nav || reviewNavMounted) {
            return;
        }
        reviewNavMounted = true;
        reviewNavEls = ReviewNav.mount(nav, {
            onStart: function () {
                if (!reviewMode || reviewPlaybackPlaying) {
                    return;
                }
                stopReviewPlayback();
                showReviewAtPly(0);
            },
            onBack: function () {
                if (!reviewMode || reviewPlaybackPlaying || reviewPlyIndex <= 0) {
                    return;
                }
                stopReviewPlayback();
                showReviewAtPly(reviewPlyIndex - 1);
            },
            onPlayPause: function () {
                if (!reviewMode || !reviewFullMoves.length) {
                    return;
                }
                if (reviewPlaybackPlaying) {
                    stopReviewPlayback();
                } else {
                    startReviewPlayback();
                }
            },
            onForward: function () {
                if (
                    !reviewMode
                    || reviewPlaybackPlaying
                    || reviewPlyIndex >= reviewFullMoves.length
                ) {
                    return;
                }
                stopReviewPlayback();
                showReviewAtPly(reviewPlyIndex + 1);
            },
            onEnd: function () {
                if (!reviewMode || reviewPlaybackPlaying) {
                    return;
                }
                stopReviewPlayback();
                showReviewAtPly(reviewFullMoves.length);
            },
        });
        updateReviewNavBar();
    }

    function updateReviewNavBar() {
        const nav = $("desktopPlayReviewNav");
        if (!nav) {
            return;
        }
        if (!reviewNavMounted) {
            ensureReviewNavBar();
        }
        const show = reviewMode && reviewFullMoves.length > 0;
        const state = ReviewModel.navButtonState({
            plyIndex: reviewPlyIndex,
            moveCount: reviewFullMoves.length,
            playing: reviewPlaybackPlaying,
        });
        ReviewNav.update(nav, reviewNavEls, {
            visible: show,
            playing: reviewPlaybackPlaying,
            start: state.start,
            back: state.back,
            forward: state.forward,
            end: state.end,
            playPause: state.playPause,
        });
    }

    function showReviewAtPly(ply) {
        stopReviewPlayback();
        if (!reviewMode || !reviewFullMoves.length) {
            return;
        }
        let clamped;
        if (playReviewMode && typeof playReviewMode.setPly === "function") {
            clamped = playReviewMode.setPly(ply);
            syncReviewShellFromMode();
        } else {
            clamped = ReviewModel.clampPly(ply, reviewFullMoves.length);
            reviewPlyIndex = clamped;
            reviewBranchPly = clamped < reviewFullMoves.length ? clamped : null;
        }
        replayReviewMovesUpTo(clamped);
        syncReviewBoardFromGame();
        syncReviewClocksForCurrentPly();
        refreshReviewMovesTable();
        syncGameRunPanelOptions();
        updateReviewNavBar();
        showReviewOutcomeStatus();
    }

    function movesForDisplay() {
        return movesForPanelDisplay();
    }

    function refreshReviewMovesTable() {
        updateMovesTable(movesForDisplay());
    }

    function onReviewMoveClick(ply) {
        if (
            !reviewMode
            || !reviewFullMoves.length
            || animating
            || engineThinking
            || dialogOn
            || reviewPlaybackPlaying
        ) {
            return;
        }
        showReviewAtPly(ply);
    }

    /** Ply the review panel should mark as selected, or null when not branching. */
    function selectedReviewPly() {
        return ReviewModel.selectedPly({
            reviewMode: reviewMode,
            branchPly: reviewBranchPly,
            plyIndex: reviewPlyIndex,
        });
    }

    function onPositionSetupToggle() {
        if (practiceMode) {
            return;
        }
        const btn = $("positionSetupBtn");
        if (btn && btn.disabled) {
            return;
        }
        if (!playSessionReady || !game) {
            showStatus(t("play.status.boardLoading"), 2500, "info");
            return;
        }
        if (positionSetupMode) {
            exitPositionSetupMode(true);
            return;
        }
        if (!gameActive && !positionSetupMode) {
            beginPositionSetupFromMenu();
            return;
        }
        if (!canUsePositionSetup()) {
            return;
        }
        enterPositionSetupMode();
    }

    function buildActionRail() {
        const rail = $("desktopPlayActions");
        if (!rail) {
            return;
        }
        const items = [
            {
                id: "rematchBtn",
                label: t("play.actions.newGame"),
                icon: "newGame",
                onClick: onRematch,
                accent: true,
            },
            { id: "resignBtn", label: t("play.actions.resign"), icon: "resign", onClick: onResign },
            { id: "drawBtn", label: t("play.actions.draw"), icon: "draw", onClick: onDrawOfferClick },
            { type: "spacer" },
            { id: "undoBtn", label: t("play.actions.undo"), icon: "undo", onClick: onUndo },
            { id: "redoBtn", label: t("play.actions.redo"), icon: "redo", onClick: onRedo },
            { id: "lastMoveBtn", label: t("play.actions.lastMove"), icon: "lastMove", onClick: onLastMove },
        ];
        if (canPlayAdvancedTools) {
            items.push(
                {
                    id: "positionSetupBtn",
                    label: t("play.actions.positionSetup"),
                    icon: "positionSetup",
                    onClick: onPositionSetupToggle,
                },
                {
                    id: "configurationBtn",
                    label: t("play.actions.config"),
                    icon: "configuration",
                    onClick: onConfigurationToggle,
                },
            );
        }
        items.push(
            { id: "flipBtn", label: t("play.actions.flip"), icon: "flip", onClick: onFlip },
        );
        if (canPlayAdvancedTools) {
            items.push({ id: "saveBtn", label: t("play.actions.save"), icon: "save", onClick: onSaveGame });
        }
        items.push(
            { type: "spacer" },
            { id: "homeBtn", label: t("play.actions.exit"), icon: "exit", onClick: onHome },
        );
        ActionRail.mount(rail, items);
        updateActionButtons();
        if (window.DesktopBoardScale && typeof window.DesktopBoardScale.refresh === "function") {
            window.DesktopBoardScale.refresh();
        }
    }

    function isHumanTurn() {
        if (practiceMode) {
            return !!(game && !game.GameOver);
        }
        return (
            (game.Turn === "white" && currentPlayerIsWhite) ||
            (game.Turn === "black" && !currentPlayerIsWhite)
        );
    }

    function isAiTurn() {
        if (practiceMode) {
            return false;
        }
        return game && !game.GameOver && !isHumanTurn();
    }

    function canUndoMovePair() {
        if (!allowUndo || !game || game.GameOver || animating || engineThinking || dialogOn) {
            return false;
        }
        const moveCount = game.Moves ? game.Moves.length : 0;
        if (practiceMode) {
            /* Single-ply undo for as long as moves remain (saved states). */
            return moveCount >= 1;
        }
        return isHumanTurn() && moveCount >= 2;
    }

    function canRedoMoves() {
        if (!allowUndo || !game || game.GameOver || animating || engineThinking || dialogOn) {
            return false;
        }
        const stack =
            typeof game.RedoStackSize === "number"
                ? game.RedoStackSize
                : game.CanRedo
                  ? 1
                  : 0;
        if (practiceMode) {
            return stack >= 1;
        }
        /* Local engine undoes human+engine pairs. */
        return stack >= 2;
    }

    function tableMovesFromGame() {
        if (!game || !game.Moves) {
            return [];
        }
        return game.Moves.map(function (m) {
            return typeof m === "string" ? JSON.parse(m) : m;
        });
    }

    function isTableResultMove(move) {
        if (!move) {
            return false;
        }
        if (game && typeof game.isResultMove === "function") {
            return game.isResultMove(move);
        }
        const str = move.moveStr || "";
        return str === "1-0" || str === "0-1" || str === "1/2-1/2" || str === "*";
    }

    function currentGameResultStr() {
        if (positionSetupMode || configurationMode) {
            return null;
        }
        if (game && game.GameOver && game.ResultMove && game.ResultMove.moveStr) {
            return game.ResultMove.moveStr;
        }
        if (reviewMode && reviewResultMoveStr) {
            return reviewResultMoveStr;
        }
        return null;
    }

    function appendGameResultToMoves(moves) {
        return MovesPanel.appendResultMove(moves, currentGameResultStr(), isTableResultMove);
    }

    function syncBoardFromGame() {
        const state = game.GameState;
        if (state) {
            Board.drawBoard(state.board);
            Board.updateCaptureLists(state.capturedPiecesList || []);
        } else {
            Board.syncFromGameState();
        }
    }

    function updateActionButtons() {
        const onlineCaps =
            playCapabilities &&
            playCapabilities.network === true &&
            playOnlineMode;
        ActionButtonsPolicy.apply(
            ActionButtonsPolicy.disabledMap({
                hasGame: !!game,
                playSessionReady: playSessionReady,
                gameActive: gameActive,
                positionSetup: positionSetupMode,
                configuration: configurationMode,
                animating: animating,
                dialogOn: dialogOn,
                engineThinking: engineThinking,
                gameOver: !!(game && game.GameOver),
                hasMoves: !!(game && game.Moves && game.Moves.length > 0),
                humanTurn: !!(game && isHumanTurn()),
                allowUndo: allowUndo,
                canUndoMovePair: canUndoMovePair(),
                redoPairAvailable: canRedoMoves(),
                canUsePositionSetup: canUsePositionSetup(),
                canUseBrainConfig: canUseBrainConfig(),
                capabilities: playCapabilities,
                canOfferDraw:
                    !!(onlineCaps &&
                        typeof playOnlineMode.canOfferDraw === "function" &&
                        playOnlineMode.canOfferDraw()),
                canRematch: !!(onlineCaps && game && game.GameOver),
            }),
            setButtonDisabled,
        );
    }

    function sessionPlayerNames(source) {
        return BookmarkHelpers.sessionPlayerNames(source || session);
    }

    function formatPlayersVsTitle(source) {
        return BookmarkHelpers.formatPlayersVsTitle(source || session);
    }

    function formatAutoSaveGameName() {
        return BookmarkHelpers.formatAutoSaveGameName(session);
    }

    function formatManualSaveGameName() {
        return BookmarkHelpers.formatManualSaveGameName(session);
    }

    function engineLabel(engineId) {
        if (Settings && typeof Settings.brainLabel === "function") {
            return Settings.brainLabel(engineId);
        }
        return "Engine";
    }

    function formatSavedGamePlayers(entry) {
        return SavedGames.formatPlayers(entry, engineLabel);
    }

    function formatPositionSetupSaveName() {
        return BookmarkHelpers.formatPositionSetupSaveName();
    }

    function showPositionSaveNameDialog(onSave, options) {
        options = options || {};
        if (dialogOn) {
            return;
        }
        Dialog.prompt({
            title: options.title || t("play.dialogs.savePosition"),
            label: t("play.prompts.positionName"),
            defaultValue: formatPositionSetupSaveName(),
            confirmLabel: options.confirmLabel || t("common.save"),
            onSubmit: onSave,
        });
    }

    function bookmarkPayloadFromCurrentState(name, moves) {
        return BookmarkHelpers.buildCreatePayload({
            gameState: game.GameState,
            name: name,
            moves: moves || [],
            session: session,
            originState: playOriginStateStr || reviewOriginStateStr,
        });
    }

    function mergeBookmarkIntoList(bookmark) {
        if (bookmark && bookmark._id) {
            savedGames = savedGames.filter(function (b) {
                return String(b._id) !== String(bookmark._id);
            });
            savedGames.unshift(bookmark);
        } else {
            return loadSavedGames();
        }
    }

    async function saveSetupPositionWithName(name, options) {
        options = options || {};
        if (!game || !session || !Api.post) {
            return;
        }
        const state = game.GameState;
        if (!state) {
            showStatus(t("play.status.nothingToSave"), 2000, "error");
            return;
        }
        try {
            const bookmark = await Api.post(
                "/bookmark",
                bookmarkPayloadFromCurrentState(name, []),
            );
            await mergeBookmarkIntoList(bookmark);
            renderSavedGamesList();
            if (options.switchToNew && bookmark && (bookmark._id || bookmark.id)) {
                const newId = String(bookmark._id || bookmark.id);
                editingSavedGameId = newId;
                lastLoadedSavedGameId = newId;
            }
            showStatus(options.statusMessage || t("play.status.positionSaved"), 2500, "info");
        } catch (err) {
            showStatus(err.message || t("play.status.couldNotSavePosition"), 0, "error");
        }
    }

    async function saveSetupPositionUpdateExisting() {
        if (!game || !session || !Api.post || !editingSavedGameId) {
            return;
        }
        const entry = savedGames.find(function (b) {
            return savedGameId(b) === String(editingSavedGameId);
        });
        if (!entry) {
            showStatus(t("play.status.savedPositionNotFound"), 0, "error");
            editingSavedGameId = null;
            return;
        }
        if (!validatePositionSetup("save")) {
            return;
        }
        if (!game.GameState) {
            showStatus(t("play.status.nothingToSave"), 2000, "error");
            return;
        }
        try {
            await Api.post("/updateBookmark", {
                id: entry._id || entry.id,
                name: entry.name || "Saved game",
                gameType: entry.gameType || "SinglePlayerGame",
                gameState: game.GameState,
                moves: [],
                engine: session.engine || "brain43",
                depth: BookmarkHelpers.thinkingOrDepth(session, 10),
                date: entry.date || new Date(),
            });
            entry.state = JSON.stringify(game.GameState);
            entry.moves = [];
            entry.engine = session.engine || "brain43";
            entry.depth = BookmarkHelpers.thinkingOrDepth(session, 6);
            lastLoadedSavedGameId = savedGameId(entry);
            renderSavedGamesList();
            syncGameRunPanelOptions();
            showStatus(t("play.status.positionUpdated"), 2500, "info");
        } catch (err) {
            showStatus(err.message || t("play.status.couldNotUpdatePosition"), 0, "error");
        }
    }

    function saveSetupPosition() {
        if (!game || !session || !Api.post) {
            return;
        }
        if (!validatePositionSetup("save")) {
            return;
        }
        if (!game.GameState) {
            showStatus(t("play.status.nothingToSave"), 2000, "error");
            return;
        }
        if (editingSavedGameId) {
            saveSetupPositionUpdateExisting();
            return;
        }
        showPositionSaveNameDialog(function (name) {
            saveSetupPositionWithName(name, { switchToNew: true });
        });
    }

    function saveSetupPositionAs() {
        if (!game || !session || !Api.post) {
            return;
        }
        if (!validatePositionSetup("save")) {
            return;
        }
        if (!game.GameState) {
            showStatus(t("play.status.nothingToSave"), 2000, "error");
            return;
        }
        showPositionSaveNameDialog(
            function (name) {
                saveSetupPositionWithName(name, {
                    switchToNew: true,
                    statusMessage: "Position saved as new bookmark",
                });
            },
            {
                title: t("play.prompts.savePositionAs"),
                confirmLabel: t("play.dialogs.saveAs"),
            },
        );
    }

    function bookmarkMovesPayload() {
        return tableMovesFromGame().map(function (m) {
            return JSON.stringify(m);
        });
    }

    function savedGameId(entry) {
        return SavedGames.entryId(entry);
    }

    function reviewNextTurnAfterPly(ply) {
        return ReviewModel.nextTurnAfterPly({
            moves: reviewFullMoves,
            ply: ply,
            originStateStr: reviewOriginStateStr,
            moveColor: MovesPanel.moveColor,
        });
    }

    function movesForMovesTable(moves) {
        return MovesPanel.normalizeMoves(moves);
    }

    function parseSavedGameMoves(entry) {
        return SavedGames.parseMoves(entry);
    }

    function isSavedPositionEntry(entry) {
        return SavedGames.isPosition(entry);
    }

    function savedEntriesForFilter(filter) {
        return SavedGames.filterEntries(savedGames, filter);
    }

    function updateSavedListFilterUi() {
        const filtersRoot = document.querySelector(".desktop-play-saved-list-filters");
        if (!filtersRoot) {
            return;
        }
        const allowPositions = canPlayAdvancedTools;
        filtersRoot.classList.toggle("desktop-play-saved-list-filters--games-only", !allowPositions);
        filtersRoot.querySelectorAll(".desktop-play-saved-list-filter").forEach(function (btn) {
            const filter = btn.getAttribute("data-filter");
            const isPositions = filter === "positions";
            if (isPositions) {
                btn.hidden = !allowPositions;
                btn.style.display = allowPositions ? "" : "none";
            }
            const active = filter === savedListFilter;
            btn.classList.toggle("is-active", active);
            btn.setAttribute("aria-selected", active ? "true" : "false");
        });
        const sep = filtersRoot.querySelector(".desktop-play-saved-list-filter-sep");
        if (sep) {
            sep.hidden = !allowPositions;
            sep.style.display = allowPositions ? "" : "none";
        }
    }

    function setSavedListFilter(filter) {
        let next = filter === "positions" ? "positions" : "games";
        if (!canPlayAdvancedTools) {
            next = "games";
        }
        if (savedListFilter === next) {
            updateSavedListFilterUi();
            return;
        }
        savedListFilter = next;
        persistSavedListFilter(next);
        clearSavedGameSelection();
        updateSavedListFilterUi();
        renderSavedGamesList();
    }

    function applyAdvancedToolsVisibility() {
        DockModeChrome.applyAdvancedToolsVisibility(
            {
                gamesSidebar: $("desktopPlaySidebarGames"),
                setupDock: $("desktopPlaySetupDock"),
                configDock: $("desktopPlayConfigDock"),
                body: document.body,
            },
            canPlayAdvancedTools,
        );
        if (!canPlayAdvancedTools && savedListFilter !== "games") {
            savedListFilter = "games";
            persistSavedListFilter("games");
        }
        updateSavedListFilterUi();
        if (canPlayAdvancedTools) {
            renderSavedGamesList();
        }
    }

    function ensureSavedListFilterControls() {
        ensureSavedGamesListDeselect();
        const filtersRoot = document.querySelector(".desktop-play-saved-list-filters");
        if (!filtersRoot || filtersRoot.dataset.wired === "1") {
            updateSavedListFilterUi();
            return;
        }
        filtersRoot.dataset.wired = "1";
        filtersRoot.querySelectorAll(".desktop-play-saved-list-filter").forEach(function (btn) {
            btn.addEventListener("click", function () {
                setSavedListFilter(btn.getAttribute("data-filter"));
            });
        });
        updateSavedListFilterUi();
    }

    function toggleSavedGameExpanded(bookmarkId) {
        expandedSavedGameId = SavedGamesList.toggleExpanded($("gamesDiv"), bookmarkId);
    }

    function formatSavedGameDate(date) {
        return SavedGames.formatDate(date);
    }

    function formatSavedGameInfoTooltip(entry) {
        return SavedGames.formatInfoTooltip(entry, engineLabel);
    }

    function formatSavedGameTurn(entry) {
        return SavedGames.formatTurn(entry);
    }

    function savedGameActionsBlocked() {
        return animating || engineThinking || dialogOn;
    }

    function isMultiSelectModifier(ev) {
        return !!(ev && (ev.metaKey || ev.ctrlKey));
    }

    function isSavedGameSelected(bookmarkId) {
        return selectedSavedGameIds.has(String(bookmarkId));
    }

    function syncSavedGameSelectionUi() {
        SavedGamesList.syncSelection($("gamesDiv"), selectedSavedGameIds);
    }

    function clearSavedGameSelection() {
        if (selectedSavedGameIds.size === 0) {
            return;
        }
        selectedSavedGameIds.clear();
        syncSavedGameSelectionUi();
    }

    function toggleSavedGameSelection(bookmarkId) {
        const id = String(bookmarkId);
        if (selectedSavedGameIds.has(id)) {
            selectedSavedGameIds.delete(id);
        } else {
            selectedSavedGameIds.add(id);
        }
        syncSavedGameSelectionUi();
    }

    function pruneSavedGameSelection() {
        const visibleIds = new Set(
            savedEntriesForFilter(savedListFilter).map(function (entry) {
                return savedGameId(entry);
            }),
        );
        let changed = false;
        selectedSavedGameIds.forEach(function (id) {
            if (!visibleIds.has(id)) {
                selectedSavedGameIds.delete(id);
                changed = true;
            }
        });
        if (changed) {
            syncSavedGameSelectionUi();
        }
    }

    function ensureSavedGamesListDeselect() {
        const gamesDiv = $("gamesDiv");
        if (!gamesDiv || gamesDiv.dataset.deselectWired === "1") {
            return;
        }
        gamesDiv.dataset.deselectWired = "1";
        gamesDiv.addEventListener("click", function (ev) {
            if (!ev.target.closest(".desktop-play-saved-game")) {
                clearSavedGameSelection();
            }
        });
    }

    function showSavedGameContextMenu(ev, entry, bookmarkId) {
        if (!window.DesktopContextMenu || !entry) {
            return;
        }
        const sid = String(bookmarkId);
        if (selectedSavedGameIds.size > 1 && selectedSavedGameIds.has(sid)) {
            const count = selectedSavedGameIds.size;
            window.DesktopContextMenu.show(ev.clientX, ev.clientY, [
                { header: true, label: count + " items selected" },
                {
                    label: t("common.delete"),
                    onClick: function () {
                        deleteSavedGames(Array.from(selectedSavedGameIds));
                    },
                },
            ]);
            return;
        }
        if (selectedSavedGameIds.size > 1) {
            clearSavedGameSelection();
        }
        const blocked = savedGameActionsBlocked();
        const isPosition = isSavedPositionEntry(entry);
        const label = entry.name || (isPosition ? "Saved position" : "Saved game");
        const items = [
            { header: true, label: label },
            {
                label: isPosition ? "Load position" : "Load game",
                disabled: blocked,
                onClick: function () {
                    loadSavedGame(bookmarkId);
                },
            },
            {
                label: t("play.actions.loadToStart"),
                disabled: blocked,
                onClick: function () {
                    loadSavedGame(bookmarkId, { atStart: true });
                },
            },
        ];
        if (canPlayAdvancedTools) {
            items.push({
                label: t("play.actions.editPosition"),
                disabled: blocked,
                onClick: function () {
                    editSavedGame(bookmarkId);
                },
            });
        }
        items.push(
            {
                label: t("common.rename"),
                onClick: function () {
                    startRenameSavedGame(bookmarkId);
                },
            },
            { separator: true },
            {
                label: t("common.delete"),
                onClick: function () {
                    deleteSavedGame(bookmarkId);
                },
            },
        );
        window.DesktopContextMenu.show(ev.clientX, ev.clientY, items);
    }

    function startRenameSavedGame(bookmarkId) {
        renamingSavedGameId = bookmarkId;
        expandedSavedGameId = bookmarkId;
        renderSavedGamesList();
        SavedGamesList.focusRenameInput($("gamesDiv"), bookmarkId);
    }

    async function commitRenameSavedGame(bookmarkId, newName) {
        const trimmed = (newName || "").trim();
        if (!trimmed) {
            showStatus(t("play.status.nameCannotBeEmpty"), 2000, "error");
            return;
        }
        const entry = savedGames.find(function (b) {
            return savedGameId(b) === String(bookmarkId);
        });
        if (!entry || !Api.post) {
            return;
        }
        try {
            await Api.post("/updateBookmark", {
                id: entry._id || entry.id,
                name: trimmed,
                gameType: entry.gameType || "SinglePlayerGame",
                date: entry.date || new Date(),
            });
            entry.name = trimmed;
            renamingSavedGameId = null;
            renderSavedGamesList();
            showStatus(t("play.status.gameRenamed"), 2000, "info");
        } catch (err) {
            showStatus(err.message || t("play.status.couldNotRenameGame"), 0, "error");
        }
    }

    function cancelRenameSavedGame() {
        renamingSavedGameId = null;
        renderSavedGamesList();
    }

    async function deleteSavedGames(bookmarkIds) {
        const ids = Array.from(new Set((bookmarkIds || []).map(String))).filter(Boolean);
        if (!ids.length || !Api.post) {
            return;
        }
        const toDelete = ids
            .map(function (id) {
                return savedGames.find(function (b) {
                    return savedGameId(b) === id;
                });
            })
            .filter(Boolean);
        if (!toDelete.length) {
            clearSavedGameSelection();
            return;
        }
        let deleted = 0;
        try {
            for (let i = 0; i < toDelete.length; i++) {
                const entry = toDelete[i];
                const id = savedGameId(entry);
                const result = await Api.post("/deleteBookmark", { id: entry._id || entry.id });
                const ok = result && (result.status === "OK" || result === "OK");
                if (!ok) {
                    throw new Error("Delete failed");
                }
                savedGames = savedGames.filter(function (b) {
                    return savedGameId(b) !== id;
                });
                selectedSavedGameIds.delete(id);
                if (expandedSavedGameId === id) {
                    expandedSavedGameId = null;
                }
                if (renamingSavedGameId === id) {
                    renamingSavedGameId = null;
                }
                if (editingSavedGameId === id) {
                    editingSavedGameId = null;
                }
                if (lastLoadedSavedGameId === id) {
                    lastLoadedSavedGameId = null;
                    exitReviewMode();
                }
                deleted += 1;
            }
            renderSavedGamesList();
            updateGameRunPanelVisibility();
            showStatus(
                deleted === 1 ? t("play.status.gameDeleted") : t("play.status.itemsDeleted", { count: deleted }),
                2000,
                "info",
            );
        } catch (err) {
            renderSavedGamesList();
            showStatus(err.message || t("play.status.couldNotDeleteSelected"), 0, "error");
        }
    }

    async function deleteSavedGame(bookmarkId) {
        await deleteSavedGames([bookmarkId]);
    }

    function applyBookmarkEntryToBoard(entry) {
        loadingBookmark = true;
        clearReviewNavigation();
        clearPlayOriginState();
        try {
            const baseOpts = Settings.loadLastOptions();
            const raw = entry.state != null ? entry.state : entry.gameState;
            const stateStr =
                typeof raw === "string" ? raw : JSON.stringify(raw || {});
            const savedHumanIsWhite = savedStateHumanIsWhite(stateStr);
            const parsedMoves = parseSavedGameMoves(entry);
            syncLoadedBookmarkDisplayMoves(parsedMoves);
            applySessionSettings({
                color: savedHumanIsWhite ? "white" : "black",
                engine: entry.engine || baseOpts.engine,
                thinkingTimeSeconds:
                    typeof entry.depth === "number"
                        ? entry.depth
                        : baseOpts.thinkingTimeSeconds,
                difficulty:
                    typeof entry.depth === "number"
                        ? entry.depth
                        : baseOpts.thinkingTimeSeconds,
                mouse: baseOpts.mouse,
                showAvailableMoves: baseOpts.showAvailableMoves,
                allowUndo: baseOpts.allowUndo,
                timeMinutes: baseOpts.timeMinutes,
            });
            game.loadGame(stateStr);
            if (parsedMoves.length) {
                game.loadMoves(parsedMoves);
            } else {
                game.loadMoves([]);
            }
            applySavedBoardOrientation(savedHumanIsWhite);
            redoPairAvailable = false;
            lastCheckNotifySide = null;
            alertMode = false;
            clearHeaderEvent();
            Board.clearArrows();
            Board.syncFromGameState();
            clearDisplayedEvaluation();
            if (game.GameState && game.GameState.capturedPiecesList) {
                Board.updateCaptureLists(game.GameState.capturedPiecesList);
            }
            initReviewNavigation(stateStr, parsedMoves, entry.originState);
            syncReviewResultMoveFromGame();
            const outcome = captureReviewOutcome(stateStr, parsedMoves);
            if (outcome.resignedColor) {
                reviewResignedColor = outcome.resignedColor;
            }
            if (outcome.resultStr) {
                reviewResultMoveStr = outcome.resultStr;
            }
            if (outcome.endKind) {
                reviewEndKind = outcome.endKind;
            }
            refreshReviewMovesTable();
            pauseClocksForSetup();
            gameActive = false;
            document.body.classList.remove("desktop-play-has-active-game");
            if (Board.setHumanPlayEnabled) {
                Board.setHumanPlayEnabled(false);
            }
            updateHeaderTurn();
        } finally {
            loadingBookmark = false;
        }
    }

    function handleSavedGameMultiSelectClick(ev, bookmarkId) {
        if (!isMultiSelectModifier(ev)) {
            return false;
        }
        if (ev.target.closest(".desktop-play-saved-game-icon-btn")) {
            return false;
        }
        if (ev.target.closest(".desktop-play-saved-game-rename-input")) {
            return false;
        }
        ev.preventDefault();
        ev.stopPropagation();
        toggleSavedGameSelection(bookmarkId);
        return true;
    }

    function cancelSavedGameSingleClick(bookmarkId) {
        const id = String(bookmarkId);
        const timer = savedGameSingleClickTimers.get(id);
        if (timer) {
            clearTimeout(timer);
            savedGameSingleClickTimers.delete(id);
        }
    }

    function scheduleSavedGameSingleClick(bookmarkId, onFire) {
        cancelSavedGameSingleClick(bookmarkId);
        const id = String(bookmarkId);
        const timer = setTimeout(function () {
            savedGameSingleClickTimers.delete(id);
            onFire();
        }, 280);
        savedGameSingleClickTimers.set(id, timer);
    }

    /**
     * @param {string|number} bookmarkId
     * @param {{ atStart?: boolean }} [options]
     */
    async function loadSavedGame(bookmarkId, options) {
        options = options || {};
        if (!game || animating || engineThinking || dialogOn) {
            return;
        }
        const entry = savedGames.find(function (b) {
            return savedGameId(b) === String(bookmarkId);
        });
        if (!entry) {
            return;
        }
        const hasMoves = parseSavedGameMoves(entry).length > 0;
        animating = true;
        updateActionButtons();
        try {
            applyBookmarkEntryToBoard(entry);
            lastLoadedSavedGameId = String(bookmarkId);
            editingSavedGameId = null;
            setCurrentGameId(null);
            enterReviewMode();
            if (options.atStart && hasMoves) {
                showReviewAtPly(0);
            } else {
                syncReviewClocksForCurrentPly();
                refreshReviewMovesTable();
                updateReviewNavBar();
                showReviewOutcomeStatus();
            }
            syncGameRunPanelOptions();
        } catch (err) {
            showStatus(err.message || t("play.status.couldNotLoadSavedGame"), 0, "error");
        } finally {
            animating = false;
            updateActionButtons();
        }
    }

    async function editSavedGame(bookmarkId) {
        if (!canPlayAdvancedTools) {
            return;
        }
        if (!game || animating || engineThinking || dialogOn) {
            return;
        }
        const entry = savedGames.find(function (b) {
            return savedGameId(b) === String(bookmarkId);
        });
        if (!entry) {
            return;
        }
        animating = true;
        updateActionButtons();
        try {
            applyBookmarkEntryToBoard(entry);
            lastLoadedSavedGameId = String(bookmarkId);
            editingSavedGameId = String(bookmarkId);
            expandedSavedGameId = String(bookmarkId);
            setCurrentGameId(null);
            exitReviewMode();
            enterPositionSetupMode();
            showStatus(t("play.status.editingPositionSaveBookmark"), 0, "info");
        } catch (err) {
            showStatus(err.message || t("play.status.couldNotOpenPositionForEditing"), 0, "error");
        } finally {
            animating = false;
            updateActionButtons();
        }
    }

    function savedGameNameTitle(entry, label) {
        const when = formatSavedGameDate(entry.date);
        const hasSavedMoves = parseSavedGameMoves(entry).length > 0;
        if (hasSavedMoves) {
            return when
                ? label + " — " + when + " (double-click to load from start)"
                : label + " (double-click to load from start)";
        }
        return when ? label + " — " + when : label;
    }

    function savedGameListView(entry) {
        const id = savedGameId(entry);
        const label = entry.name || "Saved game";
        return {
            id: id,
            isPosition: isSavedPositionEntry(entry),
            selected: isSavedGameSelected(id),
            expanded: expandedSavedGameId === id,
            renaming: renamingSavedGameId === id,
            name: label,
            nameTitle: savedGameNameTitle(entry, label),
            dateText: formatSavedGameDate(entry.date),
            turnText: formatSavedGameTurn(entry),
            playersText: formatSavedGamePlayers(entry),
            infoTooltip: formatSavedGameInfoTooltip(entry),
            showEdit: canPlayAdvancedTools,
            entry: entry,
        };
    }

    function savedGameListHandlers(view) {
        const id = view.id;
        const entry = view.entry;
        return {
            onRowClick: function (ev) {
                handleSavedGameMultiSelectClick(ev, id);
            },
            onNameClick: function (ev) {
                ev.stopPropagation();
                if (handleSavedGameMultiSelectClick(ev, id)) {
                    return;
                }
                clearSavedGameSelection();
                scheduleSavedGameSingleClick(id, function () {
                    loadSavedGame(id);
                });
            },
            onNameDblClick: function (ev) {
                ev.stopPropagation();
                ev.preventDefault();
                if (handleSavedGameMultiSelectClick(ev, id)) {
                    return;
                }
                cancelSavedGameSingleClick(id);
                clearSavedGameSelection();
                loadSavedGame(id, { atStart: true });
            },
            onNameKeydown: function (ev) {
                if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (handleSavedGameMultiSelectClick(ev, id)) {
                        return;
                    }
                    clearSavedGameSelection();
                    loadSavedGame(id);
                }
            },
            onExpand: function () {
                toggleSavedGameExpanded(id);
            },
            onEdit: function () {
                editSavedGame(id);
            },
            onDelete: function () {
                deleteSavedGame(id);
            },
            onRename: function () {
                startRenameSavedGame(id);
            },
            onRenameCommit: function (value) {
                commitRenameSavedGame(id, value);
            },
            onRenameCancel: function () {
                cancelRenameSavedGame();
            },
            onContextMenu: function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                showSavedGameContextMenu(ev, entry, id);
            },
        };
    }

    function renderSavedGamesList() {
        const gamesDiv = $("gamesDiv");
        if (!gamesDiv) {
            return;
        }
        const entries = savedEntriesForFilter(savedListFilter);
        if (!entries.length) {
            SavedGamesList.render(gamesDiv, [], { filter: savedListFilter });
            clearSavedGameSelection();
            return;
        }
        SavedGamesList.render(gamesDiv, entries.map(savedGameListView), {
            filter: savedListFilter,
            handlersFor: savedGameListHandlers,
        });
        pruneSavedGameSelection();
    }

    async function loadSavedGames() {
        if (!Api.get) {
            return;
        }
        try {
            const list = await Api.get("/bookmark");
            savedGames = Array.isArray(list) ? list.slice() : [];
            savedGames.sort(function (a, b) {
                const ta = a && a.date ? new Date(a.date).getTime() : 0;
                const tb = b && b.date ? new Date(b.date).getTime() : 0;
                return tb - ta;
            });
            renderSavedGamesList();
        } catch (err) {
            console.error(err);
        }
    }

    async function onSaveGame() {
        if (!canPlayAdvancedTools) {
            return;
        }
        if (!game || !session || animating || engineThinking || dialogOn) {
            return;
        }
        const state = game.GameState;
        if (!state) {
            showStatus(t("play.status.nothingToSave"), 2000, "error");
            return;
        }
        setButtonDisabled("saveBtn", true);
        try {
            const bookmark = await Api.post(
                "/bookmark",
                bookmarkPayloadFromCurrentState(formatManualSaveGameName(), bookmarkMovesPayload()),
            );
            if (bookmark && bookmark._id) {
                savedGames = savedGames.filter(function (b) {
                    return String(b._id) !== String(bookmark._id);
                });
                savedGames.unshift(bookmark);
            } else {
                await loadSavedGames();
            }
            renderSavedGamesList();
            showStatus(t("play.status.gameSaved"), 2000, "info");
        } catch (err) {
            showStatus(err.message || t("play.status.couldNotSaveGame"), 0, "error");
        } finally {
            updateActionButtons();
        }
    }

    function updateMovesTable(moves) {
        const movesDiv = $("movesDiv");
        if (!movesDiv || moves == null) {
            return;
        }
        const reviewClicksEnabled = reviewMode && reviewFullMoves.length > 0;
        MovesPanel.render(movesDiv, appendGameResultToMoves(moves), {
            isResultMove: isTableResultMove,
            onPlyActivate: reviewClicksEnabled ? onReviewMoveClick : null,
            selectedPly: selectedReviewPly(),
        });
    }

    function registerGameEvents() {
        game.OnUpdate = onGameUpdate;
        game.OnPromotion = function (turn) {
            if (sessionDrivesActivePlayBoard()) {
                return;
            }
            return onPromotion(turn);
        };
        game.OnDraw = function (reason) {
            if (sessionDrivesActivePlayOutcomes()) {
                return;
            }
            return onDraw(reason);
        };
        game.OnUndo = onUndoEvent;
    }

    async function onUndoEvent(moves) {
        if (batchUndoRedo) {
            return;
        }
        animating = true;
        const move = moves && moves.length ? moves[moves.length - 1] : null;
        if (move) {
            Board.clearArrows();
            await Board.animateUndoMove(move);
        } else {
            Board.syncFromGameState();
        }
        animating = false;
        redoPairAvailable = true;
        updateMovesTable(tableMovesFromGame());
        updateActionButtons();
    }

    async function onGameUpdate(gameState) {
        if (batchUndoRedo) {
            return;
        }
        /* Active play: GameSession boardChanged / moveApplied own board + chrome. */
        if (sessionDrivesActivePlayBoard()) {
            return;
        }
        if (!Board.isBoardAnimating()) {
            Board.drawBoard(gameState.board);
            Board.updateCaptureLists(gameState.capturedPiecesList || []);
            if (reviewMode) {
                applyReviewResignationHighlightIfNeeded();
            }
        }
        if (positionSetupMode || loadingBookmark) {
            if (positionSetupMode) {
                // evaluate() runs after OnUpdate during setup edits; sync status once flags settle.
                queueMicrotask(function () {
                    syncPositionSetupStatusLine();
                });
            }
            return;
        }
        if (reviewMode) {
            refreshReviewMovesTable();
            if (gameState.checkmate || gameState.check) {
                Board.applyCheckedHighlight();
            }
        } else {
            updateMovesTable(movesForMovesTable(movesForPanelDisplay()));
        }

        if (gameState.draw) {
            lastCheckNotifySide = null;
            onDraw(gameState.drawReason || "Draw");
            Board.applyDrawHighlight();
        } else if (gameState.checkmate) {
            lastCheckNotifySide = null;
            onCheckmate(game.Turn);
            Board.applyCheckedHighlight();
        } else if (gameState.check === true) {
            if (lastCheckNotifySide !== game.Turn) {
                onCheck(game.Turn);
                lastCheckNotifySide = game.Turn;
            }
            Board.applyCheckedHighlight();
        } else if (alertMode && !gameState.check && !gameState.checkmate && !gameState.draw) {
            alertMode = false;
            lastCheckNotifySide = null;
            showStatus("");
        }

        updateHeaderTurn();
        updateActionButtons();
        persistActiveGame();
    }

    function sessionDrivesActivePlayOutcomes() {
        return !!(
            playGameSession &&
            typeof playGameSession.isActive === "function" &&
            playGameSession.isActive() &&
            gameActive &&
            !positionSetupMode &&
            !reviewMode &&
            !configurationMode
        );
    }

    /** Same gate as outcomes: session events own the live Play board surface. */
    function sessionDrivesActivePlayBoard() {
        return sessionDrivesActivePlayOutcomes();
    }

    function onCheck(turn) {
        alertMode = true;
        showStatus(t("play.status.check"), 2000, "check");
    }

    function onCheckmate(matedTurn) {
        alertMode = true;
        const winner = game.opponent(matedTurn);
            showStatus(t("play.status.checkmateWins", { winner: localizeColorName(winner) }), 0, "checkmate");
            Clocks.stop();
            updateActionButtons();
            tryLogCompletedGame();
        }

        function onDraw(reason) {
        const localized = localizeDrawReason(reason);
        if (positionSetupMode) {
            showStatus(t("play.status.drawWithReason", { reason: localized }), 0, "draw");
            if (Board.applyDrawHighlight) {
                Board.applyDrawHighlight();
            }
            return;
        }
        alertMode = true;
        showStatus(t("play.status.drawWithReason", { reason: localized }), 0, "draw");
        Board.applyDrawHighlight();
        Clocks.stop();
        updateActionButtons();
        tryLogCompletedGame();
    }

    function adjustIncomingNetworkMoveForBoardView(move) {
        return move;
    }

    function adjustOutgoingNetworkMoveForBoardView(move) {
        return move;
    }

    function networkMoveAlreadyApplied(move) {
        if (!move || !game || !game.GameState || !game.GameState.board) {
            return false;
        }
        const board = game.GameState.board;
        const target = board[move.target.row] && board[move.target.row][move.target.col];
        const source = board[move.source.row] && board[move.source.row][move.source.col];
        if (!target || source) {
            return false;
        }
        if (move.piece && target.color === move.piece.color) {
            if (move.piece.pieceType == null || target.pieceType === move.piece.pieceType) {
                return true;
            }
        }
        return false;
    }

    function parseServerMoves(moves) {
        if (!Array.isArray(moves)) {
            return [];
        }
        return moves.map(function (m) {
            return typeof m === "string" ? JSON.parse(m) : m;
        });
    }

    async function applyEngineMove(move) {
        const adjusted = adjustIncomingNetworkMoveForBoardView(move);
        if (!adjusted) {
            return false;
        }
        clearDisplayedEvaluation();
        if (networkMoveAlreadyApplied(adjusted)) {
            Board.syncFromGameState();
            return true;
        }

        try {
            try {
                await Board.animateMove(adjusted);
            } catch {
                /* Animation may skip; chess apply below is authoritative. */
            }
            const gs = ensurePlayGameSession();
            if (gs && typeof gs.playMove === "function") {
                const executed = gs.playMove(adjusted, { source: "engine" });
                if (!executed) {
                    return false;
                }
            } else if (adjusted.promotion && adjusted.selectedPiece != null) {
                const actual = game.makeMove(adjusted.source, adjusted.target);
                actual.selectedPiece = adjusted.selectedPiece;
                actual.promotion = true;
                if (actual.piece && adjusted.piece) {
                    actual.piece.color = adjusted.piece.color;
                }
                game.completePromotion(actual);
            } else {
                game.makeMove(adjusted.source, adjusted.target);
            }
            if (Board.refreshHumanPieceInput) {
                Board.refreshHumanPieceInput();
            }
        } finally {
            if (Board.clearBoardAnimating) {
                Board.clearBoardAnimating();
            }
        }
        /* Session playMove emits moveApplied / boardChanged for chrome + paint. */
        return true;
    }

    async function applyNetworkMove(move) {
        const adjusted = adjustIncomingNetworkMoveForBoardView(move);
        if (!adjusted) {
            return false;
        }
        clearDisplayedEvaluation();
        if (networkMoveAlreadyApplied(adjusted)) {
            Board.syncFromGameState();
            return true;
        }

        try {
            try {
                await Board.animateMove(adjusted);
            } catch {
                /* Animation may skip; chess apply below is authoritative. */
            }
            const gs = ensurePlayGameSession();
            if (gs && typeof gs.playMove === "function") {
                const executed = gs.playMove(adjusted, { source: "network" });
                if (!executed) {
                    return false;
                }
            } else if (adjusted.promotion && adjusted.selectedPiece != null) {
                const actual = game.makeMove(adjusted.source, adjusted.target);
                actual.selectedPiece = adjusted.selectedPiece;
                actual.promotion = true;
                if (actual.piece && adjusted.piece) {
                    actual.piece.color = adjusted.piece.color;
                }
                game.completePromotion(actual);
            } else {
                game.makeMove(adjusted.source, adjusted.target);
            }
            if (Board.refreshHumanPieceInput) {
                Board.refreshHumanPieceInput();
            }
        } finally {
            if (Board.clearBoardAnimating) {
                Board.clearBoardAnimating();
            }
        }
        return true;
    }

    function playSessionMetaFromShell() {
        return {
            engine: session && session.engine,
            thinkingTimeSeconds: session && session.thinkingTimeSeconds,
            difficulty: session && session.difficulty,
            whitePlayerName: session && session.whitePlayerName,
            blackPlayerName: session && session.blackPlayerName,
            username: session && session.username,
        };
    }

    function disposePlayGameSession() {
        if (playLocalEngineMode && typeof playLocalEngineMode.abort === "function") {
            playLocalEngineMode.abort();
        }
        if (playOnlineMode && typeof playOnlineMode.detach === "function") {
            try {
                playOnlineMode.detach();
            } catch {
                /* ignore */
            }
        }
        if (playGameSession) {
            if (typeof playGameSession.leave === "function") {
                playGameSession.leave();
            }
            if (typeof playGameSession.dispose === "function") {
                playGameSession.dispose();
            }
        }
        playGameSession = null;
        playLocalEngineMode = null;
        playOnlineMode = null;
        playReviewMode = null;
        playPracticeMode = null;
        playPositionSetupMode = null;
        playConfigurationMode = null;
        playCapabilities = null;
    }

    function syncReviewShellFromMode() {
        if (!playReviewMode || typeof playReviewMode.getNavState !== "function") {
            return;
        }
        const nav = playReviewMode.getNavState();
        reviewFullMoves = nav.fullMoves || [];
        reviewPlyIndex = nav.plyIndex || 0;
        reviewOriginStateStr = nav.originStateStr;
        reviewFinalStateStr = nav.finalStateStr;
        reviewResignedColor = nav.resignedColor;
        reviewBranchPly = nav.branchPly;
    }

    function createLocalEngineMode() {
        return LocalEngineModeApi.create({
            autoRunOnAttach: false,
            canRun: function () {
                return (
                    !!gameActive &&
                    !positionSetupMode &&
                    !configurationMode &&
                    !animating &&
                    !dialogOn &&
                    !reviewMode
                );
            },
            immediateResign: function () {
                return Settings.loadGamePreferences().immediateResign === true;
            },
            applyEngineMove: async function (move) {
                engineThinking = false;
                animating = true;
                updateActionButtons();
                try {
                    const applied = await applyEngineMove(move);
                    if (!applied) {
                        showStatus(t("play.status.engineMoveNotApplied"), 0, "error");
                        return false;
                    }
                    if (isHumanTurn()) {
                        showStatus("", 0, "info");
                    }
                    return true;
                } finally {
                    animating = false;
                    if (Board.refreshHumanPieceInput) {
                        Board.refreshHumanPieceInput();
                    }
                    updateActionButtons();
                }
            },
            onStatus: function (message, kind) {
                showStatus(message, kind === "info" ? 0 : 0, kind || "info");
            },
        });
    }

    function attachPlayLocalEngineMode() {
        if (!playGameSession || !LocalEngineModeApi) {
            return;
        }
        practiceMode = false;
        playPracticeMode = null;
        playPositionSetupMode = null;
        playConfigurationMode = null;
        if (Board.setBothSidesHuman) {
            Board.setBothSidesHuman(false);
        }
        playReviewMode = null;
        if (playOnlineMode && typeof playOnlineMode.detach === "function") {
            try {
                playOnlineMode.detach();
            } catch {
                /* ignore */
            }
        }
        playOnlineMode = null;
        onlineGameInfo = null;
        if (!playLocalEngineMode) {
            playLocalEngineMode = createLocalEngineMode();
        }
        playGameSession.attachMode(playLocalEngineMode);
        if (typeof playLocalEngineMode.capabilities === "function") {
            playCapabilities = playLocalEngineMode.capabilities();
        }
        syncPrimaryGameButtonLabel();
    }

    function createPracticeMode() {
        return PracticeModeApi.create({
            onStatus: function (message, kind) {
                showStatus(message, kind === "info" ? 0 : 0, kind || "info");
            },
        });
    }

    function attachPlayPracticeMode() {
        if (!playGameSession || !PracticeModeApi) {
            return;
        }
        practiceMode = true;
        playReviewMode = null;
        playPositionSetupMode = null;
        playConfigurationMode = null;
        if (playLocalEngineMode && typeof playLocalEngineMode.abort === "function") {
            playLocalEngineMode.abort();
        }
        playLocalEngineMode = null;
        if (playOnlineMode && typeof playOnlineMode.detach === "function") {
            try {
                playOnlineMode.detach();
            } catch {
                /* ignore */
            }
        }
        playOnlineMode = null;
        onlineGameInfo = null;
        playGameSession.setEngine(null);
        if (!playPracticeMode) {
            playPracticeMode = createPracticeMode();
        }
        playGameSession.attachMode(playPracticeMode);
        if (typeof playPracticeMode.capabilities === "function") {
            playCapabilities = playPracticeMode.capabilities();
        }
        if (Board.setBothSidesHuman) {
            Board.setBothSidesHuman(true);
        }
        syncPrimaryGameButtonLabel();
        updateMatchHeader();
    }

    function createPositionSetupMode() {
        return PositionSetupModeApi.create({
            onStatus: function (message, kind) {
                showStatus(message, 0, kind || "info");
            },
        });
    }

    function attachPlayPositionSetupMode() {
        if (!playGameSession || !PositionSetupModeApi) {
            return;
        }
        playReviewMode = null;
        playPracticeMode = null;
        playConfigurationMode = null;
        if (playLocalEngineMode && typeof playLocalEngineMode.abort === "function") {
            playLocalEngineMode.abort();
        }
        playLocalEngineMode = null;
        clearOnlineSessionForLocalTools();
        playGameSession.setEngine(null);
        if (!playPositionSetupMode) {
            playPositionSetupMode = createPositionSetupMode();
        }
        playGameSession.attachMode(playPositionSetupMode);
        if (typeof playPositionSetupMode.capabilities === "function") {
            playCapabilities = playPositionSetupMode.capabilities();
        }
        syncPrimaryGameButtonLabel();
        updateMatchHeader();
    }

    function createConfigurationMode() {
        return ConfigurationModeApi.create({
            onStatus: function (message, kind) {
                showStatus(message, 0, kind || "info");
            },
        });
    }

    function attachPlayConfigurationMode() {
        if (!playGameSession || !ConfigurationModeApi) {
            return;
        }
        playReviewMode = null;
        playPracticeMode = null;
        playPositionSetupMode = null;
        if (playLocalEngineMode && typeof playLocalEngineMode.abort === "function") {
            playLocalEngineMode.abort();
        }
        playLocalEngineMode = null;
        clearOnlineSessionForLocalTools();
        playGameSession.setEngine(null);
        if (!playConfigurationMode) {
            playConfigurationMode = createConfigurationMode();
        }
        playGameSession.attachMode(playConfigurationMode);
        if (typeof playConfigurationMode.capabilities === "function") {
            playCapabilities = playConfigurationMode.capabilities();
        }
        syncPrimaryGameButtonLabel();
        updateMatchHeader();
    }

    function createOnlineMode(gameInfo) {
        const transport = WsTransportApi.create({});
        return OnlineModeApi.create({
            transport: transport,
            gameInfo: {
                id: gameInfo.id,
                username: gameInfo.username,
                userId: gameInfo.userId,
                creatorId: gameInfo.creatorId,
                whitePlayerName: gameInfo.whitePlayerName,
                blackPlayerName: gameInfo.blackPlayerName,
            },
            humanIsWhite: currentPlayerIsWhite,
            watcher: !!gameInfo.watcher,
            wsUrl: WsTransportApi.defaultWsUrl(),
            getClocks: function () {
                return Clocks.get();
            },
            setClocks: function (snapshot) {
                if (!snapshot) {
                    return;
                }
                Clocks.stop();
                Clocks.set({ white: snapshot.white, black: snapshot.black });
                if (game && !game.GameOver) {
                    Clocks.startFor(game.Turn);
                }
                updateHeaderTurn();
            },
            applyRemoteMove: async function (move) {
                animating = true;
                updateActionButtons();
                try {
                    return await applyNetworkMove(move);
                } finally {
                    animating = false;
                    if (Board.refreshHumanPieceInput) {
                        Board.refreshHumanPieceInput();
                    }
                    updateActionButtons();
                }
            },
            cancelBeforeMove: async function (gameId) {
                if (!Api || typeof Api.post !== "function") {
                    return;
                }
                await Api.post("/cancel-before-move", { gameId: gameId });
            },
            onStatus: function (message, kind) {
                showStatus(message, 0, kind || "info");
            },
            onOpponentJoined: function (name) {
                if (!session) {
                    return;
                }
                const label =
                    name && String(name).trim() ? String(name).trim() : "Opponent";
                if (currentPlayerIsWhite) {
                    session.blackPlayerName = label;
                } else {
                    session.whitePlayerName = label;
                }
                if (onlineGameInfo) {
                    if (currentPlayerIsWhite) {
                        onlineGameInfo.blackPlayerName = label;
                    } else {
                        onlineGameInfo.whitePlayerName = label;
                    }
                }
                setOpponentConnectionLost(false);
                updateMatchHeader();
                updateActionButtons();
            },
            onOpponentDisconnected: function (payload) {
                const seat =
                    payload && typeof payload.disconnectedWasWhite === "boolean"
                        ? payload.disconnectedWasWhite
                        : null;
                setOpponentConnectionLost(true, seat);
            },
            onOpponentRejoined: function () {
                setOpponentConnectionLost(false);
            },
            onGameCancelled: function () {
                setOpponentConnectionLost(false);
                clearActiveGameSnapshot();
            },
            onDrawOffered: function () {
                if (dialogOn || (onlineGameInfo && onlineGameInfo.watcher)) {
                    return;
                }
                Dialog.confirm({
                    title: t("play.status.drawOfferTitle"),
                    message: t("play.status.drawOfferMessage"),
                    confirmLabel: t("play.dialogs.accept"),
                    cancelLabel: t("play.dialogs.decline"),
                    onConfirm: function () {
                        if (playOnlineMode && playOnlineMode.acceptDrawOffer) {
                            playOnlineMode.acceptDrawOffer();
                        }
                    },
                    onCancel: function () {
                        if (playOnlineMode && playOnlineMode.declineDrawOffer) {
                            playOnlineMode.declineDrawOffer();
                        }
                    },
                });
            },
            onRematchOffered: function (payload) {
                if (dialogOn || (onlineGameInfo && onlineGameInfo.watcher)) {
                    return;
                }
                const wants =
                    payload &&
                    (payload.offererWantsColor === "white" ||
                        payload.offererWantsColor === "black")
                        ? payload.offererWantsColor
                        : null;
                let message = t("play.dialogs.rematchOfferAgree");
                if (wants) {
                    message = t("play.dialogs.rematchColorPreference", {
                        offerer: wants === "white" ? t("common.white") : t("common.black"),
                        you: wants === "white" ? t("common.black") : t("common.white"),
                    });
                }
                Dialog.confirm({
                    title: t("play.status.rematchTitle"),
                    message: message,
                    confirmLabel: t("play.dialogs.accept"),
                    cancelLabel: t("play.dialogs.decline"),
                    onConfirm: function () {
                        if (playOnlineMode && playOnlineMode.acceptRematchOffer) {
                            playOnlineMode.acceptRematchOffer(wants || undefined);
                        }
                    },
                    onCancel: function () {
                        if (playOnlineMode && playOnlineMode.declineRematchOffer) {
                            playOnlineMode.declineRematchOffer();
                        }
                    },
                });
            },
            onRematchAccepted: function (payload) {
                const newId = payload && payload.gameId;
                if (newId == null) {
                    return;
                }
                void beginOnlineRematch(newId);
            },
            onDisconnectCountdown: function (seconds, meta) {
                if (
                    meta &&
                    typeof meta.disconnectedWasWhite === "boolean"
                ) {
                    disconnectedSeatIsWhite = meta.disconnectedWasWhite;
                    applyOpponentConnectionChrome();
                }
                const isWatch = !!(onlineGameInfo && onlineGameInfo.watcher);
                let who;
                if (isWatch) {
                    if (disconnectedSeatIsWhite === true) {
                        who =
                            (onlineGameInfo.whitePlayerName &&
                                String(onlineGameInfo.whitePlayerName).trim()) ||
                            t("common.white");
                    } else if (disconnectedSeatIsWhite === false) {
                        who =
                            (onlineGameInfo.blackPlayerName &&
                                String(onlineGameInfo.blackPlayerName).trim()) ||
                            t("common.black");
                    } else {
                        who = t("common.aPlayer");
                    }
                    showStatus(
                        t("play.status.playerDisconnectedWaiting", {
                            who: who,
                            countdown: formatDisconnectCountdown(seconds),
                        }),
                        0,
                        "info",
                    );
                } else {
                    showStatus(
                        t("play.status.opponentDisconnectedCountdown", {
                            countdown: formatDisconnectCountdown(seconds),
                        }),
                        0,
                        "info",
                    );
                }
            },
            onDisconnectCountdownClear: function () {
                /* Status will refresh on next event / move. */
            },
            onDisconnectCountdownEnd: function () {
                void syncOnlineReconnectTimeoutFromServer();
            },
        });
    }

    function formatDisconnectCountdown(seconds) {
        const s = Math.max(0, Math.floor(Number(seconds) || 0));
        const m = Math.floor(s / 60);
        const r = s % 60;
        return m + ":" + (r < 10 ? "0" : "") + r;
    }

    async function syncOnlineReconnectTimeoutFromServer() {
        if (!onlineGameInfo || !onlineGameInfo.id || !Api || typeof Api.get !== "function") {
            return;
        }
        if (game && game.GameOver) {
            return;
        }
        try {
            const data = await Api.get(
                "/gameInfo?id=" + encodeURIComponent(String(onlineGameInfo.id)),
            );
            if (!data || data.status == null) {
                return;
            }
            if (data.status === "cancelled") {
                showStatus(t("play.status.gameCancelledReconnectTimeout"), 0, "info");
                Clocks.stop();
                clearActiveGameSnapshot();
                updateActionButtons();
                return;
            }
            if (data.status !== "game over") {
                return;
            }
            const movesObj = await Api.get(
                "/gameMoves?id=" + encodeURIComponent(String(onlineGameInfo.id)),
            );
            const moves = (movesObj && movesObj.moves) || [];
            const last = moves[moves.length - 1];
            let loser = null;
            if (last && last.moveStr === "1-0") {
                loser = "Black";
            } else if (last && last.moveStr === "0-1") {
                loser = "White";
            }
            if (!loser || (game && game.GameOver)) {
                return;
            }
            const gs = ensurePlayGameSession();
            if (gs && typeof gs.resign === "function") {
                gs.resign(loser);
            } else if (game) {
                game.resign(loser);
                finishResignGame(loser);
            }
            setOpponentConnectionLost(false);
            const winner = loser === "White" ? "Black" : "White";
            const isWatch = !!(onlineGameInfo && onlineGameInfo.watcher);
            if (isWatch) {
                const loserName =
                    loser === "White"
                        ? (onlineGameInfo.whitePlayerName || localizeColorName("White"))
                        : (onlineGameInfo.blackPlayerName || localizeColorName("Black"));
                const winnerName =
                    winner === "White"
                        ? (onlineGameInfo.whitePlayerName || localizeColorName("White"))
                        : (onlineGameInfo.blackPlayerName || localizeColorName("Black"));
                showStatus(
                    t("play.status.playerFailedToReconnectWins", {
                        loser: loserName,
                        winner: winnerName,
                    }),
                    0,
                    "info",
                );
            } else {
                showStatus(t("play.status.gameOverOpponentFailedReconnect"), 0, "info");
            }
            Clocks.stop();
            updateActionButtons();
        } catch (err) {
            console.warn("[Play] Could not sync reconnect timeout:", err);
        }
    }

    async function beginOnlineRematch(newGameId) {
        if (!Api || typeof Api.post !== "function") {
            showStatus(t("play.status.couldNotStartRematch"), 0, "error");
            return;
        }
        try {
            await Api.post("/rematch", { id: newGameId });
        } catch (err) {
            console.warn("[Play] rematch session sync failed:", err);
        }
        if (playOnlineMode && typeof playOnlineMode.detach === "function") {
            try {
                playOnlineMode.detach();
            } catch {
                /* ignore */
            }
        }
        playOnlineMode = null;
        onlineGameInfo = null;
        disposePlayGameSession();
        const started = await beginOnlineFromServerId(newGameId);
        if (started) {
            clearWebLaunchQueryString({ keepId: true });
            showStatus(t("play.status.rematchStarted"), 2000, "info");
        }
    }

    function attachPlayOnlineMode(gameInfo) {
        if (!playGameSession || !OnlineModeApi || !WsTransportApi || !gameInfo) {
            return;
        }
        practiceMode = false;
        playPracticeMode = null;
        playPositionSetupMode = null;
        playConfigurationMode = null;
        if (Board.setBothSidesHuman) {
            Board.setBothSidesHuman(false);
        }
        playReviewMode = null;
        if (playLocalEngineMode && typeof playLocalEngineMode.abort === "function") {
            playLocalEngineMode.abort();
        }
        playLocalEngineMode = null;
        onlineGameInfo = gameInfo;
        playOnlineMode = createOnlineMode(gameInfo);
        playGameSession.attachMode(playOnlineMode);
        if (typeof playOnlineMode.capabilities === "function") {
            playCapabilities = playOnlineMode.capabilities();
        }
        syncPrimaryGameButtonLabel();
        if (
            playGameSession.isActive &&
            playGameSession.isActive() &&
            typeof playOnlineMode.ensureConnected === "function"
        ) {
            playOnlineMode.ensureConnected();
        }
    }

    function attachPlayReviewMode() {
        if (!game || !GameSessionApi || !ReviewModeApi) {
            return;
        }
        ensurePlayGameSession();
        if (!playGameSession) {
            return;
        }
        practiceMode = false;
        playPracticeMode = null;
        playPositionSetupMode = null;
        playConfigurationMode = null;
        if (Board.setBothSidesHuman) {
            Board.setBothSidesHuman(false);
        }
        if (playLocalEngineMode && typeof playLocalEngineMode.abort === "function") {
            playLocalEngineMode.abort();
        }
        playLocalEngineMode = null;
        if (playOnlineMode && typeof playOnlineMode.detach === "function") {
            try {
                playOnlineMode.detach();
            } catch {
                /* ignore */
            }
        }
        playOnlineMode = null;
        playReviewMode = ReviewModeApi.create({});
        playGameSession.attachMode(playReviewMode);
        if (reviewFullMoves.length || reviewFinalStateStr) {
            playReviewMode.loadNavigation({
                moves: reviewFullMoves,
                finalStateStr: reviewFinalStateStr,
                originStateStr: reviewOriginStateStr,
                resignedColor: reviewResignedColor,
            });
            if (typeof playReviewMode.setPly === "function") {
                playReviewMode.setPly(reviewPlyIndex);
            }
            syncReviewShellFromMode();
        }
    }

    function detachPlayReviewMode() {
        if (!playGameSession) {
            playReviewMode = null;
            return;
        }
        playReviewMode = null;
        if (gameActive && onlineGameInfo && onlineGameInfo.gameType === "OnlineGame" && OnlineModeApi) {
            attachPlayOnlineMode(onlineGameInfo);
            return;
        }
        if (gameActive && LocalEngineModeApi) {
            attachPlayLocalEngineMode();
            return;
        }
        if (typeof playGameSession.attachMode === "function") {
            playGameSession.attachMode(null);
        }
    }

    function sessionChromeGuardsOk() {
        return (
            !!gameActive &&
            !positionSetupMode &&
            !configurationMode &&
            !reviewMode
        );
    }

    /**
     * Play chrome driven by GameSession move events (human / engine / promotion).
     */
    function onSessionMoveApplied(executed, info) {
        if (!sessionChromeGuardsOk()) {
            return;
        }
        clearDisplayedEvaluation();
        if (executed) {
            lastMove = executed;
        } else if (game && game.LastMove) {
            lastMove = game.LastMove;
        }
        const src = info && info.source;
        if (src === "human" || src === "promotion" || src === "engine" || src === "session" || src === "network") {
            redoPairAvailable = false;
        }
        if (Board.clearArrows) {
            Board.clearArrows();
        }
        if (Board.resetSquareColors) {
            Board.resetSquareColors();
        }
        updateMovesTable(tableMovesFromGame());
        updateActionButtons();
    }

    /**
     * Board surface driven by GameSession boardChanged (active play).
     * Skipped during undo/redo batch — onSessionNavChrome syncs instead.
     */
    function onSessionBoardChanged(state) {
        if (!sessionDrivesActivePlayBoard() || batchUndoRedo) {
            return;
        }
        const gameState = state || (game && game.GameState);
        if (!gameState) {
            return;
        }
        if (!Board.isBoardAnimating || !Board.isBoardAnimating()) {
            if (gameState.board) {
                Board.drawBoard(gameState.board);
            } else if (Board.syncFromGameState) {
                Board.syncFromGameState();
            }
            Board.updateCaptureLists(gameState.capturedPiecesList || []);
        }
        if (gameState.resigned && Board.applyResignedKingTilt) {
            Board.applyResignedKingTilt(gameState.resigned);
        } else if (gameState.checkmate || gameState.check) {
            if (Board.applyCheckedHighlight) {
                Board.applyCheckedHighlight();
            }
        } else if (gameState.draw && Board.applyDrawHighlight) {
            Board.applyDrawHighlight();
        }
        updateHeaderTurn();
        updateActionButtons();
        persistActiveGame();
    }

    /** Undo/redo pair chrome — OnUpdate is batched off during shell undo/redo. */
    function onSessionNavChrome() {
        if (!sessionChromeGuardsOk()) {
            return;
        }
        clearDisplayedEvaluation();
        if (Board.clearArrows) {
            Board.clearArrows();
        }
        syncBoardFromGame();
        if (game && game.LastMove) {
            lastMove = game.LastMove;
        }
        updateMovesTable(tableMovesFromGame());
        updateActionButtons();
    }

    /**
     * Phase 2/3: wrap ChessGame in GameSession + LocalEngineMode or OnlineMode.
     * Board applies human moves via session.applyMove; modes own engine / network.
     */
    function ensurePlayGameSession() {
        if (!game || !GameSessionApi) {
            return null;
        }
        /* OnlineGame participants + any Prefer-Play watcher (incl. SinglePlayerGame). */
        const wantOnline =
            !!(
                onlineGameInfo &&
                (onlineGameInfo.gameType === "OnlineGame" || onlineGameInfo.watcher === true)
            ) &&
            !!OnlineModeApi &&
            !!WsTransportApi;
        if (playGameSession && playGameSession.getGame() === game) {
            playGameSession.setHumanIsWhite(currentPlayerIsWhite);
            playGameSession.setEngine(
                wantOnline || practiceMode || positionSetupMode || configurationMode
                    ? null
                    : Engine,
            );
            playGameSession.setMeta(playSessionMetaFromShell());
            if (!playGameSession.isActive()) {
                playGameSession.load({
                    active: true,
                    humanIsWhite: currentPlayerIsWhite,
                    meta: playSessionMetaFromShell(),
                });
            }
            if (!reviewMode && !positionSetupMode && !configurationMode) {
                if (wantOnline && !playOnlineMode) {
                    attachPlayOnlineMode(onlineGameInfo);
                } else if (practiceMode && PracticeModeApi) {
                    if (!playPracticeMode) {
                        attachPlayPracticeMode();
                    }
                } else if (!wantOnline && !practiceMode && !playLocalEngineMode && LocalEngineModeApi) {
                    attachPlayLocalEngineMode();
                }
            }
            return playGameSession;
        }
        disposePlayGameSession();
        playGameSession = GameSessionApi.create({
            game: game,
            humanIsWhite: currentPlayerIsWhite,
            engine:
                wantOnline || practiceMode || positionSetupMode || configurationMode
                    ? null
                    : Engine,
            meta: playSessionMetaFromShell(),
            clocks: {
                onTurn: function (turn) {
                    Clocks.stop();
                    updateHeaderTurn();
                    if (
                        game &&
                        !game.GameOver &&
                        gameActive &&
                        !reviewMode &&
                        !positionSetupMode
                    ) {
                        Clocks.startFor(turn);
                    }
                },
                stop: function () {
                    Clocks.stop();
                },
                get: function () {
                    return Clocks.get();
                },
            },
        });
        playGameSession.on("gameOver", function (payload) {
            if (!payload) {
                return;
            }
            if (reviewMode || !gameActive) {
                Clocks.stop();
                return;
            }
            updateMovesTable(tableMovesFromGame());
            if (payload.kind === "cancelled") {
                alertMode = true;
                Clocks.stop();
                clearActiveGameSnapshot();
                showStatus(
                    payload.detail
                        ? t("play.status.gameCancelledWithDetail", { detail: payload.detail })
                        : t("play.status.gameCancelled"),
                    0,
                    "info",
                );
                updateActionButtons();
                return;
            }
            if (payload.kind === "resign") {
                finishResignGame(payload.resigned);
                tryLogCompletedGame();
                return;
            }
            if (payload.kind === "checkmate") {
                lastCheckNotifySide = null;
                alertMode = true;
                const winner =
                    payload.winner ||
                    (game && payload.mated && typeof game.opponent === "function"
                        ? game.opponent(payload.mated)
                        : null);
                const winnerName = winner ? localizeColorName(winner) : t("common.winner");
                showStatus(t("play.status.checkmateWins", { winner: winnerName }), 0, "checkmate");
                Clocks.stop();
                if (Board.applyCheckedHighlight) {
                    Board.applyCheckedHighlight();
                }
                updateActionButtons();
                tryLogCompletedGame();
                return;
            }
            if (payload.kind === "draw") {
                lastCheckNotifySide = null;
                alertMode = true;
                showStatus(t("play.status.drawWithReason", { reason: localizeDrawReason(payload.reason) }), 0, "draw");
                if (Board.applyDrawHighlight) {
                    Board.applyDrawHighlight();
                }
                Clocks.stop();
                updateActionButtons();
                tryLogCompletedGame();
                return;
            }
            if (payload.kind === "timeout") {
                lastCheckNotifySide = null;
                alertMode = true;
                const loser = payload.loser || (game && game.Turn) || "white";
                showStatus(t("play.status.timesUpLost", { loser: localizeColorName(loser) }), 5000, "timeout");
                Clocks.stop();
                updateActionButtons();
                tryLogCompletedGame();
            }
        });
        playGameSession.on("statusChanged", function (status) {
            if (status !== "check" || !game) {
                return;
            }
            if (lastCheckNotifySide !== game.Turn) {
                onCheck(game.Turn);
                lastCheckNotifySide = game.Turn;
            }
            if (Board.applyCheckedHighlight) {
                Board.applyCheckedHighlight();
            }
        });
        playGameSession.on("info", function (message, kind) {
            showStatus(message, 0, kind || "info");
        });
        playGameSession.on("error", function (message) {
            showStatus(message || t("play.status.sessionError"), 0, "error");
        });
        playGameSession.on("moveApplied", function (executed, info) {
            onSessionMoveApplied(executed, info);
            if (info && info.source !== "network" && info.source !== "undo" && info.source !== "redo") {
                syncSpMoveToServer(executed, info.source);
            }
        });
        playGameSession.on("boardChanged", function (state) {
            onSessionBoardChanged(state);
        });
        playGameSession.on("promotionNeeded", function (turn) {
            onPromotion(turn);
        });
        playGameSession.on("capabilitiesChanged", function (caps) {
            playCapabilities = caps || null;
            updateActionButtons();
        });
        playGameSession.on("undone", function () {
            redoPairAvailable = true;
            onSessionNavChrome();
        });
        playGameSession.on("redone", function () {
            redoPairAvailable = false;
            onSessionNavChrome();
        });
        if (positionSetupMode && PositionSetupModeApi) {
            attachPlayPositionSetupMode();
        } else if (configurationMode && ConfigurationModeApi) {
            attachPlayConfigurationMode();
        } else if (wantOnline) {
            attachPlayOnlineMode(onlineGameInfo);
        } else if (practiceMode && PracticeModeApi) {
            attachPlayPracticeMode();
        } else if (LocalEngineModeApi) {
            attachPlayLocalEngineMode();
        }
        playGameSession.load({
            active: true,
            humanIsWhite: currentPlayerIsWhite,
            meta: playSessionMetaFromShell(),
        });
        return playGameSession;
    }

    function abortEngineSearch() {
        if (playLocalEngineMode && typeof playLocalEngineMode.abort === "function") {
            playLocalEngineMode.abort();
        }
        if (Engine && typeof Engine.abortSearch === "function") {
            Engine.abortSearch();
        }
        engineThinking = false;
        animating = false;
    }

    function resignStatusMessage(resignedColor) {
        return EngineTurn.resignStatusMessage(resignedColor, sessionPlayerNames(session));
    }

    function finishResignGame(resignedColor) {
        alertMode = true;
        Clocks.stop();
        showStatus(resignStatusMessage(resignedColor), 0, "info");
        if (Board.applyResignedKingTilt && resignedColor) {
            Board.applyResignedKingTilt(resignedColor);
        }
        updateHeaderTurn();
        updateActionButtons();
    }

    function completeUserResign() {
        const player = practiceMode
            ? game && game.Turn === "black"
                ? "Black"
                : "White"
            : currentPlayerIsWhite
              ? "White"
              : "Black";
        abortEngineSearch();
        if (playOnlineMode && typeof playOnlineMode.requestResign === "function") {
            Promise.resolve(playOnlineMode.requestResign()).catch(function (err) {
                console.warn("[Play] Online resign failed:", err);
                showStatus((err && err.message) || t("play.status.resignFailed"), 0, "error");
            });
            return;
        }
        if (spServerSync && spServerSync.isReady && spServerSync.isReady()) {
            spServerSync.sendResign(spSyncClockPayload(currentPlayerIsWhite));
        }
        const gs = ensurePlayGameSession();
        if (gs && typeof gs.resign === "function") {
            gs.resign(player);
            return;
        }
        game.resign(player);
        updateMovesTable(tableMovesFromGame());
        finishResignGame(player);
        tryLogCompletedGame();
    }

    async function runEngineMove() {
        const gs = ensurePlayGameSession();
        if (gs && playLocalEngineMode && typeof playLocalEngineMode.maybeRunEngine === "function") {
            if (
                !EngineTurn.canStartTurn({
                    hasGame: !!game,
                    hasSession: !!session,
                    hasEngine: !!Engine,
                    gameOver: !!(game && game.GameOver),
                    aiTurn: isAiTurn(),
                    positionSetup: positionSetupMode,
                    configuration: configurationMode,
                    animating: animating,
                    engineThinking: engineThinking || playLocalEngineMode.isThinking(),
                    dialogOn: dialogOn,
                })
            ) {
                return;
            }
            if (Board.resetSquareColors) {
                Board.resetSquareColors();
            }
            await yieldForPaint();
            engineThinking = true;
            updateActionButtons();
            try {
                await playLocalEngineMode.maybeRunEngine("shell");
            } finally {
                engineThinking = !!(playLocalEngineMode && playLocalEngineMode.isThinking());
                updateActionButtons();
            }
            return;
        }
        if (
            !EngineTurn.canStartTurn({
                hasGame: !!game,
                hasSession: !!session,
                hasEngine: !!Engine,
                gameOver: !!(game && game.GameOver),
                aiTurn: isAiTurn(),
                positionSetup: positionSetupMode,
                configuration: configurationMode,
                animating: animating,
                engineThinking: engineThinking,
                dialogOn: dialogOn,
            })
        ) {
            return;
        }
        if (Board.resetSquareColors) {
            Board.resetSquareColors();
        }
        await yieldForPaint();
        engineThinking = true;
        updateActionButtons();
        showStatus(t("play.status.engineThinking"), 0, "info");
        try {
            const prefs = Settings.loadGamePreferences();
            const move = await Engine.computeMove(
                EngineTurn.buildComputeArgs({
                    gameState: game.GameState,
                    moves: tableMovesFromGame(),
                    engine: session.engine,
                    thinkingTimeSeconds: session.thinkingTimeSeconds,
                    difficulty: session.difficulty,
                    pliesPlayed: game.Moves ? game.Moves.length : 0,
                    immediateResign: prefs.immediateResign === true,
                }),
            );
            const decision = EngineTurn.decideAfterCompute(move, {
                gameOver: !!game.GameOver,
                immediateResign: prefs.immediateResign === true,
                defaultPromotionPiece: game.QUEEN,
            });
            if (decision.mateNote != null) {
                console.log("[Shmerling] Engine detected forced loss" + decision.mateNote);
            }
            if (decision.action === "noop") {
                return;
            }
            if (decision.action === "resign") {
                engineThinking = false;
                updateActionButtons();
                engineResignFromLostPosition();
                return;
            }
            if (decision.action === "error") {
                showStatus(decision.message || t("play.status.engineCouldNotFindMove"), 0, "error");
                return;
            }
            if (decision.logScore) {
                console.log(
                    "[Shmerling] Engine move score:",
                    decision.move.score,
                    decision.move.searchDepthReached != null
                        ? "(depth " + decision.move.searchDepthReached + ")"
                        : "",
                );
            }
            engineThinking = false;
            animating = true;
            updateActionButtons();
            const applied = await applyEngineMove(decision.move);
            if (!applied) {
                showStatus(t("play.status.engineMoveNotApplied"), 0, "error");
                return;
            }
            switchClocks();
            if (isHumanTurn()) {
                showStatus("", 0, "info");
            }
        } catch (err) {
            if (EngineTurn.isSearchAbortedError(err) || game.GameOver) {
                return;
            }
            console.error(err);
            showStatus(err.message || t("play.status.engineError"), 0, "error");
        } finally {
            engineThinking = false;
            animating = false;
            if (Board.refreshHumanPieceInput) {
                Board.refreshHumanPieceInput();
            }
            updateActionButtons();
        }
    }

    function applySessionSettings(opts) {
        const launchOpts = Object.assign({}, opts || {});
        const username = resolveHumanUsername(launchOpts.username);
        if (username) {
            launchOpts.username = username;
        }
        session = Settings.buildSession(launchOpts);
        allowUndo = resolveAllowUndo(session);
        currentPlayerIsWhite = launchOpts.color !== "black";
        Board.setPlayerView(currentPlayerIsWhite);
        if (Board.setHumanColor) {
            Board.setHumanColor(currentPlayerIsWhite);
        }
        Board.setPreferences({
            mouse: session.mousePreference || "drag",
            showAvailableMoves: session.showAvailableMoves !== false,
        });
        updateMatchHeader();
        syncGameRunPanelOptions();
    }

    function applyGamePreferences(prefs) {
        const next = prefs || Settings.loadGamePreferences();
        if (session) {
            const thinkingTime = Settings.normalizeThinkingTimeSeconds(next.thinkingTimeSeconds);
            session = Object.assign({}, session, {
                mousePreference: next.mouse === "double" ? "double" : "drag",
                showAvailableMoves: next.showAvailableMoves !== false,
                thinkingTimeSeconds: thinkingTime,
                difficulty: thinkingTime,
            });
            updateMatchHeader();
            syncGameRunPanelOptions();
        }
        Board.setPreferences({
            mouse: next.mouse === "double" ? "double" : "drag",
            showAvailableMoves: next.showAvailableMoves !== false,
        });
        if (Board.refreshHumanPieceInput) {
            Board.refreshHumanPieceInput();
        }
    }

    function isWebPlayPage() {
        return !!(
            window.ShmerlingPlayShell
            && typeof window.ShmerlingPlayShell.isWebPlayPage === "function"
            && window.ShmerlingPlayShell.isWebPlayPage()
        );
    }

    /**
     * Human display name for the clock header / bookmarks.
     * On web, prefer the launch-context username over the guest fallback "Player".
     */
    function resolveHumanUsername(explicit) {
        const trimmed =
            explicit != null && String(explicit).trim() ? String(explicit).trim() : "";
        if (webLaunchUsername) {
            return webLaunchUsername;
        }
        if (trimmed && trimmed !== "Player") {
            return trimmed;
        }
        if (session && session.username && session.username !== "Player") {
            return session.username;
        }
        return trimmed || undefined;
    }

    function syncSessionPlayerNames() {
        if (!session) {
            return;
        }
        const human = resolveHumanUsername(session.username) || "Player";
        const engineName =
            Settings && typeof Settings.brainLabel === "function"
                ? Settings.brainLabel(session.engine)
                : "Engine";
        session = Object.assign({}, session, {
            username: human,
            whitePlayerName: currentPlayerIsWhite ? human : engineName,
            blackPlayerName: currentPlayerIsWhite ? engineName : human,
        });
    }

    function normalizeLaunchEngine(raw) {
        return LaunchOptions.normalizeLaunchEngine(raw, {
            promoteBrain41OnWeb: isWebPlayPage(),
            normalizeEngine: function (engine) {
                return Settings.normalizeEngine(engine);
            },
        });
    }

    function mergeStoredLaunchOptions(target, source) {
        return LaunchOptions.mergeStored(target, source, {
            promoteBrain41OnWeb: isWebPlayPage(),
            normalizeEngine: function (engine) {
                return Settings.normalizeEngine(engine);
            },
        });
    }

    function applyUrlLaunchOptions(target) {
        return LaunchOptions.applyUrlSearch(
            target,
            window.location.search || "",
            {
                promoteBrain41OnWeb: isWebPlayPage(),
                normalizeEngine: function (engine) {
                    return Settings.normalizeEngine(engine);
                },
            },
        );
    }

    async function fetchLaunchContext() {
        if (launchContextPromise) {
            return launchContextPromise;
        }
        launchContextPromise = (async function () {
            if (!isWebPlayPage()) {
                canPlayAdvancedTools = true;
                canDebug = true;
                return {
                    ok: true,
                    canPlayAdvanced: true,
                    canDebug: true,
                    username: null,
                    lastGameOptions: null,
                };
            }
            canPlayAdvancedTools = false;
            canDebug = false;
            if (!Api || typeof Api.get !== "function") {
                return { ok: false, canPlayAdvanced: false, canDebug: false };
            }
            try {
                const ctx = await Api.get("/api/play/launch-context");
                canPlayAdvancedTools = !!(ctx && ctx.canPlayAdvanced);
                canDebug = !!(ctx && ctx.canDebug);
                if (ctx && ctx.username) {
                    webLaunchUsername = ctx.username;
                }
                return ctx || { ok: false, canPlayAdvanced: false, canDebug: false };
            } catch (err) {
                console.warn("[Play] Could not load launch context:", err);
                canPlayAdvancedTools = false;
                canDebug = false;
                return { ok: false, canPlayAdvanced: false, canDebug: false };
            }
        })();
        return launchContextPromise;
    }

    async function resolveWebAutoStartOptions() {
        const opts = Settings.loadLastOptions();
        try {
            const ctx = await fetchLaunchContext();
            if (ctx && ctx.lastGameOptions) {
                mergeStoredLaunchOptions(opts, ctx.lastGameOptions);
            }
            if (ctx && ctx.username) {
                opts.username = ctx.username;
                webLaunchUsername = ctx.username;
            }
        } catch (err) {
            console.warn("[Play] Could not apply launch context:", err);
        }
        applyUrlLaunchOptions(opts);
        Settings.saveLastOptions(opts);
        return opts;
    }

    function clearWebLaunchQueryString(options) {
        if (!isWebPlayPage() || !window.history || !window.history.replaceState) {
            return;
        }
        if (options && options.keepPractice) {
            window.history.replaceState({}, "", "/play?mode=practice");
            return;
        }
        const keepId = options && options.keepId && currentGameId;
        if (keepId) {
            let url = "/play?id=" + encodeURIComponent(String(currentGameId));
            if (onlineGameInfo && onlineGameInfo.watcher) {
                url += "&mode=watch";
            } else if (options && options.keepReview) {
                url =
                    "/play?mode=review&id=" +
                    encodeURIComponent(String(currentGameId));
                if (lastServerReviewType === "history" || lastServerReviewType === "pgn") {
                    url += "&type=" + encodeURIComponent(lastServerReviewType);
                }
            }
            window.history.replaceState({}, "", url);
            return;
        }
        if ((window.location.search || "").length > 0) {
            window.history.replaceState({}, "", "/play");
        }
    }

    function getWebHomeHref() {
        if (
            window.ShmerlingPlayShell
            && typeof window.ShmerlingPlayShell.getPlayHomeHref === "function"
        ) {
            return window.ShmerlingPlayShell.getPlayHomeHref();
        }
        return "/home";
    }

    function leavePlayShell() {
        clearActiveGameSnapshot();
        if (isWebPlayPage()) {
            window.location.href = getWebHomeHref();
            return;
        }
        if (
            window.ShmerlingPlayShell
            && typeof window.ShmerlingPlayShell.isElectronPlayPage === "function"
            && window.ShmerlingPlayShell.isElectronPlayPage()
            && window.shmerling
            && typeof window.shmerling.invoke === "function"
        ) {
            window.shmerling.invoke("app:quit").catch(function (err) {
                console.warn("[desktop-play] Could not quit app:", err);
                resetToIdleScreen();
            });
            return;
        }
        resetToIdleScreen();
    }

    function wantsNewGameDialogFromUrl() {
        return LaunchOptions.wantsNewGameDialog(window.location.search || "");
    }

    function captureActiveGameSnapshot() {
        const clocks = Clocks.get();
        return {
            gameId: currentGameId,
            color: currentPlayerIsWhite ? "white" : "black",
            whitePlayerView: game.WhitePlayerView !== false,
            options: {
                engine: session ? session.engine : undefined,
                thinkingTimeSeconds: session ? session.thinkingTimeSeconds : undefined,
                timeMinutes: session ? session.gameTimeMinutes : undefined,
                allowUndo: allowUndo,
                mouse: session ? session.mousePreference : undefined,
                showAvailableMoves: session ? session.showAvailableMoves : undefined,
            },
            state: JSON.stringify(game.GameState),
            moves: tableMovesFromGame(),
            originState: playOriginStateStr,
            whiteTimer: clocks.white,
            blackTimer: clocks.black,
        };
    }

    /** Keep the refresh snapshot in step with the live game; a finished game drops it. */
    function persistActiveGame() {
        if (!Resume || !isWebPlayPage() || !game || !game.GameState) {
            return;
        }
        if (onlineGameInfo && onlineGameInfo.gameType === "OnlineGame") {
            return;
        }
        if (!gameActive || reviewMode || positionSetupMode || configurationMode || loadingBookmark) {
            return;
        }
        if (game.GameOver) {
            Resume.clear();
            return;
        }
        Resume.save(captureActiveGameSnapshot());
    }

    function clearActiveGameSnapshot() {
        if (Resume) {
            Resume.clear();
        }
    }

    async function resumeStoredGame() {
        const snapshot = Resume && Resume.load ? Resume.load() : null;
        if (!snapshot) {
            return false;
        }
        try {
            const opts = Object.assign(
                Settings.loadLastOptions(),
                snapshot.options || {},
                { color: snapshot.color === "black" ? "black" : "white" },
            );
            if (!opts.username || opts.username === "Player") {
                const username = resolveHumanUsername(opts.username);
                if (username) {
                    opts.username = username;
                }
            }
            applySessionSettings(opts);
            setCurrentGameId(snapshot.gameId || null);
            gameHistoryLogged = false;
            gameAutoBookmarked = false;
            clearLoadedBookmarkDisplayMoves();
            game.loadGame(snapshot.state);
            game.loadMoves(snapshot.moves.slice());
            if (Board.setPlayerView) {
                Board.setPlayerView(snapshot.whitePlayerView !== false);
            }
            setPlayOriginState(snapshot.originState || null);
            clearDisplayedEvaluation();
            resetClocks();
            Clocks.set({ white: snapshot.whiteTimer, black: snapshot.blackTimer });
            redoPairAvailable = false;
            lastCheckNotifySide = null;
            alertMode = false;
            Board.clearArrows();
            Board.syncFromGameState();
            if (Board.updateCaptureLists && game.GameState.capturedPiecesList) {
                Board.updateCaptureLists(game.GameState.capturedPiecesList);
            }
            updateMovesTable(tableMovesFromGame());
            updateMatchHeader();
            updateHeaderTurn();
            gameActive = true;
            document.body.classList.add("desktop-play-has-active-game");
            if (Board.setHumanPlayEnabled) {
                Board.setHumanPlayEnabled(true);
            }
            lastLoadedSavedGameId = null;
            editingSavedGameId = null;
            updateActionButtons();
            syncGameRunPanelOptions();
            updateGameRunPanelVisibility();
        } catch (err) {
            console.warn("[Play] Could not resume the stored game:", err);
            clearActiveGameSnapshot();
            return false;
        }
        if (game.GameOver) {
            clearActiveGameSnapshot();
            return false;
        }
        ensurePlayGameSession();
        if (isAiTurn()) {
            switchClocks();
            showStatus(t("play.status.engineToMove"), 0, "info");
            await runEngineMove();
        } else {
            switchClocks();
            showStatus(t("play.status.gameResumedYourMove"), 2000, "info");
        }
        return true;
    }

    /**
     * Local self-play / Debug (Admin/Partner). No engine, both colors human.
     * @returns {Promise<boolean>}
     */
    async function beginPracticeGame() {
        if (!canDebug) {
            return false;
        }
        if (!PracticeModeApi) {
            showStatus(t("play.status.practiceNotAvailable"), 0, "error");
            return false;
        }
        const username = resolveHumanUsername(webLaunchUsername);
        const name = username || "Player";
        practiceMode = true;
        onlineGameInfo = null;
        if (playOnlineMode && typeof playOnlineMode.detach === "function") {
            try {
                playOnlineMode.detach();
            } catch {
                /* ignore */
            }
        }
        playOnlineMode = null;
        setOpponentConnectionLost(false);
        applySessionSettings({
            color: "white",
            username: name,
            whitePlayerName: name,
            blackPlayerName: name,
            timeMinutes:
                session && typeof session.gameTimeMinutes === "number"
                    ? session.gameTimeMinutes
                    : 90,
            allowUndo: true,
        });
        if (session) {
            session.whitePlayerName = name;
            session.blackPlayerName = name;
            session.engine = null;
        }
        currentPlayerIsWhite = true;
        if (Board.setHumanColor) {
            Board.setHumanColor(true);
        }
        if (Board.setPlayerView) {
            Board.setPlayerView(true);
        }
        assignNewGameId();
        gameHistoryLogged = false;
        gameAutoBookmarked = false;
        clearLoadedBookmarkDisplayMoves();
        game.startNewGame(true);
        clearDisplayedEvaluation();
        resetClocks();
        redoPairAvailable = false;
        lastCheckNotifySide = null;
        alertMode = false;
        Board.clearArrows();
        Board.syncFromGameState();
        updateMovesTable([]);
        updateHeaderTurn();
        gameActive = true;
        exitConfigurationIfGameStarting();
        exitReviewMode();
        setPlayOriginState(game.GameState);
        document.body.classList.add("desktop-play-has-active-game");
        if (Board.setHumanPlayEnabled) {
            Board.setHumanPlayEnabled(true);
        }
        if (Board.setBothSidesHuman) {
            Board.setBothSidesHuman(true);
        }
        lastLoadedSavedGameId = null;
        editingSavedGameId = null;
        updateActionButtons();
        syncGameRunPanelOptions();
        updateGameRunPanelVisibility();
        updateMatchHeader();
        persistActiveGame();
        ensurePlayGameSession();
        if (!playPracticeMode) {
            attachPlayPracticeMode();
        }
        syncPrimaryGameButtonLabel();
        if (!game.GameOver) {
            switchClocks();
            showStatus(t("session.practiceBothSides"), 2000, "info");
        }
        return true;
    }

    async function maybeAutoStartWebGame() {
        if (!isWebPlayPage()) {
            return;
        }
        if (wantsNewGameDialogFromUrl()) {
            clearWebLaunchQueryString();
            /* Prefetch last options so the compact dialog defaults match saved prefs. */
            await resolveWebAutoStartOptions();
            if (NewGameDialog && typeof NewGameDialog.show === "function") {
                NewGameDialog.show(beginNewGame);
            }
            return;
        }
        const joinId =
            LaunchOptions && typeof LaunchOptions.getJoinGameIdFromSearch === "function"
                ? LaunchOptions.getJoinGameIdFromSearch(window.location.search || "")
                : null;
        if (joinId) {
            /* Prefer-Play: accept already joined; treat joinGame as reopen by id. */
            const startedJoin = await beginOnlineFromServerId(joinId);
            if (startedJoin) {
                clearWebLaunchQueryString({ keepId: true });
                return;
            }
            showStatus(t("play.status.couldNotJoinOnPlay"), 0, "error");
            return;
        }
        const launchMode =
            LaunchOptions && typeof LaunchOptions.getModeFromSearch === "function"
                ? LaunchOptions.getModeFromSearch(window.location.search || "")
                : null;
        const onlineId =
            LaunchOptions && typeof LaunchOptions.getGameIdFromSearch === "function"
                ? LaunchOptions.getGameIdFromSearch(window.location.search || "")
                : null;
        if (launchMode === "practice") {
            const started = await beginPracticeGame();
            if (started) {
                clearWebLaunchQueryString({ keepPractice: true });
                return;
            }
            showStatus(t("play.status.practiceDebugNotAvailable"), 0, "error");
            return;
        }
        if (launchMode === "review" && onlineId) {
            const reviewType =
                LaunchOptions && typeof LaunchOptions.getReviewTypeFromSearch === "function"
                    ? LaunchOptions.getReviewTypeFromSearch(window.location.search || "")
                    : null;
            const started = await beginReviewFromServerId(onlineId, reviewType);
            if (started) {
                clearWebLaunchQueryString({ keepId: true, keepReview: true });
                return;
            }
        }
        if (onlineId) {
            const started = await beginOnlineFromServerId(onlineId, {
                forceWatch: launchMode === "watch",
            });
            if (started) {
                clearWebLaunchQueryString({ keepId: true });
                return;
            }
        }
        if (await resumeStoredGame()) {
            clearWebLaunchQueryString();
            return;
        }
        const opts = await resolveWebAutoStartOptions();
        await beginNewGame(opts);
        clearWebLaunchQueryString();
    }

    /**
     * Expand PGN SAN moves into full board moves for ReviewMode / loadMoves.
     * @param {object[]} rawMoves
     * @returns {object[]}
     */
    function expandPgnMovesForReview(rawMoves) {
        const list = Array.isArray(rawMoves) ? rawMoves : [];
        const trial = new ChessGame(true);
        trial.startNewGame(true);
        const out = [];
        for (let i = 0; i < list.length; i++) {
            const pgnMove = list[i];
            if (!pgnMove) {
                continue;
            }
            if (typeof trial.isResultMove === "function" && trial.isResultMove(pgnMove)) {
                out.push({ moveStr: pgnMove.moveStr });
                continue;
            }
            try {
                const converted = trial.convertPGNMove(pgnMove);
                const actual = trial.makeMove(converted.source, converted.target);
                if (actual && actual.promotion) {
                    actual.selectedPiece = trial.letterToPiece(converted.promotedTo);
                    trial.completePromotion(actual);
                }
                const stored = Object.assign({}, actual || converted);
                if (converted.moveStr) {
                    stored.moveStr = converted.moveStr;
                } else if (pgnMove.moveStr) {
                    stored.moveStr = pgnMove.moveStr;
                }
                out.push(stored);
            } catch (err) {
                console.warn("[Play] PGN convert failed at ply", i, err);
                break;
            }
        }
        return out;
    }

    /**
     * Clone history review moves (coordinate objects from the server).
     * @param {object[]} rawMoves
     * @returns {object[]}
     */
    function cloneHistoryMovesForReview(rawMoves) {
        const list = Array.isArray(rawMoves) ? rawMoves : [];
        const out = [];
        for (let i = 0; i < list.length; i++) {
            const m = list[i];
            if (!m) {
                continue;
            }
            out.push(typeof m === "object" ? Object.assign({}, m) : m);
        }
        return out;
    }

    async function beginReviewFromServerId(gameId, reviewTypeHint) {
        if (!Api || typeof Api.get !== "function") {
            showStatus(t("play.status.reviewRequiresWebApi"), 0, "error");
            return false;
        }
        let info;
        let movesObj;
        try {
            info = await Api.get("/gameInfo?id=" + encodeURIComponent(String(gameId)));
            movesObj = await Api.get("/gameMoves?id=" + encodeURIComponent(String(gameId)));
        } catch (err) {
            console.warn("[Play] Could not load review game:", err);
            showStatus((err && err.message) || t("play.status.couldNotLoadReviewGame"), 0, "error");
            return false;
        }
        if (!info || info.mode !== "review") {
            showStatus(t("play.status.notReviewGameLink"), 0, "error");
            return false;
        }
        const reviewType =
            (movesObj && (movesObj.type || movesObj.reviewType)) ||
            info.reviewType ||
            reviewTypeHint ||
            "history";
        lastServerReviewType =
            reviewType === "pgn" || reviewType === "history" ? reviewType : null;

        if (playOnlineMode && typeof playOnlineMode.detach === "function") {
            try {
                playOnlineMode.detach();
            } catch {
                /* ignore */
            }
        }
        playOnlineMode = null;
        onlineGameInfo = null;
        setOpponentConnectionLost(false);
        clearActiveGameSnapshot();
        exitReviewMode();

        const username = info.username != null ? String(info.username) : "";
        const whiteName = info.whitePlayerName || "White";
        const blackName = info.blackPlayerName || "Black";
        currentPlayerIsWhite =
            reviewType === "pgn"
                ? true
                : !(username && username === blackName && username !== whiteName);

        session = {
            engine: null,
            thinkingTimeSeconds: null,
            difficulty: null,
            whitePlayerName: whiteName,
            blackPlayerName: blackName,
            username: username,
            mouse: info.mousePreference || "drag",
            showAvailableMoves: info.showAvailableMoves !== false,
            timeMinutes:
                info.gameTimeMinutes != null ? info.gameTimeMinutes : 90,
        };
        allowUndo = false;
        setCurrentGameId(info.id != null ? info.id : gameId);
        gameHistoryLogged = false;
        gameAutoBookmarked = false;
        clearLoadedBookmarkDisplayMoves();
        pauseClocksForSetup();
        resetClocks();

        const rawMoves = (movesObj && movesObj.moves) || [];
        const parsedMoves =
            reviewType === "pgn"
                ? expandPgnMovesForReview(rawMoves)
                : cloneHistoryMovesForReview(rawMoves);

        const originTrial = new ChessGame(true);
        originTrial.startNewGame(currentPlayerIsWhite);
        const originStateStr = JSON.stringify(originTrial.GameState);

        game.startNewGame(currentPlayerIsWhite);
        if (parsedMoves.length) {
            game.loadMoves(parsedMoves);
        } else {
            game.loadMoves([]);
        }
        const finalStateStr = JSON.stringify(game.GameState);
        const outcome = captureReviewOutcome(finalStateStr, parsedMoves);
        if (game.GameOver && game.ResultMove && game.ResultMove.moveStr) {
            outcome.resultStr = game.ResultMove.moveStr;
        }

        game.loadGame(originStateStr);
        game.loadMoves([]);

        if (Board.setPlayerView) {
            Board.setPlayerView(currentPlayerIsWhite);
        }
        Board.setPreferences({
            mouse: session.mouse,
            showAvailableMoves: session.showAvailableMoves,
        });
        clearDisplayedEvaluation();
        pauseClocksForSetup();
        redoPairAvailable = false;
        lastCheckNotifySide = null;
        alertMode = false;
        Board.clearArrows();
        Board.syncFromGameState();
        if (Board.updateCaptureLists && game.GameState && game.GameState.capturedPiecesList) {
            Board.updateCaptureLists(game.GameState.capturedPiecesList);
        }

        syncLoadedBookmarkDisplayMoves(parsedMoves);
        initReviewNavigation(finalStateStr, parsedMoves, originStateStr);
        if (outcome.resignedColor) {
            reviewResignedColor = outcome.resignedColor;
        }
        if (outcome.resultStr) {
            reviewResultMoveStr = outcome.resultStr;
        }
        if (outcome.endKind) {
            reviewEndKind = outcome.endKind;
        }
        syncReviewResultMoveFromGame();
        refreshReviewMovesTable();
        gameActive = false;
        document.body.classList.remove("desktop-play-has-active-game");
        if (Board.setHumanPlayEnabled) {
            Board.setHumanPlayEnabled(false);
        }
        lastLoadedSavedGameId = null;
        editingSavedGameId = null;
        enterReviewMode();
        showReviewAtPly(0);
        updateMatchHeader();
        updateHeaderTurn();
        updateActionButtons();
        updateGameRunPanelVisibility();
        pauseClocksForSetup();
        return true;
    }

    function resolveOnlineHumanIsWhite(info) {
        const username = info && info.username != null ? String(info.username) : "";
        const white =
            info && info.whitePlayerName != null ? String(info.whitePlayerName) : "";
        const black =
            info && info.blackPlayerName != null ? String(info.blackPlayerName) : "";
        if (username && white && username === white) {
            return true;
        }
        if (username && black && username === black) {
            return false;
        }
        /* Waiting creator with empty black slot — White. */
        return true;
    }

    async function beginServerSpResume(info) {
        if (!info || !info.id) {
            return false;
        }
        clearActiveGameSnapshot();
        onlineGameInfo = null;
        practiceMode = false;
        playPracticeMode = null;
        if (Board.setBothSidesHuman) {
            Board.setBothSidesHuman(false);
        }
        if (playOnlineMode && typeof playOnlineMode.detach === "function") {
            try {
                playOnlineMode.detach();
            } catch {
                /* ignore */
            }
        }
        playOnlineMode = null;
        setOpponentConnectionLost(false);
        currentPlayerIsWhite = resolveOnlineHumanIsWhite(info);
        session = {
            engine: info.engine || "brain43",
            thinkingTimeSeconds: info.difficulty != null ? info.difficulty : 3,
            difficulty: info.difficulty != null ? info.difficulty : 3,
            whitePlayerName: info.whitePlayerName || "White",
            blackPlayerName: info.blackPlayerName || "Black",
            username: info.username,
            mouse: info.mousePreference || "drag",
            showAvailableMoves: info.showAvailableMoves !== false,
            timeMinutes: info.gameTimeMinutes != null ? info.gameTimeMinutes : 90,
        };
        allowUndo = false;
        setCurrentGameId(info.id);
        gameHistoryLogged = false;
        gameAutoBookmarked = false;
        clearLoadedBookmarkDisplayMoves();
        if (info.gameState) {
            const stateStr =
                typeof info.gameState === "string"
                    ? info.gameState
                    : JSON.stringify(info.gameState);
            game.loadGame(stateStr);
        } else {
            game.startNewGame(currentPlayerIsWhite);
        }
        try {
            const movesObj = await Api.get(
                "/gameMoves?id=" + encodeURIComponent(String(info.id)),
            );
            if (movesObj && Array.isArray(movesObj.moves) && movesObj.moves.length) {
                game.loadMoves(movesObj.moves);
            }
        } catch (err) {
            console.warn("[Play] Could not load SP moves:", err);
        }
        if (Board.setPlayerView) {
            Board.setPlayerView(currentPlayerIsWhite);
        }
        Board.setPreferences({
            mouse: session.mouse,
            showAvailableMoves: session.showAvailableMoves,
        });
        clearDisplayedEvaluation();
        resetClocks();
        if (typeof info.whiteTimer === "number" || typeof info.blackTimer === "number") {
            Clocks.set({
                white:
                    typeof info.whiteTimer === "number"
                        ? info.whiteTimer
                        : Clocks.get().white,
                black:
                    typeof info.blackTimer === "number"
                        ? info.blackTimer
                        : Clocks.get().black,
            });
        }
        redoPairAvailable = false;
        lastCheckNotifySide = null;
        alertMode = false;
        Board.clearArrows();
        Board.syncFromGameState();
        if (Board.updateCaptureLists && game.GameState && game.GameState.capturedPiecesList) {
            Board.updateCaptureLists(game.GameState.capturedPiecesList);
        }
        updateMovesTable(tableMovesFromGame());
        updateMatchHeader();
        updateHeaderTurn();
        gameActive = true;
        exitConfigurationIfGameStarting();
        exitReviewMode();
        setPlayOriginState(game.GameState);
        document.body.classList.add("desktop-play-has-active-game");
        if (Board.setHumanPlayEnabled) {
            Board.setHumanPlayEnabled(true);
        }
        lastLoadedSavedGameId = null;
        editingSavedGameId = null;
        await attachSpServerSync(
            {
                gameId: info.id,
                username: info.username,
                userId: info.userId,
                creatorId: info.creatorId,
            },
            currentPlayerIsWhite,
        );
        updateActionButtons();
        syncGameRunPanelOptions();
        updateGameRunPanelVisibility();
        ensurePlayGameSession();
        syncPrimaryGameButtonLabel();
        if (!game.GameOver) {
            switchClocks();
            if (isAiTurn()) {
                showStatus(t("play.status.engineToMove"), 0, "info");
                await runEngineMove();
            } else {
                showStatus(t("play.status.yourMove"), 2000, "info");
            }
        }
        return true;
    }

    async function beginOnlineFromServerId(gameId, launchOpts) {
        if (!Api || typeof Api.get !== "function") {
            showStatus(t("play.status.onlineRequiresWebApi"), 0, "error");
            return false;
        }
        let info;
        try {
            info = await Api.get("/gameInfo?id=" + encodeURIComponent(String(gameId)));
        } catch (err) {
            console.warn("[Play] Could not load gameInfo:", err);
            showStatus((err && err.message) || t("play.status.couldNotLoadOnlineGame"), 0, "error");
            return false;
        }
        if (!info) {
            showStatus(t("play.status.couldNotLoadOnlineGame"), 0, "error");
            return false;
        }
        const forceWatch =
            (launchOpts && launchOpts.forceWatch === true) ||
            (LaunchOptions &&
                typeof LaunchOptions.getModeFromSearch === "function" &&
                LaunchOptions.getModeFromSearch(window.location.search || "") === "watch");
        if (info.gameType === "SinglePlayerGame") {
            if (forceWatch || info.watcher) {
                info.watcher = true;
                detachSpServerSync();
                await beginOnlineGame(info);
                return true;
            }
            detachSpServerSync();
            return beginServerSpResume(info);
        }
        if (info.gameType !== "OnlineGame") {
            showStatus(t("play.status.notOnlineGameOnPlay"), 0, "error");
            return false;
        }
        if (forceWatch) {
            info.watcher = true;
        }
        detachSpServerSync();
        await beginOnlineGame(info);
        return true;
    }

    async function beginOnlineGame(info) {
        clearActiveGameSnapshot();
        detachSpServerSync();
        onlineGameInfo = info;
        setOpponentConnectionLost(false);
        currentPlayerIsWhite = resolveOnlineHumanIsWhite(info);
        const whiteName = info.whitePlayerName || "White";
        const blackName =
            info.blackPlayerName && String(info.blackPlayerName).trim()
                ? info.blackPlayerName
                : "looking for opponent…";
        session = {
            engine: null,
            thinkingTimeSeconds: null,
            difficulty: null,
            whitePlayerName: whiteName,
            blackPlayerName: blackName,
            username: info.username,
            mouse: info.mousePreference || "drag",
            showAvailableMoves: info.showAvailableMoves !== false,
            timeMinutes:
                info.gameTimeMinutes != null ? info.gameTimeMinutes : 90,
        };
        allowUndo = false;
        setCurrentGameId(info.id);
        gameHistoryLogged = false;
        gameAutoBookmarked = false;
        clearLoadedBookmarkDisplayMoves();
        if (info.gameState) {
            const stateStr =
                typeof info.gameState === "string"
                    ? info.gameState
                    : JSON.stringify(info.gameState);
            game.loadGame(stateStr);
        } else {
            game.startNewGame(currentPlayerIsWhite);
        }
        try {
            const movesObj = await Api.get(
                "/gameMoves?id=" + encodeURIComponent(String(info.id)),
            );
            if (movesObj && Array.isArray(movesObj.moves) && movesObj.moves.length) {
                game.loadMoves(movesObj.moves);
            }
        } catch (err) {
            console.warn("[Play] Could not load online moves:", err);
        }
        if (Board.setPlayerView) {
            Board.setPlayerView(currentPlayerIsWhite);
        }
        Board.setPreferences({
            mouse: session.mouse,
            showAvailableMoves: session.showAvailableMoves,
        });
        clearDisplayedEvaluation();
        resetClocks();
        if (typeof info.whiteTimer === "number" || typeof info.blackTimer === "number") {
            Clocks.set({
                white:
                    typeof info.whiteTimer === "number"
                        ? info.whiteTimer
                        : Clocks.get().white,
                black:
                    typeof info.blackTimer === "number"
                        ? info.blackTimer
                        : Clocks.get().black,
            });
        }
        redoPairAvailable = false;
        lastCheckNotifySide = null;
        alertMode = false;
        Board.clearArrows();
        Board.syncFromGameState();
        if (Board.updateCaptureLists && game.GameState && game.GameState.capturedPiecesList) {
            Board.updateCaptureLists(game.GameState.capturedPiecesList);
        }
        updateMovesTable(tableMovesFromGame());
        updateMatchHeader();
        updateHeaderTurn();
        gameActive = true;
        exitConfigurationIfGameStarting();
        exitReviewMode();
        setPlayOriginState(game.GameState);
        document.body.classList.add("desktop-play-has-active-game");
        const isWatcher = !!info.watcher;
        if (Board.setHumanPlayEnabled) {
            Board.setHumanPlayEnabled(!isWatcher);
        }
        lastLoadedSavedGameId = null;
        editingSavedGameId = null;
        updateActionButtons();
        syncGameRunPanelOptions();
        updateGameRunPanelVisibility();
        ensurePlayGameSession();
        syncPrimaryGameButtonLabel();
        updateActionButtons();
        if (!game.GameOver) {
            switchClocks();
            if (isWatcher) {
                showStatus(t("play.status.watchingLiveGame"), 0, "info");
            } else {
                const waiting =
                    currentPlayerIsWhite &&
                    !(info.blackPlayerName && String(info.blackPlayerName).trim());
                showStatus(
                    waiting ? t("play.status.waitingForOpponent") : t("play.status.onlineGameConnected"),
                    waiting ? 0 : 2000,
                    "info",
                );
            }
        }
    }

    async function beginNewGame(opts) {
        const launchOpts = Object.assign({}, opts || {});
        const username = resolveHumanUsername(launchOpts.username);
        if (username) {
            launchOpts.username = username;
        }
        practiceMode = false;
        playPracticeMode = null;
        if (Board.setBothSidesHuman) {
            Board.setBothSidesHuman(false);
        }
        onlineGameInfo = null;
        detachSpServerSync();
        if (playOnlineMode && typeof playOnlineMode.detach === "function") {
            try {
                playOnlineMode.detach();
            } catch {
                /* ignore */
            }
        }
        playOnlineMode = null;
        setOpponentConnectionLost(false);
        applySessionSettings(launchOpts);
        if (Settings.saveNewGameOptions) {
            Settings.saveNewGameOptions({
                color: launchOpts.color === "black" ? "black" : "white",
                engine: launchOpts.engine || "brain43",
                allowUndo: launchOpts.allowUndo !== false,
                isPrivate: launchOpts.isPrivate === true,
                timeMinutes: launchOpts.timeMinutes,
                mouse: launchOpts.mouse,
                thinkingTimeSeconds: launchOpts.thinkingTimeSeconds != null
                    ? launchOpts.thinkingTimeSeconds
                    : launchOpts.difficulty,
                showAvailableMoves: launchOpts.showAvailableMoves,
            });
        }
        const serverSp = await createPublicSpServerGame(launchOpts);
        if (serverSp && serverSp.gameId) {
            setCurrentGameId(serverSp.gameId);
            await attachSpServerSync(
                {
                    gameId: serverSp.gameId,
                    username: username,
                    userId: serverSp.userId,
                    creatorId: serverSp.creatorId,
                },
                launchOpts.color !== "black",
            );
        } else {
            assignNewGameId();
        }
        gameHistoryLogged = false;
        gameAutoBookmarked = false;
        clearLoadedBookmarkDisplayMoves();
        game.startNewGame(currentPlayerIsWhite);
        clearDisplayedEvaluation();
        resetClocks();
        redoPairAvailable = false;
        lastCheckNotifySide = null;
        alertMode = false;
        Board.clearArrows();
        Board.syncFromGameState();
        updateMovesTable([]);
        updateHeaderTurn();
        gameActive = true;
        exitConfigurationIfGameStarting();
        exitReviewMode();
        setPlayOriginState(game.GameState);
        document.body.classList.add("desktop-play-has-active-game");
        if (Board.setHumanPlayEnabled) {
            Board.setHumanPlayEnabled(true);
        }
        lastLoadedSavedGameId = null;
        editingSavedGameId = null;
        updateActionButtons();
        syncGameRunPanelOptions();
        updateGameRunPanelVisibility();
        persistActiveGame();
        ensurePlayGameSession();
        syncPrimaryGameButtonLabel();
        if (isWebPlayPage() && currentGameId) {
            clearWebLaunchQueryString({ keepId: true });
        }
        if (!game.GameOver && isAiTurn()) {
            switchClocks();
            showStatus(t("play.status.engineToMove"), 0, "info");
            await runEngineMove();
        } else if (!game.GameOver) {
            switchClocks();
            showStatus(t("play.status.yourMove"), 2000, "info");
        }
    }

    function beginPositionSetupFromMenu() {
        if (!game) {
            showStatus(t("play.status.boardLoading"), 2500, "info");
            return;
        }
        exitReviewMode();
        lastLoadedSavedGameId = null;
        const opts = Settings.loadLastOptions();
        applySessionSettings(opts);
        lastLoadedSavedGameId = null;
        editingSavedGameId = null;
        syncEmptyBoard();
        resetClocks();
        redoPairAvailable = false;
        updateMovesTable([]);
        updateHeaderTurn();
        gameActive = false;
        enterPositionSetupMode();
    }

    async function onPromotion(turn) {
        if (reviewMode || reviewPlaybackPlaying || autoCompletePromotion) {
            return;
        }
        const opponentMove =
            (currentPlayerIsWhite && turn === "black") ||
            (!currentPlayerIsWhite && turn === "white");
        if (opponentMove) {
            return;
        }
        dialogOn = true;
        animating = true;
        showStatus(t("play.status.choosePromotionPiece"), 0, "promotion");
        return new Promise(function (resolve) {
            Board.showPromotionDialog(turn, async function (selectedPiece) {
                let runBrainAfter = false;
                try {
                    const pending = game.LastMove;
                    if (!pending || !pending.promotion) {
                        showStatus("");
                        return;
                    }
                    if (
                        typeof selectedPiece !== "number" ||
                        selectedPiece < game.KNIGHT ||
                        selectedPiece > game.QUEEN
                    ) {
                        showStatus(t("play.status.invalidPromotionPiece"), 0, "error");
                        return;
                    }
                    const gs = ensurePlayGameSession();
                    if (gs && typeof gs.selectPromotion === "function") {
                        const ok = gs.selectPromotion(selectedPiece);
                        if (!ok) {
                            return;
                        }
                        Board.syncFromGameState();
                        syncBoardFromGame();
                        showStatus("");
                        /* Chrome + engine reply come from session moveApplied / afterMove. */
                        runBrainAfter = false;
                    } else {
                        pending.selectedPiece = selectedPiece;
                        game.completePromotion(pending);
                        lastMove = pending;
                        Board.syncFromGameState();
                        syncBoardFromGame();
                        redoPairAvailable = false;
                        switchClocks();
                        updateMovesTable(tableMovesFromGame());
                        updateHeaderTurn();
                        showStatus("");
                        runBrainAfter = !game.GameOver && isAiTurn();
                    }
                } catch (err) {
                    console.error(err);
                    showStatus(err.message || "Promotion failed", 0, "error");
                } finally {
                    dialogOn = false;
                    animating = false;
                    updateActionButtons();
                    resolve();
                }
                if (runBrainAfter) {
                    await runEngineMove();
                }
            });
        });
    }

    async function onHumanMove(executed) {
        if (!gameActive || positionSetupMode || configurationMode) {
            return;
        }
        const gs = ensurePlayGameSession();
        if (gs && typeof gs.humanMoveApplied === "function") {
            await yieldForPaint();
            gs.humanMoveApplied(executed);
            return;
        }
        clearDisplayedEvaluation();
        lastMove = executed;
        redoPairAvailable = false;
        Board.clearArrows();
        if (Board.resetSquareColors) {
            Board.resetSquareColors();
        }
        updateMovesTable(tableMovesFromGame());
        updateActionButtons();
        switchClocks();
        updateHeaderTurn();
        if (!game.GameOver && isAiTurn()) {
            await yieldForPaint();
            await runEngineMove();
        }
    }

    function showPositionValidationAlert(text) {
        if (dialogOn) {
            return;
        }
        const raw = String(text);
        const idx = raw.indexOf("\n\n");
        let title = t("play.dialogs.invalidPosition");
        let body = raw;
        if (idx !== -1) {
            title = raw.slice(0, idx).trim().replace(/:\s*$/, "");
            body = raw.slice(idx + 2).trim();
        }
        Dialog.alert({ title: title, message: body });
    }

    function clearSetupEngineFlags(state) {
        if (!state) {
            return;
        }
        state.check = false;
        state.checkmate = false;
        state.draw = false;
        state.drawReason = "";
    }

    /** ChessGame pawn validation reads lastMove.piece; custom setups often omit lastMove. */
    function ensurePlayableLastMove(state) {
        if (!state || !game || (state.lastMove && state.lastMove.piece)) {
            return;
        }
        const turn = state.turn === "black" ? "black" : "white";
        state.lastMove = {
            valid: true,
            source: { row: 0, col: 0 },
            target: { row: 0, col: 0 },
            piece: { color: turn, pieceType: game.KING },
            promotion: false,
            ennPassant: false,
            capturedPiece: null,
            hitSquare: null,
            turn: turn,
            castling: false,
        };
    }

    function cloneSetupStateForPlay() {
        const state = JSON.parse(JSON.stringify(game.GameState));
        clearSetupEngineFlags(state);
        ensurePlayableLastMove(state);
        return state;
    }

    function validatePositionSetup(purpose) {
        if (!PositionValidation || !PositionValidation.getMessage || !game) {
            return true;
        }
        const err = PositionValidation.getMessage(game, purpose);
        if (err) {
            showPositionValidationAlert(err);
            return false;
        }
        return true;
    }

    function confirmDialog(title, message, onYes) {
        if (dialogOn) {
            return;
        }
        if (typeof message === "function") {
            onYes = message;
            message = title;
            title = t("common.confirm");
        }
        Dialog.confirm({
            title: title,
            message: message,
            onConfirm: onYes,
        });
    }

    function onResign() {
        if (game.GameOver) {
            return;
        }
        if (practiceMode) {
            confirmDialog(t("play.dialogs.areYouSure"), function () {
                completeUserResign();
            });
            return;
        }
        confirmDialog(
            t("play.dialogs.resignTitle"),
            t("play.dialogs.resignBody"),
            function () {
                completeUserResign();
            },
        );
    }

    function engineResignFromLostPosition() {
        if (!game || game.GameOver) {
            return;
        }
        const player = currentPlayerIsWhite ? "Black" : "White";
        abortEngineSearch();
        const gs = ensurePlayGameSession();
        if (gs && typeof gs.resign === "function") {
            gs.resign(player);
            return;
        }
        game.resign(player);
        updateMovesTable(tableMovesFromGame());
        finishResignGame(player);
        tryLogCompletedGame();
    }

    function onDrawOfferClick() {
        if (game.GameOver || $("drawBtn").disabled) {
            return;
        }
        if (playOnlineMode && typeof playOnlineMode.offerDraw === "function") {
            if (!playOnlineMode.offerDraw()) {
                showStatus(t("play.status.drawOfferNotAvailable"), 2500, "info");
            }
            updateActionButtons();
            return;
        }
        Dialog.alert({
            title: t("play.status.drawOfferTitle"),
            message: t("classic.drawOffersNotVsEngine"),
        });
    }

    async function onUndo() {
        if (!canUndoMovePair() || $("undoBtn").disabled) {
            return;
        }
        abortEngineSearch();
        animating = true;
        batchUndoRedo = true;
        const gs = ensurePlayGameSession();
        if (gs && typeof gs.undo === "function") {
            gs.undo();
            batchUndoRedo = false;
            animating = false;
            if (Board.refreshHumanPieceInput) {
                Board.refreshHumanPieceInput();
            }
            updateActionButtons();
            persistActiveGame();
            return;
        }
        clearDisplayedEvaluation();
        game.undo();
        game.undo();
        redoPairAvailable = true;
        batchUndoRedo = false;
        Board.clearArrows();
        syncBoardFromGame();
        animating = false;
        updateMovesTable(tableMovesFromGame());
        if (Board.refreshHumanPieceInput) {
            Board.refreshHumanPieceInput();
        }
        updateActionButtons();
        persistActiveGame();
    }

    async function onRedo() {
        if (!canRedoMoves() || ($("redoBtn") && $("redoBtn").disabled)) {
            return;
        }
        animating = true;
        batchUndoRedo = true;
        const gs = ensurePlayGameSession();
        if (gs && typeof gs.redo === "function") {
            gs.redo();
            batchUndoRedo = false;
            animating = false;
            if (Board.refreshHumanPieceInput) {
                Board.refreshHumanPieceInput();
            }
            updateActionButtons();
            persistActiveGame();
            return;
        }
        clearDisplayedEvaluation();
        game.redo();
        game.redo();
        redoPairAvailable = false;
        batchUndoRedo = false;
        Board.clearArrows();
        syncBoardFromGame();
        animating = false;
        updateMovesTable(tableMovesFromGame());
        updateActionButtons();
        persistActiveGame();
    }

    function onLastMove() {
        if ($("lastMoveBtn").disabled) {
            return;
        }
        Board.toggleLastMoveArrow();
    }

    function onFlip() {
        if ($("flipBtn").disabled) {
            return;
        }
        Board.flipBoard();
        persistActiveGame();
    }

    function onRematch() {
        if ($("rematchBtn") && $("rematchBtn").disabled) {
            return;
        }
        if (practiceMode && canDebug) {
            beginPracticeGame();
            return;
        }
        if (
            playOnlineMode &&
            onlineGameInfo &&
            game &&
            game.GameOver &&
            typeof playOnlineMode.offerRematch === "function"
        ) {
            if (dialogOn) {
                return;
            }
            let rematchColorHandle;
            rematchColorHandle = Dialog.open({
                title: t("play.status.rematchTitle"),
                body: t("play.dialogs.rematchChooseColor"),
                panelClass: "desktop-play-dialog--confirm",
                buttons: [
                    {
                        label: t("common.cancel"),
                        className: "desktop-btn",
                        onClick: function () {
                            rematchColorHandle.close();
                        },
                    },
                    {
                        label: t("common.white"),
                        className: "desktop-btn desktop-btn-gold",
                        onClick: function () {
                            rematchColorHandle.close();
                            playOnlineMode.offerRematch("white");
                            updateActionButtons();
                        },
                    },
                    {
                        label: t("common.black"),
                        className: "desktop-btn desktop-btn-gold",
                        onClick: function () {
                            rematchColorHandle.close();
                            playOnlineMode.offerRematch("black");
                            updateActionButtons();
                        },
                    },
                ],
            });
            return;
        }
        if (NewGameDialog && typeof NewGameDialog.show === "function") {
            NewGameDialog.show(beginNewGame);
        }
    }

    function onHome() {
        if (configurationMode) {
            if (!exitConfigurationMode()) {
                return;
            }
        }
        if (positionSetupMode) {
            exitPositionSetupMode(true);
            leavePlayShell();
            return;
        }
        if (!gameActive) {
            leavePlayShell();
            return;
        }
        if (onlineGameInfo && onlineGameInfo.watcher) {
            leavePlayShell();
            return;
        }
        /* Finished games (draw, mate, resign, flag, …): leave without resign warning. */
        if (game && game.GameOver) {
            leavePlayShell();
            return;
        }
        const anyMovePlayed = !!(game && game.Moves && game.Moves.length >= 1);
        if (playOnlineMode && typeof playOnlineMode.requestResign === "function") {
            if (!anyMovePlayed) {
                Promise.resolve(playOnlineMode.requestResign())
                    .catch(function (err) {
                        console.warn("[Play] Online cancel failed:", err);
                    })
                    .finally(function () {
                        leavePlayShell();
                    });
                return;
            }
            confirmDialog(
                t("play.dialogs.leaveTitle"),
                t("play.dialogs.leaveBody"),
                function () {
                abortEngineSearch();
                Promise.resolve(playOnlineMode.requestResign())
                    .catch(function (err) {
                        console.warn("[Play] Online resign failed:", err);
                    })
                    .finally(function () {
                        tryLogCompletedGame();
                        leavePlayShell();
                    });
            });
            return;
        }
        if (practiceMode) {
            if (!anyMovePlayed) {
                leavePlayShell();
                return;
            }
            confirmDialog(t("play.dialogs.areYouSure"), function () {
                const player =
                    game && game.Turn === "black" ? "Black" : "White";
                abortEngineSearch();
                const gs = ensurePlayGameSession();
                if (gs && typeof gs.resign === "function") {
                    gs.resign(player);
                } else {
                    game.resign(player);
                }
                tryLogCompletedGame();
                leavePlayShell();
            });
            return;
        }
        const humanHasMoved = currentPlayerIsWhite
            ? game.Moves.length >= 1
            : game.Moves.length >= 2;
        if (!humanHasMoved) {
            /* Public SP with no human move: drop server game via cancel path if synced. */
            if (spServerSync && spServerSync.isReady && spServerSync.isReady()) {
                detachSpServerSync();
            }
            leavePlayShell();
            return;
        }
        confirmDialog(
            t("play.dialogs.leaveTitle"),
            t("play.dialogs.leaveBody"),
            function () {
            resignPreferPlaySpAndLeave();
        });
    }

    /**
     * Exit after resign confirm for Prefer-Play SP (local and/or server-synced).
     * Sends resign over WS before closing so the server records game over instead of on-hold.
     */
    function resignPreferPlaySpAndLeave() {
        const player = currentPlayerIsWhite ? "White" : "Black";
        abortEngineSearch();
        const hadServerSync =
            !!(spServerSync && spServerSync.isReady && spServerSync.isReady());
        if (hadServerSync) {
            spServerSync.sendResign(spSyncClockPayload(currentPlayerIsWhite));
        }
        const gs = ensurePlayGameSession();
        if (gs && typeof gs.resign === "function") {
            gs.resign(player);
        } else if (game) {
            game.resign(player);
        }
        tryLogCompletedGame();
        const finishLeave = function () {
            detachSpServerSync();
            leavePlayShell();
        };
        if (hadServerSync) {
            /* Let the resign frame flush before navigation closes the socket. */
            setTimeout(finishLeave, 200);
        } else {
            finishLeave();
        }
    }

    function resetToIdleScreen() {
        clearActiveGameSnapshot();
        disposePlayGameSession();
        onlineGameInfo = null;
        practiceMode = false;
        playPracticeMode = null;
        if (Board.setBothSidesHuman) {
            Board.setBothSidesHuman(false);
        }
        setOpponentConnectionLost(false);
        syncPrimaryGameButtonLabel();
        if (configurationMode) {
            setConfigurationUi(false);
        }
        if (positionSetupMode) {
            Board.setSetupMode(false);
            setPositionSetupUi(false);
        }
        exitReviewMode();
        clearPlayOriginState();
        clearLoadedBookmarkDisplayMoves();
        gameActive = false;
        positionSetupSnapshot = null;
        document.body.classList.remove("desktop-play-has-active-game");
        Clocks.stop();
        session = null;
        setCurrentGameId(null);
        lastLoadedSavedGameId = null;
        editingSavedGameId = null;
        alertMode = false;
        clearHeaderEvent();
        updateGameRunPanelVisibility();
        if (Board.setHumanPlayEnabled) {
            Board.setHumanPlayEnabled(false);
        }
        if (Board.clearKingHighlights) {
            Board.clearKingHighlights();
        }
        syncEmptyBoard();
        updateMovesTable([]);
        updateMatchHeader();
        updateHeaderTurn();
        showStatus(t("play.status.chooseNewGameOrSetup"), 0, "info");
        updateActionButtons();
        updateGameModeTooltip();
    }

    async function startSession() {
        playSessionReady = false;
        ensureSavedListFilterControls();
        await loadSavedGames();

        game = new ChessGame();
        ensureGameRunPanel();
        Board.setGame(game);
        Board.setPlayerView(true);
        const idlePrefs = Settings.loadGamePreferences();
        Board.setPreferences({
            mouse: idlePrefs.mouse,
            showAvailableMoves: idlePrefs.showAvailableMoves,
        });
        Board.setHumanMoveHandler(onHumanMove);
        if (typeof Board.setHumanMoveApplicator === "function") {
            Board.setHumanMoveApplicator(function (source, target) {
                const gs = ensurePlayGameSession();
                if (gs && typeof gs.applyMove === "function") {
                    return gs.applyMove(source, target);
                }
                return game.makeMove(source, target);
            });
        }
        Board.mount("chessboard");
        if (window.DesktopBoardScale && typeof window.DesktopBoardScale.refresh === "function") {
            window.DesktopBoardScale.refresh();
        }
        Board.registerInput();
        if (Board.setHumanPlayEnabled) {
            Board.setHumanPlayEnabled(false);
        }
        registerGameEvents();

        syncEmptyBoard();
        updateMovesTable([]);
        updateHeaderTurn();
        updateMatchHeader();
        if (!isWebPlayPage()) {
            showStatus(
                canPlayAdvancedTools
                    ? t("play.status.chooseNewGameOrSetup")
                    : t("play.status.chooseNewGame"),
                0,
                "info",
            );
        }
        playSessionReady = true;
        updateActionButtons();
        if (isWebPlayPage()) {
            await maybeAutoStartWebGame();
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        document.addEventListener("contextmenu", function (ev) {
            ev.preventDefault();
        });
        document.addEventListener("click", handleDismissEvaluationOnClick, true);
        document.addEventListener("keydown", handleKeyboardShortcuts);
        document.addEventListener("shmerling-game-preferences-changed", function (e) {
            applyGamePreferences(e.detail);
        });
        if (Dialog && Dialog.setLockHandlers) {
            Dialog.setLockHandlers(function (locked) {
                dialogOn = locked;
            });
        }
        fetchLaunchContext()
            .then(function () {
                applyAdvancedToolsVisibility();
                buildActionRail();
                ensureReviewNavBar();
                return startSession();
            })
            .catch(function (err) {
                showStatus(err.message || "Could not load game", 0, "error");
                console.error(err);
            });
    });
})();