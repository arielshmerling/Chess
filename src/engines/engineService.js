/**
 * Prefer-Play engine compute facade: brains + UCI backends.
 */

"use strict";

const desktopBrainService = require("../desktop/desktopBrainService");
const registry = require("./registry");
const uciBackend = require("./uci/uciBackend");

async function listPreferPlayEnginesForClient() {
    const defs = registry.listPreferPlayEngines();
    const out = [];
    for (let i = 0; i < defs.length; i += 1) {
        const def = defs[i];
        let available = def.alwaysAvailable === true;
        let unavailableReason = null;
        if (def.backend === "uci") {
            const probe = await uciBackend.probeAvailability(def.id, { timeoutMs: 2000 });
            available = !!probe.available;
            unavailableReason = available ? null : probe.error || "unavailable";
        }
        out.push({
            id: def.id,
            labelKey: def.labelKey,
            fallbackLabel: def.fallbackLabel,
            backend: def.backend,
            available,
            unavailableReason,
        });
    }
    return out;
}

/**
 * @param {object} opts
 * @param {(progress: object) => void} [onProgress]
 */
async function computeMove(opts, onProgress) {
    const engine = (opts && opts.engine) || "brain43";
    if (registry.isUciEngine(engine)) {
        return uciBackend.computeMove(opts);
    }
    return desktopBrainService.computeMove(opts, onProgress);
}

async function evaluatePosition(opts) {
    const engine = (opts && opts.engine) || "brain43";
    if (registry.isUciEngine(engine)) {
        throw new Error(`Evaluation display is not supported for engine "${engine}"`);
    }
    return desktopBrainService.evaluatePosition(opts);
}

function abortSearch() {
    uciBackend.abortSearch();
    desktopBrainService.abortSearch();
}

module.exports = {
    computeMove,
    evaluatePosition,
    abortSearch,
    listPreferPlayEnginesForClient,
    SearchAbortedError: desktopBrainService.SearchAbortedError,
};
