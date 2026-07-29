const gamesManagerService = require("./service");
const { validate } = require("../../serverValidations");
const { User } = require("../user/model");
const { t, resolveRequestLocale } = require("../../strings");

/**
 * @param {number|null|undefined} startedMs
 * @param {string} [locale]
 * @returns {{ label: string, tooltip: string, minutes: number|null }}
 */
function formatStartedLabel(startedMs, locale) {
    if (!startedMs) {
        return { label: t("site.activeGames.notStarted", null, locale), tooltip: "", minutes: null };
    }
    const minutesAgo = Math.max(0, parseInt((Date.now() - startedMs) / 1000 / 60, 10) || 0);
    let label;
    if (minutesAgo < 1) {
        label = t("site.activeGames.justStarted", null, locale);
    } else if (minutesAgo === 1) {
        label = t("site.activeGames.oneMinuteAgo", null, locale);
    } else {
        label = t("site.activeGames.minutesAgo", { count: minutesAgo }, locale);
    }
    let tooltip = "";
    try {
        tooltip = t("site.activeGames.startedTooltip", {
            when: new Date(startedMs).toLocaleString(),
        }, locale);
    } catch {
        tooltip = "";
    }
    return { label, tooltip, minutes: minutesAgo };
}

function statusDisplay(state, locale) {
    if (state === "on hold") {
        return { key: "onHold", label: t("site.activeGames.onHold", null, locale) };
    }
    return { key: "inProgress", label: t("site.activeGames.inProgress", null, locale) };
}

/**
 * @param {object} g - row from getOnGoingOnlineGames
 * @param {string} username
 * @param {{ board?: unknown[][], turn?: string, isHighlight?: boolean }} [extras]
 */
function userAgentLooksMobile(req) {
    const ua = (req.get("user-agent") || "").toLowerCase();
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua);
}

/**
 * Shared data for `welcome` and `mobile-welcome` (same queries and column shaping).
 */
async function loadHomePageData(req) {
    const username = req.session.user_name;
    const locale = resolveRequestLocale(req);
    const onGoing = await gamesManagerService.getOnGoingOnlineGames(3);
    const allGames = onGoing.map((g) => {
        const snap = gamesManagerService.getActiveGameBoardSnapshot(g.gameId, g.moves || []);
        return mapOngoingGameForClient(g, username, {
            board: snap ? snap.board : null,
            turn: snap ? snap.turn : "white",
            isHighlight: true,
        }, locale);
    });

    let playerGames = await gamesManagerService.getRecentFinishedGamesByUsername(username, 10);
    const homeColumns = ["Id", "Date", "Time", "White", "Black", "Result", "Moves"];
    playerGames = playerGames.map((g) => {
        const out = {};
        for (const k of homeColumns) {
            if (Object.prototype.hasOwnProperty.call(g, k)) { out[k] = g[k]; }
        }
        if (Object.prototype.hasOwnProperty.call(g, "_sortableDate")) { out._sortableDate = g._sortableDate; }
        const reason = g.Reason != null ? String(g.Reason).trim() : "";
        if (reason) {
            out._resultReason = reason;
        }
        return out;
    });

    let lastGameOptions = null;
    if (req.session.user_id) {
        const user = await User.findById(req.session.user_id).select("lastGameOptions").lean();
        if (user && user.lastGameOptions) {
            lastGameOptions = { ...user.lastGameOptions };
            // Promote previous Play Now product defaults to Brain 4.3.
            if (lastGameOptions.engine === "brain41" || lastGameOptions.engine === "brain4") {
                lastGameOptions.engine = "brain43";
            }
        }
    }

    return { username, allGames, playerGames, lastGameOptions };
}

function mapOngoingGameForClient(g, username, extras = {}, locale) {
    const whiteName = g.whitePlayer?.userName || "";
    const blackName = g.blackPlayer?.userName || "";
    const isParticipant = whiteName === username || blackName === username;
    const startedMs = g.startedOn;
    const moveCount = g.moves ? g.moves.length : 0;
    const halfMoves = Math.ceil(moveCount / 2);
    const started = formatStartedLabel(startedMs, locale);
    const status = statusDisplay(g.state, locale);
    const row = {
        Id: g.gameId,
        Game: t("site.activeGames.playersVs", { white: whiteName, black: blackName }, locale),
        Started: started.label,
        startedAtMs: startedMs,
        StartedMinutes: started.minutes,
        StartedTooltip: started.tooltip,
        Moves: halfMoves,
        Status: status.label,
        StatusKey: status.key,
        IsParticipant: isParticipant,
        whitePlayerName: whiteName,
        blackPlayerName: blackName,
    };
    if (extras.board) {
        row.board = extras.board;
    }
    if (extras.turn) {
        row.turn = extras.turn;
    }
    if (extras.isHighlight != null) {
        row.isHighlight = extras.isHighlight;
    }
    return row;
}

exports.showHomePage = async (req, res) => {
    if (userAgentLooksMobile(req) && req.query.desktop !== "1") {
        const q = req.originalUrl.indexOf("?") >= 0 ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
        return res.redirect(302, "/mobile-home" + q);
    }
    const ctx = await loadHomePageData(req);
    res.locals.username = ctx.username;
    res.locals.playerGames = ctx.playerGames;
    res.render("welcome", {
        allGames: ctx.allGames,
        lastGameOptions: ctx.lastGameOptions,
    });
};

/** Same data as `showHomePage`; renders compact mobile-only template. */
exports.showHomePageMobile = async (req, res) => {
    const ctx = await loadHomePageData(req);
    res.locals.username = ctx.username;
    res.locals.playerGames = ctx.playerGames;
    res.render("mobile-welcome", {
        allGames: ctx.allGames,
        lastGameOptions: ctx.lastGameOptions,
    });
};

exports.getActiveGamesJson = async (req, res) => {
    const username = req.session.user_name;
    const locale = resolveRequestLocale(req);
    const limitRaw = req.query.limit;
    const limit = Math.min(Math.max(parseInt(String(limitRaw || "10"), 10) || 10, 1), 200);
    const includeBoard = req.query.includeBoard === "1" || req.query.includeBoard === "true";
    const onGoing = await gamesManagerService.getOnGoingOnlineGames(limit);
    let allGames;
    if (includeBoard) {
        allGames = onGoing.map((g) => {
            const snap = gamesManagerService.getActiveGameBoardSnapshot(g.gameId, g.moves || []);
            return mapOngoingGameForClient(g, username, {
                board: snap ? snap.board : null,
                turn: snap ? snap.turn : "white",
                isHighlight: true,
            }, locale);
        });
    } else {
        allGames = onGoing.map((g) => mapOngoingGameForClient(g, username, {}, locale));
    }
    res.json(allGames);
};

exports.showActiveGamesListPage = async (req, res) => {
    const username = req.session.user_name;
    const locale = resolveRequestLocale(req);
    const onGoing = await gamesManagerService.getOnGoingOnlineGames(100);
    const allGames = onGoing.map((g) => mapOngoingGameForClient(g, username, {}, locale));
    res.locals.username = username;
    res.render("active-games-list", { allGames });
};

exports.showList = async (req, res) => {

    const username = req.session.user_name;
    const numberOfGamesToRetrieve = 50;
    const playerGames = await gamesManagerService.getRecentGamesByUsername(username, numberOfGamesToRetrieve);
    res.locals.username = username;
    res.render("list", { playerGames });
};

exports.search = async (req, res) => {
    let { page, q } = req.query;
    const { sort: sortKey, order: sortOrder } = req.query;
    if (!page) {
        page = 1; // default
    }
    try {
        validate(q, "search");
    }
    catch {
        q = "";
    }
    const username = req.session.user_name;
    let pgnGames = await gamesManagerService.getPGNGames();
    if (q) {
        pgnGames = pgnGames.filter(g => {
            return g.site.toLowerCase().indexOf(q.toLowerCase()) != -1 ||
                g.white.toLowerCase().indexOf(q.toLowerCase()) != -1 ||
                g.black.toLowerCase().indexOf(q.toLowerCase()) != -1 ||
                g.event.toLowerCase().indexOf(q.toLowerCase()) != -1 ||
                g.date.indexOf(q) != -1;
        });
    }
    pgnGames = pgnGames.slice(0, 200000);
    const pgn = pgnGames.map(({ moves, ...rest }) => rest);
    res.locals.username = username;
    const recordsPerPage = 20;
    const totalPages = Math.ceil(pgnGames.length / recordsPerPage);
    res.render("search", { pgn, recordsPerPage, totalPages, page, q, sortKey: sortKey || null, sortOrder: sortOrder || null });
};

// exports.filter = async (req, res) => {
//     const { searchText } = req.body;
//     const username = req.session.user_name;
//     let pgnGames = await gamesManagerService.getPGNGames(searchText);

//     pgnGames = pgnGames.filter(g => {
//         return g.site.toLowerCase().indexOf(searchText.toLowerCase()) != -1 ||
//             g.white.toLowerCase().indexOf(searchText.toLowerCase()) != -1 ||
//             g.black.toLowerCase().indexOf(searchText.toLowerCase()) != -1 ||
//             g.event.toLowerCase().indexOf(searchText.toLowerCase()) != -1 ||
//             g.date.indexOf(searchText) != -1;
//     });
//     pgnGames = pgnGames.slice(0, 20000);
//     const pgn = pgnGames.map(({ moves, ...rest }) => rest);
//     res.locals.username = username;
//     const recordsPerPage = 20;
//     const totalPages = Math.floor(pgnGames.length / recordsPerPage);
//     res.render("search", { pgn, recordsPerPage, totalPages });
// };

exports.delete = async (req, res) => {
    const { id } = req.params;
    await gamesManagerService.deleteGame(id);
    const returnTo = req.body.returnTo;
    /** Allowlist only — never redirect to arbitrary URLs from POST body */
    if (returnTo === "/admin") {
        res.redirect("/admin?tab=games");
        return;
    }
    const sortKey = req.body.sortKey;
    const sortOrder = req.body.sortOrder;
    const query = [];
    if (sortKey) {query.push("sort=" + encodeURIComponent(sortKey));}
    if (sortOrder) {query.push("order=" + encodeURIComponent(sortOrder));}
    const qs = query.length ? "?" + query.join("&") : "";
    res.redirect("/list" + qs);
};


exports.generateState = async (req, res) => {
    const files = await gamesManagerService.getPGNFiles();
    const pgnGames = await gamesManagerService.readPGNGames(files);
    await gamesManagerService.addGamesToDB(pgnGames);
    res.redirect("list");
};

/** Admin-only: rebuild `data/opening-book-lines.txt` from PGNs; does not write Mongo. */
exports.generateOpeningBook = async (req, res) => {
    const files = await gamesManagerService.getOpeningBookPGNFiles();
    const pgnGames = await gamesManagerService.readPGNGames(files);
    const stats = await gamesManagerService.addGamesToOpeningBook(pgnGames);
    res.type("json").send({
        ok: true,
        file: gamesManagerService.getOpeningBookLinesPath(),
        gamesCompleted: stats && stats.gamesCompleted != null ? stats.gamesCompleted : null,
        entryCount: stats && stats.positionCount != null ? stats.positionCount : null,
    });
};