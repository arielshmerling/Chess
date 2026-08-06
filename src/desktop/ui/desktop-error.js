(function () {
    "use strict";

    function t(key, params) {
        if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
            return window.ShmerlingStrings.t(key, params);
        }
        return key;
    }

    function init() {
        var params = new URLSearchParams(window.location.search);
        var msg = params.get("message");
        var code = params.get("status");
        if (msg) {
            document.getElementById("desktopErrorMessage").textContent = msg;
        }
        if (code) {
            document.getElementById("desktopErrorCode").textContent = t("errorPage.code", {
                code: code,
            });
        }
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
