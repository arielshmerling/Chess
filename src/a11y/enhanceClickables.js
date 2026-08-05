/**
 * Make click-activated rows/controls keyboard operable (Enter / Space).
 */
(function () {
    "use strict";

    function enhance(el) {
        if (!el || el.getAttribute("data-a11y-enhanced") === "1") {
            return;
        }
        el.setAttribute("data-a11y-enhanced", "1");
        if (!el.hasAttribute("tabindex")) {
            el.setAttribute("tabindex", "0");
        }
        if (!el.getAttribute("role") && el.tagName === "TR") {
            el.setAttribute("role", "link");
        }
        el.addEventListener("keydown", function (e) {
            if (e.key !== "Enter" && e.key !== " ") {
                return;
            }
            e.preventDefault();
            if (typeof el.click === "function") {
                el.click();
            } else if (typeof el.onclick === "function") {
                el.onclick.call(el, e);
            }
        });
    }

    function scan(root) {
        var scope = root || document;
        var nodes = scope.querySelectorAll(
            "tr[onclick], .selectionOption[onclick], [data-a11y-activate='click']",
        );
        for (var i = 0; i < nodes.length; i++) {
            enhance(nodes[i]);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            scan(document);
        });
    } else {
        scan(document);
    }

    window.ShmerlingA11yEnhance = { scan: scan, enhance: enhance };
})();
