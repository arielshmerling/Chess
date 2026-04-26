/**
 * Optional alerts when an admin changes another user's admin flag (grant/revoke).
 *
 * Email (SMTP): set SMTP_HOST, SMTP_PORT (587 or 465), SMTP_USER, SMTP_PASS, SMTP_FROM,
 *   and ADMIN_NOTIFY_EMAILS (comma-separated).
 *   Gmail: use smtp.gmail.com, port 587, and an App Password (not your normal password).
 *   Do not set SMTP_SECURE for port 587 — that port uses STARTTLS (plain then upgrade).
 *   Use port 465 only if you want implicit SSL (secure connection from the first byte).
 * SMS (Twilio): set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER (From),
 *   and ADMIN_NOTIFY_SMS (E.164, e.g. +15551234567).
 *
 * If the relevant env vars are missing, that channel is skipped (no error).
 */

const nodemailer = require("nodemailer");

function buildMessage({ actorUsername, targetUsername, targetUserId, wasAdmin, isAdmin }) {
    const action = wasAdmin && !isAdmin
        ? "Admin privileges were REVOKED"
        : (!wasAdmin && isAdmin ? "Admin privileges were GRANTED" : "Admin privileges were changed");
    const lines = [
        action + " on the chess site.",
        "",
        `Time (server): ${new Date().toISOString()}`,
        `Changed by (admin session): ${actorUsername}`,
        `Target user: ${targetUsername}`,
        `Target user id: ${targetUserId}`,
        `Before: ${wasAdmin ? "Admin" : "User"}`,
        `After: ${isAdmin ? "Admin" : "User"}`,
    ];
    return lines.join("\n");
}

function smtpConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.ADMIN_NOTIFY_EMAILS);
}

function twilioConfigured() {
    return Boolean(
        process.env.TWILIO_ACCOUNT_SID &&
            process.env.TWILIO_AUTH_TOKEN &&
            process.env.TWILIO_PHONE_NUMBER &&
            process.env.ADMIN_NOTIFY_SMS
    );
}

async function sendEmailNotification(subject, text) {
    if (!smtpConfigured()) {return;}
    const port = Number(process.env.SMTP_PORT || 587);
    /* Port 465 = TLS from connect. Port 587 = plain SMTP then STARTTLS (secure must be false). */
    const implicitTls = port === 465;
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: implicitTls,
        requireTLS: !implicitTls && port === 587,
        auth:
            process.env.SMTP_USER && process.env.SMTP_PASS
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                : undefined,
    });
    const recipients = process.env.ADMIN_NOTIFY_EMAILS.split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (recipients.length === 0) {return;}
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    await transporter.sendMail({
        from,
        to: recipients.join(", "),
        subject,
        text,
    });
}

async function sendSmsNotification(text) {
    if (!twilioConfigured()) {return;}
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    const to = process.env.ADMIN_NOTIFY_SMS.trim();
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({ To: to, From: from, Body: text });
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Twilio HTTP ${res.status}: ${errText}`);
    }
}

/**
 * @param {object} p
 * @param {string} p.actorUsername - session admin who performed the change
 * @param {string} p.targetUsername
 * @param {string} p.targetUserId
 * @param {boolean} p.wasAdmin
 * @param {boolean} p.isAdmin
 */
exports.notifyAdminPrivilegeChange = async (p) => {
    if (!smtpConfigured() && !twilioConfigured()) {
        return;
    }
    const subject = "Admin privilege change (chess site)";
    const text = buildMessage(p);
    const results = await Promise.allSettled([
        sendEmailNotification(subject, text),
        sendSmsNotification(text),
    ]);
    results.forEach((r, i) => {
        if (r.status === "rejected") {
            const label = i === 0 ? "email" : "sms";
            console.error(`adminPrivilegeNotify ${label}:`, r.reason && r.reason.message ? r.reason.message : r.reason);
        }
    });
};
