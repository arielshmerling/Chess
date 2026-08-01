/**
 * Normalize friend-invite game options from API body (server).
 * @param {object} [raw]
 */
function normalizeFriendInviteOptions(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    let tm = parseInt(src.timeMinutes, 10);
    if (!Number.isFinite(tm) || tm < 1) {
        tm = 90;
    }
    if (tm > 180) {
        tm = 180;
    }
    let color = String(src.color || "white").toLowerCase();
    if (color !== "white" && color !== "black" && color !== "random") {
        color = "white";
    }
    return {
        timeMinutes: tm,
        color: color,
        /* Online undo is not implemented. */
        allowUndo: false,
        friendly: src.friendly !== false && src.friendly !== "0" && src.friendly !== 0,
        isPrivate: src.isPrivate === true || src.isPrivate === "1" || src.isPrivate === 1,
    };
}

/**
 * Resolve inviter's seat color (random → white|black).
 * @param {{ color: string }} opts
 * @returns {"white"|"black"}
 */
function resolveInviterColor(opts) {
    if (opts && opts.color === "black") {
        return "black";
    }
    if (opts && opts.color === "random") {
        return Math.random() < 0.5 ? "white" : "black";
    }
    return "white";
}

/**
 * Snapshot for WS / friends data / invite banner.
 * @param {object} opts normalized options
 * @param {"white"|"black"} inviterColor resolved
 */
function buildInviteOfferSnapshot(opts, inviterColor) {
    const inviterPlaysWhite = inviterColor !== "black";
    return {
        timeMinutes: opts.timeMinutes,
        allowUndo: opts.allowUndo === true,
        friendly: opts.friendly === true,
        isPrivate: opts.isPrivate === true,
        inviterPlaysWhite: inviterPlaysWhite,
        youPlayAs: inviterPlaysWhite ? "black" : "white",
    };
}

module.exports = {
    normalizeFriendInviteOptions,
    resolveInviterColor,
    buildInviteOfferSnapshot,
};
