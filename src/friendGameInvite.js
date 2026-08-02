/**
 * Friend game invites: dock below header; multiple invites shown side-by-side (wrap on small screens).
 */
(function () {
    "use strict";

    /** @type {Record<string, HTMLElement>} */
    var cardsByGameId = {};
    var establishingEl = null;

    function t(key, params) {
        if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
            return window.ShmerlingStrings.t(key, params);
        }
        return key;
    }

    function getOrCreateDock() {
        var dock = document.getElementById("friend-game-invite-dock");
        if (!dock) {
            dock = document.createElement("div");
            dock.id = "friend-game-invite-dock";
            dock.className = "friend-game-invite-dock";
            dock.setAttribute("aria-label", t("site.friendsPage.gameInvitationsAria"));
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
                    throw new Error((data && data.message) || r.statusText || t("site.friendsPage.requestFailed"));
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

    function formatOfferMeta(offer) {
        if (!offer || typeof offer !== "object") {
            return "";
        }
        var parts = [];
        if (typeof offer.timeMinutes === "number") {
            parts.push(t("site.friendsPage.inviteOfferTime", { minutes: offer.timeMinutes }));
        }
        if (offer.friendly === true) {
            parts.push(t("site.friendsPage.inviteOfferFriendly"));
        } else if (offer.friendly === false) {
            parts.push(t("site.friendsPage.inviteOfferRated"));
        }
        if (offer.isPrivate === true) {
            parts.push(t("site.friendsPage.inviteOfferPrivate"));
        }
        if (!parts.length) {
            return "";
        }
        return '<p class="friend-game-invite-meta">' + esc(parts.join(" · ")) + "</p>";
    }

    function showInviteCard(fromUsername, gameId, offer) {
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
        card.setAttribute("aria-label", t("site.friendsPage.gameInvitationAria"));
        var whoName = fromUsername || t("site.friendsPage.aFriend");
        var who = esc(whoName);
        var youPlayAs = offer && offer.youPlayAs === "white" ? "white" : "black";
        var lineKey =
            youPlayAs === "white"
                ? "site.friendsPage.wantsToPlayYouWhite"
                : "site.friendsPage.wantsToPlayAsBlack";
        var inviteLine = esc(t(lineKey, { name: "{{NAME}}" })).replace(
            "{{NAME}}",
            "<strong>" + who + "</strong>",
        );
        card.innerHTML =
            "<div class=\"friend-game-invite-card\">" +
            "<div class=\"friend-game-invite-title\">" + esc(t("site.friendsPage.chessInviteTitle")) + "</div>" +
            "<p class=\"friend-game-invite-line\">" + inviteLine + "</p>" +
            formatOfferMeta(offer) +
            "<div class=\"friend-game-invite-actions\">" +
            "<button type=\"button\" class=\"friend-game-invite-btn friend-game-invite-accept\">" +
            esc(t("site.friendsPage.accept")) +
            "</button>" +
            "<button type=\"button\" class=\"friend-game-invite-btn friend-game-invite-decline\">" +
            esc(t("site.friendsPage.decline")) +
            "</button>" +
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
                    .then(function (data) {
                        removeInviteCardImmediate(gid);
                        var side = data && data.youPlayAs === "white" ? "white" : "black";
                        var roleHint =
                            side === "white"
                                ? t("site.friendsPage.youPlayAsWhite")
                                : t("site.friendsPage.youPlayAsBlack");
                        showEstablishingOverlayThenNavigate(
                            roleHint,
                            "/play?id=" + encodeURIComponent(gid)
                        );
                    })
                    .catch(function (e) {
                        acceptBtn.disabled = false;
                        var msg = (e && e.message) ? e.message : t("site.friendsPage.couldNotAccept");
                        if (typeof window.showSiteAlert === "function") {
                            window.showSiteAlert(msg, t("site.friendsPage.gameInvite"));
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
            "<p class=\"friend-game-establishing-text\">" +
            esc(t("site.friendsPage.establishingGame")) +
            "</p>" +
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
        var name = declinedByUsername
            ? esc(declinedByUsername)
            : esc(t("site.friendsPage.yourOpponent"));
        var el = document.createElement("div");
        el.className = "friend-game-invite-toast friend-game-invite-toast--declined";
        el.setAttribute("role", "status");
        el.innerHTML =
            "<p class=\"friend-game-invite-toast-text\">" +
            esc(
                t("site.friendsPage.declinedYourInvite", {
                    name: "{{NAME}}",
                }),
            ).replace("{{NAME}}", name) +
            "</p>";
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
            showInviteCard(d.fromUsername, d.gameId, d.offer || null);
            return;
        }
        if (msg.type === "friendGameInviteAccepted" && msg.data && msg.data.gameId) {
            var gidAcc = String(msg.data.gameId);
            var inviterSide = msg.data.youPlayAs === "black" ? "black" : "white";
            showEstablishingOverlayThenNavigate(
                inviterSide === "black"
                    ? t("site.friendsPage.youPlayAsBlack")
                    : t("site.friendsPage.youPlayAsWhite"),
                "/play?id=" + encodeURIComponent(gidAcc)
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
                        showInviteCard(inv.fromUsername, inv.gameId, inv.offer || null);
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
