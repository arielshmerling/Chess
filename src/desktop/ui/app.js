(function () {
    "use strict";

    var Settings = window.DesktopGameSettings;

    function loadLastOptions() {
        if (Settings && Settings.loadLastOptions) {
            return Settings.loadLastOptions();
        }
        return {};
    }

    function saveLastOptions(opts) {
        if (Settings && Settings.saveLastOptions) {
            Settings.saveLastOptions(opts);
            return;
        }
        try {
            localStorage.setItem("shmerling.desktop.lastGameOptions", JSON.stringify(opts));
        } catch {
            /* ignore */
        }
    }

    function normalizeThinkingTimeSeconds(value) {
        if (Settings && Settings.normalizeThinkingTimeSeconds) {
            return Settings.normalizeThinkingTimeSeconds(value);
        }
        var parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : 10;
    }

    document.addEventListener("DOMContentLoaded", function () {
        var form = document.getElementById("newGameForm");
        if (!form) {
            return;
        }

        var last = loadLastOptions();
        if (last.engine) {
            var engineEl = form.elements.engine;
            if (engineEl) {
                engineEl.value = last.engine;
            }
        }
        var thinkingTime =
            last.thinkingTimeSeconds != null ? last.thinkingTimeSeconds : last.difficulty;
        if (thinkingTime != null) {
            var diff = form.querySelector("[name=thinkingTimeSeconds]");
            var normalized = normalizeThinkingTimeSeconds(thinkingTime);
            if (diff) {
                diff.value = String(normalized);
            }
        }
        if (last.color === "black") {
            var black = form.querySelector("input[name=color][value=black]");
            if (black) {
                black.checked = true;
            }
        }
        if (last.mouse === "double") {
            var mouseDouble = form.querySelector("input[name=mouse][value=double]");
            if (mouseDouble) {
                mouseDouble.checked = true;
            }
        }
        if (last.showAvailableMoves === false) {
            var showMoves = form.querySelector("input[name=showMoves]");
            if (showMoves) {
                showMoves.checked = false;
            }
        }
        if (last.allowUndo === false) {
            var allowUndoEl = form.querySelector("input[name=allowUndo]");
            if (allowUndoEl) {
                allowUndoEl.checked = false;
            }
        }

            var thinkingTimeSeconds = normalizeThinkingTimeSeconds(
                parseInt(fd.get("thinkingTimeSeconds"), 10) || 10,
            );
            var payload = {
                color: fd.get("color") || "white",
                engine: fd.get("engine") || "brain42",
                thinkingTimeSeconds: thinkingTimeSeconds,
                difficulty: thinkingTimeSeconds,
                mouse: fd.get("mouse") || "drag",
                showAvailableMoves: fd.get("showMoves") === "1",
                allowUndo: fd.get("allowUndo") === "1",
                timeMinutes: parseInt(fd.get("timeMinutes"), 10) || 90,
            };

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
                    window.__LAST_GAME_OPTIONS__ = payload;
                    window.location.href = "/app/play?id=" + encodeURIComponent(res.body.gameId);
                })
                .catch(function (err) {
                    if (errEl) {
                        errEl.textContent = err.message || "Could not start game";
                        errEl.hidden = false;
                    }
                    if (btn) {
                        btn.disabled = false;
                    }
                });
        });
    });
})();
