/**
 * Home page: active games as cards (highlight + compact) with optional mini-board preview.
 */
(function () {
    "use strict";

    var WHITE_URLS = [
        "images/3409_white-pawn.png",
        "images/3404_white-king.png",
        "images/3408_white-knight.png",
        "images/3407_white-bishop.png",
        "images/3406_white-rook.png",
        "images/3405_white-queen.png",
    ];
    var BLACK_URLS = [
        "images/3403_black-pawn.png",
        "images/3398_black-king.png",
        "images/3402_black-knight.png",
        "images/3401_black-bishop.png",
        "images/3400_black-rook.png",
        "images/3399_black-queen.png",
    ];

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

    function getGameUrl(g, username) {
        var w = g.whitePlayerName != null ? String(g.whitePlayerName) : "";
        var b = g.blackPlayerName != null ? String(g.blackPlayerName) : "";
        var isParticipant =
            g.IsParticipant === true ||
            (username && (w === username || b === username));
        var status = g.Status || "In progress";
        if (isParticipant && (status === "In progress" || status === "On hold")) {
            return "/game?id=" + encodeURIComponent(g.Id);
        }
        return "/watch?id=" + encodeURIComponent(g.Id);
    }

    function render(root, games, username) {
        var highlightWrap = document.getElementById("active-game-highlight-wrap");
        var compactList = document.getElementById("active-games-compact-list");
        var emptyEl = document.getElementById("online-no-games-msg");
        var boardEl = document.getElementById("active-mini-board");
        var container = document.getElementById("online-games-container");

        if (!highlightWrap || !compactList) {
            return;
        }

        if (!games || games.length === 0) {
            if (container) {
                container.classList.remove("has-online-games");
            }
            highlightWrap.style.display = "none";
            compactList.innerHTML = "";
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

        var first = games[0];
        var rest = games.slice(1);

        highlightWrap.style.display = "flex";
        highlightWrap.setAttribute("data-game-id", String(first.Id));
        highlightWrap.onclick = function () {
            window.location.href = getGameUrl(first, username);
        };

        var namesEl = document.getElementById("active-highlight-names");
        var metaEl = document.getElementById("active-highlight-meta");
        var startedEl = document.getElementById("active-highlight-started");
        if (namesEl) {
            namesEl.innerHTML =
                '<span class="active-highlight-white">' +
                esc(first.whitePlayerName || "White") +
                '</span><span class="active-highlight-vs"> vs </span><span class="active-highlight-black">' +
                esc(first.blackPlayerName || "Black") +
                "</span>";
        }
        if (startedEl) {
            startedEl.textContent = first.Started || "";
            startedEl.title = first.StartedTooltip || "";
        }
        if (metaEl) {
            var turn = first.turn === "black" ? "Black" : "White";
            metaEl.innerHTML =
                '<span class="active-meta-item"><span class="active-meta-label">Moves</span> ' +
                esc(first.Moves != null ? first.Moves : "0") +
                '</span><span class="active-meta-item"><span class="active-meta-label">Turn</span> ' +
                esc(turn) +
                '</span><span class="active-meta-item"><span class="active-meta-label">Status</span> ' +
                esc(first.Status || "In progress") +
                "</span>";
        }
        drawMiniBoard(boardEl, first.board);

        compactList.innerHTML = "";
        rest.forEach(function (g) {
            var card = document.createElement("button");
            card.type = "button";
            card.className = "active-game-compact-card";
            card.setAttribute("data-game-id", String(g.Id));
            card.innerHTML =
                '<span class="active-compact-names">' +
                esc(g.whitePlayerName || "") +
                " vs " +
                esc(g.blackPlayerName || "") +
                "</span>" +
                '<span class="active-compact-meta">' +
                esc(g.Started || "") +
                " · " +
                esc(g.Moves != null ? g.Moves : "0") +
                " moves</span>";
            card.title = g.StartedTooltip || "";
            card.onclick = function () {
                window.location.href = getGameUrl(g, username);
            };
            compactList.appendChild(card);
        });
    }

    function refresh(username) {
        fetch("/active-games?limit=4&includeBoard=1", { credentials: "same-origin" })
            .then(function (r) {
                return r.ok ? r.json() : [];
            })
            .then(function (games) {
                var root = document.getElementById("online-games-cards-root");
                if (root) {
                    render(root, Array.isArray(games) ? games : [], username);
                }
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
            } catch (e) {
                initial = [];
            }
        }
        render(null, initial, username);
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
