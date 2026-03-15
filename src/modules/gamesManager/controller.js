const gamesManagerService = require("./service");
const { validate } = require("../../serverValidations");
const { User } = require("../user/model");

exports.showHomePage = async (req, res) => {

    const username = req.session.user_name;
    const onGoing = await gamesManagerService.getOnGoingOnlineGames(10);
    const allGames = onGoing.map((g) => {
        const whiteName = g.whitePlayer?.userName || "";
        const blackName = g.blackPlayer?.userName || "";
        const isParticipant = whiteName === username || blackName === username;
        return {
            Id: g.gameId,
            Game: whiteName + " Vs. " + blackName,
            Started: g.startedOn ? parseInt((Date.now() - g.startedOn) / 1000 / 60, 10) + " minutes ago" : "Not started",
            Moves: Math.ceil((g.moves || []).length / 2),
            Status: g.state === "on hold" ? "On hold" : "In progress",
            IsParticipant: isParticipant,
        };
    });
    //console.log(allGames);
    //req.session.gameId = null; // why? this causes a crash on back button

    res.locals.username = username;
    let playerGames = await gamesManagerService.getRecentFinishedGamesByUsername(username, 10);
    // Home page: only these columns (exclude Reason, Type, Status)
    const homeColumns = ["Id", "Date", "Time", "White", "Black", "Result", "Moves"];
    playerGames = playerGames.map((g) => {
        const out = {};
        for (const k of homeColumns) {
            if (Object.prototype.hasOwnProperty.call(g, k)) out[k] = g[k];
        }
        if (Object.prototype.hasOwnProperty.call(g, "_sortableDate")) out._sortableDate = g._sortableDate;
        return out;
    });
    res.locals.playerGames = playerGames;
    let lastGameOptions = null;
    if (req.session.user_id) {
        const user = await User.findById(req.session.user_id).select("lastGameOptions").lean();
        if (user && user.lastGameOptions) {
            lastGameOptions = user.lastGameOptions;
        }
    }
    res.render("welcome", { allGames, lastGameOptions });
};

exports.getActiveGamesJson = async (req, res) => {
    const username = req.session.user_name;
    const onGoing = await gamesManagerService.getOnGoingOnlineGames(10);
    const allGames = onGoing.map((g) => {
        const whiteName = g.whitePlayer?.userName || "";
        const blackName = g.blackPlayer?.userName || "";
        const isParticipant = whiteName === username || blackName === username;
        return {
            Id: g.gameId,
            Game: whiteName + " Vs. " + blackName,
            Started: g.startedOn
                ? parseInt((Date.now() - g.startedOn) / 1000 / 60, 10) + " minutes ago"
                : "Not started",
            Moves: Math.ceil((g.moves || []).length / 2),
            Status: g.state === "on hold" ? "On hold" : "In progress",
            IsParticipant: isParticipant,
            whitePlayerName: whiteName,
            blackPlayerName: blackName,
        };
    });
    res.json(allGames);
};

exports.showList = async (req, res) => {

    const username = req.session.user_name;
    const numberOfGamesToRetrieve = 50;
    const playerGames = await gamesManagerService.getRecentGamesByUsername(username, numberOfGamesToRetrieve);
    res.locals.username = username;
    res.render("list", { playerGames });
};

exports.search = async (req, res) => {
    let { page, q, sort: sortKey, order: sortOrder } = req.query;
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
    const sortKey = req.body.sortKey;
    const sortOrder = req.body.sortOrder;
    const query = [];
    if (sortKey) query.push("sort=" + encodeURIComponent(sortKey));
    if (sortOrder) query.push("order=" + encodeURIComponent(sortOrder));
    const qs = query.length ? "?" + query.join("&") : "";
    res.redirect("/list" + qs);
};


exports.generateState = async (req, res) => {
    const files = await gamesManagerService.getPGNFiles();
    const pgnGames = await gamesManagerService.readPGNGames(files);
    await gamesManagerService.addGamesToDB(pgnGames);
    res.redirect("list");
};