/**
 * Chess piece set registry and active-set persistence.
 * Piece type index order matches ChessGame: pawn, king, knight, bishop, rook, queen.
 */
(function (global) {
    "use strict";

    const STORAGE_KEY = "shmerling.pieceSet";
    const DEFAULT_SET_ID = "obsidian-court";

    const PIECE_FILES = ["pawn", "king", "knight", "bishop", "rook", "queen"];

    const SETS = [
        { id: "obsidian-court", name: "Obsidian Court" },
        { id: "storm-ivory", name: "Storm Ivory" },
        { id: "ember-regalia", name: "Ember Regalia" },
    ];

    function getSetById(setId) {
        for (let i = 0; i < SETS.length; i++) {
            if (SETS[i].id === setId) {
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
        return "images/pieces/" + setId + "/" + color + "-" + file + ".png";
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

    function setActiveSetId(setId) {
        const id = getSetById(setId).id;
        try {
            localStorage.setItem(STORAGE_KEY, id);
        } catch {
            /* ignore */
        }
        document.dispatchEvent(
            new CustomEvent("shmerling-piece-set-changed", {
                detail: { setId: id },
            })
        );
        return id;
    }

    function getActiveUrls() {
        return getUrlsForSet(getActiveSetId());
    }

    function renderPieceSetButtons(container) {
        if (!container) {
            return;
        }
        container.innerHTML = "";
        const active = getActiveSetId();
        SETS.forEach(function (set) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "desktop-piece-set-choice";
            btn.setAttribute("data-piece-set", set.id);
            btn.setAttribute("aria-pressed", set.id === active ? "true" : "false");
            if (set.id === active) {
                btn.classList.add("is-active");
            }

            const preview = document.createElement("span");
            preview.className = "desktop-piece-set-preview";
            preview.setAttribute("aria-hidden", "true");

            const whitePawn = document.createElement("img");
            whitePawn.src = piecePath(set.id, "white", 0);
            whitePawn.alt = "";
            whitePawn.width = 22;
            whitePawn.height = 22;

            const blackKnight = document.createElement("img");
            blackKnight.src = piecePath(set.id, "black", 2);
            blackKnight.alt = "";
            blackKnight.width = 22;
            blackKnight.height = 22;

            preview.appendChild(whitePawn);
            preview.appendChild(blackKnight);

            const name = document.createElement("span");
            name.className = "desktop-piece-set-name";
            name.textContent = set.name;

            btn.appendChild(preview);
            btn.appendChild(name);
            btn.addEventListener("click", function () {
                setActiveSetId(set.id);
                syncPieceSetButtons(container);
            });
            container.appendChild(btn);
        });
    }

    function syncPieceSetButtons(container) {
        if (!container) {
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
    };
})(typeof window !== "undefined" ? window : global);
