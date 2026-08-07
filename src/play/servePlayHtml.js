/**
 * Serve Play HTML with locale-on-demand scripts, optional minify, and CSP-safe output.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const LOCALE_COOKIE = "shmerling_locale";
const PLAY_HTML_PATH = path.join(__dirname, "../desktop/ui/play.html");
const STRINGS_MARKER = "<!--PLAY_STRINGS-->";

const SUPPORTED_LOCALES = [
    "en",
    "he",
    "ja",
    "fr",
    "de",
    "zh",
    "ar",
    "hi",
    "es",
    "ru",
    "uk",
    "no",
    "bn",
    "pt",
];

const LOCALE_SET = new Set(SUPPORTED_LOCALES);

let cachedRawHtml = null;
let cachedMtimeMs = 0;

function readPlayHtml() {
    const stat = fs.statSync(PLAY_HTML_PATH);
    if (!cachedRawHtml || stat.mtimeMs !== cachedMtimeMs) {
        cachedRawHtml = fs.readFileSync(PLAY_HTML_PATH, "utf8");
        cachedMtimeMs = stat.mtimeMs;
    }
    return cachedRawHtml;
}

function parseCookieHeader(header, name) {
    if (!header || !name) {
        return null;
    }
    const parts = String(header).split(";");
    for (let i = 0; i < parts.length; i++) {
        const piece = parts[i].trim();
        const eq = piece.indexOf("=");
        if (eq <= 0) {
            continue;
        }
        const key = piece.slice(0, eq).trim();
        if (key !== name) {
            continue;
        }
        try {
            return decodeURIComponent(piece.slice(eq + 1).trim());
        } catch {
            return piece.slice(eq + 1).trim();
        }
    }
    return null;
}

function normalizeLocale(code) {
    if (!code || typeof code !== "string") {
        return "en";
    }
    const lower = code.trim().toLowerCase().replace(/_/g, "-");
    const base = lower.split("-")[0];
    if (LOCALE_SET.has(lower)) {
        return lower;
    }
    if (LOCALE_SET.has(base)) {
        return base;
    }
    return "en";
}

function resolveLocaleFromRequest(req) {
    const fromCookie = parseCookieHeader(req && req.headers && req.headers.cookie, LOCALE_COOKIE);
    if (fromCookie) {
        return normalizeLocale(fromCookie);
    }
    const accept = req && req.headers && req.headers["accept-language"];
    if (accept) {
        const first = String(accept).split(",")[0];
        return normalizeLocale(first);
    }
    return "en";
}

function buildLocaleScriptTags(locale) {
    const code = normalizeLocale(locale);
    const tags = [
        "<script src=\"/app/strings/en.js\" defer></script>",
        "<script src=\"/app/strings/en-extra.js\" defer></script>",
    ];
    if (code !== "en") {
        tags.push("<script src=\"/app/strings/" + code + ".js\" defer></script>");
        tags.push("<script src=\"/app/strings/" + code + "-extra.js\" defer></script>");
    }
    tags.push("<script src=\"/app/strings/index.js\" defer></script>");
    tags.push("<script src=\"/app/strings/t-bridge.js\" defer></script>");
    tags.push("<script src=\"/app/strings/applyPlayShell.js\" defer></script>");
    return tags.join("\n  ");
}

/**
 * Collapse safe whitespace / comments for smaller HTML transfer.
 * Does not touch content inside <script> or <pre>.
 * @param {string} html
 * @returns {string}
 */
function minifyPlayHtml(html) {
    if (!html) {
        return "";
    }
    const parts = [];
    const re = /(<(script|pre)\b[^>]*>[\s\S]*?<\/\2>)/gi;
    let last = 0;
    let match;
    while ((match = re.exec(html)) !== null) {
        const chunk = html.slice(last, match.index);
        parts.push(minifyHtmlChunk(chunk));
        parts.push(match[0]);
        last = match.index + match[0].length;
    }
    parts.push(minifyHtmlChunk(html.slice(last)));
    return parts.join("").trim();
}

function minifyHtmlChunk(chunk) {
    return chunk
        .replace(/<!--(?!\[if)[\s\S]*?-->/g, "")
        .replace(/\s+/g, " ")
        .replace(/>\s+</g, "><");
}

function buildPlayHtml(options) {
    const opts = options || {};
    const locale = normalizeLocale(opts.locale || "en");
    let html = readPlayHtml();
    if (html.indexOf(STRINGS_MARKER) === -1) {
        throw new Error("play.html missing " + STRINGS_MARKER + " marker");
    }
    html = html.replace(STRINGS_MARKER, buildLocaleScriptTags(locale));
    html = html.replace(/<html\b([^>]*)>/i, function (full, attrs) {
        let next = attrs;
        if (/\blang=/.test(next)) {
            next = next.replace(/\blang=(["']).*?\1/, "lang=\"" + locale + "\"");
        } else {
            next += " lang=\"" + locale + "\"";
        }
        const rtl = locale === "he" || locale === "ar";
        if (/\bdir=/.test(next)) {
            next = next.replace(/\bdir=(["']).*?\1/, "dir=\"" + (rtl ? "rtl" : "ltr") + "\"");
        } else {
            next += " dir=\"" + (rtl ? "rtl" : "ltr") + "\"";
        }
        return "<html" + next + ">";
    });
    if (opts.minify !== false) {
        html = minifyPlayHtml(html);
    }
    return html;
}

function sendPlayHtml(req, res, options) {
    const locale = resolveLocaleFromRequest(req);
    const html = buildPlayHtml({
        locale: locale,
        minify: options && options.minify !== false,
    });
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(html);
}

module.exports = {
    PLAY_HTML_PATH,
    STRINGS_MARKER,
    SUPPORTED_LOCALES,
    resolveLocaleFromRequest,
    buildLocaleScriptTags,
    minifyPlayHtml,
    buildPlayHtml,
    sendPlayHtml,
    normalizeLocale,
};
