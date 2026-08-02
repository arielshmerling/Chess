/**
 * Applies static Play shell labels from the string catalog (play.html).
 */
(function () {
    "use strict";

    function apply() {
        const strings = window.ShmerlingStrings;
        if (!strings || typeof strings.t !== "function") {
            return;
        }
        const t = strings.t;
        document.querySelectorAll("[data-i18n]").forEach(function (el) {
            const key = el.getAttribute("data-i18n");
            if (!key) {
                return;
            }
            const text = t(key);
            const attr = el.getAttribute("data-i18n-attr");
            if (attr) {
                attr.split(/\s+/).forEach(function (name) {
                    if (name) {
                        el.setAttribute(name, text);
                    }
                });
            } else {
                el.textContent = text;
            }
            const titleKey = el.getAttribute("data-i18n-title");
            if (titleKey) {
                el.setAttribute("title", t(titleKey));
            }
        });
        const titleKey = document.documentElement.getAttribute("data-i18n-title");
        if (titleKey) {
            document.title = t(titleKey);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", apply);
    } else {
        apply();
    }
})();
