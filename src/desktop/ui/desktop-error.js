(function () {
    "use strict";
    function init() {
        var params = new URLSearchParams(window.location.search);
        var msg = params.get("message");
        var code = params.get("status");
        if (msg) {
            document.getElementById("desktopErrorMessage").textContent = msg;
        }
        if (code) {
            document.getElementById("desktopErrorCode").textContent = "Error " + code;
        }
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
