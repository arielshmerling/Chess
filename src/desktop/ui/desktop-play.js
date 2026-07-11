/**
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

    let game = null;
    const Settings = window.DesktopGameSettings;
    const Engine = window.DesktopEngine;
    const GameLog = window.DesktopGameLog;
    const Dialog = window.DesktopDialog;
    const NewGameDialog = window.DesktopNewGameDialog;

    let session = null;
    let gameActive = false;
    let currentPlayerIsWhite = true;
    let whiteTimer = 0;
    let blackTimer = 0;
    let whiteHandle = null;
    let blackHandle = null;
    let lastMove = null;
    let autoCompletePromotion = false;
    let dialogOn = false;
    let lastCheckNotifySide = null;
    let alertMode = false;
    let headerEventMessage = null;
    let headerEventKind = null;
    let headerEventTimer = null;
    let animating = false;
    let engineThinking = false;
    let redoPairAvailable = false;
    let allowUndo = true;
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
    let positionSetupMode = false;
    let configurationMode = false;
    let reviewMode = false;
    let reviewFullMoves = [];
    let reviewOriginStateStr = null;
    let reviewFinalStateStr = null;
    let reviewPlyIndex = 0;
    /** When set, Play continues from this ply and drops later moves. */
    let reviewBranchPly = null;
    let positionSetupSnapshot = null;
    let playSessionReady = false;
    let positionSetupPanelMounted = false;
    let configurationPanelMounted = false;
    let gameRunPanelMounted = false;
    let currentGameId = null;
    let gameHistoryLogged = false;
    let gameAutoBookmarked = false;

    const ACTION_ICONS = {
        resign:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V12M10 20V4M16 20v-6M22 20V9"/></svg>',
        draw:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>',
        undo:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14H4V9l1.4 1.4 5.6-5.6 1.4 1.4-5.6 5.6H15v2H9z"/></svg>',
        redo:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 14h5V9l-1.4 1.4-5.6-5.6-1.4 1.4 5.6 5.6H9v2h6z"/></svg>',
        lastMove:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l7-7 7 7M12 5v14"/></svg>',
        flip:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v3l4-4.5L17 1v3H5v6h2V7zm10 10H7v-3l-4 4.5L7 23v-3h12v-6h-2v4z"/></svg>',
        newGame:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
        exit:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3H5a2 2 0 00-2 2v14a2 2 0 002 2h5M14 8l5 4-5 4M11 12h8"/></svg>',
        save:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
        positionSetup:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="3" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="14" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="14" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
        configuration:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    };

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

    function timerToText(timer) {
        const d = new Date(1970, 0, 1);
        d.setSeconds(timer);
        return d.toLocaleTimeString("eo", { hour12: false });
    }

    function initialClockSeconds() {
        if (session && typeof session.gameTimeMinutes === "number" && session.gameTimeMinutes >= 1) {
            return Math.round(session.gameTimeMinutes * 60);
        }
        return 90 * 60;
    }

    function resetClocks() {
        if (whiteHandle) {
            clearInterval(whiteHandle);
            whiteHandle = null;
        }
        if (blackHandle) {
            clearInterval(blackHandle);
            blackHandle = null;
        }
        whiteTimer = initialClockSeconds();
        blackTimer =
            session &&
            typeof session.blackTimer === "number" &&
            session.blackTimer > 0
                ? session.blackTimer
                : whiteTimer;
        const whiteClock = $("whiteClockTimeText");
        const blackClock = $("blackClockTimeText");
        if (whiteClock) {
            whiteClock.textContent = timerToText(whiteTimer);
        }
        if (blackClock) {
            blackClock.textContent = timerToText(blackTimer);
        }
    }

    function updateTimersFromInfo(info) {
        if (typeof info.whiteTimer === "number" && info.whiteTimer >= 0) {
            whiteTimer = info.whiteTimer;
            const el = $("whiteClockTimeText");
            if (el) {
                el.textContent = timerToText(whiteTimer);
            }
        }
        if (typeof info.blackTimer === "number" && info.blackTimer >= 0) {
            blackTimer = info.blackTimer;
            const el = $("blackClockTimeText");
            if (el) {
                el.textContent = timerToText(blackTimer);
            }
        }
    }

    const STATUS_BAR_CLASSES = [
        "desktop-play-status-bar--event",
        "desktop-play-status-bar--check",
        "desktop-play-status-bar--checkmate",
        "desktop-play-status-bar--draw",
        "desktop-play-status-bar--promotion",
        "desktop-play-status-bar--info",
        "desktop-play-status-bar--timeout",
        "desktop-play-status-bar--error",
    ];

    function updateHeaderClockHighlight() {
        const headerBlack = $("desktopPlayHeaderBlack");
        const headerWhite = $("desktopPlayHeaderWhite");
        if (!game) {
            return;
        }
        const suppressForAlert =
            headerEventMessage &&
            headerEventKind &&
            headerEventKind !== "info";
        const active = !game.GameOver && !suppressForAlert;
        const turn = game.Turn || (game.GameState && game.GameState.turn);
        if (headerBlack) {
            headerBlack.classList.toggle("desktop-play-header-clock--active", active && turn === "black");
        }
        if (headerWhite) {
            headerWhite.classList.toggle("desktop-play-header-clock--active", active && turn === "white");
        }
    }

    function clearHeaderEvent() {
        if (headerEventTimer) {
            clearTimeout(headerEventTimer);
            headerEventTimer = null;
        }
        headerEventMessage = null;
        headerEventKind = null;
        refreshStatusBar();
    }

    function defaultStatusText() {
        if (!game) {
            return "";
        }
        if (!gameActive && !positionSetupMode && !configurationMode) {
            if (reviewMode && boardHasPieces()) {
                return "";
            }
            if (boardHasPieces()) {
                return "Set move, color, engine, and think time in the header, then press Play";
            }
            return "Choose New game or Position setup from the sidebar";
        }
        if (game.GameOver) {
            return "Game over";
        }
        return "Game in progress";
    }

    function refreshStatusBar() {
        const statusEl = $("desktopPlayStatusBar");
        if (!statusEl) {
            return;
        }
        STATUS_BAR_CLASSES.forEach(function (cls) {
            statusEl.classList.remove(cls);
        });
        updateHeaderClockHighlight();
        if (headerEventMessage) {
            statusEl.textContent = headerEventMessage;
            statusEl.classList.add("desktop-play-status-bar--event");
            if (headerEventKind) {
                statusEl.classList.add("desktop-play-status-bar--" + headerEventKind);
            }
            return;
        }
        statusEl.textContent = defaultStatusText();
    }

    function updateHeaderTurn() {
        refreshStatusBar();
    }

    function formatSessionTypeLabel() {
        if (positionSetupMode) {
            return "Position Setup";
        }
        if (configurationMode) {
            return "Configuration mode";
        }
        if (reviewMode) {
            return "Review Mode";
        }
        return "Play Mode";
    }

    function updateMatchHeader() {
        const titleEl = $("desktopPlayMatchTitle");
        if (titleEl) {
            titleEl.textContent = formatSessionTypeLabel();
            updateGameModeTooltip();
        }
        if (!session) {
            return;
        }
        const whiteName = session.whitePlayerName || "White";
        const blackName = session.blackPlayerName || "Black";
        const whiteNameEl = $("desktopPlayWhiteName");
        const blackNameEl = $("desktopPlayBlackName");
        if (whiteNameEl) {
            whiteNameEl.textContent = whiteName;
        }
        if (blackNameEl) {
            blackNameEl.textContent = blackName;
        }
    }

    function switchClocks() {
        if (whiteHandle) {
            clearInterval(whiteHandle);
            whiteHandle = null;
        }
        if (blackHandle) {
            clearInterval(blackHandle);
            blackHandle = null;
        }
        updateHeaderTurn();
        if (game.Turn === "black") {
            blackHandle = setInterval(function () {
                blackTimer--;
                const el = $("blackClockTimeText");
                if (el) {
                    el.textContent = timerToText(blackTimer);
                }
                if (game.GameOver || blackTimer <= 0) {
                    clearInterval(blackHandle);
                    blackHandle = null;
                    if (blackTimer <= 0 && !game.GameOver) {
                        outOfTime();
                    }
                }
            }, 1000);
        }
        if (game.Turn === "white") {
            whiteHandle = setInterval(function () {
                whiteTimer--;
                const el = $("whiteClockTimeText");
                if (el) {
                    el.textContent = timerToText(whiteTimer);
                }
                if (game.GameOver || whiteTimer <= 0) {
                    clearInterval(whiteHandle);
                    whiteHandle = null;
                    if (whiteTimer <= 0 && !game.GameOver) {
                        outOfTime();
                    }
                }
            }, 1000);
        }
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
        if (headerEventTimer) {
            clearTimeout(headerEventTimer);
            headerEventTimer = null;
        }
        headerEventMessage = message;
        headerEventKind = kind || "info";
        alertMode = headerEventKind !== "info";
        refreshStatusBar();
        if (durationMs) {
            headerEventTimer = setTimeout(function () {
                if (headerEventMessage === message) {
                    clearHeaderEvent();
                }
            }, durationMs);
        }
    }

    function setButtonDisabled(id, disabled) {
        const btn = $(id);
        if (btn) {
            btn.disabled = !!disabled;
        }
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
        if (whiteHandle) {
            clearInterval(whiteHandle);
            whiteHandle = null;
        }
        if (blackHandle) {
            clearInterval(blackHandle);
            blackHandle = null;
        }
    }

    function capturePositionSetupSnapshot() {
        return {
            stateStr: JSON.stringify(game.GameState),
            moves: tableMovesFromGame(),
            whiteTimer: whiteTimer,
            blackTimer: blackTimer,
            clocksWereRunning: !!(whiteHandle || blackHandle),
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
        whiteTimer = positionSetupSnapshot.whiteTimer;
        blackTimer = positionSetupSnapshot.blackTimer;
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
        updateTimersFromInfo({ whiteTimer: whiteTimer, blackTimer: blackTimer });
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
        const btn = $("positionSetupBtn");
        if (btn) {
            btn.classList.toggle("desktop-play-action--active", positionSetupMode);
        }
        const sidebar = $("desktopPlaySidebarMoves");
        if (sidebar) {
            sidebar.classList.toggle("desktop-play-sidebar--position-setup", positionSetupMode);
            if (positionSetupMode) {
                sidebar.classList.remove("desktop-play-sidebar--brain-config");
            }
        }
        updateMatchHeader();
        updateActionButtons();
    }

    function setConfigurationUi(active) {
        const on = !!active;
        if (on && positionSetupMode) {
            Board.setSetupMode(false);
            positionSetupMode = false;
            const setupBtn = $("positionSetupBtn");
            if (setupBtn) {
                setupBtn.classList.remove("desktop-play-action--active");
            }
        }
        configurationMode = on;
        const btn = $("configurationBtn");
        if (btn) {
            btn.classList.toggle("desktop-play-action--active", configurationMode);
        }
        const sidebar = $("desktopPlaySidebarMoves");
        if (sidebar) {
            sidebar.classList.toggle("desktop-play-sidebar--brain-config", configurationMode);
            if (configurationMode) {
                sidebar.classList.remove("desktop-play-sidebar--position-setup");
            }
        }
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
        const el = $("desktopPlayHeaderRun");
        if (!el) {
            return;
        }
        el.classList.toggle("desktop-play-header-run--hidden", !visible);
        el.setAttribute("aria-hidden", visible ? "false" : "true");
    }

    function updateGameRunPanelVisibility() {
        const show =
            positionSetupMode ||
            (!gameActive && !!lastLoadedSavedGameId && boardHasPieces());
        setGameRunPanelVisible(show);
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
        if (continuedMoves.length === 0) {
            reviewOriginStateStr = JSON.stringify(state);
        }
        applyGameRunPanelOptions(setupOpts);
        assignNewGameId();
        gameHistoryLogged = false;
        gameAutoBookmarked = false;
        whiteTimer = initialClockSeconds();
        blackTimer = initialClockSeconds();
        updateTimersFromInfo({ whiteTimer: whiteTimer, blackTimer: blackTimer });
        redoPairAvailable = false;
        lastCheckNotifySide = null;
        alertMode = false;
        Board.syncFromGameState();
        if (Board.updateCaptureLists && game.GameState.capturedPiecesList) {
            Board.updateCaptureLists(game.GameState.capturedPiecesList);
        }
        updateMovesTable(movesForMovesTable(continuedMoves));
        updateMatchHeader();
        updateHeaderTurn();
        gameActive = true;
        exitConfigurationIfGameStarting();
        exitReviewMode();
        document.body.classList.add("desktop-play-has-active-game");
        if (Board.setHumanPlayEnabled) {
            Board.setHumanPlayEnabled(true);
        }
        updateActionButtons();
        editingSavedGameId = null;
        updateGameRunPanelVisibility();
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

    function formatEvaluationTotalText(result) {
        if (!result) {
            return "";
        }
        if (result.terminal === "checkmate") {
            return "Checkmate";
        }
        if (result.terminal === "draw") {
            return "Draw (0)";
        }
        const value = result.total;
        if (!Number.isFinite(value)) {
            return "?";
        }
        if (Math.abs(value) >= 1000) {
            return String(Math.round(value));
        }
        const rounded = Math.round(value * 100) / 100;
        if (Number.isInteger(rounded)) {
            return (rounded > 0 ? "+" : "") + String(rounded);
        }
        const text = rounded.toFixed(2).replace(/\.?0+$/, "");
        return (rounded > 0 ? "+" : "") + text;
    }

    function formatEvaluationSummaryTooltip(summary, totalText) {
        const lines = (summary || []).map(function (item) {
            if (item.text != null && Number.isFinite(item.value)) {
                const sign = item.value > 0 ? "+" : "";
                return item.label + ": " + sign + item.value + " (" + item.text + ")";
            }
            if (item.text != null) {
                return item.label + ": " + item.text;
            }
            const sign = item.value > 0 ? "+" : "";
            return item.label + ": " + sign + item.value;
        });
        if (totalText) {
            lines.push("Total: " + totalText);
        }
        return lines.join("\n");
    }

    function setStatusBarEvaluationTooltip(summary, totalText) {
        const statusEl = $("desktopPlayStatusBar");
        if (!statusEl) {
            return;
        }
        const tooltip = formatEvaluationSummaryTooltip(summary, totalText);
        if (tooltip) {
            statusEl.setAttribute("title", tooltip);
        } else {
            statusEl.removeAttribute("title");
        }
    }

    function clearStatusBarEvaluationTooltip() {
        const statusEl = $("desktopPlayStatusBar");
        if (statusEl) {
            statusEl.removeAttribute("title");
        }
    }

    function clearDisplayedEvaluation() {
        if (Board && Board.clearEvaluationOverlay) {
            Board.clearEvaluationOverlay();
        }
        clearStatusBarEvaluationTooltip();
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
            const sideLabel = result.sideToMove === "black" ? "Black" : "White";
            const scoreText = formatEvaluationTotalText(result);
            showStatus("Evaluation (" + sideLabel + " to move): " + scoreText, 0, "info");
            setStatusBarEvaluationTooltip(result.summary, scoreText);
        } catch (err) {
            clearDisplayedEvaluation();
            showStatus(err.message || "Evaluation failed", 0, "error");
        }
    }

    function shouldIgnoreShortcutTarget(target) {
        if (!target || !target.closest) {
            return false;
        }
        return !!target.closest("input, textarea, select, [contenteditable='true']");
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
        if (shouldIgnoreShortcutTarget(ev.target)) {
            return;
        }
        if (ev.key === "F2") {
            ev.preventDefault();
            logGameState();
            return;
        }
        if (
            (ev.ctrlKey || ev.metaKey) &&
            ev.shiftKey &&
            !ev.altKey &&
            ev.key &&
            ev.key.toLowerCase() === "o"
        ) {
            ev.preventDefault();
            openSavedGamesPgnFolder();
            return;
        }
        if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && ev.key && ev.key.toLowerCase() === "e") {
            ev.preventDefault();
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
        reviewOriginStateStr = JSON.stringify(state);
        applyGameRunPanelOptions(setupOpts);
        whiteTimer = initialClockSeconds();
        blackTimer = initialClockSeconds();
        updateTimersFromInfo({ whiteTimer: whiteTimer, blackTimer: blackTimer });
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
        if (!game) {
            return false;
        }
        if (game.GameOver) {
            return true;
        }
        const moveCount = game.Moves ? game.Moves.length : 0;
        return moveCount === 0;
    }

    function canUseBrainConfig() {
        return !positionSetupMode && !gameActive;
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
    }

    function exitReviewMode() {
        if (!reviewMode) {
            return;
        }
        reviewMode = false;
        clearReviewNavigation();
        updateMatchHeader();
        updateActionButtons();
        updateGameRunPanelVisibility();
        restoreSidebarPreferences();
    }

    function clearReviewNavigation() {
        reviewFullMoves = [];
        reviewOriginStateStr = null;
        reviewFinalStateStr = null;
        reviewPlyIndex = 0;
        reviewBranchPly = null;
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

    function applyReviewMove(chess, move) {
        try {
            const raw = cloneReviewMove(move);
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
            if (chess.GameState && chess.GameState.promoting) {
                if (!result.piece) {
                    return false;
                }
                result.selectedPiece = raw.selectedPiece != null ? raw.selectedPiece : chess.QUEEN;
                chess.completePromotion(result);
            }
            return true;
        } catch (err) {
            console.warn("[desktop-play] Review move failed:", err);
            return false;
        }
    }

    function replayReviewMovesUpTo(ply) {
        prepareReviewStartPosition(game);
        const limit = Math.max(0, Math.min(ply, reviewFullMoves.length));
        for (let i = 0; i < limit; i += 1) {
            if (!applyReviewMove(game, reviewFullMoves[i])) {
                console.warn("[desktop-play] Review replay stopped at ply", i + 1);
                break;
            }
        }
        game.loadMoves(reviewFullMoves.slice(0, limit).map(cloneReviewMove));
    }

    function cloneReviewMove(move) {
        if (typeof move === "string") {
            return JSON.parse(move);
        }
        return Object.assign({}, move);
    }

    function initReviewNavigation(finalStateStr, moves, bookmarkOrigin) {
        const loaded = moves && moves.length ? moves : tableMovesFromGame();
        reviewFullMoves = loaded.map(cloneReviewMove);
        reviewFinalStateStr = finalStateStr;
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
        Board.syncFromGameState();
        clearDisplayedEvaluation();
        if (game.GameState && game.GameState.capturedPiecesList) {
            Board.updateCaptureLists(game.GameState.capturedPiecesList);
        }
        updateHeaderTurn();
    }

    function showReviewAtPly(ply) {
        if (!reviewMode || !reviewFullMoves.length) {
            return;
        }
        const clamped = Math.max(0, Math.min(ply, reviewFullMoves.length));
        reviewPlyIndex = clamped;
        reviewBranchPly = clamped < reviewFullMoves.length ? clamped : null;
        replayReviewMovesUpTo(clamped);
        syncReviewBoardFromGame();
        refreshReviewMovesTable();
        syncGameRunPanelOptions();
    }

    function movesForDisplay() {
        if (reviewMode && reviewFullMoves.length) {
            return reviewFullMoves;
        }
        return tableMovesFromGame();
    }

    function refreshReviewMovesTable() {
        updateMovesTable(movesForDisplay());
    }

    function onReviewMoveClick(ply) {
        if (!reviewMode || !reviewFullMoves.length || animating || engineThinking || dialogOn) {
            return;
        }
        showReviewAtPly(ply);
    }

    function attachReviewMoveCell(td, ply) {
        if (!ply) {
            return;
        }
        td.dataset.ply = String(ply);
        td.classList.add("desktop-play-move-clickable");
        td.setAttribute("role", "button");
        td.setAttribute("tabindex", "0");
        td.addEventListener("click", function (ev) {
            ev.preventDefault();
            onReviewMoveClick(ply);
        });
        td.addEventListener("keydown", function (ev) {
            if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                onReviewMoveClick(ply);
            }
        });
    }

    function highlightReviewMoveSelection() {
        const movesDiv = $("movesDiv");
        if (!movesDiv) {
            return;
        }
        movesDiv.querySelectorAll(".tdMove").forEach(function (td) {
            td.classList.remove("selectedMove");
        });
        if (!reviewMode || reviewBranchPly == null || reviewPlyIndex <= 0) {
            return;
        }
        const selected = movesDiv.querySelector('.tdMove[data-ply="' + reviewPlyIndex + '"]');
        if (selected) {
            selected.classList.add("selectedMove");
            selected.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
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
            { type: "spacer" },
            { id: "resignBtn", label: "Resign", icon: "resign", onClick: onResign },
            { id: "drawBtn", label: "Draw", icon: "draw", onClick: onDrawOfferClick },
            { type: "spacer" },
            { id: "undoBtn", label: "Undo", icon: "undo", onClick: onUndo },
            { id: "redoBtn", label: "Redo", icon: "redo", onClick: onRedo },
            { id: "lastMoveBtn", label: "Last move", icon: "lastMove", onClick: onLastMove },
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
            { id: "flipBtn", label: "Flip", icon: "flip", onClick: onFlip },
            { id: "saveBtn", label: "Save", icon: "save", onClick: onSaveGame },
            { type: "spacer" },
            { id: "homeBtn", label: "Exit", icon: "exit", onClick: onHome },
        ];
        items.forEach(function (item) {
            if (item.type === "spacer") {
                const spacer = document.createElement("div");
                spacer.className = "desktop-play-actions-spacer";
                rail.appendChild(spacer);
                return;
            }
            const btn = document.createElement("button");
            btn.type = "button";
            btn.id = item.id;
            btn.className =
                "desktop-play-action" + (item.accent ? " desktop-play-action--accent" : "");
            btn.title = item.label;
            const iconWrap = document.createElement("span");
            iconWrap.className = "desktop-play-action-icon";
            iconWrap.innerHTML = ACTION_ICONS[item.icon] || "";
            const label = document.createElement("span");
            label.className = "desktop-play-action-label";
            label.textContent = item.label;
            btn.appendChild(iconWrap);
            btn.appendChild(label);
            btn.addEventListener("click", item.onClick);
            rail.appendChild(btn);
        });
        updateActionButtons();
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

    function appendGameResultToMoves(moves) {
        const list = (moves || []).slice();
        if (
            !game
            || !game.GameOver
            || positionSetupMode
            || configurationMode
            || !game.ResultMove
            || !game.ResultMove.moveStr
        ) {
            return list;
        }
        const resultStr = game.ResultMove.moveStr;
        const last = list[list.length - 1];
        if (last && last.moveStr === resultStr) {
            return list;
        }
        if (last && isTableResultMove(last)) {
            return list;
        }
        const resultMove = { moveStr: resultStr };
        const lastColor = moveColorForTable(last);
        if (lastColor === "white") {
            resultMove.turn = "black";
        } else if (lastColor === "black") {
            resultMove.turn = "white";
        } else if (list.length === 0) {
            resultMove.turn = "black";
        } else if (list.length % 2 === 1) {
            resultMove.turn = "black";
        } else {
            resultMove.turn = "white";
        }
        list.push(resultMove);
        return list;
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
        if (!game || !playSessionReady) {
            setButtonDisabled("positionSetupBtn", true);
            setButtonDisabled("configurationBtn", true);
            setButtonDisabled("rematchBtn", true);
            return;
        }
        setButtonDisabled(
            "configurationBtn",
            animating || dialogOn || (!configurationMode && !canUseBrainConfig()),
        );
        if (!gameActive && !positionSetupMode && !configurationMode) {
            setButtonDisabled("resignBtn", true);
            setButtonDisabled("drawBtn", true);
            setButtonDisabled("undoBtn", true);
            setButtonDisabled("redoBtn", true);
            setButtonDisabled("lastMoveBtn", true);
            setButtonDisabled("saveBtn", true);
            setButtonDisabled("rematchBtn", animating || dialogOn);
            setButtonDisabled("positionSetupBtn", animating || dialogOn);
            setButtonDisabled("flipBtn", true);
            return;
        }
        const over = game.GameOver;
        const hasMoves = game.Moves && game.Moves.length > 0;
        const humanTurn = isHumanTurn();

        setButtonDisabled(
            "positionSetupBtn",
            animating ||
                dialogOn ||
                configurationMode ||
                (!positionSetupMode && !canUsePositionSetup()),
        );
        if (positionSetupMode) {
            setButtonDisabled("resignBtn", true);
            setButtonDisabled("drawBtn", true);
            setButtonDisabled("undoBtn", true);
            setButtonDisabled("redoBtn", true);
            setButtonDisabled("lastMoveBtn", true);
            setButtonDisabled("saveBtn", true);
            setButtonDisabled("rematchBtn", true);
            setButtonDisabled("flipBtn", animating);
            return;
        }
        if (configurationMode) {
            setButtonDisabled("resignBtn", true);
            setButtonDisabled("drawBtn", true);
            setButtonDisabled("undoBtn", true);
            setButtonDisabled("redoBtn", true);
            setButtonDisabled("lastMoveBtn", true);
            setButtonDisabled("saveBtn", true);
            setButtonDisabled("rematchBtn", true);
            setButtonDisabled("flipBtn", animating);
            return;
        }
        setButtonDisabled("resignBtn", over || animating);
        setButtonDisabled("drawBtn", over || animating || !humanTurn);
        const undoRedoDisabled = !allowUndo || over || animating || engineThinking || dialogOn;
        setButtonDisabled("undoBtn", undoRedoDisabled || !canUndoMovePair());
        setButtonDisabled("redoBtn", undoRedoDisabled || !redoPairAvailable);
        setButtonDisabled("lastMoveBtn", !hasMoves);
        setButtonDisabled("flipBtn", animating);
        setButtonDisabled("saveBtn", !game || animating || dialogOn);
        setButtonDisabled("rematchBtn", animating || dialogOn);
    }

    function sessionPlayerNames(source) {
        const src = source || session;
        if (!src) {
            return { white: "White", black: "Black" };
        }
        return {
            white: src.whitePlayerName || "White",
            black: src.blackPlayerName || "Black",
        };
    }

    function formatPlayersVsTitle(source) {
        const names = sessionPlayerNames(source);
        return names.white + " vs. " + names.black;
    }

    function formatAutoSaveGameName() {
        return formatPlayersVsTitle(session);
    }

    function formatManualSaveGameName() {
        return "Saved — " + formatPlayersVsTitle(session);
    }

    function resolveSavedGamePlayers(entry) {
        if (!entry) {
            return { white: "White", black: "Black" };
        }
        if (entry.whitePlayerName && entry.blackPlayerName) {
            return {
                white: entry.whitePlayerName,
                black: entry.blackPlayerName,
            };
        }
        const engineName =
            window.DesktopGameSettings && typeof window.DesktopGameSettings.brainLabel === "function"
                ? window.DesktopGameSettings.brainLabel(entry.engine || "brain43")
                : "Engine";
        return { white: "Player", black: engineName };
    }

    function formatSavedGamePlayers(entry) {
        const names = resolveSavedGamePlayers(entry);
        return names.white + " vs. " + names.black;
    }

    function formatPositionSetupSaveName() {
        const now = new Date();
        const stamp = now.toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
        });
        return "Position — " + stamp;
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
        const state = game.GameState;
        const players = sessionPlayerNames(session);
        const payload = {
            gameState: state,
            name: name,
            gameType: "SinglePlayerGame",
            moves: moves || [],
            engine: session.engine || "brain43",
            whitePlayerName: players.white,
            blackPlayerName: players.black,
            thinkingTimeSeconds:
                typeof session.thinkingTimeSeconds === "number"
                    ? session.thinkingTimeSeconds
                    : typeof session.difficulty === "number"
                      ? session.difficulty
                      : 10,
            depth:
                typeof session.thinkingTimeSeconds === "number"
                    ? session.thinkingTimeSeconds
                    : typeof session.difficulty === "number"
                      ? session.difficulty
                      : 10,
        };
        if (reviewOriginStateStr) {
            payload.originState = reviewOriginStateStr;
        }
        return payload;
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
                depth:
                    typeof session.thinkingTimeSeconds === "number"
                        ? session.thinkingTimeSeconds
                        : typeof session.difficulty === "number"
                          ? session.difficulty
                          : 10,
                date: entry.date || new Date(),
            });
            entry.state = JSON.stringify(game.GameState);
            entry.moves = [];
            entry.engine = session.engine || "brain43";
            entry.depth =
                typeof session.thinkingTimeSeconds === "number"
                    ? session.thinkingTimeSeconds
                    : typeof session.difficulty === "number"
                      ? session.difficulty
                      : 6;
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

    function setCellLabel(td, text) {
        const label = text == null ? "" : String(text);
        td.textContent = label;
        td.title = label;
    }

    function savedGameId(entry) {
        return entry && (entry._id || entry.id) ? String(entry._id || entry.id) : "";
    }

    function moveColorForTable(move) {
        if (!move) {
            return null;
        }
        if (move.turn === "white" || move.turn === "black") {
            return move.turn;
        }
        if (move.piece && (move.piece.color === "white" || move.piece.color === "black")) {
            return move.piece.color;
        }
        return null;
    }

    function reviewOriginTurn() {
        try {
            const origin = JSON.parse(reviewOriginStateStr || "{}");
            if (origin.turn === "white" || origin.turn === "black") {
                return origin.turn;
            }
        } catch {
            /* ignore */
        }
        return "white";
    }

    /** Side to move after replaying `ply` half-moves from the review start. */
    function reviewNextTurnAfterPly(ply) {
        const clamped = Math.max(0, Math.min(ply, reviewFullMoves.length));
        if (clamped === 0) {
            return reviewOriginTurn();
        }
        const lastMove = reviewFullMoves[clamped - 1];
        const mover = moveColorForTable(lastMove);
        if (mover === "white") {
            return "black";
        }
        if (mover === "black") {
            return "white";
        }
        let turn = reviewOriginTurn();
        for (let i = 0; i < clamped; i += 1) {
            turn = turn === "white" ? "black" : "white";
        }
        return turn;
    }

    function buildMoveTableRows(moves) {
        const rows = [];
        if (!moves || !moves.length) {
            return rows;
        }
        for (let i = 0; i < moves.length; ) {
            const move = moves[i];
            const color = moveColorForTable(move);
            if (color === "black") {
                rows.push({ white: "-", black: move.moveStr || "" });
                i += 1;
            } else if (color === "white") {
                const whiteStr = move.moveStr || "";
                const next = i + 1 < moves.length ? moves[i + 1] : null;
                if (next && moveColorForTable(next) === "black") {
                    rows.push({ white: whiteStr, black: next.moveStr || "" });
                    i += 2;
                } else {
                    rows.push({ white: whiteStr, black: "" });
                    i += 1;
                }
            } else {
                const whiteMove = move;
                const blackMove = i + 1 < moves.length ? moves[i + 1] : null;
                rows.push({
                    white: whiteMove.moveStr || "",
                    black: blackMove ? blackMove.moveStr || "" : "",
                });
                i += blackMove ? 2 : 1;
            }
        }
        return rows;
    }

    function buildMoveTableCells(moves) {
        const rows = [];
        if (!moves || !moves.length) {
            return rows;
        }
        let i = 0;
        let rowNum = 1;
        while (i < moves.length) {
            const move = moves[i];
            const color = moveColorForTable(move);
            const row = {
                num: rowNum,
                white: "",
                black: "",
                whitePly: null,
                blackPly: null,
            };
            rowNum += 1;
            if (color === "black") {
                row.white = "-";
                row.black = move.moveStr || "";
                if (!isTableResultMove(move)) {
                    row.blackPly = i + 1;
                }
                rows.push(row);
                i += 1;
            } else if (color === "white") {
                row.white = move.moveStr || "";
                if (!isTableResultMove(move)) {
                    row.whitePly = i + 1;
                }
                const next = i + 1 < moves.length ? moves[i + 1] : null;
                if (next && moveColorForTable(next) === "black") {
                    row.black = next.moveStr || "";
                    if (!isTableResultMove(next)) {
                        row.blackPly = i + 2;
                    }
                    i += 2;
                } else {
                    i += 1;
                }
                rows.push(row);
            } else {
                row.white = move.moveStr || "";
                if (!isTableResultMove(move)) {
                    row.whitePly = i + 1;
                }
                const next = i + 1 < moves.length ? moves[i + 1] : null;
                if (next) {
                    row.black = next.moveStr || "";
                    if (!isTableResultMove(next)) {
                        row.blackPly = i + 2;
                    }
                    i += 2;
                } else {
                    i += 1;
                }
                rows.push(row);
            }
        }
        return rows;
    }

    function movesForMovesTable(moves) {
        return (moves || []).map(function (m) {
            if (typeof m === "string") {
                try {
                    const parsed = JSON.parse(m);
                    return { moveStr: parsed.moveStr || "", turn: parsed.turn };
                } catch {
                    return { moveStr: "" };
                }
            }
            return { moveStr: m.moveStr || "", turn: m.turn };
        });
    }

    function parseSavedGameMoves(entry) {
        if (!entry || !Array.isArray(entry.moves)) {
            return [];
        }
        return entry.moves.map(function (m) {
            return typeof m === "string" ? JSON.parse(m) : m;
        });
    }

    function isSavedPositionEntry(entry) {
        return parseSavedGameMoves(entry).length === 0;
    }

    function isSavedGameEntry(entry) {
        return !isSavedPositionEntry(entry);
    }

    function savedEntriesForFilter(filter) {
        const mode = filter === "positions" ? "positions" : "games";
        return savedGames.filter(function (entry) {
            return mode === "positions" ? isSavedPositionEntry(entry) : isSavedGameEntry(entry);
        });
    }

    function updateSavedListFilterUi() {
        const filtersRoot = document.querySelector(".desktop-play-saved-list-filters");
        if (!filtersRoot) {
            return;
        }
        filtersRoot.querySelectorAll(".desktop-play-saved-list-filter").forEach(function (btn) {
            const active = btn.getAttribute("data-filter") === savedListFilter;
            btn.classList.toggle("is-active", active);
            btn.setAttribute("aria-selected", active ? "true" : "false");
        });
    }

    function setSavedListFilter(filter) {
        const next = filter === "positions" ? "positions" : "games";
        if (savedListFilter === next) {
            return;
        }
        savedListFilter = next;
        persistSavedListFilter(next);
        clearSavedGameSelection();
        updateSavedListFilterUi();
        renderSavedGamesList();
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
        const gamesDiv = $("gamesDiv");
        if (!gamesDiv) {
            return;
        }
        const item = gamesDiv.querySelector(
            '.desktop-play-saved-game[data-bookmark-id="' + bookmarkId + '"]',
        );
        if (!item) {
            return;
        }
        gamesDiv.querySelectorAll(".desktop-play-saved-game.expanded").forEach(function (el) {
            if (el !== item) {
                el.classList.remove("expanded");
            }
        });
        const wasExpanded = item.classList.contains("expanded");
        item.classList.toggle("expanded");
        expandedSavedGameId = !wasExpanded ? bookmarkId : null;
        const row = item.querySelector(".desktop-play-saved-game-row");
        if (row) {
            row.setAttribute("aria-expanded", item.classList.contains("expanded") ? "true" : "false");
        }
        const expandBtn = item.querySelector(".desktop-play-saved-game-expand");
        if (expandBtn) {
            expandBtn.setAttribute(
                "aria-expanded",
                item.classList.contains("expanded") ? "true" : "false",
            );
        }
    }

    function formatSavedGameDate(date) {
        if (!date) {
            return "";
        }
        const d = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(d.getTime())) {
            return "";
        }
        return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
    }

    function formatSavedGameInfoTooltip(entry) {
        const parts = [];
        const when = formatSavedGameDate(entry && entry.date);
        if (when) {
            parts.push("Saved: " + when);
        }
        const players = formatSavedGamePlayers(entry);
        if (players) {
            parts.push(players);
        }
        const id = savedGameId(entry);
        if (id) {
            parts.push("Game ID: " + id);
        }
        return parts.join("\n");
    }

    function savedGameStateFromEntry(entry) {
        if (!entry) {
            return null;
        }
        let raw = entry.state != null ? entry.state : entry.gameState;
        if (raw == null) {
            return null;
        }
        if (typeof raw === "string") {
            try {
                return JSON.parse(raw);
            } catch {
                return null;
            }
        }
        if (typeof raw === "object") {
            return raw;
        }
        return null;
    }

    function savedGameTurnFromEntry(entry) {
        const gs = savedGameStateFromEntry(entry);
        if (!gs || (gs.turn !== "white" && gs.turn !== "black")) {
            return null;
        }
        return gs.turn;
    }

    function formatSavedGameTurn(entry) {
        const turn = savedGameTurnFromEntry(entry);
        if (!turn) {
            return "Next move: —";
        }
        return "Next move: " + (turn === "white" ? "White" : "Black");
    }

    const SAVED_GAME_ACTION_ICONS = {
        edit:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
        delete:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
        rename:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
        load:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>',
        expand:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>',
        info:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };

    function createSavedGameIconButton(title, iconKey, onClick) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "desktop-play-saved-game-icon-btn";
        btn.setAttribute("title", title);
        btn.setAttribute("aria-label", title);
        btn.innerHTML = SAVED_GAME_ACTION_ICONS[iconKey] || "";
        btn.addEventListener("click", function (ev) {
            ev.stopPropagation();
            onClick(ev);
        });
        return btn;
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
        const gamesDiv = $("gamesDiv");
        if (!gamesDiv) {
            return;
        }
        gamesDiv.querySelectorAll(".desktop-play-saved-game").forEach(function (el) {
            const id = el.dataset.bookmarkId;
            el.classList.toggle("is-selected", id != null && selectedSavedGameIds.has(id));
            el.setAttribute(
                "aria-selected",
                id != null && selectedSavedGameIds.has(id) ? "true" : "false",
            );
        });
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
                label: "Edit position",
                disabled: blocked,
                onClick: function () {
                    editSavedGame(bookmarkId);
                },
            },
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
        ];
        window.DesktopContextMenu.show(ev.clientX, ev.clientY, items);
    }

    function startRenameSavedGame(bookmarkId) {
        renamingSavedGameId = bookmarkId;
        expandedSavedGameId = bookmarkId;
        renderSavedGamesList();
        const gamesDiv = $("gamesDiv");
        if (!gamesDiv) {
            return;
        }
        const input = gamesDiv.querySelector(
            '.desktop-play-saved-game[data-bookmark-id="' +
                bookmarkId +
                '"] .desktop-play-saved-game-rename-input',
        );
        if (input) {
            input.focus();
            input.select();
        }
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
        try {
            const baseOpts = Settings.loadLastOptions();
            const raw = entry.state != null ? entry.state : entry.gameState;
            const stateStr =
                typeof raw === "string" ? raw : JSON.stringify(raw || {});
            const savedHumanIsWhite = savedStateHumanIsWhite(stateStr);
            const parsedMoves = parseSavedGameMoves(entry);
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
            headerEventMessage = null;
            headerEventKind = null;
            Board.clearArrows();
            Board.syncFromGameState();
            clearDisplayedEvaluation();
            if (game.GameState && game.GameState.capturedPiecesList) {
                Board.updateCaptureLists(game.GameState.capturedPiecesList);
            }
            initReviewNavigation(stateStr, parsedMoves, entry.originState);
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

    async function loadSavedGame(bookmarkId) {
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
            editingSavedGameId = null;
            setCurrentGameId(null);
            enterReviewMode();
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

    function createSavedGameItem(entry) {
        const id = savedGameId(entry);
        const div = document.createElement("div");
        div.className = "desktop-play-saved-game";
        if (isSavedPositionEntry(entry)) {
            div.classList.add("desktop-play-saved-position");
        }
        div.dataset.bookmarkId = id;
        if (expandedSavedGameId === id) {
            div.classList.add("expanded");
        }
        if (isSavedGameSelected(id)) {
            div.classList.add("is-selected");
        }
        div.setAttribute("aria-selected", isSavedGameSelected(id) ? "true" : "false");

        const row = document.createElement("div");
        row.className = "desktop-play-saved-game-row";
        row.setAttribute("role", "button");
        row.setAttribute("tabindex", "0");
        row.setAttribute(
            "aria-expanded",
            expandedSavedGameId === id ? "true" : "false",
        );
        row.addEventListener("click", function (ev) {
            handleSavedGameMultiSelectClick(ev, id);
        });

        if (renamingSavedGameId === id) {
            const renameInput = document.createElement("input");
            renameInput.type = "text";
            renameInput.className = "desktop-play-saved-game-rename-input";
            renameInput.value = entry.name || "Saved game";
            renameInput.setAttribute("aria-label", "Saved game name");
            renameInput.addEventListener("click", function (ev) {
                ev.stopPropagation();
            });
            renameInput.addEventListener("keydown", function (ev) {
                if (ev.key === "Enter") {
                    ev.preventDefault();
                    commitRenameSavedGame(id, renameInput.value);
                } else if (ev.key === "Escape") {
                    ev.preventDefault();
                    cancelRenameSavedGame();
                }
            });
            row.appendChild(renameInput);
        } else {
            const nameSpan = document.createElement("span");
            nameSpan.className = "desktop-play-saved-game-name";
            const label = entry.name || "Saved game";
            nameSpan.textContent = label;
            const when = formatSavedGameDate(entry.date);
            nameSpan.title = when ? label + " — " + when : label;
            nameSpan.setAttribute("role", "button");
            nameSpan.setAttribute("tabindex", "0");
            nameSpan.addEventListener("click", function (ev) {
                ev.stopPropagation();
                if (handleSavedGameMultiSelectClick(ev, id)) {
                    return;
                }
                clearSavedGameSelection();
                loadSavedGame(id);
            });
            nameSpan.addEventListener("keydown", function (ev) {
                if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (handleSavedGameMultiSelectClick(ev, id)) {
                        return;
                    }
                    clearSavedGameSelection();
                    loadSavedGame(id);
                }
            });
            row.appendChild(nameSpan);
        }

        const expandBtn = createSavedGameIconButton(
            "Show details",
            "expand",
            function () {
                toggleSavedGameExpanded(id);
            },
        );
        expandBtn.classList.add("desktop-play-saved-game-expand");
        expandBtn.setAttribute("aria-expanded", expandedSavedGameId === id ? "true" : "false");
        row.appendChild(expandBtn);
        div.appendChild(row);

        const details = document.createElement("div");
        details.className = "desktop-play-saved-game-details";

        const turnLine = document.createElement("div");
        turnLine.className = "desktop-play-saved-game-turn";
        turnLine.textContent = formatSavedGameTurn(entry);
        details.appendChild(turnLine);

        const meta = document.createElement("div");
        meta.className = "desktop-play-saved-game-meta";
        meta.textContent = formatSavedGameDate(entry.date);
        details.appendChild(meta);

        const playersLine = document.createElement("div");
        playersLine.className = "desktop-play-saved-game-players";
        playersLine.textContent = formatSavedGamePlayers(entry);
        details.appendChild(playersLine);

        const actions = document.createElement("div");
        actions.className = "desktop-play-saved-game-actions";
        const infoTooltip = formatSavedGameInfoTooltip(entry);
        if (infoTooltip) {
            const infoBtn = createSavedGameIconButton(infoTooltip, "info", function () {});
            infoBtn.setAttribute("aria-label", "Saved game details");
            actions.appendChild(infoBtn);
        }
        actions.appendChild(
            createSavedGameIconButton("Edit position", "edit", function () {
                editSavedGame(id);
            }),
        );
        actions.appendChild(
            createSavedGameIconButton("Delete saved game", "delete", function () {
                deleteSavedGame(id);
            }),
        );
        actions.appendChild(
            createSavedGameIconButton("Rename saved game", "rename", function () {
                startRenameSavedGame(id);
            }),
        );
        details.appendChild(actions);
        div.appendChild(details);

        div.addEventListener("contextmenu", function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            showSavedGameContextMenu(ev, entry, id);
        });

        return div;
    }

    function renderSavedGamesList() {
        const gamesDiv = $("gamesDiv");
        if (!gamesDiv) {
            return;
        }
        gamesDiv.innerHTML = "";
        const entries = savedEntriesForFilter(savedListFilter);
        if (!entries.length) {
            const empty = document.createElement("p");
            empty.className = "desktop-play-saved-list-empty";
            empty.textContent =
                savedListFilter === "positions"
                    ? "No saved positions yet."
                    : "No saved games yet.";
            gamesDiv.appendChild(empty);
            clearSavedGameSelection();
            return;
        }
        entries.forEach(function (entry) {
            gamesDiv.appendChild(createSavedGameItem(entry));
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
        movesDiv.innerHTML = "";
        const table = document.createElement("table");
        table.className = "movesTable";
        const displayMoves = appendGameResultToMoves(moves != null ? moves : []);
        const reviewClicksEnabled = reviewMode && reviewFullMoves.length > 0;
        const rows = reviewClicksEnabled
            ? buildMoveTableCells(displayMoves)
            : buildMoveTableRows(displayMoves).map(function (row, index) {
                  return {
                      num: index + 1,
                      white: row.white,
                      black: row.black,
                      whitePly: null,
                      blackPly: null,
                  };
              });
        for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            const tr = document.createElement("tr");
            const tdNum = document.createElement("td");
            tdNum.textContent = String(row.num);
            tdNum.className = "tdNum";
            const tdWhite = document.createElement("td");
            tdWhite.className = "tdMove";
            setCellLabel(tdWhite, row.white);
            const tdBlack = document.createElement("td");
            tdBlack.className = "tdMove";
            setCellLabel(tdBlack, row.black);
            if (reviewClicksEnabled) {
                attachReviewMoveCell(tdWhite, row.whitePly);
                attachReviewMoveCell(tdBlack, row.blackPly);
            }
            tr.appendChild(tdNum);
            tr.appendChild(tdWhite);
            tr.appendChild(tdBlack);
            table.appendChild(tr);
        }
        movesDiv.appendChild(table);
        highlightReviewMoveSelection();
        movesDiv.scrollTop = movesDiv.scrollHeight;
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
        }
        if (positionSetupMode || loadingBookmark) {
            return;
        }
        if (reviewMode) {
            refreshReviewMovesTable();
        } else {
            updateMovesTable(tableMovesFromGame());
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
    }

    function onCheck(turn) {
        alertMode = true;
        showStatus("Check", 2000, "check");
    }

    function onCheckmate(matedTurn) {
        alertMode = true;
        const winner = game.opponent(matedTurn);
        showStatus("Checkmate — " + game.colorName(winner) + " wins", 0, "checkmate");
        if (whiteHandle) {
            clearInterval(whiteHandle);
        }
        if (blackHandle) {
            clearInterval(blackHandle);
        }
        updateActionButtons();
        tryLogCompletedGame();
    }

    function onDraw(reason) {
        alertMode = true;
        showStatus("Draw — " + reason, 0, "draw");
        Board.applyDrawHighlight();
        if (whiteHandle) {
            clearInterval(whiteHandle);
        }
        if (blackHandle) {
            clearInterval(blackHandle);
        }
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

    function stopGameClocks() {
        if (whiteHandle) {
            clearInterval(whiteHandle);
            whiteHandle = null;
        }
        if (blackHandle) {
            clearInterval(blackHandle);
            blackHandle = null;
        }
    }

    function abortEngineSearch() {
        if (Engine && typeof Engine.abortSearch === "function") {
            Engine.abortSearch();
        }
        engineThinking = false;
        animating = false;
    }

    function isSearchAbortedError(err) {
        return !!(err && (err.name === "SearchAbortedError" || err.message === "Search aborted"));
    }

    function resignStatusMessage(resignedColor) {
        const isWhite = String(resignedColor).toLowerCase() === "white";
        const name = session
            ? (isWhite ? session.whitePlayerName : session.blackPlayerName) || (isWhite ? "White" : "Black")
            : (isWhite ? "White" : "Black");
        return "Game over. " + name + " resign.";
    }

    function finishResignGame(resignedColor) {
        alertMode = true;
        stopGameClocks();
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
            !game ||
            !session ||
            !Engine ||
            game.GameOver ||
            !isAiTurn() ||
            positionSetupMode ||
            configurationMode
        ) {
            return;
        }
        if (animating || engineThinking || dialogOn) {
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
            const move = await Engine.computeMove({
                gameState: game.GameState,
                moves: tableMovesFromGame(),
                engine: session.engine,
                thinkingTimeSeconds: session.thinkingTimeSeconds != null
                    ? session.thinkingTimeSeconds
                    : session.difficulty,
                pliesPlayed: game.Moves ? game.Moves.length : 0,
                immediateResign: Settings.loadGamePreferences().immediateResign === true,
            });
            if (game.GameOver) {
                return;
            }
            if (move && move.searchAborted) {
                return;
            }
            if (move && move.opponentMateDetected) {
                const mateNote =
                    move.opponentMateIn != null && Number.isFinite(move.opponentMateIn)
                        ? ` (mate in ${move.opponentMateIn})`
                        : "";
                console.log("[Shmerling] Engine detected forced loss" + mateNote);
                if (Settings.loadGamePreferences().immediateResign) {
                    engineThinking = false;
                    updateActionButtons();
                    engineResignFromLostPosition();
                    return;
                }
            }
            if (!move) {
                showStatus("Engine could not find a move", 0, "error");
                return;
            }
            if (move.score != null && Number.isFinite(move.score)) {
                console.log(
                    "[Shmerling] Engine move score:",
                    move.score,
                    move.searchDepthReached != null ? `(depth ${move.searchDepthReached})` : "",
                );
            }
            if (move.promotion && move.selectedPiece == null) {
                move.selectedPiece = game.QUEEN;
            }
            engineThinking = false;
            animating = true;
            updateActionButtons();
            const applied = await applyEngineMove(move);
            if (!applied) {
                showStatus("Engine move could not be applied", 0, "error");
                return;
            }
            switchClocks();
            if (isHumanTurn()) {
                showStatus("", 0, "info");
            }
        } catch (err) {
            if (isSearchAbortedError(err) || game.GameOver) {
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

    async function beginNewGame(opts) {
        applySessionSettings(opts);
        assignNewGameId();
        gameHistoryLogged = false;
        gameAutoBookmarked = false;
        game.startNewGame(currentPlayerIsWhite);
        reviewOriginStateStr = JSON.stringify(game.GameState);
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
        document.body.classList.add("desktop-play-has-active-game");
        if (Board.setHumanPlayEnabled) {
            Board.setHumanPlayEnabled(true);
        }
        lastLoadedSavedGameId = null;
        editingSavedGameId = null;
        updateActionButtons();
        syncGameRunPanelOptions();
        updateGameRunPanelVisibility();
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
        const opponentMove =
            (currentPlayerIsWhite && turn === "black") ||
            (!currentPlayerIsWhite && turn === "white");
        if (opponentMove || autoCompletePromotion) {
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
            resetToIdleScreen();
            return;
        }
        if (!gameActive) {
            resetToIdleScreen();
            return;
        }
        const humanHasMoved = currentPlayerIsWhite
            ? game.Moves.length >= 1
            : game.Moves.length >= 2;
        if (!humanHasMoved) {
            resetToIdleScreen();
            return;
        }
        confirmDialog("Leave game?", "Your game will be resigned.", function () {
            const player = currentPlayerIsWhite ? "White" : "Black";
            game.resign(player);
            abortEngineSearch();
            tryLogCompletedGame();
            resetToIdleScreen();
        });
    }

    function resetToIdleScreen() {
        if (configurationMode) {
            setConfigurationUi(false);
        }
        if (positionSetupMode) {
            Board.setSetupMode(false);
            setPositionSetupUi(false);
        }
        exitReviewMode();
        gameActive = false;
        positionSetupSnapshot = null;
        document.body.classList.remove("desktop-play-has-active-game");
        if (whiteHandle) {
            clearInterval(whiteHandle);
            whiteHandle = null;
        }
        if (blackHandle) {
            clearInterval(blackHandle);
            blackHandle = null;
        }
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
        showStatus("Choose New game or Position setup from the sidebar", 0, "info");
        playSessionReady = true;
        updateActionButtons();
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
        buildActionRail();
        startSession().catch(function (err) {
            showStatus(err.message || "Could not load game", 0, "error");
            console.error(err);
        });
    });
})();
