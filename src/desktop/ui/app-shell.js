/**
 * Desktop play shell: rematch modal + navigation helpers (no lobby.js).
 */
(function () {
    "use strict";

    var STORAGE_KEY = "shmerling.desktop.lastGameOptions";

    function loadLastOptions() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : (window.__LAST_GAME_OPTIONS__ || {});
        } catch {
            return window.__LAST_GAME_OPTIONS__ || {};
        }
    }

    function saveLastOptions(opts) {
        window.__LAST_GAME_OPTIONS__ = opts;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
        } catch {
            /* ignore */
        }
    }

    function normalizeThinkingTimeSeconds(value) {
        var allowed = [2, 5, 10, 15, 20, 30, 60, 120];
        var parsed = parseInt(value, 10);
        if (!Number.isFinite(parsed)) {
            return 10;
        }
        if (allowed.indexOf(parsed) !== -1) {
            return parsed;
        }
        if (parsed >= 1 && parsed <= 6) {
            return allowed[Math.min(parsed - 1, allowed.length - 1)];
        }
        var nearest = allowed[0];
        var nearestDist = Math.abs(parsed - nearest);
        for (var i = 1; i < allowed.length; i += 1) {
            var dist = Math.abs(parsed - allowed[i]);
            if (dist < nearestDist) {
                nearest = allowed[i];
                nearestDist = dist;
            }
        }
        return nearest;
    }

    function resolveThinkingTimeSeconds(opts) {
        if (opts.thinkingTimeSeconds != null) {
            return normalizeThinkingTimeSeconds(opts.thinkingTimeSeconds);
        }
        if (opts.difficulty != null) {
            return normalizeThinkingTimeSeconds(opts.difficulty);
        }
        return 10;
    }

    function applyLastGameOptions(opts) {
        var form = document.getElementById("playNowForm");
        if (!form) {
            return;
        }
        if (opts.color === "black") {
            var blackRadio = form.querySelector("input[name='color'][value='black']");
            if (blackRadio) {
                blackRadio.checked = true;
            }
        }
        if (opts.engine && form.elements.engine) {
            form.elements.engine.value = opts.engine;
        }
        var thinkingTimeSeconds = resolveThinkingTimeSeconds(opts);
        var thinkingTimeInput = form.querySelector("input[name='thinkingTimeSeconds']")
            || form.querySelector("input[name='difficulty']");
        var valueSpan = document.getElementById("playNowDifficultyValue");
        if (thinkingTimeInput) {
            thinkingTimeInput.value = String(thinkingTimeSeconds);
            if (valueSpan) {
                valueSpan.textContent = String(thinkingTimeSeconds) + "s";
            }
        }
        if (opts.mouse === "double") {
            var doubleRadio = form.querySelector("input[name='mouse'][value='double']");
            if (doubleRadio) {
                doubleRadio.checked = true;
            }
        }
        var showCheckbox = form.querySelector("input[name='showMoves']");
        if (showCheckbox) {
            showCheckbox.checked = opts.showAvailableMoves !== false;
        }
    }

    function openPlayNowModal() {
        var modal = document.getElementById("playNowModal");
        if (!modal) {
            return;
        }
        applyLastGameOptions(loadLastOptions());
        modal.setAttribute("aria-hidden", "false");
    }

    function closePlayNowModal() {
        var modal = document.getElementById("playNowModal");
        if (modal) {
            modal.setAttribute("aria-hidden", "true");
        }
    }

    function startNewGameFromModal(event) {
        event.preventDefault();
        var form = document.getElementById("playNowForm");
        if (!form) {
            return;
        }
        var formData = new FormData(form);
        var thinkingTimeSeconds = normalizeThinkingTimeSeconds(
            parseInt(formData.get("thinkingTimeSeconds") || formData.get("difficulty"), 10) || 10,
        );
        var payload = {
            color: formData.get("color") || "white",
            engine: formData.get("engine") || "brain42",
            thinkingTimeSeconds: thinkingTimeSeconds,
            difficulty: thinkingTimeSeconds,
            mouse: formData.get("mouse") || "drag",
            showAvailableMoves: formData.get("showMoves") === "1",
            timeMinutes: 90,
        };
        closePlayNowModal();
        fetch("/app/api/game", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
            .then(function (r) {
                return r.json().then(function (body) {
                    return { ok: r.ok, body: body };
                });
            })
            .then(function (res) {
                if (!res.ok || !res.body || !res.body.ok || !res.body.gameId) {
                    throw new Error((res.body && res.body.message) || "Could not start game");
                }
                saveLastOptions(payload);
                window.location.href = "/app/play?id=" + encodeURIComponent(res.body.gameId);
            })
            .catch(function (err) {
                alert(err.message || "Could not start game");
            });
    }

    window.openPlayNowModal = openPlayNowModal;
    window.closePlayNowModal = closePlayNowModal;
    window.startNewGameFromModal = startNewGameFromModal;
})();
