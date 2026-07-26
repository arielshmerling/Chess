/**
 * Play shell coordinator (Phase 1 complete).
 *
 * Presentation/policy live under `src/play-ui/`. This file still owns mode
 * enter/exit, ChessGame wiring, and API calls until Phase 2 GameSession.
 *
 * Desktop single-player chess — local ChessGame + in-process brain (Electron IPC).
 * No WebSocket or server-side game session.
 */
(function () {
    "use strict";

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
    const Clocks = window.PlayClocksController.create({
        getElement: function (color) {
            return $(color === "black" ? "blackClockTimeText" : "whiteClockTimeText");
        },
        isStopped: function () {
            return !!(game && game.GameOver);
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
    let reviewFullMoves = [];
    let reviewOriginStateStr = null;
    /** Starting position for the active game; survives exitReviewMode for auto-save. */
    let playOriginStateStr = null;
    /** Full move list from a loaded bookmark, shown in the panel until play adds moves. */
    let loadedBookmarkDisplayMoves = null;
    let reviewFinalStateStr = null;
    /** Game result (1-0, 0-1, etc.) from loaded bookmark; kept for review at earlier plies. */
    let reviewResultMoveStr = null;
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
        updateGameModeTooltip();
    }

    function switchClocks() {
        Clocks.stop();
        updateHeaderTurn();
        Clocks.startFor(game.Turn);
    }

    function outOfTime() {
        const loser = game.Turn;
        showStatus("Time's up! " + loser + " lost", 5000, "timeout");
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
            const proceed = window.confirm("Discard unsaved brain configuration changes?");
            if (!proceed) {
                return false;
            }
        }
        setConfigurationUi(false);
        showStatus("");
        updateActionButtons();
        restoreSidebarPreferences();
        return true;
    }

    function enterConfigurationMode() {
        if (!game || !playSessionReady) {
            showStatus("Board is still loading…", 2500, "info");
            return;
        }
        if (!canUseBrainConfig()) {
            return;
        }
        exitReviewMode();
        if (positionSetupMode) {
            exitPositionSetupMode(false);
        }
        setConfigurationUi(true);
        expandMovesSidebar();
        ensureConfigurationPanel();
        if (BrainConfig && BrainConfig.syncEngine) {
            const engine = session && session.engine ? session.engine : "brain43";
            BrainConfig.syncEngine(engine);
        }
        showStatus("Configuration mode — edit values and save", 0, "info");
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
            showStatus("Board is still loading…", 2500, "info");
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
                "Select a saved game or set up a position on the board first",
                3000,
                "info",
            );
            return;
        }
        if (gameActive) {
            showStatus("A game is already in progress", 2500, "info");
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
        if (!game.GameOver && isHumanTurn()) {
            switchClocks();
            showStatus("Your move", 2000, "info");
        } else if (!game.GameOver && isAiTurn()) {
            switchClocks();
            showStatus("Engine to move…", 0, "info");
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
            showStatus("Board is not ready yet. Please wait and try again.", 3000, "info");
            return;
        }
        if (configurationMode) {
            if (!exitConfigurationMode()) {
                return;
            }
        }
        exitReviewMode();
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
        showStatus("Position setup — place pieces on the board", 0, "info");
        updateActionButtons();
    }

    function syncPositionSetupStatusLine() {
        if (!positionSetupMode || !game || !game.GameState) {
            return;
        }
        const gameState = game.GameState;
        if (gameState.draw) {
            showStatus("Draw — " + (gameState.drawReason || "Draw"), 0, "draw");
            return;
        }
        if (gameState.checkmate) {
            const winner = game.opponent(game.Turn);
            showStatus("Checkmate — " + game.colorName(winner) + " wins", 0, "checkmate");
            return;
        }
        if (gameState.check) {
            showStatus("Check", 0, "check");
            return;
        }
        showStatus("Position setup — place pieces on the board", 0, "info");
    }

    function exitPositionSetupMode(restore) {
        Board.setSetupMode(false);
        clearDisplayedEvaluation();
        setPositionSetupUi(false);
        showStatus("");
        if (restore && positionSetupSnapshot) {
            restorePositionSetupSnapshot();
            editingSavedGameId = null;
        } else {
            positionSetupSnapshot = null;
        }
        updateGameRunPanelVisibility();
        updateActionButtons();
        restoreSidebarPreferences();
    }

    function clearDisplayedEvaluation() {
        if (Board && Board.clearEvaluationOverlay) {
            Board.clearEvaluationOverlay();
        }
        EvaluationDisplay.clearStatusTooltip($("desktopPlayStatusBar"));
    }

    async function displayPositionEvaluation() {
        if (!game || !game.GameState) {
            showStatus("Board is not ready yet. Please wait and try again.", 3000, "info");
            return;
        }
        if (animating || engineThinking) {
            showStatus("Wait for the current move to finish before evaluating", 2500, "info");
            return;
        }
        if (!validatePositionSetup("play")) {
            clearDisplayedEvaluation();
            return;
        }
        if (!Engine || typeof Engine.evaluatePosition !== "function") {
            showStatus("Evaluation is not available. Restart the Shmerling Chess app.", 0, "error");
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
            showStatus("Evaluating position…", 0, "info");
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
            showStatus(err.message || "Evaluation failed", 0, "error");
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
            showStatus("Open folder is only available in the desktop app", 3000, "info");
            return;
        }
        try {
            await GameLog.openGamesLogFolder();
        } catch (err) {
            showStatus(err.message || "Could not open games log folder", 0, "error");
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
            showStatus("Position is valid", 2500, "info");
        }
    }

    async function applyPositionSetup() {
        if (!game || !game.GameState) {
            return;
        }
        if (!validatePositionSetup("play")) {
            return;
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
        updateActionButtons();
        editingSavedGameId = null;
        updateGameRunPanelVisibility();
        if (!game.GameOver) {
            switchClocks();
            if (isHumanTurn()) {
                showStatus("Playing from custom position", 3000, "info");
            } else {
                showStatus("Engine to move…", 0, "info");
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
        });
    }

    function canUseBrainConfig() {
        return SessionMode.canUseBrainConfig({
            canPlayAdvancedTools: canPlayAdvancedTools,
            positionSetup: positionSetupMode,
            gameActive: gameActive,
        });
    }

    function exitConfigurationIfGameStarting() {
        if (!configurationMode) {
            return;
        }
        setConfigurationUi(false);
    }

    function exitConfigurationSilently() {
        if (!configurationMode) {
            return;
        }
        setConfigurationUi(false);
    }

    function enterReviewMode() {
        exitConfigurationSilently();
        if (positionSetupMode) {
            Board.setSetupMode(false);
            setPositionSetupUi(false);
        }
        reviewMode = true;
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
        updateMatchHeader();
        updateActionButtons();
        updateGameRunPanelVisibility();
        restoreSidebarPreferences();
        updateReviewNavBar();
    }

    function clearReviewNavigation() {
        reviewFullMoves = [];
        reviewOriginStateStr = null;
        reviewFinalStateStr = null;
        reviewResultMoveStr = null;
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
            return;
        }
        reviewResultMoveStr = null;
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
        reviewFullMoves = ReviewModel.cloneMoves(loaded);
        reviewFinalStateStr = finalStateStr;
        reviewResignedColor = resignedColorFromStateStr(finalStateStr);
        if (bookmarkOrigin && String(bookmarkOrigin).trim()) {
            reviewOriginStateStr = String(bookmarkOrigin);
        } else if (!loaded.length) {
            reviewOriginStateStr = finalStateStr;
        } else {
            const trial = new ChessGame(true);
            trial.startNewGame(reviewBoardIsWhiteView());
            reviewOriginStateStr = JSON.stringify(trial.GameState);
        }
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

    async function animateReviewStepForward() {
        if (!reviewMode || reviewPlyIndex >= reviewFullMoves.length) {
            return false;
        }
        const raw = reviewFullMoves[reviewPlyIndex];
        if (typeof game.isResultMove === "function" && game.isResultMove(raw)) {
            reviewPlyIndex += 1;
            reviewBranchPly =
                reviewPlyIndex < reviewFullMoves.length ? reviewPlyIndex : null;
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
            const previousOnUpdateStep = game.OnUpdate;
            game.OnUpdate = null;
            try {
                game.loadMoves(ReviewModel.cloneMoves(reviewFullMoves.slice(0, reviewPlyIndex)));
            } finally {
                game.OnUpdate = previousOnUpdateStep;
            }
            syncReviewBoardFromGame();
            refreshReviewMovesTable();
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
        const clamped = ReviewModel.clampPly(ply, reviewFullMoves.length);
        reviewPlyIndex = clamped;
        reviewBranchPly = clamped < reviewFullMoves.length ? clamped : null;
        replayReviewMovesUpTo(clamped);
        syncReviewBoardFromGame();
        refreshReviewMovesTable();
        syncGameRunPanelOptions();
        updateReviewNavBar();
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
        const btn = $("positionSetupBtn");
        if (btn && btn.disabled) {
            return;
        }
        if (!playSessionReady || !game) {
            showStatus("Board is still loading…", 2500, "info");
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
                label: "New game",
                icon: "newGame",
                onClick: onRematch,
                accent: true,
            },
            { id: "resignBtn", label: "Resign", icon: "resign", onClick: onResign },
            { id: "drawBtn", label: "Draw", icon: "draw", onClick: onDrawOfferClick },
            { type: "spacer" },
            { id: "undoBtn", label: "Undo", icon: "undo", onClick: onUndo },
            { id: "redoBtn", label: "Redo", icon: "redo", onClick: onRedo },
            { id: "lastMoveBtn", label: "Last move", icon: "lastMove", onClick: onLastMove },
        ];
        if (canPlayAdvancedTools) {
            items.push(
                {
                    id: "positionSetupBtn",
                    label: "Position setup",
                    icon: "positionSetup",
                    onClick: onPositionSetupToggle,
                },
                {
                    id: "configurationBtn",
                    label: "Config",
                    icon: "configuration",
                    onClick: onConfigurationToggle,
                },
            );
        }
        items.push(
            { id: "flipBtn", label: "Flip", icon: "flip", onClick: onFlip },
        );
        if (canPlayAdvancedTools) {
            items.push({ id: "saveBtn", label: "Save", icon: "save", onClick: onSaveGame });
        }
        items.push(
            { type: "spacer" },
            { id: "homeBtn", label: "Exit", icon: "exit", onClick: onHome },
        );
        ActionRail.mount(rail, items);
        updateActionButtons();
        if (window.DesktopBoardScale && typeof window.DesktopBoardScale.refresh === "function") {
            window.DesktopBoardScale.refresh();
        }
    }

    function isHumanTurn() {
        return (
            (game.Turn === "white" && currentPlayerIsWhite) ||
            (game.Turn === "black" && !currentPlayerIsWhite)
        );
    }

    function isAiTurn() {
        return game && !game.GameOver && !isHumanTurn();
    }

    function canUndoMovePair() {
        if (!allowUndo || !game || game.GameOver || animating || engineThinking || dialogOn) {
            return false;
        }
        const moveCount = game.Moves ? game.Moves.length : 0;
        return isHumanTurn() && moveCount >= 2;
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
                redoPairAvailable: redoPairAvailable,
                canUsePositionSetup: canUsePositionSetup(),
                canUseBrainConfig: canUseBrainConfig(),
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
            title: options.title || "Save position",
            label: "Position name",
            defaultValue: formatPositionSetupSaveName(),
            confirmLabel: options.confirmLabel || "Save",
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
            showStatus("Nothing to save", 2000, "error");
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
            showStatus(options.statusMessage || "Position saved", 2500, "info");
        } catch (err) {
            showStatus(err.message || "Could not save position", 0, "error");
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
            showStatus("Saved position not found", 0, "error");
            editingSavedGameId = null;
            return;
        }
        if (!validatePositionSetup("save")) {
            return;
        }
        if (!game.GameState) {
            showStatus("Nothing to save", 2000, "error");
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
            showStatus("Position updated", 2500, "info");
        } catch (err) {
            showStatus(err.message || "Could not update position", 0, "error");
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
            showStatus("Nothing to save", 2000, "error");
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
            showStatus("Nothing to save", 2000, "error");
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
                title: "Save position as",
                confirmLabel: "Save As",
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
                    label: "Delete",
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
                label: "Load to start",
                disabled: blocked,
                onClick: function () {
                    loadSavedGame(bookmarkId, { atStart: true });
                },
            },
        ];
        if (canPlayAdvancedTools) {
            items.push({
                label: "Edit position",
                disabled: blocked,
                onClick: function () {
                    editSavedGame(bookmarkId);
                },
            });
        }
        items.push(
            {
                label: "Rename",
                onClick: function () {
                    startRenameSavedGame(bookmarkId);
                },
            },
            { separator: true },
            {
                label: "Delete",
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
            showStatus("Name cannot be empty", 2000, "error");
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
            showStatus("Game renamed", 2000, "info");
        } catch (err) {
            showStatus(err.message || "Could not rename game", 0, "error");
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
                deleted === 1 ? "Game deleted" : deleted + " items deleted",
                2000,
                "info",
            );
        } catch (err) {
            renderSavedGamesList();
            showStatus(err.message || "Could not delete selected items", 0, "error");
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
                refreshReviewMovesTable();
            }
            syncGameRunPanelOptions();
            showStatus("");
        } catch (err) {
            showStatus(err.message || "Could not load saved game", 0, "error");
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
            showStatus("Editing position — Save to update this bookmark", 0, "info");
        } catch (err) {
            showStatus(err.message || "Could not open position for editing", 0, "error");
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
            showStatus("Nothing to save", 2000, "error");
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
            showStatus("Game saved", 2000, "info");
        } catch (err) {
            showStatus(err.message || "Could not save game", 0, "error");
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
        game.OnPromotion = onPromotion;
        game.OnDraw = onDraw;
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

    function onCheck(turn) {
        alertMode = true;
        showStatus("Check", 2000, "check");
    }

    function onCheckmate(matedTurn) {
        alertMode = true;
        const winner = game.opponent(matedTurn);
        showStatus("Checkmate — " + game.colorName(winner) + " wins", 0, "checkmate");
        Clocks.stop();
        updateActionButtons();
        tryLogCompletedGame();
    }

    function onDraw(reason) {
        if (positionSetupMode) {
            showStatus("Draw — " + reason, 0, "draw");
            if (Board.applyDrawHighlight) {
                Board.applyDrawHighlight();
            }
            return;
        }
        alertMode = true;
        showStatus("Draw — " + reason, 0, "draw");
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
        if (adjusted.promotion && adjusted.selectedPiece == null) {
            return false;
        }
        if (networkMoveAlreadyApplied(adjusted)) {
            Board.syncFromGameState();
            return true;
        }

        try {
            if (adjusted.promotion) {
                await Board.animateMove(adjusted);
                const actual = game.makeMove(adjusted.source, adjusted.target);
                actual.selectedPiece = adjusted.selectedPiece;
                actual.promotion = true;
                if (actual.piece && adjusted.piece) {
                    actual.piece.color = adjusted.piece.color;
                }
                game.completePromotion(actual);
            } else {
                await Board.animateMove(adjusted);
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
        lastMove = game.LastMove || lastMove;
        updateMovesTable(tableMovesFromGame());
        updateHeaderTurn();
        return true;
    }

    function abortEngineSearch() {
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
        const player = currentPlayerIsWhite ? "White" : "Black";
        game.resign(player);
        abortEngineSearch();
        updateMovesTable(tableMovesFromGame());
        finishResignGame(player);
        tryLogCompletedGame();
    }

    async function runEngineMove() {
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
        showStatus("Engine thinking…", 0, "info");
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
                showStatus(decision.message || "Engine could not find a move", 0, "error");
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
                showStatus("Engine move could not be applied", 0, "error");
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
            showStatus(err.message || "Engine error", 0, "error");
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
        session = Settings.buildSession(opts);
        allowUndo = resolveAllowUndo(session);
        currentPlayerIsWhite = opts.color !== "black";
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
                return {
                    ok: true,
                    canPlayAdvanced: true,
                    username: null,
                    lastGameOptions: null,
                };
            }
            canPlayAdvancedTools = false;
            if (!Api || typeof Api.get !== "function") {
                return { ok: false, canPlayAdvanced: false };
            }
            try {
                const ctx = await Api.get("/api/play/launch-context");
                canPlayAdvancedTools = !!(ctx && ctx.canPlayAdvanced);
                if (ctx && ctx.username) {
                    webLaunchUsername = ctx.username;
                }
                return ctx || { ok: false, canPlayAdvanced: false };
            } catch (err) {
                console.warn("[Play] Could not load launch context:", err);
                canPlayAdvancedTools = false;
                return { ok: false, canPlayAdvanced: false };
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

    function clearWebLaunchQueryString() {
        if (!isWebPlayPage() || !window.history || !window.history.replaceState) {
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
            if (!opts.username && webLaunchUsername) {
                opts.username = webLaunchUsername;
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
        if (isAiTurn()) {
            switchClocks();
            showStatus("Engine to move…", 0, "info");
            await runEngineMove();
        } else {
            switchClocks();
            showStatus("Game resumed — your move", 2000, "info");
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
        if (await resumeStoredGame()) {
            clearWebLaunchQueryString();
            return;
        }
        const opts = await resolveWebAutoStartOptions();
        await beginNewGame(opts);
        clearWebLaunchQueryString();
    }

    async function beginNewGame(opts) {
        const launchOpts = Object.assign({}, opts || {});
        if (!launchOpts.username && webLaunchUsername) {
            launchOpts.username = webLaunchUsername;
        }
        applySessionSettings(launchOpts);
        if (Settings.saveNewGameOptions) {
            Settings.saveNewGameOptions({
                color: launchOpts.color === "black" ? "black" : "white",
                engine: launchOpts.engine || "brain43",
                allowUndo: launchOpts.allowUndo !== false,
                timeMinutes: launchOpts.timeMinutes,
                mouse: launchOpts.mouse,
                thinkingTimeSeconds: launchOpts.thinkingTimeSeconds != null
                    ? launchOpts.thinkingTimeSeconds
                    : launchOpts.difficulty,
                showAvailableMoves: launchOpts.showAvailableMoves,
            });
        }
        assignNewGameId();
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
        if (!game.GameOver && isAiTurn()) {
            switchClocks();
            showStatus("Engine to move…", 0, "info");
            await runEngineMove();
        } else if (!game.GameOver) {
            switchClocks();
            showStatus("Your move", 2000, "info");
        }
    }

    function beginPositionSetupFromMenu() {
        if (!game) {
            showStatus("Board is still loading…", 2500, "info");
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
        showStatus("Choose promotion piece", 0, "promotion");
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
                        showStatus("Invalid promotion piece", 0, "error");
                        return;
                    }
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
        clearDisplayedEvaluation();
        lastMove = executed;
        redoPairAvailable = false;
        Board.clearArrows();
        if (Board.resetSquareColors) {
            Board.resetSquareColors();
        }
        switchClocks();
        updateMovesTable(tableMovesFromGame());
        updateHeaderTurn();
        updateActionButtons();
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
        let title = "Invalid position";
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
            title = "Confirm";
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
        confirmDialog("Resign this game?", "You will lose the game.", function () {
            completeUserResign();
        });
    }

    function engineResignFromLostPosition() {
        if (!game || game.GameOver) {
            return;
        }
        const player = currentPlayerIsWhite ? "Black" : "White";
        game.resign(player);
        abortEngineSearch();
        updateMovesTable(tableMovesFromGame());
        finishResignGame(player);
        tryLogCompletedGame();
    }

    function onDrawOfferClick() {
        if (game.GameOver || $("drawBtn").disabled) {
            return;
        }
        Dialog.alert({
            title: "Draw offer",
            message: "Draw offers are not available when playing against the engine.",
        });
    }

    async function onUndo() {
        if (!canUndoMovePair() || $("undoBtn").disabled) {
            return;
        }
        clearDisplayedEvaluation();
        animating = true;
        batchUndoRedo = true;
        game.undo();
        game.undo();
        batchUndoRedo = false;
        Board.clearArrows();
        syncBoardFromGame();
        animating = false;
        redoPairAvailable = true;
        updateMovesTable(tableMovesFromGame());
        updateActionButtons();
        persistActiveGame();
    }

    async function onRedo() {
        if (!allowUndo || !redoPairAvailable || $("redoBtn").disabled || game.GameOver || dialogOn || animating || engineThinking) {
            return;
        }
        clearDisplayedEvaluation();
        animating = true;
        batchUndoRedo = true;
        game.redo();
        game.redo();
        batchUndoRedo = false;
        Board.clearArrows();
        syncBoardFromGame();
        animating = false;
        redoPairAvailable = false;
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
        const humanHasMoved = currentPlayerIsWhite
            ? game.Moves.length >= 1
            : game.Moves.length >= 2;
        if (!humanHasMoved) {
            leavePlayShell();
            return;
        }
        confirmDialog("Leave game?", "Your game will be resigned.", function () {
            const player = currentPlayerIsWhite ? "White" : "Black";
            game.resign(player);
            abortEngineSearch();
            tryLogCompletedGame();
            leavePlayShell();
        });
    }

    function resetToIdleScreen() {
        clearActiveGameSnapshot();
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
        showStatus("Choose New game or Position setup from the sidebar", 0, "info");
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
                    ? "Choose New game or Position setup from the sidebar"
                    : "Choose New game from the sidebar",
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