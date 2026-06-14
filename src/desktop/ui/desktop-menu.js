(function () {
    "use strict";
    function init() {
        document.getElementById("desktopMenuPlayBtn")?.addEventListener("click", function () {
            window.location.href = "/app/play";
        });
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
