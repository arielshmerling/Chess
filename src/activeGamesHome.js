/**
 * Home page: up to 3 active game cards (full highlight layout with mini-board each).
 */
(function () {
    "use strict";

    var WHITE_URLS = [];
    var BLACK_URLS = [];

    function syncPieceUrlArrays() {
        if (window.ShmerlingPieceSets && typeof window.ShmerlingPieceSets.getActiveUrls === "function") {
            var urls = window.ShmerlingPieceSets.getActiveUrls();
            WHITE_URLS = urls.white;
            BLACK_URLS = urls.black;
            return;
        }
        WHITE_URLS = [
            "images/white-pawn.png",
            "images/white-king.png",
            "images/white-knight.png",
            "images/white-bishop.png",
            "images/white-rook.png",
            "images/white-queen.png",
        ];
        BLACK_URLS = [
            "images/black-pawn.png",
            "images/black-king.png",
            "images/black-knight.png",
            "images/black-bishop.png",
            "images/black-rook.png",
            "images/black-queen.png",
        ];
    }

    syncPieceUrlArrays();

    document.addEventListener("shmerling-piece-set-changed", syncPieceUrlArrays);

    function pieceUrl(piece) {
        if (!piece) {
            return null;
        }
        var urls = piece.color === "white" ? WHITE_URLS : BLACK_URLS;
        var t = piece.pieceType;
        if (typeof t !== "number" || t < 0 || t >= urls.length) {
            return null;
        }
        return urls[t];
    }

    function drawMiniBoard(container, board) {
        if (!container) {
            return;
        }
        container.innerHTML = "";
        if (!board || !board.length) {
            return;
        }
        var grid = document.createElement("div");
        grid.className = "active-mini-board-grid";
        var rows = board.length;
        var cols = board[0] ? board[0].length : 0;
        for (var i = 0; i < rows; i++) {
            for (var j = 0; j < cols; j++) {
                var sq = document.createElement("div");
                sq.className = "active-mini-square " + ((i + j) % 2 === 0 ? "active-mini-light" : "active-mini-dark");
                var p = board[i][j];
                var url = pieceUrl(p);
                if (url) {
                    var img = document.createElement("img");
                    img.src = url;
                    img.alt = "";
                    img.className = "active-mini-piece";
                    sq.appendChild(img);
                }
                grid.appendChild(sq);
            }
        }
        container.appendChild(grid);
    }

    function esc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function playBase() {
        var pathFn = typeof window !== "undefined" ? window.getPlayGameBasePath : null;
        if (typeof pathFn === "function") {
            try {
                return pathFn({ forOnlineSession: true });
            } catch {
                /* ignore */
            }
        }
        return "/game";
    }

    function getGameUrl(g, username) {
        var w = g.whitePlayerName != null ? String(g.whitePlayerName) : "";
        var b = g.blackPlayerName != null ? String(g.blackPlayerName) : "";
        var isParticipant =
            g.IsParticipant === true ||
            (username && (w === username || b === username));
        var status = g.Status || "In progress";
        if (isParticipant && (status === "In progress" || status === "On hold")) {
            return playBase() + "?id=" + encodeURIComponent(g.Id);
        }
        if (playBase() === "/play") {
            return "/play?id=" + encodeURIComponent(g.Id) + "&mode=watch";
        }
        return "/watch?id=" + encodeURIComponent(g.Id);
    }

    function buildHighlightCard(first, username) {
        var wrap = document.createElement("div");
        wrap.className = "active-game-highlight";
        wrap.setAttribute("data-game-id", String(first.Id));
        wrap.setAttribute("role", "link");
        wrap.setAttribute("tabindex", "0");
        var url = getGameUrl(first, username);
        wrap.onclick = function () {
            window.location.href = url;
        };
        wrap.onkeydown = function (e) {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                window.location.href = url;
            }
        };

        var boardWrap = document.createElement("div");
        boardWrap.className = "active-highlight-board-wrap";
        var boardEl = document.createElement("div");
        boardEl.className = "active-mini-board";
        boardEl.setAttribute("aria-hidden", "true");
        boardWrap.appendChild(boardEl);

        var side = document.createElement("div");
        side.className = "active-highlight-side";

        var namesEl = document.createElement("div");
        namesEl.className = "active-highlight-names";
        namesEl.innerHTML =
            "<span class=\"active-highlight-white\">" +
            esc(first.whitePlayerName || "White") +
            "</span><span class=\"active-highlight-vs\"> vs </span><span class=\"active-highlight-black\">" +
            esc(first.blackPlayerName || "Black") +
            "</span>";

        var startedEl = document.createElement("p");
        startedEl.className = "active-highlight-started";
        startedEl.textContent = first.Started || "";
        startedEl.title = first.StartedTooltip || "";

        var metaEl = document.createElement("div");
        metaEl.className = "active-highlight-meta";
        var turn = first.turn === "black" ? "Black" : "White";
        metaEl.innerHTML =
            "<span class=\"active-meta-item\"><span class=\"active-meta-label\">Moves</span> " +
            esc(first.Moves != null ? first.Moves : "0") +
            "</span><span class=\"active-meta-item\"><span class=\"active-meta-label\">Turn</span> " +
            esc(turn) +
            "</span><span class=\"active-meta-item\"><span class=\"active-meta-label\">Status</span> " +
            esc(first.Status || "In progress") +
            "</span>";

        side.appendChild(namesEl);
        side.appendChild(startedEl);
        side.appendChild(metaEl);

        wrap.appendChild(boardWrap);
        wrap.appendChild(side);

        drawMiniBoard(boardEl, first.board);

        return wrap;
    }

    function render(games, username) {
        var root = document.getElementById("online-games-cards-root");
        var emptyEl = document.getElementById("online-no-games-msg");
        var container = document.getElementById("online-games-container");

        if (!root) {
            return;
        }

        root.innerHTML = "";

        if (!games || games.length === 0) {
            if (container) {
                container.classList.remove("has-online-games");
            }
            if (emptyEl) {
                emptyEl.style.display = "block";
            }
            return;
        }

        if (container) {
            container.classList.add("has-online-games");
        }
        if (emptyEl) {
            emptyEl.style.display = "none";
        }

        var list = games.slice(0, 3);
        list.forEach(function (g) {
            root.appendChild(buildHighlightCard(g, username));
        });
    }

    function refresh(username) {
        fetch("/active-games?limit=3&includeBoard=1", { credentials: "same-origin" })
            .then(function (r) {
                return r.ok ? r.json() : [];
            })
            .then(function (games) {
                render(Array.isArray(games) ? games : [], username);
            })
            .catch(function () {});
    }

    function init() {
        var username =
            typeof window.__WELCOME_USERNAME__ === "string" ? window.__WELCOME_USERNAME__ : "";
        var el = document.getElementById("active-games-initial-json");
        var initial = [];
        if (el && el.textContent) {
            try {
                initial = JSON.parse(el.textContent);
            } catch {
                initial = [];
            }
        }
        render(initial, username);
        refresh(username);
        setInterval(function () {
            refresh(username);
        }, 8000);

        window.addEventListener("site-ws-message", function (ev) {
            var msg = ev.detail;
            if (!msg) {
                return;
            }
            if (msg.type === "onlineGameInProgress" || msg.type === "onlineGameUpdated") {
                refresh(username);
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
