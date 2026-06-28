/**
 * Play / turn / computer-side controls for starting games from setup or saved entries.
 */
(function (global) {
    "use strict";

    const SVG_PLAY =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="8 5 19 12 8 19 8 5"/></svg>';

    const SVG_EVAL =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 8h14"/><path d="M7 13h10"/></svg>';

    let panelRoot = null;
    let runTurn = "white";
    let runComputerIsWhite = false;
    let runThinkingTimeSeconds = 10;
    let runEngine = "brain42";
    let onPlay = null;
    let onDisplayEvaluation = null;
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
        { value: "brain43", label: "Brain 4.3" },
        { value: "brain42", label: "Brain 4.2" },
        { value: "brain41", label: "Brain 4.1" },
    ];
    const EVAL_BUTTON_DEFAULT_TITLE =
        "Display evaluation (Ctrl+E) — score each piece and show the total in the status bar";

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
        whiteBtn.title = "White";
        whiteBtn.setAttribute("aria-label", "White");
        appendSwatchSelectionDot(whiteBtn);
        whiteBtn.addEventListener("click", function () {
            onPick(true);
        });

        const blackBtn = document.createElement("button");
        blackBtn.type = "button";
        blackBtn.className =
            "desktop-play-game-run-swatch desktop-play-game-run-swatch--black";
        blackBtn.title = "Black";
        blackBtn.setAttribute("aria-label", "Black");
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
        return allowed.indexOf(engine) !== -1 ? engine : "brain42";
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
        label.textContent = "Engine";
        row.appendChild(label);

        const select = document.createElement("select");
        select.className = "desktop-play-game-run-select desktop-play-game-run-engine";
        select.setAttribute("aria-label", "Engine");
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
        label.textContent = "Think time (s)";
        row.appendChild(label);

        const select = document.createElement("select");
        select.className = "desktop-play-game-run-select desktop-play-game-run-thinking-time";
        select.setAttribute("aria-label", "Engine thinking time in seconds");
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
        return "brain42";
    }

    function mount(container, options) {
        options = options || {};
        onPlay = options.onPlay || null;
        onDisplayEvaluation = options.onDisplayEvaluation || null;
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
        panelRoot = container;
        container.className = "desktop-play-game-run";

        const controls = document.createElement("div");
        controls.className = "desktop-play-game-run-controls";

        const turnBtns = {};
        controls.appendChild(
            createSwatchToggle(
                "Next Move",
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
            "Computer",
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
            "Which color the computer plays — you play the other side",
        );
        controls.appendChild(computerRow);
        computerSwatchWhite = computerBtns.white;
        computerSwatchBlack = computerBtns.black;

        controls.appendChild(createEngineRow(runEngine));
        controls.appendChild(createThinkingTimeRow(runThinkingTimeSeconds));

        container.appendChild(controls);

        const actions = document.createElement("div");
        actions.className = "desktop-play-game-run-actions";

        const evalBtn = document.createElement("button");
        evalBtn.type = "button";
        evalBtn.className = "desktop-play-game-run-eval";
        evalBtn.setAttribute(
            "title",
            EVAL_BUTTON_DEFAULT_TITLE,
        );
        evalBtn.setAttribute("aria-label", "Display evaluation");
        evalBtn.innerHTML = SVG_EVAL;
        evalBtn.addEventListener("click", function () {
            if (onDisplayEvaluation) {
                onDisplayEvaluation();
            }
        });

        const playBtn = document.createElement("button");
        playBtn.type = "button";
        playBtn.className = "desktop-play-game-run-play";
        playBtn.setAttribute("title", "Play");
        playBtn.setAttribute("aria-label", "Play");
        playBtn.innerHTML = SVG_PLAY;
        playBtn.addEventListener("click", function () {
            if (onPlay) {
                onPlay();
            }
        });

        actions.appendChild(evalBtn);
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
