/**
 * Play / turn / computer-side controls for starting games from setup or saved entries.
 */
(function (global) {
    "use strict";

    function t(key, params) {
        if (global.ShmerlingStrings && typeof global.ShmerlingStrings.t === "function") {
            return global.ShmerlingStrings.t(key, params);
        }
        return key;
    }

    const SVG_PLAY =
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polygon points=\"8 5 19 12 8 19 8 5\"/></svg>";

    let floatingShellEl = null;
    let floatingDragState = null;
    let floatingBound = false;
    const FLOATING_POS_KEY = "shmerling.desktop.gameRunPanelPos.v4";
    let floatingUserMoved = false;
    let runTurn = "white";
    let runComputerIsWhite = false;
    let runThinkingTimeSeconds = 10;
    let runEngine = "brain43";
    let onPlay = null;
    let onTurnChange = null;
    let onComputerColorChange = null;
    let onThinkingTimeChange = null;
    let onEngineChange = null;
    let turnSwatchWhite = null;
    let turnSwatchBlack = null;
    let computerSwatchWhite = null;
    let computerSwatchBlack = null;
    let thinkingTimeSelect = null;
    let engineSelect = null;
    const DEFAULT_THINKING_TIME_OPTIONS = [2, 5, 10, 15, 20, 30, 60, 120];
    const DEFAULT_ENGINE_OPTIONS = [
        { value: "brain43", label: t("play.newGameDialog.brain43") },
        { value: "brain42", label: t("play.newGameDialog.brain42") },
        { value: "brain41", label: t("play.newGameDialog.brain41") },
    ];

    function updateSwatchPair(whiteBtn, blackBtn, isWhiteSelected) {
        if (whiteBtn) {
            whiteBtn.classList.toggle("selected", isWhiteSelected);
            whiteBtn.setAttribute("aria-pressed", isWhiteSelected ? "true" : "false");
        }
        if (blackBtn) {
            blackBtn.classList.toggle("selected", !isWhiteSelected);
            blackBtn.setAttribute("aria-pressed", !isWhiteSelected ? "true" : "false");
        }
    }

    function appendSwatchSelectionDot(btn) {
        const dot = document.createElement("span");
        dot.className = "desktop-play-game-run-swatch-dot";
        dot.setAttribute("aria-hidden", "true");
        btn.appendChild(dot);
    }

    function createSwatchToggle(labelText, initialWhite, onPick, btnOut) {
        const row = document.createElement("div");
        row.className = "desktop-play-game-run-row";

        const label = document.createElement("span");
        label.className = "desktop-play-game-run-label";
        label.textContent = labelText;
        row.appendChild(label);

        const group = document.createElement("div");
        group.className = "desktop-play-game-run-swatch-group";
        group.setAttribute("role", "group");
        group.setAttribute("aria-label", labelText);

        const whiteBtn = document.createElement("button");
        whiteBtn.type = "button";
        whiteBtn.className =
            "desktop-play-game-run-swatch desktop-play-game-run-swatch--white";
        whiteBtn.title = t("common.white");
        whiteBtn.setAttribute("aria-label", t("common.white"));
        appendSwatchSelectionDot(whiteBtn);
        whiteBtn.addEventListener("click", function () {
            onPick(true);
        });

        const blackBtn = document.createElement("button");
        blackBtn.type = "button";
        blackBtn.className =
            "desktop-play-game-run-swatch desktop-play-game-run-swatch--black";
        blackBtn.title = t("common.black");
        blackBtn.setAttribute("aria-label", t("common.black"));
        appendSwatchSelectionDot(blackBtn);
        blackBtn.addEventListener("click", function () {
            onPick(false);
        });

        group.appendChild(whiteBtn);
        group.appendChild(blackBtn);
        row.appendChild(group);

        if (btnOut) {
            btnOut.white = whiteBtn;
            btnOut.black = blackBtn;
        }

        updateSwatchPair(whiteBtn, blackBtn, initialWhite);
        return row;
    }

    function setTurnSelection(turn) {
        runTurn = turn === "black" ? "black" : "white";
        updateSwatchPair(turnSwatchWhite, turnSwatchBlack, runTurn === "white");
    }

    function setComputerColorSelection(isWhite) {
        runComputerIsWhite = !!isWhite;
        updateSwatchPair(
            computerSwatchWhite,
            computerSwatchBlack,
            runComputerIsWhite,
        );
    }

    function resolveInitialComputerIsWhite(options) {
        if (typeof options.initialComputerIsWhite === "boolean") {
            return options.initialComputerIsWhite;
        }
        if (typeof options.initialHumanIsWhite === "boolean") {
            return !options.initialHumanIsWhite;
        }
        return false;
    }

    function thinkingTimeOptionsList() {
        const settings = global.DesktopGameSettings;
        if (settings && Array.isArray(settings.THINKING_TIME_OPTIONS) && settings.THINKING_TIME_OPTIONS.length) {
            return settings.THINKING_TIME_OPTIONS;
        }
        return DEFAULT_THINKING_TIME_OPTIONS;
    }

    function normalizeThinkingTimeSeconds(value) {
        const settings = global.DesktopGameSettings;
        if (settings && settings.normalizeThinkingTimeSeconds) {
            return settings.normalizeThinkingTimeSeconds(value);
        }
        const parsed = parseInt(value, 10);
        if (!Number.isFinite(parsed)) {
            return 10;
        }
        const options = thinkingTimeOptionsList();
        if (options.indexOf(parsed) !== -1) {
            return parsed;
        }
        return 10;
    }

    function setThinkingTimeSelection(seconds) {
        runThinkingTimeSeconds = normalizeThinkingTimeSeconds(seconds);
        if (thinkingTimeSelect) {
            thinkingTimeSelect.value = String(runThinkingTimeSeconds);
        }
    }

    /** @deprecated use setThinkingTimeSelection */
    function setDepthSelection(depth) {
        setThinkingTimeSelection(depth);
    }

    function engineOptionsList() {
        const settings = global.DesktopGameSettings;
        if (settings && Array.isArray(settings.ENGINE_OPTIONS) && settings.ENGINE_OPTIONS.length) {
            return settings.ENGINE_OPTIONS;
        }
        return DEFAULT_ENGINE_OPTIONS;
    }

    function normalizeEngine(engine) {
        const settings = global.DesktopGameSettings;
        if (settings && settings.normalizeEngine) {
            return settings.normalizeEngine(engine);
        }
        const allowed = engineOptionsList().map(function (o) {
            return o.value;
        });
        return allowed.indexOf(engine) !== -1 ? engine : "brain43";
    }

    function setEngineSelection(engine) {
        runEngine = normalizeEngine(engine);
        if (engineSelect) {
            engineSelect.value = runEngine;
        }
    }

    function createEngineRow(initialEngine) {
        const row = document.createElement("div");
        row.className = "desktop-play-game-run-row desktop-play-game-run-engine-row";

        const label = document.createElement("span");
        label.className = "desktop-play-game-run-label";
        label.textContent = t("desktop.gameRun.engine");
        row.appendChild(label);

        const select = document.createElement("select");
        select.className = "desktop-play-game-run-select desktop-play-game-run-engine";
        select.setAttribute("aria-label", t("desktop.gameRun.engine"));
        engineOptionsList().forEach(function (opt) {
            const option = document.createElement("option");
            option.value = opt.value;
            option.textContent = opt.label;
            select.appendChild(option);
        });
        setEngineSelection(initialEngine);
        select.value = runEngine;
        select.addEventListener("change", function () {
            setEngineSelection(select.value);
            if (onEngineChange) {
                onEngineChange(runEngine);
            }
        });
        engineSelect = select;
        row.appendChild(select);
        return row;
    }

    function createThinkingTimeRow(initialSeconds) {
        const row = document.createElement("div");
        row.className = "desktop-play-game-run-row desktop-play-game-run-thinking-time-row";

        const label = document.createElement("span");
        label.className = "desktop-play-game-run-label";
        label.textContent = t("desktop.gameRun.thinkTime");
        row.appendChild(label);

        const select = document.createElement("select");
        select.className = "desktop-play-game-run-select desktop-play-game-run-thinking-time";
        select.setAttribute("aria-label", t("desktop.gameRun.thinkTimeAria"));
        thinkingTimeOptionsList().forEach(function (seconds) {
            const opt = document.createElement("option");
            opt.value = String(seconds);
            opt.textContent = String(seconds);
            select.appendChild(opt);
        });
        setThinkingTimeSelection(initialSeconds);
        select.value = String(runThinkingTimeSeconds);
        select.addEventListener("change", function () {
            setThinkingTimeSelection(select.value);
            if (onThinkingTimeChange) {
                onThinkingTimeChange(runThinkingTimeSeconds);
            }
        });
        thinkingTimeSelect = select;
        row.appendChild(select);
        return row;
    }

    function resolveInitialThinkingTime(options) {
        if (options.initialThinkingTimeSeconds != null) {
            return options.initialThinkingTimeSeconds;
        }
        if (options.initialDepth != null) {
            return options.initialDepth;
        }
        if (options.initialDifficulty != null) {
            return options.initialDifficulty;
        }
        return 6;
    }

    function resolveInitialEngine(options) {
        if (options.initialEngine) {
            return options.initialEngine;
        }
        return "brain43";
    }

    function saveFloatingPosition() {
        if (!floatingShellEl) {
            return;
        }
        const rect = floatingShellEl.getBoundingClientRect();
        try {
            localStorage.setItem(
                FLOATING_POS_KEY,
                JSON.stringify({ left: rect.left, top: rect.top }),
            );
            floatingUserMoved = true;
        } catch {
            /* ignore quota / private mode */
        }
    }

    function defaultFloatingTop() {
        const topbar = parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue("--desktop-topbar-height"),
        );
        const header = parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue("--desktop-play-header-height"),
        );
        const topbarPx = Number.isFinite(topbar) ? topbar : 51;
        const headerPx = Number.isFinite(header) ? header : 64;
        return topbarPx + headerPx + 12;
    }

    function readSavedFloatingPosition() {
        try {
            const raw = localStorage.getItem(FLOATING_POS_KEY);
            if (!raw) {
                return null;
            }
            const pos = JSON.parse(raw);
            if (typeof pos.left === "number" && typeof pos.top === "number") {
                return pos;
            }
        } catch {
            /* ignore */
        }
        return null;
    }

    /**
     * Snap so the Start-game panel's right edge meets the Games/Positions
     * dock's left edge (panel sits just left of that column).
     */
    function placeDefaultBesideGamesPanel() {
        if (!floatingShellEl) {
            return;
        }
        const sidebar = document.getElementById("desktopPlaySidebarGames");
        let dockLeft = window.innerWidth;
        if (sidebar) {
            const rect = sidebar.getBoundingClientRect();
            if (rect.width > 8) {
                dockLeft = rect.left;
            } else {
                const page = document.querySelector(".desktop-play-page") || document.documentElement;
                const raw = getComputedStyle(page).getPropertyValue("--desktop-play-sidebar-width");
                const sidebarW = parseFloat(raw);
                dockLeft = window.innerWidth - (Number.isFinite(sidebarW) && sidebarW > 0 ? sidebarW : 220);
            }
        } else {
            const page = document.querySelector(".desktop-play-page") || document.documentElement;
            const raw = getComputedStyle(page).getPropertyValue("--desktop-play-sidebar-width");
            const sidebarW = parseFloat(raw);
            dockLeft = window.innerWidth - (Number.isFinite(sidebarW) && sidebarW > 0 ? sidebarW : 220);
        }
        const width = Math.max(floatingShellEl.offsetWidth || 0, floatingShellEl.scrollWidth || 0, 216);
        const next = clampFloatingPosition(dockLeft - width, defaultFloatingTop());
        floatingShellEl.style.left = next.left + "px";
        floatingShellEl.style.top = next.top + "px";
        floatingShellEl.style.right = "auto";
        floatingShellEl.style.bottom = "auto";
    }

    function applyFloatingPosition(pos) {
        if (!floatingShellEl || !pos) {
            return;
        }
        const next = clampFloatingPosition(pos.left, pos.top);
        floatingShellEl.style.left = next.left + "px";
        floatingShellEl.style.top = next.top + "px";
        floatingShellEl.style.right = "auto";
        floatingShellEl.style.bottom = "auto";
    }

    function restoreFloatingPosition() {
        if (!floatingShellEl) {
            return;
        }
        const saved = readSavedFloatingPosition();
        if (saved) {
            floatingUserMoved = true;
            applyFloatingPosition(saved);
            return;
        }
        floatingUserMoved = false;
        /* Defer until visible so width/sidebar rects are accurate. */
    }

    /**
     * After the panel is shown, snap to the Games dock unless the user dragged it.
     */
    function ensureFloatingPlacement() {
        if (!floatingShellEl || floatingShellEl.classList.contains("desktop-play-header-run--hidden")) {
            return;
        }
        const place = function () {
            if (floatingUserMoved || readSavedFloatingPosition()) {
                const saved = readSavedFloatingPosition();
                if (saved) {
                    applyFloatingPosition(saved);
                }
                return;
            }
            placeDefaultBesideGamesPanel();
        };
        requestAnimationFrame(function () {
            requestAnimationFrame(place);
        });
    }

    function clampFloatingPosition(left, top) {
        const width = floatingShellEl.offsetWidth || 216;
        const height = floatingShellEl.offsetHeight || 200;
        const maxL = Math.max(8, window.innerWidth - width - 8);
        const maxT = Math.max(8, window.innerHeight - height - 8);
        return {
            left: Math.max(8, Math.min(maxL, left)),
            top: Math.max(8, Math.min(maxT, top)),
        };
    }

    function startFloatingDrag(e) {
        if (e.button !== 0 || !floatingShellEl) {
            return;
        }
        const rect = floatingShellEl.getBoundingClientRect();
        floatingDragState = {
            startX: e.clientX,
            startY: e.clientY,
            left: rect.left,
            top: rect.top,
        };
        floatingShellEl.classList.add("is-dragging");
        e.preventDefault();
    }

    function onFloatingDrag(e) {
        if (!floatingDragState || !floatingShellEl) {
            return;
        }
        const next = clampFloatingPosition(
            floatingDragState.left + (e.clientX - floatingDragState.startX),
            floatingDragState.top + (e.clientY - floatingDragState.startY),
        );
        floatingShellEl.style.left = next.left + "px";
        floatingShellEl.style.top = next.top + "px";
        floatingShellEl.style.right = "auto";
        floatingShellEl.style.bottom = "auto";
    }

    function endFloatingDrag() {
        if (!floatingDragState || !floatingShellEl) {
            return;
        }
        floatingDragState = null;
        floatingShellEl.classList.remove("is-dragging");
        saveFloatingPosition();
    }

    /**
     * Make the Game Run shell a movable floating panel (drag via [data-drag-handle]).
     * @param {HTMLElement|null} shellEl
     */
    function bindFloatingShell(shellEl) {
        if (!shellEl || floatingBound) {
            return;
        }
        floatingShellEl = shellEl;
        floatingBound = true;
        restoreFloatingPosition();

        const handle = shellEl.querySelector("[data-drag-handle]");
        if (handle) {
            handle.addEventListener("mousedown", startFloatingDrag);
        }
        document.addEventListener("mousemove", onFloatingDrag);
        document.addEventListener("mouseup", endFloatingDrag);
        window.addEventListener("resize", function () {
            if (!floatingShellEl || floatingShellEl.classList.contains("desktop-play-header-run--hidden")) {
                return;
            }
            if (!floatingUserMoved && !readSavedFloatingPosition()) {
                placeDefaultBesideGamesPanel();
                return;
            }
            const rect = floatingShellEl.getBoundingClientRect();
            const next = clampFloatingPosition(rect.left, rect.top);
            floatingShellEl.style.left = next.left + "px";
            floatingShellEl.style.top = next.top + "px";
            floatingShellEl.style.right = "auto";
            floatingShellEl.style.bottom = "auto";
        });
    }

    function mount(container, options) {
        options = options || {};
        onPlay = options.onPlay || null;
        onTurnChange = options.onTurnChange || null;
        onComputerColorChange =
            options.onComputerColorChange || options.onHumanColorChange || null;
        onThinkingTimeChange = options.onThinkingTimeChange || options.onDepthChange || null;
        onEngineChange = options.onEngineChange || null;
        runTurn =
            options.initialTurn === "black" || options.initialTurn === "white"
                ? options.initialTurn
                : "white";
        runComputerIsWhite = resolveInitialComputerIsWhite(options);
        runThinkingTimeSeconds = normalizeThinkingTimeSeconds(resolveInitialThinkingTime(options));
        runEngine = normalizeEngine(resolveInitialEngine(options));
        thinkingTimeSelect = null;
        engineSelect = null;

        container.innerHTML = "";
        container.className = "desktop-play-game-run";

        const controls = document.createElement("div");
        controls.className = "desktop-play-game-run-controls";

        const turnBtns = {};
        controls.appendChild(
            createSwatchToggle(
                t("desktop.gameRun.nextMove"),
                runTurn === "white",
                function (isWhite) {
                    const next = isWhite ? "white" : "black";
                    setTurnSelection(next);
                    if (onTurnChange) {
                        onTurnChange(next);
                    }
                },
                turnBtns,
            ),
        );
        turnSwatchWhite = turnBtns.white;
        turnSwatchBlack = turnBtns.black;

        const computerBtns = {};
        const computerRow = createSwatchToggle(
            t("desktop.gameRun.computer"),
            runComputerIsWhite,
            function (isWhite) {
                setComputerColorSelection(isWhite);
                if (onComputerColorChange) {
                    onComputerColorChange(isWhite);
                }
            },
            computerBtns,
        );
        computerRow.setAttribute(
            "title",
            t("desktop.gameRun.computerColorHint"),
        );
        controls.appendChild(computerRow);
        computerSwatchWhite = computerBtns.white;
        computerSwatchBlack = computerBtns.black;

        controls.appendChild(createEngineRow(runEngine));
        controls.appendChild(createThinkingTimeRow(runThinkingTimeSeconds));

        container.appendChild(controls);

        const actions = document.createElement("div");
        actions.className = "desktop-play-game-run-actions";

        const playBtn = document.createElement("button");
        playBtn.type = "button";
        playBtn.className = "desktop-play-game-run-play";
        playBtn.setAttribute("title", t("desktop.gameRun.play"));
        playBtn.setAttribute("aria-label", t("desktop.gameRun.play"));
        playBtn.innerHTML = SVG_PLAY;
        playBtn.addEventListener("click", function () {
            if (onPlay) {
                onPlay();
            }
        });

        actions.appendChild(playBtn);
        container.appendChild(actions);
    }

    function syncOptions(opts) {
        opts = opts || {};
        if (opts.turn === "black" || opts.turn === "white") {
            setTurnSelection(opts.turn);
        }
        if (typeof opts.computerIsWhite === "boolean") {
            setComputerColorSelection(opts.computerIsWhite);
        } else if (typeof opts.humanIsWhite === "boolean") {
            setComputerColorSelection(!opts.humanIsWhite);
        }
        if (opts.thinkingTimeSeconds != null) {
            setThinkingTimeSelection(opts.thinkingTimeSeconds);
        } else if (opts.depth != null) {
            setThinkingTimeSelection(opts.depth);
        } else if (opts.difficulty != null) {
            setThinkingTimeSelection(opts.difficulty);
        }
        if (opts.engine != null) {
            setEngineSelection(opts.engine);
        }
    }

    function getOptions() {
        return {
            turn: runTurn,
            computerIsWhite: runComputerIsWhite,
            humanIsWhite: !runComputerIsWhite,
            engine: runEngine,
            thinkingTimeSeconds: runThinkingTimeSeconds,
            depth: runThinkingTimeSeconds,
            difficulty: runThinkingTimeSeconds,
        };
    }

    global.DesktopGameRun = {
        mount: mount,
        bindFloatingShell: bindFloatingShell,
        ensureFloatingPlacement: ensureFloatingPlacement,
        getOptions: getOptions,
        syncOptions: syncOptions,
        setTurnSelection: setTurnSelection,
        setComputerColorSelection: setComputerColorSelection,
        setThinkingTimeSelection: setThinkingTimeSelection,
        setDepthSelection: setDepthSelection,
        setEngineSelection: setEngineSelection,
        createSwatchRow: createSwatchToggle,
        updateSwatchPair: updateSwatchPair,
    };
})(window);
