/**
 * Desktop IPC channel allowlists shared by preload (SEC-03).
 */
"use strict";

const INVOKE_ALLOWLIST = [
    "engines:listPlay",
    "brain:computeMove",
    "brain:evaluatePosition",
    "brain:abortSearch",
    "game:appendPgn",
    "game:openPgnFolder",
    "app:quit",
];

const ON_ALLOWLIST = ["brain:searchProgress"];

function isInvokeAllowed(channel) {
    return INVOKE_ALLOWLIST.indexOf(channel) !== -1;
}

function isOnAllowed(channel) {
    return ON_ALLOWLIST.indexOf(channel) !== -1;
}

module.exports = {
    INVOKE_ALLOWLIST,
    ON_ALLOWLIST,
    isInvokeAllowed,
    isOnAllowed,
};
