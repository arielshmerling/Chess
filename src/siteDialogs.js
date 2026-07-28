/**
 * Site-wide confirm / alert dialogs (same look as admin + research validation).
 * Requires partial site-dialogs.ejs in the page and app.css admin-confirm styles.
 */
(function () {
    "use strict";

    function t(key, params) {
        if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
            return window.ShmerlingStrings.t(key, params);
        }
        return key;
    }

    function getConfirmEls() {
        var overlay = document.getElementById("site-confirm-overlay");
        if (!overlay) {
            return null;
        }
        return {
            overlay: overlay,
            titleEl: document.getElementById("site-confirm-title"),
            msgEl: document.getElementById("site-confirm-message"),
            btnOk: overlay.querySelector(".site-confirm-ok"),
            btnCancel: overlay.querySelector(".site-confirm-cancel"),
        };
    }

    function getAlertEls() {
        var overlay = document.getElementById("site-alert-overlay");
        if (!overlay) {
            return null;
        }
        return {
            overlay: overlay,
            titleEl: document.getElementById("site-alert-title"),
            msgEl: document.getElementById("site-alert-message"),
            btnOk: overlay.querySelector(".site-alert-ok"),
        };
    }

    /**
     * @param {string} message
     * @param {{ title?: string, confirmLabel?: string, cancelLabel?: string }} [opts]
     * @returns {Promise<boolean>}
     */
    function showSiteConfirm(message, opts) {
        opts = opts || {};
        return new Promise(function (resolve) {
            var els = getConfirmEls();
            if (!els || !els.titleEl || !els.msgEl || !els.btnOk || !els.btnCancel) {
                resolve(window.confirm(String(message)));
                return;
            }
            els.titleEl.textContent = opts.title != null ? String(opts.title) : t("site.confirm");
            els.msgEl.textContent = String(message);
            els.btnOk.textContent = opts.confirmLabel != null ? String(opts.confirmLabel) : t("site.confirm");
            els.btnCancel.textContent = opts.cancelLabel != null ? String(opts.cancelLabel) : t("site.cancel");

            var prevOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            els.overlay.classList.add("admin-confirm-overlay--open");
            els.overlay.setAttribute("aria-hidden", "false");

            function cleanup() {
                document.body.style.overflow = prevOverflow;
                els.overlay.classList.remove("admin-confirm-overlay--open");
                els.overlay.setAttribute("aria-hidden", "true");
                document.removeEventListener("keydown", onKey);
                els.overlay.removeEventListener("click", onOverlayClick);
                els.btnOk.removeEventListener("click", onOk);
                els.btnCancel.removeEventListener("click", onCancel);
            }

            function onOk() {
                cleanup();
                resolve(true);
            }
            function onCancel() {
                cleanup();
                resolve(false);
            }
            function onKey(e) {
                if (e.key === "Escape") {
                    e.preventDefault();
                    onCancel();
                }
            }
            function onOverlayClick(e) {
                if (e.target === els.overlay) {
                    onCancel();
                }
            }

            els.btnOk.addEventListener("click", onOk);
            els.btnCancel.addEventListener("click", onCancel);
            document.addEventListener("keydown", onKey);
            els.overlay.addEventListener("click", onOverlayClick);
            els.btnOk.focus();
        });
    }

    /**
     * @param {string} message
     * @param {string} [title]
     * @returns {Promise<void>}
     */
    function showSiteAlert(message, title) {
        return new Promise(function (resolve) {
            var els = getAlertEls();
            if (!els || !els.titleEl || !els.msgEl || !els.btnOk) {
                window.alert(String(message));
                resolve();
                return;
            }
            els.titleEl.textContent = title != null ? String(title) : t("site.notice");
            els.msgEl.textContent = String(message);

            var prevOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            els.overlay.classList.add("admin-confirm-overlay--open");
            els.overlay.setAttribute("aria-hidden", "false");

            function cleanup() {
                document.body.style.overflow = prevOverflow;
                els.overlay.classList.remove("admin-confirm-overlay--open");
                els.overlay.setAttribute("aria-hidden", "true");
                document.removeEventListener("keydown", onKey);
                els.overlay.removeEventListener("click", onOverlayClick);
                els.btnOk.removeEventListener("click", onOk);
            }

            function onOk() {
                cleanup();
                resolve();
            }
            function onKey(e) {
                if (e.key === "Escape") {
                    e.preventDefault();
                    onOk();
                }
            }
            function onOverlayClick(e) {
                if (e.target === els.overlay) {
                    onOk();
                }
            }

            els.btnOk.addEventListener("click", onOk);
            document.addEventListener("keydown", onKey);
            els.overlay.addEventListener("click", onOverlayClick);
            els.btnOk.focus();
        });
    }

    window.showSiteConfirm = showSiteConfirm;
    window.showSiteAlert = showSiteAlert;
})();
