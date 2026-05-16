(function () {
    "use strict";

    var STORAGE_KEY = "shmerling.desktop.lastGameOptions";

    function loadLastOptions() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    function saveLastOptions(opts) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
        } catch {
            /* ignore */
        }
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
        if (last.difficulty != null) {
            var diff = form.querySelector("[name=difficulty]");
            var out = document.getElementById("difficultyOut");
            if (diff) {
                diff.value = String(last.difficulty);
                if (out) {
                    out.textContent = String(last.difficulty);
                }
            }
        }
        if (last.color === "black") {
            var black = form.querySelector("input[name=color][value=black]");
            if (black) {
                black.checked = true;
            }
        }

        var range = document.getElementById("difficultyRange");
        var output = document.getElementById("difficultyOut");
        if (range && output) {
            range.addEventListener("input", function () {
                output.textContent = range.value;
            });
        }

        form.addEventListener("submit", function (ev) {
            ev.preventDefault();
            var errEl = document.getElementById("newGameError");
            var btn = document.getElementById("startBtn");
            if (errEl) {
                errEl.hidden = true;
            }
            if (btn) {
                btn.disabled = true;
            }

            var fd = new FormData(form);
            var payload = {
                color: fd.get("color") || "white",
                engine: fd.get("engine") || "brain42",
                difficulty: parseInt(fd.get("difficulty"), 10) || 3,
                mouse: fd.get("mouse") || "drag",
                showAvailableMoves: fd.get("showMoves") === "1",
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
