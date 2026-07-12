/**
 * Full-screen helpers for the play shell (browser + Electron renderer).
 */
(function (global) {
    "use strict";

    function getFullscreenElement() {
        return (
            document.fullscreenElement
            || document.webkitFullscreenElement
            || document.mozFullScreenElement
            || document.msFullscreenElement
            || null
        );
    }

    function isFullscreen() {
        return !!getFullscreenElement();
    }

    function requestFullscreen() {
        const el = document.documentElement;
        if (el.requestFullscreen) {
            return el.requestFullscreen();
        }
        if (el.webkitRequestFullscreen) {
            return el.webkitRequestFullscreen();
        }
        if (el.mozRequestFullScreen) {
            return el.mozRequestFullScreen();
        }
        if (el.msRequestFullscreen) {
            return el.msRequestFullscreen();
        }
        return Promise.reject(new Error("Full screen is not supported in this browser."));
    }

    function exitFullscreen() {
        if (document.exitFullscreen) {
            return document.exitFullscreen();
        }
        if (document.webkitExitFullscreen) {
            return document.webkitExitFullscreen();
        }
        if (document.mozCancelFullScreen) {
            return document.mozCancelFullScreen();
        }
        if (document.msExitFullscreen) {
            return document.msExitFullscreen();
        }
        return Promise.reject(new Error("Full screen is not supported in this browser."));
    }

    function toggleFullscreen() {
        if (isFullscreen()) {
            return exitFullscreen();
        }
        return requestFullscreen();
    }

    function onFullscreenChange(callback) {
        if (typeof callback !== "function") {
            return function () {};
        }
        const events = [
            "fullscreenchange",
            "webkitfullscreenchange",
            "mozfullscreenchange",
            "MSFullscreenChange",
        ];
        events.forEach(function (name) {
            document.addEventListener(name, callback);
        });
        return function unsubscribe() {
            events.forEach(function (name) {
                document.removeEventListener(name, callback);
            });
        };
    }

    global.DesktopFullscreen = {
        isFullscreen,
        requestFullscreen,
        exitFullscreen,
        toggleFullscreen,
        onFullscreenChange,
    };
})(window);
