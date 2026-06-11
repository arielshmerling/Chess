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
    let runDepth = 3;
    let onPlay = null;
    let onDisplayEvaluation = null;
    let onTurnChange = null;
    let onComputerColorChange = null;
    let onDepthChange = null;
    let turnSwatchWhite = null;
    let turnSwatchBlack = null;
    let computerSwatchWhite = null;
    let computerSwatchBlack = null;
    let depthSelect = null;
    const MAX_SEARCH_DEPTH = 6;
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

    function clampDepth(depth) {
        const parsed = parseInt(depth, 10);
        if (!Number.isFinite(parsed)) {
            return 3;
        }
        return Math.min(MAX_SEARCH_DEPTH, Math.max(1, parsed));
    }

    function setDepthSelection(depth) {
        runDepth = clampDepth(depth);
        if (depthSelect) {
            depthSelect.value = String(runDepth);
        }
    }

    function createDepthRow(initialDepth) {
        const row = document.createElement("div");
        row.className = "desktop-play-game-run-row desktop-play-game-run-depth-row";

        const label = document.createElement("span");
        label.className = "desktop-play-game-run-label";
        label.textContent = "Depth";
        row.appendChild(label);

        const select = document.createElement("select");
        select.className = "desktop-play-game-run-depth";
        select.setAttribute("aria-label", "Search depth");
        for (let i = 1; i <= MAX_SEARCH_DEPTH; i += 1) {
            const opt = document.createElement("option");
            opt.value = String(i);
            opt.textContent = String(i);
            select.appendChild(opt);
        }
        setDepthSelection(initialDepth);
        select.value = String(runDepth);
        select.addEventListener("change", function () {
            setDepthSelection(select.value);
            if (onDepthChange) {
                onDepthChange(runDepth);
            }
        });
        depthSelect = select;
        row.appendChild(select);
        return row;
    }

    function resolveInitialDepth(options) {
        if (options.initialDepth != null) {
            return options.initialDepth;
        }
        if (options.initialDifficulty != null) {
            return options.initialDifficulty;
        }
        return 3;
    }

    function mount(container, options) {
        options = options || {};
        onPlay = options.onPlay || null;
        onDisplayEvaluation = options.onDisplayEvaluation || null;
        onTurnChange = options.onTurnChange || null;
        onComputerColorChange =
            options.onComputerColorChange || options.onHumanColorChange || null;
        onDepthChange = options.onDepthChange || null;
        runTurn =
            options.initialTurn === "black" || options.initialTurn === "white"
                ? options.initialTurn
                : "white";
        runComputerIsWhite = resolveInitialComputerIsWhite(options);
        runDepth = clampDepth(resolveInitialDepth(options));
        depthSelect = null;

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

        controls.appendChild(createDepthRow(runDepth));

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
        if (opts.depth != null) {
            setDepthSelection(opts.depth);
        } else if (opts.difficulty != null) {
            setDepthSelection(opts.difficulty);
        }
    }

    function getOptions() {
        return {
            turn: runTurn,
            computerIsWhite: runComputerIsWhite,
            humanIsWhite: !runComputerIsWhite,
            depth: runDepth,
            difficulty: runDepth,
        };
    }

    global.DesktopGameRun = {
        mount: mount,
        getOptions: getOptions,
        syncOptions: syncOptions,
        setTurnSelection: setTurnSelection,
        setComputerColorSelection: setComputerColorSelection,
        setDepthSelection: setDepthSelection,
        createSwatchRow: createSwatchToggle,
        updateSwatchPair: updateSwatchPair,
    };
})(window);
