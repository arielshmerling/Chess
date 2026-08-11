/**
 * Shared SMTP send helper (nodemailer).
 *
 * User-facing mail (password recovery) needs:
 *   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_FROM (or SMTP_USER)
 * Admin alerts also require ADMIN_NOTIFY_EMAILS (see adminPrivilegeNotify.js).
 */

const nodemailer = require("nodemailer");

function isSmtpConfigured() {
    return Boolean(process.env.SMTP_HOST && (process.env.SMTP_FROM || process.env.SMTP_USER));
}

/**
 * @param {{ to: string, subject: string, text: string }} opts
 * @returns {Promise<void>}
 */
async function sendMail(opts) {
    if (!isSmtpConfigured()) {
        throw new Error("SMTP is not configured");
    }
    const to = opts && opts.to != null ? String(opts.to).trim() : "";
    const subject = opts && opts.subject != null ? String(opts.subject) : "";
    const text = opts && opts.text != null ? String(opts.text) : "";
    if (!to || !subject) {
        throw new Error("sendMail requires to and subject");
    }

    const port = Number(process.env.SMTP_PORT || 587);
    const implicitTls = port === 465;
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: implicitTls,
        requireTLS: !implicitTls && port === 587,
        auth:
            process.env.SMTP_USER && process.env.SMTP_PASS
                ? {
                    user: process.env.SMTP_USER,
                    /* Gmail app passwords are often pasted with spaces; strip them. */
                    pass: String(process.env.SMTP_PASS).replace(/\s+/g, ""),
                }
                : undefined,
    });
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    await transporter.sendMail({
        from,
        to,
        subject,
        text,
    });
}

/**
 * Absolute site origin for links in emails.
 * Prefer PUBLIC_BASE_URL / SITE_URL; otherwise derive from the request.
 * @param {import("express").Request} [req]
 * @returns {string}
 */
function resolvePublicBaseUrl(req) {
    const fromEnv = String(process.env.PUBLIC_BASE_URL || process.env.SITE_URL || "")
        .trim()
        .replace(/\/+$/, "");
    if (fromEnv) {
        return fromEnv;
    }
    if (!req || typeof req.get !== "function") {
        return "";
    }
    const proto = String(req.protocol || "http").split(",")[0].trim() || "http";
    const host = String(req.get("host") || "").trim();
    if (!host) {
        return "";
    }
    return proto + "://" + host;
}

module.exports = {
    isSmtpConfigured,
    sendMail,
    resolvePublicBaseUrl,
};
