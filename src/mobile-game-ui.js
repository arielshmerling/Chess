/**
 * Mobile play page only (`body.mobile-game-shell`). Desktop game does not load this file.
 */
(function () {
    function qs(id) {
        return document.getElementById(id);
    }

    function syncTurnBarFromClockIcons() {
        const bar = qs("mobile-match-bar");
        const w = qs("whiteTurnClock");
        const b = qs("blackTurnClock");
        if (!bar || !w || !b) {
            return;
        }
        const whiteHidden = w.classList.contains("unvisible");
        const blackHidden = b.classList.contains("unvisible");
        /* Before `switchClocks` runs, both icons are hidden — default bar to white's side. */
        if (whiteHidden && blackHidden) {
            bar.setAttribute("data-active-turn", "white");
            return;
        }
        const whiteActive = !whiteHidden;
        bar.setAttribute("data-active-turn", whiteActive ? "white" : "black");
    }

    function syncGameIdTooltip() {
        const btn = qs("mobileMatchTitleBtn");
        const bar = qs("mobile-match-bar");
        if (!btn) {
            return;
        }
        let id = "";
        if (bar && bar.getAttribute("data-game-id")) {
            id = String(bar.getAttribute("data-game-id")).trim();
        }
        if (!id) {
            btn.removeAttribute("title");
            return;
        }
        btn.title = "Game ID: " + id;
    }

    function init() {
        if (!document.body.classList.contains("mobile-game-shell")) {
            return;
        }

        syncGameIdTooltip();

        const w = qs("whiteTurnClock");
        const b = qs("blackTurnClock");
        if (w && b) {
            syncTurnBarFromClockIcons();
            const mo = new MutationObserver(syncTurnBarFromClockIcons);
            mo.observe(w, { attributes: true, attributeFilter: ["class"] });
            mo.observe(b, { attributes: true, attributeFilter: ["class"] });
        }

        document.addEventListener("shmerlingGameId", function (ev) {
            const bar = qs("mobile-match-bar");
            const btn = qs("mobileMatchTitleBtn");
            const raw = ev && ev.detail && ev.detail.id != null ? String(ev.detail.id).trim() : "";
            if (bar) {
                bar.setAttribute("data-game-id", raw);
            }
            if (btn) {
                btn.title = raw ? ("Game ID: " + raw) : "";
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
