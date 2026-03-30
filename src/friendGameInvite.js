/**
 * Friend game invites: dock below header; multiple invites shown side-by-side (wrap on small screens).
 */
(function () {
    "use strict";

    /** @type {Record<string, HTMLElement>} */
    var cardsByGameId = {};
    var establishingEl = null;

    function getOrCreateDock() {
        var dock = document.getElementById("friend-game-invite-dock");
        if (!dock) {
            dock = document.createElement("div");
            dock.id = "friend-game-invite-dock";
            dock.className = "friend-game-invite-dock";
            dock.setAttribute("aria-label", "Game invitations");
            document.body.appendChild(dock);
        }
        return dock;
    }

    function esc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function postJson(url, body) {
        return fetch(url, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(body || {}),
        }).then(function (r) {
            return r.json().then(function (data) {
                if (!r.ok) {
                    throw new Error((data && data.message) || r.statusText || "Request failed");
                }
                return data;
            });
        });
    }

    function removeCardAnimated(cardEl, runAfter) {
        if (!cardEl) {
            if (runAfter) {
                runAfter();
            }
            return;
        }
        var gid = cardEl.getAttribute("data-game-id");
        if (gid) {
            delete cardsByGameId[String(gid)];
        }
        cardEl.classList.add("friend-game-invite-banner--leave");
        setTimeout(function () {
            if (cardEl.parentNode) {
                cardEl.parentNode.removeChild(cardEl);
            }
            var dock = document.getElementById("friend-game-invite-dock");
            if (dock && dock.childElementCount === 0 && dock.parentNode) {
                dock.parentNode.removeChild(dock);
            }
            if (runAfter) {
                runAfter();
            }
        }, 380);
    }

    function showInviteCard(fromUsername, gameId) {
        if (!gameId) {
            return;
        }
        var gid = String(gameId);
        if (cardsByGameId[gid]) {
            return;
        }
        var dock = getOrCreateDock();
        var card = document.createElement("article");
        card.className = "friend-game-invite-banner";
        card.setAttribute("data-game-id", gid);
        card.setAttribute("role", "alertdialog");
        card.setAttribute("aria-label", "Game invitation");
        var who = fromUsername ? esc(fromUsername) : "A friend";
        card.innerHTML =
            "<div class=\"friend-game-invite-card\">" +
            "<div class=\"friend-game-invite-title\">Chess invite</div>" +
            "<p class=\"friend-game-invite-line\"><strong>" +
            who +
            "</strong> wants to play. You play as <strong>Black</strong>.</p>" +
            "<div class=\"friend-game-invite-actions\">" +
            "<button type=\"button\" class=\"friend-game-invite-btn friend-game-invite-accept\">Accept</button>" +
            "<button type=\"button\" class=\"friend-game-invite-btn friend-game-invite-decline\">Decline</button>" +
            "</div></div>";

        var acceptBtn = card.querySelector(".friend-game-invite-accept");
        var declineBtn = card.querySelector(".friend-game-invite-decline");
        if (acceptBtn) {
            acceptBtn.addEventListener("click", function () {
                if (acceptBtn.disabled) {
                    return;
                }
                acceptBtn.disabled = true;
                postJson("/api/friends/game-invite-accept", { gameId: gid })
                    .then(function () {
                        removeInviteCardImmediate(gid);
                        showEstablishingOverlayThenNavigate(
                            "You play as Black",
                            "/game?gameType=2&joinGame=" + encodeURIComponent(gid)
                        );
                    })
                    .catch(function (e) {
                        acceptBtn.disabled = false;
                        var msg = (e && e.message) ? e.message : "Could not accept invite";
                        if (typeof window.showSiteAlert === "function") {
                            window.showSiteAlert(msg, "Game invite");
                        } else {
                            window.alert(msg);
                        }
                    });
            });
        }
        if (declineBtn) {
            declineBtn.addEventListener("click", function () {
                removeCardAnimated(card, function () {
                    postJson("/api/friends/game-invite-decline", { gameId: gid }).catch(function () {});
                });
            });
        }
        cardsByGameId[gid] = card;
        dock.appendChild(card);
    }

    function removeInviteCardImmediate(gameId) {
        var gid = String(gameId);
        var el = cardsByGameId[gid];
        if (!el) {
            return;
        }
        delete cardsByGameId[gid];
        if (el.parentNode) {
            el.parentNode.removeChild(el);
        }
        var dock = document.getElementById("friend-game-invite-dock");
        if (dock && dock.childElementCount === 0 && dock.parentNode) {
            dock.parentNode.removeChild(dock);
        }
    }

    function removeEstablishing() {
        if (establishingEl && establishingEl.parentNode) {
            establishingEl.parentNode.removeChild(establishingEl);
        }
        establishingEl = null;
    }

    /**
     * Same full-screen establishing UI for inviter (White) and invitee (Black) before navigating to the game.
     * @param {string} roleHint e.g. "You play as White" / "You play as Black"
     * @param {string} nextUrl absolute path + query on this origin
     */
    function showEstablishingOverlayThenNavigate(roleHint, nextUrl) {
        removeEstablishing();
        establishingEl = document.createElement("div");
        establishingEl.className = "friend-game-establishing-overlay";
        establishingEl.setAttribute("role", "status");
        establishingEl.setAttribute("aria-live", "polite");
        var hint = esc(roleHint);
        establishingEl.innerHTML =
            "<div class=\"friend-game-establishing-card\">" +
            "<div class=\"friend-game-establishing-spinner\" aria-hidden=\"true\"></div>" +
            "<p class=\"friend-game-establishing-text\">Establishing game…</p>" +
            "<p class=\"friend-game-establishing-hint\">" +
            hint +
            "</p>" +
            "</div>";
        document.body.appendChild(establishingEl);
        setTimeout(function () {
            removeEstablishing();
            window.location.href = nextUrl;
        }, 2000);
    }

    function showInviterDeclinedToast(declinedByUsername) {
        var name = declinedByUsername ? esc(declinedByUsername) : "Your opponent";
        var el = document.createElement("div");
        el.className = "friend-game-invite-toast friend-game-invite-toast--declined";
        el.setAttribute("role", "status");
        el.innerHTML =
            "<p class=\"friend-game-invite-toast-text\">" +
            name +
            " declined your game invite.</p>";
        document.body.appendChild(el);
        setTimeout(function () {
            el.classList.add("friend-game-invite-toast--fade");
        }, 4200);
        setTimeout(function () {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }, 5000);
    }

    function dismissIfWithdrawn(gameId) {
        if (!gameId) {
            return;
        }
        var card = cardsByGameId[String(gameId)];
        if (card) {
            removeCardAnimated(card, null);
        }
    }

    window.addEventListener("site-ws-message", function (ev) {
        var msg = ev.detail;
        if (!msg) {
            return;
        }
        if (msg.type === "friendGameInvite" && msg.data) {
            var d = msg.data;
            showInviteCard(d.fromUsername, d.gameId);
            return;
        }
        if (msg.type === "friendGameInviteAccepted" && msg.data && msg.data.gameId) {
            var gidAcc = String(msg.data.gameId);
            showEstablishingOverlayThenNavigate(
                "You play as White",
                "/game?id=" + encodeURIComponent(gidAcc)
            );
            return;
        }
        if (msg.type === "friendGameInviteDeclined" && msg.data) {
            showInviterDeclinedToast(msg.data.declinedByUsername);
            return;
        }
        if (msg.type === "friendGameInviteWithdrawn" && msg.data) {
            dismissIfWithdrawn(msg.data.gameId);
        }
    });

    function hydrateIncomingInvitesFromServer() {
        fetch("/api/friends/data", { credentials: "same-origin" })
            .then(function (r) {
                if (!r.ok) {
                    return null;
                }
                return r.json();
            })
            .then(function (data) {
                if (!data || !data.ok || !Array.isArray(data.incomingGameInvites)) {
                    return;
                }
                data.incomingGameInvites.forEach(function (inv) {
                    if (inv && inv.gameId) {
                        showInviteCard(inv.fromUsername, inv.gameId);
                    }
                });
            })
            .catch(function () {});
    }

    function scheduleHydrate() {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", hydrateIncomingInvitesFromServer);
        } else {
            hydrateIncomingInvitesFromServer();
        }
    }

    scheduleHydrate();
    window.addEventListener("site-ws-reconnected", function () {
        hydrateIncomingInvitesFromServer();
    });
})();
