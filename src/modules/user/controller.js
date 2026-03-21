
const catchAsync = require("../../utils/catchAsync");
const ExpressError = require("../../utils/ExpressError");
const userService = require("./service");

exports.showLoginPage = (req, res) => {

    const { f } = req.query;
    let errorMessage = "";
    if (f == "error") {
        errorMessage = "Wrong username or password";

    }
    res.locals.username = "";
    // const username = req.session.user_name || "Guest";
    const game = { username: "" };

    res.render("login", { errorMessage, game });
};

exports.logout = async (req, res) => {
    req.session.user_id = null;
    req.session = null;

    res.redirect("/login"); // or home
};

exports.validateUsername = catchAsync(async (req, res) => {
    const { username } = req.query;
    const foundUser = await userService.userExist(username);
    if (foundUser) {
        res.send("FOUND USER");
    }
    else {
        res.send("NOT FOUND");
    }
});

exports.getBookmarks = catchAsync(async (req, res) => {
    const userId = req.session.user_id;

    if (userId) {
        const userBookmarks = await userService.getAllUserBookmarks(userId);
        res.send(userBookmarks);
    }
});

exports.setBookmark = catchAsync(async (req, res) => {
    const userId = req.session.user_id;
    const { gameState, name, gameType, moves } = req.body;

    if (userId) {
        await userService.addBookmark(userId, gameState, name, gameType, moves);
        res.send("OK");
    }
    else {
        console.log("Bad request. No userId");
        res.send("ERROR");
    }
});

exports.updateBookmark = catchAsync(async (req, res) => {
    const userId = req.session.user_id;
    const { id, name, gameType, date, gameState, moves } = req.body;

    if (id) {
        await userService.updateBookmark(userId, id, date, name, gameType, gameState, moves);
        res.send("{ \"status\": \"OK\" }");
    }
    else {
        console.log("Bad request. No bookmarkId");
        res.send("ERROR");
    }
});

exports.applyBookmark = catchAsync(async (req, res) => {
    const userId = req.session.user_id;
    const { gameId, bookarkId } = req.body;

    if (userId && gameId && bookarkId) {
        await userService.applyBookmark(userId, gameId, bookarkId);
        res.send("{ \"status\": \"OK\" }");
    }
    else {
        console.log("Bad request. No userID, gameId or bookmarkId");
        res.send("ERROR");
    }
});


exports.deleteBookmark = catchAsync(async (req, res) => {
    //const userId = req.session.user_id;
    const { id } = req.body;
    // const { name, gameType, date } = req.body;

    if (id) {
        var success = await userService.deleteBookmark(id);
        if (success) {
            res.send("{ \"status\": \"OK\" }");
        }
    }
});

exports.login = catchAsync(async (req, res) => {
    const { username, password } = req.body;
    const foundUser = await userService.findUser(username, password);
    if (foundUser) {
        req.session.user_id = foundUser.id;
        req.session.user_name = foundUser.username;
        req.session.admin = foundUser.admin;
        foundUser.lastLogin = Date.now();
        await foundUser.save();
        const redirectUrl = res.locals.returnTo || "/Home";
        delete req.session.returnTo;
        res.locals.returnTo = null;
        return res.redirect(redirectUrl);
    }
    else {
        req.flash("messages", "Wrong username or password");
        console.log("login failed");
        res.redirect("/login");
    }
});

exports.showAdminPage = catchAsync(async (req, res) => {
    const adminUsers = await userService.listUsersForAdmin();
    res.render("admin", { adminUsers });
});

exports.updateUserAdmin = async (req, res, next) => {
    try {
        const result = await userService.updateUserByAdmin(req.params.id, req.body);
        if (req.session.user_id && String(req.session.user_id) === String(req.params.id)) {
            if (result.username !== undefined) req.session.user_name = result.username;
            if (result.admin !== undefined) req.session.admin = result.admin;
        }
        res.json({ ok: true, user: result });
    } catch (err) {
        if (err instanceof ExpressError) {
            return res.status(err.statusCode).json({ ok: false, message: err.message });
        }
        if (err.name === "CastError") {
            return res.status(400).json({ ok: false, message: "Invalid user id" });
        }
        next(err);
    }
};

exports.showRegistrationPage = async (req, res) => {
    res.render("register");
};

exports.register = catchAsync(async (req, res) => {
    const { username, password, email, level } = req.body;
    const user = await userService.registerNewUser(username, password, email, level);
    if (!req.session.admin) {
        req.session.user_id = user._id;
        req.session.user_name = username;
        req.session.admin = user.admin;
    }
    else {
        req.flash("messages", "User added Successfully");
    }


    res.redirect("/home");
});