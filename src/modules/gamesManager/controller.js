const gamesManagerService = require("./service");
const { validate } = require("../../serverValidations");
const { User } = require("../user/model");

exports.showHomePage = async (req, res) => {

    const onGoing = await gamesManagerService.getOnGoingOnlineGames(10);
    // console.log(onGoing);
    const allGames = onGoing.map(g => {
        return {
            Id: g.gameId,
            Game: g.whitePlayer.userName + " Vs. " + g.blackPlayer.userName,
            Started: g.startedOn ? parseInt((Date.now() - g.startedOn) / 1000 / 60) + " minutes ago" : "Not started",
            Moves: Math.ceil(g.moves.length / 2),
        };
    }
    );
    //console.log(allGames);
    //req.session.gameId = null; // why? this causes a crash on back button

    const username = req.session.user_name;
    res.locals.username = username;
    let playerGames = await gamesManagerService.getRecentGamesByUsername(username, 10);
    playerGames = playerGames.map(({ Reason, Type, ...rest }) => rest);
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

exports.showList = async (req, res) => {

    const username = req.session.user_name;
    const numberOfGamesToRetrieve = 50;
    const playerGames = await gamesManagerService.getRecentGamesByUsername(username, numberOfGamesToRetrieve);
    res.locals.username = username;
    res.render("list", { playerGames });
};

exports.search = async (req, res) => {
    let { page, q } = req.query;
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
    res.render("search", { pgn, recordsPerPage, totalPages, page, q });
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
    res.redirect("/list");
};


exports.generateState = async (req, res) => {
    const files = await gamesManagerService.getPGNFiles();
    const pgnGames = await gamesManagerService.readPGNGames(files);
    await gamesManagerService.addGamesToDB(pgnGames);
    res.redirect("list");
};