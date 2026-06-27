const { mountDesktopRoutes } = require("./routes");

/**
 * Desktop-only Express setup. Called from app.js when SHMERLING_MODE=desktop.
 * @param {import("express").Application} app
 */
function configureDesktopApp(app) {
    if (!process.env.SESSION_SECRET) {
        process.env.SESSION_SECRET = "shmerling-desktop-local-session";
    }

    mountDesktopRoutes(app);

    app.use((err, req, res, next) => {
        if (process.env.SHMERLING_MODE !== "desktop") {
            return next(err);
        }
        const statusCode = err.statusCode || 500;
        const message = err.message || "Sorry, something went wrong";
        if (req.path && req.path.startsWith("/app/api/")) {
            return res.status(statusCode).json({ ok: false, message });
        }
        if (req.path && (req.path.startsWith("/app") || req.path === "/")) {
            const q = new URLSearchParams({
                status: String(statusCode),
                message,
            });
            return res.redirect(302, "/app/error?" + q.toString());
        }
        return next(err);
    });
}

module.exports = configureDesktopApp;
