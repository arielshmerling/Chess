/**
 * Play engine compute facade: brains + UCI backends.
 */

"use strict";

const desktopBrainService = require("../desktop/desktopBrainService");
const registry = require("./registry");
const uciBackend = require("./uci/uciBackend");
const enablementStore = require("./engineEnablementStore");

/**
 * @param {object} [opts]
 * @param {boolean} [opts.includeDisabled] - include admin-disabled engines (admin UI)
 * @param {boolean} [opts.skipUciProbe] - do not spawn UCI; treat configured command as available
 * @param {number} [opts.probeTimeoutMs] - UCI handshake timeout (default 800ms)
 */
async function listPlayEnginesForClient(opts) {
    const includeDisabled = !!(opts && opts.includeDisabled);
    const skipUciProbe = !!(opts && opts.skipUciProbe);
    const probeTimeoutMs =
        opts && typeof opts.probeTimeoutMs === "number" && opts.probeTimeoutMs > 0
            ? opts.probeTimeoutMs
            : 800;
    const disabled = await enablementStore.getDisabledSet();
    const defs = registry.listPlayEngines();
    const out = [];
    for (let i = 0; i < defs.length; i += 1) {
        const def = defs[i];
        const enabled = !disabled.has(def.id);
        if (!includeDisabled && !enabled) {
            continue;
        }
        let available = def.alwaysAvailable === true;
        let unavailableReason = null;
        if (def.backend === "uci") {
            const command = registry.resolveUciCommand(def, process.env);
            if (!command) {
                available = false;
                unavailableReason = "command not configured";
            } else if (skipUciProbe) {
                /* Launch/boot path: never wait on Stockfish spawn. */
                available = true;
                unavailableReason = null;
            } else {
                const probe = await uciBackend.probeAvailability(def.id, {
                    timeoutMs: probeTimeoutMs,
                });
                available = !!probe.available;
                unavailableReason = available ? null : probe.error || "unavailable";
            }
        }
        out.push({
            id: def.id,
            labelKey: def.labelKey,
            fallbackLabel: def.fallbackLabel,
            backend: def.backend,
            available,
            unavailableReason,
            enabled,
        });
    }
    return out;
}

/**
 * Full Play catalog for Admin Engines tab (includes disabled + command hints).
 */
async function listPlayEnginesForAdmin() {
    const disabled = await enablementStore.getDisabledSet();
    const defs = registry.listPlayEngines();
    const out = [];
    for (let i = 0; i < defs.length; i += 1) {
        const def = defs[i];
        const enabled = !disabled.has(def.id);
        let available = def.alwaysAvailable === true;
        let unavailableReason = null;
        let command = null;
        if (def.backend === "uci") {
            command = registry.resolveUciCommand(def, process.env);
            const probe = await uciBackend.probeAvailability(def.id, { timeoutMs: 2000 });
            available = !!probe.available;
            unavailableReason = available ? null : probe.error || "unavailable";
        }
        out.push({
            id: def.id,
            labelKey: def.labelKey,
            fallbackLabel: def.fallbackLabel,
            backend: def.backend,
            alwaysAvailable: def.alwaysAvailable === true,
            commandEnv: def.commandEnv || null,
            commandFallback: def.commandFallback || null,
            command,
            available,
            unavailableReason,
            enabled,
        });
    }
    return out;
}

/**
 * @param {string} id
 * @param {boolean} enabled
 */
async function setPlayEngineEnabled(id, enabled) {
    const def = registry.getEngine(id);
    if (!def) {
        const err = new Error(`Unknown Play engine: ${id}`);
        err.code = "ENGINE_NOT_FOUND";
        throw err;
    }
    await enablementStore.setEngineEnabled(id, enabled === true);
    const list = await listPlayEnginesForAdmin();
    return list.find((e) => e.id === id) || null;
}

/**
 * Resolve a client-requested engine to an enabled Play id, or null if none enabled.
 * @param {string} [requested]
 * @returns {Promise<string|null>}
 */
async function resolveEnabledPlayEngine(requested) {
    const disabled = await enablementStore.getDisabledSet();
    const ids = registry.playEngineIds();
    const req = typeof requested === "string" ? requested.trim() : "";
    if (req && ids.indexOf(req) !== -1 && !disabled.has(req)) {
        return req;
    }
    for (let i = 0; i < ids.length; i += 1) {
        if (!disabled.has(ids[i])) {
            return ids[i];
        }
    }
    return null;
}

async function assertEngineEnabledForCompute(engineId) {
    const id = typeof engineId === "string" && engineId.trim() ? engineId.trim() : "brain43";
    if (!registry.getEngine(id)) {
        return id;
    }
    if (!(await enablementStore.isEngineEnabled(id))) {
        const err = new Error(`Engine "${id}" is disabled by an administrator`);
        err.code = "ENGINE_DISABLED";
        throw err;
    }
    return id;
}

/**
 * @param {object} opts
 * @param {(progress: object) => void} [onProgress]
 */
async function computeMove(opts, onProgress) {
    const engine = await assertEngineEnabledForCompute((opts && opts.engine) || "brain43");
    const nextOpts = opts && typeof opts === "object" ? { ...opts, engine } : { engine };
    if (registry.isUciEngine(engine)) {
        return uciBackend.computeMove(nextOpts);
    }
    return desktopBrainService.computeMove(nextOpts, onProgress);
}

async function evaluatePosition(opts) {
    const engine = await assertEngineEnabledForCompute((opts && opts.engine) || "brain43");
    if (registry.isUciEngine(engine)) {
        throw new Error(`Evaluation display is not supported for engine "${engine}"`);
    }
    const nextOpts = opts && typeof opts === "object" ? { ...opts, engine } : { engine };
    return desktopBrainService.evaluatePosition(nextOpts);
}

function abortSearch() {
    uciBackend.abortSearch();
    desktopBrainService.abortSearch();
}

function disposeEngines() {
    abortSearch();
    if (typeof uciBackend.disposeAll === "function") {
        uciBackend.disposeAll();
    }
}

module.exports = {
    computeMove,
    evaluatePosition,
    abortSearch,
    disposeEngines,
    listPlayEnginesForClient,
    listPlayEnginesForAdmin,
    setPlayEngineEnabled,
    resolveEnabledPlayEngine,
    SearchAbortedError: desktopBrainService.SearchAbortedError,
};
