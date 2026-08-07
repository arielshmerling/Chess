/**
 * Chess piece set registry and active-set persistence.
 * Piece type index order matches ChessGame: pawn, king, knight, bishop, rook, queen.
 */
(function (global) {
    "use strict";

    const STORAGE_KEY = "shmerling.pieceSet";
    const DEFAULT_SET_ID = "imperishable-army";

    const PIECE_FILES = ["pawn", "king", "knight", "bishop", "rook", "queen"];

    const SETS = [
        { id: "obsidian-court", name: "Obsidian Court" },
        { id: "storm-ivory", name: "Storm Ivory" },
        { id: "ember-regalia", name: "Ember Regalia" },
        { id: "imperishable-army", name: "Imperishable Army" },
    ];

    function getSetById(setId) {
        for (let i = 0; i < SETS.length; i++) {
            if (SETS[i].id === setId) {
                return SETS[i];
            }
        }
        for (let i = 0; i < SETS.length; i++) {
            if (SETS[i].id === DEFAULT_SET_ID) {
                return SETS[i];
            }
        }
        return SETS[0];
    }

    function piecePath(setId, color, pieceType) {
        const file = PIECE_FILES[pieceType];
        if (!file) {
            return null;
        }
        return "/images/pieces/" + setId + "/" + color + "-" + file + ".png";
    }

    function getUrlsForSet(setId) {
        const id = getSetById(setId).id;
        const white = [];
        const black = [];
        for (let i = 0; i < PIECE_FILES.length; i++) {
            white.push(piecePath(id, "white", i));
            black.push(piecePath(id, "black", i));
        }
        return { white: white, black: black };
    }

    function isDesktopApp() {
        if (typeof window === "undefined" || !window.location) {
            return false;
        }
        return window.location.pathname.indexOf("/app") === 0;
    }

    function rememberActiveSetId(setId) {
        try {
            localStorage.setItem(STORAGE_KEY, setId);
        } catch {
            /* ignore */
        }
    }

    function persistPieceSetToServer(setId) {
        if (!isDesktopApp()) {
            return;
        }
        fetch("/app/api/ui-settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pieceSet: setId }),
        }).catch(function () {
            /* ignore */
        });
    }

    function getActiveSetId() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && getSetById(stored).id === stored) {
                return stored;
            }
        } catch {
            /* ignore */
        }
        return DEFAULT_SET_ID;
    }

    function notifyPieceSetChanged(setId) {
        if (typeof document === "undefined") {
            return;
        }
        document.dispatchEvent(
            new CustomEvent("shmerling-piece-set-changed", {
                detail: { setId: setId },
            })
        );
    }

    function setActiveSetId(setId) {
        const id = getSetById(setId).id;
        rememberActiveSetId(id);
        persistPieceSetToServer(id);
        notifyPieceSetChanged(id);
        return id;
    }

    function loadPieceSetFromServer() {
        if (!isDesktopApp()) {
            return Promise.resolve(null);
        }
        return fetch("/app/api/ui-settings")
            .then(function (res) {
                if (!res.ok) {
                    return null;
                }
                return res.json();
            })
            .then(function (data) {
                if (!data || !data.pieceSet) {
                    return null;
                }
                const id = getSetById(data.pieceSet).id;
                return id === data.pieceSet ? id : null;
            })
            .catch(function () {
                return null;
            });
    }

    let bootStarted = false;

    function bootActivePieceSet() {
        if (bootStarted || typeof document === "undefined") {
            return;
        }
        bootStarted = true;

        loadPieceSetFromServer().then(function (serverSetId) {
            const setId = serverSetId || getActiveSetId();
            rememberActiveSetId(setId);
            notifyPieceSetChanged(setId);
        });
    }

    function getActiveUrls() {
        return getUrlsForSet(getActiveSetId());
    }

    function renderPieceSetButtons(container) {
        if (!container) {
            return;
        }
        container.innerHTML = "";
        container.classList.add("desktop-prefs-gallery");

        const active = getActiveSetId();
        let selectedName = "";

        const status = document.createElement("div");
        status.className = "desktop-prefs-gallery-status";

        const grid = document.createElement("div");
        grid.className = "desktop-prefs-gallery-grid desktop-prefs-gallery-grid--pieces";
        grid.setAttribute("role", "group");

        SETS.forEach(function (set) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "desktop-piece-set-choice desktop-piece-set-choice--tile";
            btn.setAttribute("data-piece-set", set.id);
            btn.setAttribute("aria-label", set.name);
            btn.title = set.name;
            const isActive = set.id === active;
            btn.setAttribute("aria-pressed", isActive ? "true" : "false");
            if (isActive) {
                btn.classList.add("is-active");
                selectedName = set.name;
            }

            const preview = document.createElement("span");
            preview.className = "desktop-piece-set-preview desktop-piece-set-preview--board";
            preview.setAttribute("aria-hidden", "true");

            const board = document.createElement("span");
            board.className = "desktop-piece-set-preview-board";
            for (let i = 0; i < 4; i++) {
                const cell = document.createElement("span");
                const row = Math.floor(i / 2);
                const col = i % 2;
                cell.className =
                    "desktop-piece-set-preview-cell" +
                    ((row + col) % 2 === 0
                        ? " desktop-piece-set-preview-cell--light"
                        : " desktop-piece-set-preview-cell--dark");
                board.appendChild(cell);
            }

            const whiteKing = document.createElement("img");
            whiteKing.src = piecePath(set.id, "white", 1);
            whiteKing.alt = "";
            whiteKing.className = "desktop-piece-set-preview-piece desktop-piece-set-preview-piece--a";

            const blackQueen = document.createElement("img");
            blackQueen.src = piecePath(set.id, "black", 5);
            blackQueen.alt = "";
            blackQueen.className = "desktop-piece-set-preview-piece desktop-piece-set-preview-piece--b";

            preview.appendChild(board);
            preview.appendChild(whiteKing);
            preview.appendChild(blackQueen);
            btn.appendChild(preview);

            btn.addEventListener("click", function () {
                setActiveSetId(set.id);
                renderPieceSetButtons(container);
            });
            grid.appendChild(btn);
        });

        status.textContent = selectedName
            ? (global.ShmerlingStrings && typeof global.ShmerlingStrings.t === "function"
                ? global.ShmerlingStrings.t("desktop.prefs.selectedPieceSet", { name: selectedName })
                : "Selected: " + selectedName)
            : "";

        container.appendChild(status);
        container.appendChild(grid);
    }

    function syncPieceSetButtons(container) {
        if (!container) {
            return;
        }
        if (container.classList.contains("desktop-prefs-gallery")) {
            renderPieceSetButtons(container);
            return;
        }
        const active = getActiveSetId();
        container.querySelectorAll("[data-piece-set]").forEach(function (btn) {
            const id = btn.getAttribute("data-piece-set");
            const isActive = id === active;
            btn.setAttribute("aria-pressed", isActive ? "true" : "false");
            btn.classList.toggle("is-active", isActive);
        });
    }

    global.ShmerlingPieceSets = {
        SETS: SETS,
        DEFAULT_SET_ID: DEFAULT_SET_ID,
        getSetById: getSetById,
        getUrlsForSet: getUrlsForSet,
        getActiveSetId: getActiveSetId,
        setActiveSetId: setActiveSetId,
        getActiveUrls: getActiveUrls,
        renderPieceSetButtons: renderPieceSetButtons,
        syncPieceSetButtons: syncPieceSetButtons,
        bootActivePieceSet: bootActivePieceSet,
    };

    if (typeof document !== "undefined") {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", bootActivePieceSet);
        } else {
            bootActivePieceSet();
        }
    }
})(typeof window !== "undefined" ? window : global);
