/**
 * Pure logic for Quit / back-to-home behavior (matches chessboard backToHome).
 * Used by tests and can be required from the client bundle.
 */

/**
 * Human has made at least one move (white moves first).
 */
function humanHasMoved(currentPlayerIsWhite, movesLength) {
    const n = movesLength | 0;
    if (currentPlayerIsWhite) {
        return n >= 1;
    }
    return n >= 2;
}

/**
 * When true, navigate home without confirmation dialog.
 * Mirrors: game.GameOver || mode === "review" || watcher || !humanHasMoved
 */
function shouldNavigateHomeWithoutConfirm(options) {
    const {
        gameOver,
        mode,
        watcher,
        currentPlayerIsWhite,
        movesLength,
    } = options;
    if (gameOver) {
        return true;
    }
    if (mode === "review") {
        return true;
    }
    if (watcher === true) {
        return true;
    }
    if (!humanHasMoved(currentPlayerIsWhite, movesLength)) {
        return true;
    }
    return false;
}

/**
 * Confirm dialog text when user must confirm before leaving (has moved, game not over, not review).
 * PracticeGame → "Are you sure?"; other types → "Resign?"
 */
function getQuitConfirmText(gameType) {
    return gameType === "PracticeGame" ? "Are you sure?" : "Resign?";
}

/**
 * Describes what backToHome should do before any DOM/button state.
 * homeBtnDisabled: if true, caller returns without doing anything.
 */
function getBackToHomePlan(options) {
    const {
        homeBtnDisabled,
        gameOver,
        mode,
        watcher,
        gameType,
        currentPlayerIsWhite,
        movesLength,
    } = options;

    if (homeBtnDisabled) {
        return { action: "noop" };
    }
    if (shouldNavigateHomeWithoutConfirm({ gameOver, mode, watcher, currentPlayerIsWhite, movesLength })) {
        return { action: "navigate" };
    }
    return {
        action: "confirm",
        confirmText: getQuitConfirmText(gameType),
    };
}

module.exports = {
    humanHasMoved,
    shouldNavigateHomeWithoutConfirm,
    getQuitConfirmText,
    getBackToHomePlan,
};
