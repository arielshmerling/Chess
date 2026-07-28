/**
 * Desktop position validation — delegates to shared ShmerlingPositionValidation.
 */
(function (global) {
    "use strict";

    function getPositionValidationMessage(chessGame, purpose) {
        const api = global.ShmerlingPositionValidation;
        if (api && typeof api.getMessage === "function") {
            return api.getMessage(chessGame, purpose);
        }
        return null;
    }

    global.DesktopPositionValidation = {
        getMessage: getPositionValidationMessage,
    };
})(typeof window !== "undefined" ? window : globalThis);
