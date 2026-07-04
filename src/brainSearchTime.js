/** Shared timed-search helpers for brain41 / brain42 / brain43 worker search. */

let searchDeadlineMs = 0;
let searchTimeExceeded = false;

function beginTimedSearch(thinkingTimeMs) {
    searchDeadlineMs = Date.now() + Math.max(1, Math.floor(Number(thinkingTimeMs) || 1));
    searchTimeExceeded = false;
}

function endTimedSearch() {
    searchDeadlineMs = 0;
    searchTimeExceeded = false;
}

function shouldStopSearch() {
    if (searchTimeExceeded) {
        return true;
    }
    if (searchDeadlineMs > 0 && Date.now() >= searchDeadlineMs) {
        searchTimeExceeded = true;
        return true;
    }
    return false;
}

function getRemainingSearchMs() {
    if (searchDeadlineMs <= 0) {
        return Infinity;
    }
    return Math.max(0, searchDeadlineMs - Date.now());
}

function wasSearchTimedOut() {
    return searchTimeExceeded;
}

function getSearchDeadlineMs() {
    return searchDeadlineMs;
}

/** Sync deadline into a child worker thread (same module, separate isolate). */
function syncSearchDeadline(deadlineMs) {
    const deadline = Math.floor(Number(deadlineMs) || 0);
    searchDeadlineMs = deadline;
    searchTimeExceeded = deadline > 0 && Date.now() >= deadline;
}

module.exports = {
    beginTimedSearch,
    endTimedSearch,
    shouldStopSearch,
    getRemainingSearchMs,
    getSearchDeadlineMs,
    syncSearchDeadline,
    wasSearchTimedOut,
};
