/**
 * Friend game invite defaults + split-button / settings popover.
 * Fast Invite uses saved options; gear configures before invite.
 */
(function (global) {
    "use strict";

    var STORAGE_KEY = "shmerling.friendInviteOptions.v1";

    var DEFAULTS = {
        timeMinutes: 90,
        color: "white",
        /* Online undo is not implemented — keep off and omit from invite UI. */
        allowUndo: false,
        friendly: true,
        isPrivate: false,
    };

    var openPopoverEl = null;
    var openAnchor = null;

    function t(key, vars) {
        if (global.ShmerlingStrings && typeof global.ShmerlingStrings.t === "function") {
            return global.ShmerlingStrings.t(key, vars);
        }
        if (typeof global.t === "function") {
            return global.t(key, vars);
        }
        return key;
    }

    function esc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function normalize(raw) {
        var src = raw && typeof raw === "object" ? raw : {};
        var tm = parseInt(src.timeMinutes, 10);
        if (!Number.isFinite(tm) || tm < 1) {
            tm = DEFAULTS.timeMinutes;
        }
        if (tm > 180) {
            tm = 180;
        }
        var color = String(src.color || DEFAULTS.color).toLowerCase();
        if (color !== "white" && color !== "black" && color !== "random") {
            color = DEFAULTS.color;
        }
        return {
            timeMinutes: tm,
            color: color,
            allowUndo: false,
            friendly: src.friendly !== false && src.friendly !== "0" && src.friendly !== 0,
            isPrivate: src.isPrivate === true || src.isPrivate === "1" || src.isPrivate === 1,
        };
    }

    function load() {
        try {
            var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
            if (raw) {
                return normalize(JSON.parse(raw));
            }
        } catch (e) {
            /* ignore */
        }
        return normalize(DEFAULTS);
    }

    function save(opts) {
        var n = normalize(opts);
        try {
            if (global.localStorage) {
                global.localStorage.setItem(STORAGE_KEY, JSON.stringify(n));
            }
        } catch (e) {
            /* ignore */
        }
        return n;
    }

    function buildInviteBody(targetUserId, opts) {
        var o = normalize(opts || load());
        return {
            targetUserId: String(targetUserId),
            timeMinutes: o.timeMinutes,
            color: o.color,
            allowUndo: o.allowUndo,
            friendly: o.friendly,
            isPrivate: o.isPrivate,
        };
    }

    /**
     * Split Invite | gear control HTML.
     */
    function splitInviteButtonHtml(friendId, username, disabled) {
        var dis = disabled ? " disabled" : "";
        return (
            '<div class="friends-invite-split">' +
            '<button type="button" class="friends-btn friends-btn-primary friends-btn-invite"' +
            dis +
            ' data-friend-id="' +
            esc(friendId) +
            '" data-username="' +
            esc(username || "") +
            '">' +
            esc(t("site.friendsPage.invite")) +
            "</button>" +
            '<button type="button" class="friends-btn friends-btn-primary friends-btn-invite-gear"' +
            dis +
            ' data-friend-id="' +
            esc(friendId) +
            '" data-username="' +
            esc(username || "") +
            '" title="' +
            esc(t("site.friendsPage.inviteSettingsTitle")) +
            '" aria-label="' +
            esc(t("site.friendsPage.inviteSettingsTitle")) +
            '">' +
            '<span class="friends-invite-gear-icon" aria-hidden="true"></span>' +
            "</button></div>"
        );
    }

    function closePopover(opts) {
        if (openPopoverEl) {
            var form = openPopoverEl.querySelector("form");
            if (form && !(opts && opts.skipSave)) {
                try {
                    save(readForm(form));
                } catch (e) {
                    /* ignore */
                }
            }
            if (openPopoverEl.parentNode) {
                openPopoverEl.parentNode.removeChild(openPopoverEl);
            }
        }
        openPopoverEl = null;
        openAnchor = null;
        document.removeEventListener("mousedown", onDocDown, true);
        document.removeEventListener("keydown", onDocKey, true);
    }

    function onDocDown(ev) {
        if (!openPopoverEl) {
            return;
        }
        var tEl = ev.target;
        if (openPopoverEl.contains(tEl)) {
            return;
        }
        if (openAnchor && (openAnchor === tEl || openAnchor.contains(tEl))) {
            return;
        }
        closePopover();
    }

    function onDocKey(ev) {
        if (ev.key === "Escape") {
            closePopover();
        }
    }

    function readForm(form) {
        var fd = new FormData(form);
        return normalize({
            timeMinutes: fd.get("timeMinutes"),
            color: fd.get("color"),
            friendly: fd.get("friendly") === "1",
            isPrivate: fd.get("isPrivate") === "1",
        });
    }

    /**
     * @param {HTMLElement} gearBtn
     * @param {{ onInvite: function(string, object): void }} handlers
     */
    function openSettingsPopover(gearBtn, handlers) {
        if (!gearBtn) {
            return;
        }
        var friendId = gearBtn.getAttribute("data-friend-id");
        if (!friendId) {
            return;
        }
        if (openPopoverEl && openAnchor === gearBtn) {
            closePopover();
            return;
        }
        closePopover();

        var opts = load();
        var pop = document.createElement("div");
        pop.className = "friends-invite-popover";
        pop.setAttribute("role", "dialog");
        pop.setAttribute("aria-label", t("site.friendsPage.inviteSettingsTitle"));
        pop.innerHTML =
            '<form class="friends-invite-popover-form">' +
            '<div class="friends-invite-popover-title">' +
            esc(t("site.friendsPage.inviteSettingsTitle")) +
            "</div>" +
            '<label class="friends-invite-field">' +
            '<span class="friends-invite-label">' +
            esc(t("site.friendsPage.inviteTimeMinutes")) +
            "</span>" +
            '<input type="number" name="timeMinutes" min="1" max="180" value="' +
            esc(String(opts.timeMinutes)) +
            '" required>' +
            "</label>" +
            '<label class="friends-invite-field">' +
            '<span class="friends-invite-label">' +
            esc(t("site.friendsPage.inviteYourColor")) +
            "</span>" +
            '<select name="color">' +
            '<option value="white"' +
            (opts.color === "white" ? " selected" : "") +
            ">" +
            esc(t("site.friendsPage.inviteColorWhite")) +
            "</option>" +
            '<option value="black"' +
            (opts.color === "black" ? " selected" : "") +
            ">" +
            esc(t("site.friendsPage.inviteColorBlack")) +
            "</option>" +
            '<option value="random"' +
            (opts.color === "random" ? " selected" : "") +
            ">" +
            esc(t("site.friendsPage.inviteColorRandom")) +
            "</option>" +
            "</select></label>" +
            '<label class="friends-invite-check" title="' +
            esc(t("site.friendsPage.inviteFriendlyHint")) +
            '">' +
            '<input type="checkbox" name="friendly" value="1"' +
            (opts.friendly ? " checked" : "") +
            ">" +
            "<span>" +
            esc(t("site.friendsPage.inviteFriendly")) +
            "</span></label>" +
            '<label class="friends-invite-check" title="' +
            esc(t("site.friendsPage.invitePrivateHint")) +
            '">' +
            '<input type="checkbox" name="isPrivate" value="1"' +
            (opts.isPrivate ? " checked" : "") +
            ">" +
            "<span>" +
            esc(t("site.friendsPage.invitePrivate")) +
            "</span></label>" +
            '<div class="friends-invite-popover-actions">' +
            '<button type="submit" class="friends-btn friends-btn-primary friends-invite-send"' +
            (gearBtn.disabled ? " disabled" : "") +
            ">" +
            esc(t("site.friendsPage.invite")) +
            "</button>" +
            "</div></form>";

        document.body.appendChild(pop);
        openPopoverEl = pop;
        openAnchor = gearBtn;

        /* fixed positioning — viewport coords (ignore scrollY/scrollX) */
        var rect = gearBtn.getBoundingClientRect();
        var pad = 8;
        var popW = pop.offsetWidth || 280;
        var popH = pop.offsetHeight || 0;
        var top = rect.bottom + pad;
        var left = rect.right - popW;
        if (left < pad) {
            left = pad;
        }
        if (left + popW > global.innerWidth - pad) {
            left = Math.max(pad, global.innerWidth - popW - pad);
        }
        if (top + popH > global.innerHeight - pad && rect.top - pad - popH > pad) {
            top = rect.top - pad - popH;
        }
        if (top < pad) {
            top = pad;
        }
        pop.style.top = Math.round(top) + "px";
        pop.style.left = Math.round(left) + "px";

        var form = pop.querySelector("form");
        form.addEventListener("submit", function (ev) {
            ev.preventDefault();
            var o = save(readForm(form));
            closePopover({ skipSave: true });
            if (handlers && typeof handlers.onInvite === "function") {
                handlers.onInvite(friendId, o);
            }
        });

        document.addEventListener("mousedown", onDocDown, true);
        document.addEventListener("keydown", onDocKey, true);
        var first = form.querySelector('input[name="timeMinutes"]');
        if (first && first.focus) {
            first.focus();
            first.select();
        }
    }

    global.FriendInviteOptions = {
        DEFAULTS: DEFAULTS,
        normalize: normalize,
        load: load,
        save: save,
        buildInviteBody: buildInviteBody,
        splitInviteButtonHtml: splitInviteButtonHtml,
        openSettingsPopover: openSettingsPopover,
        closePopover: closePopover,
    };
})(typeof window !== "undefined" ? window : global);
