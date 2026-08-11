const { t, getHtmlLang, getHtmlDir } = require("../../strings");
const { version: appVersion } = require("../../../desktop/package.json");

const { normalizeReturnTo } = require("../../utils");
const catchAsync = require("../../utils/catchAsync");
const ExpressError = require("../../utils/ExpressError");
const smtpMail = require("../../utils/smtpMail");
const userService = require("./service");
const gamesManagerService = require("../gamesManager/service");

exports.showLoginPage = (req, res) => {

    const { f } = req.query;
    /* The login screen owns its own error line; the flash bar sits behind it. */
    const flashed = Array.isArray(res.locals.messages) ? res.locals.messages.join(" ") : "";
    let errorMessage = flashed;
    if (f == "error") {
        errorMessage = t("auth.wrongCredentials");

    }
    res.locals.username = "";
    // const username = req.session.user_name || "Guest";
    const game = { username: "" };

    res.render("login", { appVersion, errorMessage, game });
};

function resolvePublicContactEmail() {
    const candidates = [
        process.env.SITE_CONTACT_EMAIL,
        process.env.SMTP_FROM,
        process.env.SMTP_USER,
    ];
    for (let i = 0; i < candidates.length; i += 1) {
        const value = candidates[i] != null ? String(candidates[i]).trim() : "";
        if (value && value.indexOf("@") > 0) {
            return value;
        }
    }
    return null;
}

function renderLegalPage(res, keys, sections) {
    res.render("legal", {
        pageTitle: t(keys.title),
        pageLead: t(keys.lead),
        pageBody: keys.body ? t(keys.body) : "",
        pageSections: sections || [],
        lastUpdated: "August 6, 2026",
    });
}

function privacySections() {
    return [
        { heading: t("site.privacy.controllerHeading"), body: t("site.privacy.controllerBody") },
        { heading: t("site.privacy.dataHeading"), body: t("site.privacy.dataBody") },
        { heading: t("site.privacy.purposesHeading"), body: t("site.privacy.purposesBody") },
        { heading: t("site.privacy.basesHeading"), body: t("site.privacy.basesBody") },
        { heading: t("site.privacy.retentionHeading"), body: t("site.privacy.retentionBody") },
        { heading: t("site.privacy.sharingHeading"), body: t("site.privacy.sharingBody") },
        { heading: t("site.privacy.transfersHeading"), body: t("site.privacy.transfersBody") },
        { heading: t("site.privacy.rightsHeading"), body: t("site.privacy.rightsBody") },
        { heading: t("site.privacy.securityHeading"), body: t("site.privacy.securityBody") },
        { heading: t("site.privacy.cookiesHeading"), body: t("site.privacy.cookiesBody") },
        { heading: t("site.privacy.childrenHeading"), body: t("site.privacy.childrenBody") },
        { heading: t("site.privacy.changesHeading"), body: t("site.privacy.changesBody") },
    ];
}

function termsSections() {
    return [
        { heading: t("site.terms.acceptanceHeading"), body: t("site.terms.acceptanceBody") },
        { heading: t("site.terms.accountHeading"), body: t("site.terms.accountBody") },
        { heading: t("site.terms.fairPlayHeading"), body: t("site.terms.fairPlayBody") },
        { heading: t("site.terms.acceptableUseHeading"), body: t("site.terms.acceptableUseBody") },
        { heading: t("site.terms.contentHeading"), body: t("site.terms.contentBody") },
        { heading: t("site.terms.availabilityHeading"), body: t("site.terms.availabilityBody") },
        { heading: t("site.terms.disclaimerHeading"), body: t("site.terms.disclaimerBody") },
        { heading: t("site.terms.liabilityHeading"), body: t("site.terms.liabilityBody") },
        { heading: t("site.terms.terminationHeading"), body: t("site.terms.terminationBody") },
        { heading: t("site.terms.lawHeading"), body: t("site.terms.lawBody") },
        { heading: t("site.terms.contactHeading"), body: t("site.terms.contactBody") },
    ];
}

function contactSections() {
    const email = resolvePublicContactEmail();
    const sections = [
        {
            heading: t("site.contactPage.controllerHeading"),
            body: t("site.contactPage.controllerBody"),
        },
        {
            heading: t("site.contactPage.emailHeading"),
            body: email
                ? t("site.contactPage.emailBody")
                : t("site.contactPage.emailMissingBody"),
            mailto: email || undefined,
        },
        {
            heading: t("site.contactPage.whatToIncludeHeading"),
            body: t("site.contactPage.whatToIncludeBody"),
        },
        {
            heading: t("site.contactPage.securityHeading"),
            body: t("site.contactPage.securityBody"),
        },
    ];
    return sections;
}

exports.showPrivacyPage = (req, res) => {
    renderLegalPage(
        res,
        {
            title: "site.footer.privacyTitle",
            lead: "site.footer.privacyLead",
        },
        privacySections(),
    );
};

exports.showTermsPage = (req, res) => {
    renderLegalPage(
        res,
        {
            title: "site.footer.termsTitle",
            lead: "site.footer.termsLead",
        },
        termsSections(),
    );
};

exports.showContactPage = (req, res) => {
    renderLegalPage(
        res,
        {
            title: "site.footer.contactTitle",
            lead: "site.footer.contactLead",
        },
        contactSections(),
    );
};

exports.showAccessibilityPage = (req, res) => {
    res.render("accessibility", {
        pageTitle: t("site.footer.accessibilityTitle"),
        pageLead: t("site.footer.accessibilityLead"),
        lastUpdated: "August 4, 2026",
        pageSections: [
            {
                heading: t("site.accessibility.statementCommitmentHeading"),
                body: t("site.accessibility.statementCommitmentBody"),
            },
            {
                heading: t("site.accessibility.statementScopeHeading"),
                body: t("site.accessibility.statementScopeBody"),
            },
            {
                heading: t("site.accessibility.statementLimitsHeading"),
                body: t("site.accessibility.statementLimitsBody"),
            },
            {
                heading: t("site.accessibility.statementContactHeading"),
                body: t("site.accessibility.statementContactBody"),
            },
            {
                heading: t("site.accessibility.statementStandardsHeading"),
                body: t("site.accessibility.statementStandardsBody"),
            },
        ],
    });
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
    const {
        gameState,
        name,
        gameType,
        moves,
        engine,
        depth,
        originState,
        whitePlayerName,
        blackPlayerName,
    } = req.body;

    if (userId) {
        const bookmark = await userService.addBookmark(
            userId,
            gameState,
            name,
            gameType,
            moves,
            engine,
            depth,
            originState,
            whitePlayerName,
            blackPlayerName,
        );
        if (!bookmark) {
            res.status(400).json({ ok: false, message: t("auth.couldNotSaveBookmark") });
            return;
        }
        res.json(bookmark);
    }
    else {
        console.log("Bad request. No userId");
        res.send("ERROR");
    }
});

exports.updateBookmark = catchAsync(async (req, res) => {
    const userId = req.session.user_id;
    const {
        id,
        name,
        gameType,
        date,
        gameState,
        moves,
        engine,
        depth,
        originState,
        whitePlayerName,
        blackPlayerName,
    } = req.body;

    if (id) {
        await userService.updateBookmark(
            userId,
            id,
            date,
            name,
            gameType,
            gameState,
            moves,
            engine,
            depth,
            originState,
            whitePlayerName,
            blackPlayerName,
        );
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
        const ok = await userService.applyBookmark(userId, gameId, bookarkId);
        if (ok) {
            res.send("{ \"status\": \"OK\" }");
            return;
        }
        res.status(403).json({ ok: false, message: "Forbidden" });
        return;
    }
    console.log("Bad request. No userID, gameId or bookmarkId");
    res.send("ERROR");
});


exports.deleteBookmark = catchAsync(async (req, res) => {
    const userId = req.session.user_id;
    const { id } = req.body;

    if (!userId || !id) {
        res.status(400).json({ ok: false, message: "Bad request" });
        return;
    }
    const success = await userService.deleteBookmark(userId, id);
    if (success) {
        res.send("{ \"status\": \"OK\" }");
        return;
    }
    res.status(403).json({ ok: false, message: "Forbidden" });
});

/** Credentials reach Mongo as a regex; only plain strings may pass through. */
function readCredentials(body) {
    const username = body && typeof body.username === "string" ? body.username : "";
    const password = body && typeof body.password === "string" ? body.password : "";
    return { username, password };
}

async function startUserSession(req, foundUser) {
    req.session.user_id = foundUser.id;
    req.session.user_name = foundUser.username;
    req.session.admin = foundUser.admin;
    if (foundUser.admin) {
        foundUser.userType = "Admin";
    } else if (!foundUser.userType) {
        foundUser.userType = "Member";
    }
    req.session.userType = foundUser.userType;
    req.session.credentialsVersion = typeof foundUser.credentialsVersion === "number"
        ? foundUser.credentialsVersion
        : 0;
    foundUser.lastLogin = Date.now();
    await foundUser.save();
}

function takeRedirectUrl(req, res) {
    const redirectUrl = normalizeReturnTo(res.locals.returnTo);
    delete req.session.returnTo;
    res.locals.returnTo = null;
    return redirectUrl;
}

exports.login = catchAsync(async (req, res) => {
    const { username, password } = readCredentials(req.body);
    const foundUser = username && password
        ? await userService.findUser(username, password)
        : null;
    if (foundUser) {
        await startUserSession(req, foundUser);
        return res.redirect(takeRedirectUrl(req, res));
    }
    req.flash("messages", t("auth.wrongCredentials"));
    return res.redirect("/login");
});

/** Same authentication as the form post, for the two-step login screen. */
exports.loginJson = catchAsync(async (req, res) => {
    const { username, password } = readCredentials(req.body);
    const foundUser = username && password
        ? await userService.findUser(username, password)
        : null;
    if (!foundUser) {
        return res.status(401).json({ ok: false });
    }
    await startUserSession(req, foundUser);
    return res.json({ ok: true, redirectUrl: takeRedirectUrl(req, res) });
});

exports.showAdminPage = catchAsync(async (req, res) => {
    const [adminUsers, adminGames, openingBookStatus] = await Promise.all([
        userService.listUsersForAdmin(),
        gamesManagerService.getAllGamesForAdmin(2000),
        gamesManagerService.getOpeningBookStatus(),
    ]);
    /*
     * Admin console stays English. Non-en catalogs only partially cover
     * site.adminPage, which produced mixed Hebrew/English UI.
     */
    res.locals.locale = "en";
    res.locals.htmlLang = getHtmlLang("en");
    res.locals.htmlDir = getHtmlDir("en");
    res.locals.t = function (key, params) {
        return t(key, params, "en");
    };
    res.render("admin", {
        adminUsers,
        adminGames,
        openingBookStatus,
        openingBookEntryCount: openingBookStatus.entryCount,
        needsAxios: true,
    });
});

exports.getAdminOpeningBookStatus = catchAsync(async (req, res) => {
    const status = await gamesManagerService.getOpeningBookStatus();
    res.json({ ok: true, status });
});

exports.listAdminEngines = catchAsync(async (req, res) => {
    const engineService = require("../../engines/engineService");
    const engines = await engineService.listPlayEnginesForAdmin();
    res.json({ ok: true, engines });
});

exports.updateAdminEngine = async (req, res, next) => {
    try {
        const engineService = require("../../engines/engineService");
        const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
        if (!id) {
            return res.status(400).json({ ok: false, message: "Engine id is required" });
        }
        if (req.body == null || typeof req.body.enabled !== "boolean") {
            return res.status(400).json({ ok: false, message: "Body must include boolean enabled" });
        }
        const engine = await engineService.setPlayEngineEnabled(id, req.body.enabled);
        res.json({ ok: true, engine });
    } catch (err) {
        if (err && err.code === "ENGINE_NOT_FOUND") {
            return res.status(404).json({ ok: false, message: err.message });
        }
        next(err);
    }
};

exports.stopGenerateState = (req, res) => {
    gamesManagerService.requestGenerateStateStop();
    res.json({ ok: true });
};

/**
 * Server-Sent Events: replay PGNs into Mongo (`mode=mongo`) or line opening book (`mode=book`).
 */
exports.generateStateStream = async (req, res) => {
    if (!gamesManagerService.tryAcquireGenerateStateLock()) {
        res.status(200);
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.write(`data: ${JSON.stringify({
            type: "error",
            message: "Another generation job is already running. Wait for it to finish or open this page in one tab only.",
        })}\n\n`);
        res.end();
        return;
    }

    gamesManagerService.resetGenerateStateStop();
    const checkAbort = () => gamesManagerService.isGenerateStateStopRequested();

    const mode = req.query.mode === "book" ? "book" : "mongo";
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
    }

    const send = (obj) => {
        res.write(`data: ${JSON.stringify(obj)}\n\n`);
    };

    try {
        send({ type: "start", mode });
        send({ type: "phase", phase: "scanning", message: "Listing PGN files…" });
        const files = mode === "book"
            ? await gamesManagerService.getOpeningBookPGNFiles()
            : await gamesManagerService.getPGNFiles();
        if (checkAbort()) {
            send({
                type: "done",
                ok: true,
                mode,
                stopped: true,
                cancelledBeforeRead: true,
                file: mode === "book" ? gamesManagerService.getOpeningBookLinesPath() : null,
            });
            return;
        }
        send({
            type: "phase",
            phase: "reading",
            message: `Reading ${files.length} PGN file(s)…`,
            fileCount: files.length,
        });
        const pgnGames = await gamesManagerService.readPGNGames(files, {
            onProgress: (e) => send({ type: "progress", segment: "reading", ...e }),
            checkAbort,
        });
        if (gamesManagerService.wasLastPgnReadInterrupted()) {
            gamesManagerService.resetGenerateStateStop();
        } else if (checkAbort()) {
            send({
                type: "done",
                ok: true,
                mode,
                stopped: true,
                cancelledAfterRead: true,
                file: mode === "book" ? gamesManagerService.getOpeningBookLinesPath() : null,
            });
            return;
        }
        send({
            type: "phase",
            phase: "replay",
            message: `Replaying ${pgnGames.length} games…`,
            totalGames: pgnGames.length,
        });
        const result = mode === "book"
            ? await gamesManagerService.regenerateOpeningBookLines(pgnGames, {
                onProgress: (e) => send({ type: "progress", segment: "replay", ...e }),
                checkAbort,
            })
            : await gamesManagerService.replayPGNGames(pgnGames, {
                saveToDB: true,
                onProgress: (e) => send({ type: "progress", segment: "replay", ...e }),
                checkAbort,
            });
        send({
            type: "done",
            ok: true,
            mode,
            stopped: !!(result && result.stopped),
            gamesCompleted: result && result.gamesCompleted != null ? result.gamesCompleted : undefined,
            entryCount: result && result.positionCount != null ? result.positionCount : undefined,
            bookUnchanged: mode === "book" && result && result.stopped && result.positionCount == null,
            file: mode === "book" ? gamesManagerService.getOpeningBookLinesPath() : null,
        });
    } catch (err) {
        console.error("[generateStateStream]", err);
        send({ type: "error", message: err.message || String(err) });
    } finally {
        gamesManagerService.resetGenerateStateStop();
        gamesManagerService.releaseGenerateStateLock();
        res.end();
    }
};

exports.updateUserAdmin = async (req, res, next) => {
    try {
        const result = await userService.updateUserByAdmin(req.params.id, req.body, {
            actorUsername: req.session.user_name || "unknown",
        });
        if (req.session.user_id && String(req.session.user_id) === String(req.params.id)) {
            if (result.username !== undefined) {req.session.user_name = result.username;}
            if (result.admin !== undefined) {req.session.admin = result.admin;}
            if (result.userType !== undefined) {req.session.userType = result.userType;}
        }
        res.json({ ok: true, user: result });
    } catch (err) {
        if (err instanceof ExpressError) {
            return res.status(err.statusCode).json({ ok: false, message: err.message });
        }
        if (err.name === "CastError") {
            return res.status(400).json({ ok: false, message: t("auth.invalidUserId") });
        }
        next(err);
    }
};

exports.showRegistrationPage = async (req, res) => {
    res.render("register", { needsAxios: true });
};

exports.register = catchAsync(async (req, res) => {
    const { username, password, email, level } = req.body;
    const user = await userService.registerNewUser(username, password, email, level);
    if (!req.session.admin) {
        req.session.user_id = user._id;
        req.session.user_name = username;
        req.session.admin = user.admin;
        req.session.userType = user.userType || "Member";
    }
    else {
        req.flash("messages", t("auth.userAdded"));
    }


    res.redirect("/home");
});

function formatAccountDateTime(value, locale) {
    if (value == null || value === "") {
        return "—";
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "—";
    }
    try {
        return new Intl.DateTimeFormat(locale || "en", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(date);
    } catch {
        return new Intl.DateTimeFormat("en", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(date);
    }
}

function localizeAccountUserType(userType, locale) {
    const keyByType = {
        Admin: "site.adminPage.userTypeAdmin",
        Partner: "site.adminPage.userTypePartner",
        Member: "site.adminPage.userTypeMember",
    };
    const key = keyByType[userType];
    return key ? t(key, null, locale) : (userType || "—");
}

function localizeAccountLevel(level, locale) {
    const normalized = level == null ? "" : String(level).trim().toLowerCase();
    const keyByLevel = {
        rookie: "site.register.rookie",
        skilled: "site.register.skilled",
        elite: "site.register.elite",
        "grand master": "site.register.grandMaster",
        grandmaster: "site.register.grandMaster",
    };
    const key = keyByLevel[normalized];
    if (key) {
        return t(key, null, locale);
    }
    return level == null || level === "" ? "—" : String(level);
}

exports.showAccountPage = catchAsync(async (req, res) => {
    const locale = res.locals.locale || "en";
    const tt = typeof res.locals.t === "function"
        ? res.locals.t
        : function (key, params) {
            return t(key, params, locale);
        };
    const profile = await userService.getAccountProfile(req.session.user_id);
    res.render("account", {
        pageTitle: tt("site.accountPage.title"),
        pageLead: tt("site.accountPage.lead"),
        profile: {
            ...profile,
            userTypeLabel: localizeAccountUserType(profile.userType, locale),
            levelLabel: localizeAccountLevel(profile.level, locale),
            joinedDateLabel: formatAccountDateTime(profile.joinedDate, locale),
            lastLoginLabel: formatAccountDateTime(profile.lastLogin, locale),
        },
    });
});

exports.exportAccountData = catchAsync(async (req, res) => {
    const payload = await userService.buildAccountDataExport(req.session.user_id);
    const safeName = String(payload.profile.username || "account")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .slice(0, 64);
    const filename = `shmerling-account-export-${safeName}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(JSON.stringify(payload, null, 2));
});

exports.deleteAccount = catchAsync(async (req, res) => {
    const body = req.body || {};
    await userService.deleteAccountCascade(req.session.user_id, {
        confirmUsername: body.confirmUsername,
    });
    req.session.user_id = null;
    req.session = null;
    res.json({ ok: true, redirectUrl: "/login" });
});

exports.changeAccountPassword = catchAsync(async (req, res) => {
    const body = req.body || {};
    const result = await userService.changeAccountPassword(req.session.user_id, {
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        confirmPassword: body.confirmPassword,
    });
    if (result && typeof result.credentialsVersion === "number") {
        req.session.credentialsVersion = result.credentialsVersion;
    }
    res.json({ ok: true });
});

exports.showForgotPasswordPage = (req, res) => {
    res.render("forgot-password", {
        pageTitle: t("auth.forgotPasswordTitle"),
        pageLead: t("auth.forgotPasswordLead"),
    });
};

exports.requestPasswordReset = catchAsync(async (req, res) => {
    const body = req.body || {};
    const email = body.email != null ? String(body.email) : "";
    const baseUrl = smtpMail.resolvePublicBaseUrl(req);
    const result = await userService.requestPasswordReset(email, { baseUrl });
    res.json(result);
});

exports.showResetPasswordPage = (req, res) => {
    const token = req.query && req.query.token != null ? String(req.query.token) : "";
    res.render("reset-password", {
        pageTitle: t("auth.resetPasswordTitle"),
        pageLead: t("auth.resetPasswordLead"),
        resetToken: token,
        tokenMissing: !token,
    });
};

exports.completePasswordReset = catchAsync(async (req, res) => {
    const body = req.body || {};
    await userService.completePasswordReset({
        token: body.token,
        email: body.email,
        newPassword: body.newPassword,
        confirmPassword: body.confirmPassword,
    });
    res.json({ ok: true, redirectUrl: "/login" });
});
