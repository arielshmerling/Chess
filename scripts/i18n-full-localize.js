#!/usr/bin/env node
/**
 * Full localization sync from English source of truth.
 *
 * - Fills missing keys in existing locales (he, fr, de, …) via Google Translate
 * - Builds complete Bengali (bn) and Portuguese (pt) catalogs
 * - Preserves existing translations and {{param}} placeholders
 * - Keeps native language-option labels consistent
 *
 * Usage: node scripts/i18n-full-localize.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "src", "strings");

const EXISTING_LOCALES = ["he", "fr", "de", "es", "ar", "zh", "ja", "hi", "ru", "uk", "no"];
const NEW_LOCALES = ["bn", "pt"];

const LOCALE_META = {
    he: { name: "Hebrew", globalBase: "ShmerlingStringsHe", globalExtra: "ShmerlingStringsHeExtra", varBase: "he", varExtra: "heExtra" },
    fr: { name: "French", globalBase: "ShmerlingStringsFr", globalExtra: "ShmerlingStringsFrExtra", varBase: "fr", varExtra: "frExtra" },
    de: { name: "German", globalBase: "ShmerlingStringsDe", globalExtra: "ShmerlingStringsDeExtra", varBase: "de", varExtra: "deExtra" },
    es: { name: "Spanish", globalBase: "ShmerlingStringsEs", globalExtra: "ShmerlingStringsEsExtra", varBase: "es", varExtra: "esExtra" },
    ar: { name: "Arabic", globalBase: "ShmerlingStringsAr", globalExtra: "ShmerlingStringsArExtra", varBase: "ar", varExtra: "arExtra" },
    zh: { name: "Simplified Chinese", globalBase: "ShmerlingStringsZh", globalExtra: "ShmerlingStringsZhExtra", varBase: "zh", varExtra: "zhExtra" },
    ja: { name: "Japanese", globalBase: "ShmerlingStringsJa", globalExtra: "ShmerlingStringsJaExtra", varBase: "ja", varExtra: "jaExtra" },
    hi: { name: "Hindi", globalBase: "ShmerlingStringsHi", globalExtra: "ShmerlingStringsHiExtra", varBase: "hi", varExtra: "hiExtra" },
    ru: { name: "Russian", globalBase: "ShmerlingStringsRu", globalExtra: "ShmerlingStringsRuExtra", varBase: "ru", varExtra: "ruExtra" },
    uk: { name: "Ukrainian", globalBase: "ShmerlingStringsUk", globalExtra: "ShmerlingStringsUkExtra", varBase: "uk", varExtra: "ukExtra" },
    no: { name: "Norwegian (Bokmål)", globalBase: "ShmerlingStringsNo", globalExtra: "ShmerlingStringsNoExtra", varBase: "noStrings", varExtra: "noExtra" },
    bn: { name: "Bengali", globalBase: "ShmerlingStringsBn", globalExtra: "ShmerlingStringsBnExtra", varBase: "bn", varExtra: "bnExtra" },
    pt: { name: "Portuguese", globalBase: "ShmerlingStringsPt", globalExtra: "ShmerlingStringsPtExtra", varBase: "pt", varExtra: "ptExtra" },
};

/** Native language-option labels (same in every catalog). */
const LANGUAGE_LABELS = {
    "desktop.prefs.languageHebrew": "עברית",
    "desktop.prefs.languageEnglish": "English",
    "desktop.prefs.languageJapanese": "日本語",
    "desktop.prefs.languageFrench": "Français",
    "desktop.prefs.languageGerman": "Deutsch",
    "desktop.prefs.languageChinese": "简体中文",
    "desktop.prefs.languageArabic": "العربية",
    "desktop.prefs.languageHindi": "हिन्दी",
    "desktop.prefs.languageSpanish": "Español",
    "desktop.prefs.languageRussian": "Русский",
    "desktop.prefs.languageUkrainian": "Українська",
    "desktop.prefs.languageNorwegian": "Norsk",
    "desktop.prefs.languageBengali": "বাংলা",
    "desktop.prefs.languagePortuguese": "Português",
};

const DO_NOT_TRANSLATE = new Set([
    "OK",
    "Stockfish",
    "Shmerling Chess",
    "PGN",
    "ELO",
    "FEN",
    "UCI",
]);

function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function setPath(obj, dotted, value) {
    const parts = dotted.split(".");
    let node = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (!isPlainObject(node[key])) {
            node[key] = {};
        }
        node = node[key];
    }
    node[parts[parts.length - 1]] = value;
}

function getPath(obj, dotted) {
    const parts = dotted.split(".");
    let node = obj;
    for (let i = 0; i < parts.length; i++) {
        if (node == null || typeof node !== "object") {
            return undefined;
        }
        node = node[parts[i]];
    }
    return node;
}

function flatten(obj, prefix, out) {
    out = out || {};
    prefix = prefix || "";
    if (!isPlainObject(obj)) {
        return out;
    }
    Object.keys(obj).forEach(function (key) {
        const next = prefix ? prefix + "." + key : key;
        const val = obj[key];
        if (typeof val === "string") {
            out[next] = val;
        } else if (isPlainObject(val)) {
            flatten(val, next, out);
        }
    });
    return out;
}

function protectPlaceholders(text) {
    const params = [];
    const protectedText = String(text).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, function (_m, name) {
        const idx = params.length;
        params.push(name);
        return "⟦PH" + idx + "⟧";
    });
    return { text: protectedText, params: params };
}

function restorePlaceholders(text, params) {
    let out = String(text);
    params.forEach(function (name, idx) {
        const token = "⟦PH" + idx + "⟧";
        const variants = [
            token,
            token.replace(/⟦/g, "[").replace(/⟧/g, "]"),
            "[[PH" + idx + "]]",
            "[PH" + idx + "]",
            "(PH" + idx + ")",
            "PH" + idx,
        ];
        variants.forEach(function (v) {
            out = out.split(v).join("{{" + name + "}}");
        });
        // Recover if translator mangled braces around PH tokens
        out = out.replace(new RegExp("⟦\\s*PH\\s*" + idx + "\\s*⟧", "gi"), "{{" + name + "}}");
        out = out.replace(new RegExp("\\[\\[\\s*PH\\s*" + idx + "\\s*\\]\\]", "gi"), "{{" + name + "}}");
    });
    return out;
}

function sleep(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

async function translateOne(text, to) {
    if (!text) {
        return text;
    }
    if (DO_NOT_TRANSLATE.has(text)) {
        return text;
    }
    const protectedPayload = protectPlaceholders(text);
    if (!/[A-Za-z]/.test(protectedPayload.text) && !/[\u00C0-\u024F]/.test(protectedPayload.text)) {
        // No Latin letters left (e.g. pure symbols) — skip
        if (!/[a-zA-Z]/.test(protectedPayload.text)) {
            return restorePlaceholders(protectedPayload.text, protectedPayload.params);
        }
    }
    const url =
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" +
        encodeURIComponent(to) +
        "&dt=t&q=" +
        encodeURIComponent(protectedPayload.text);
    let lastErr = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const res = await fetch(url);
            if (res.status === 429 || res.status >= 500) {
                await sleep(800 * (attempt + 1));
                continue;
            }
            if (!res.ok) {
                throw new Error("HTTP " + res.status);
            }
            const data = await res.json();
            const translated = (data[0] || []).map(function (row) {
                return row[0];
            }).join("");
            return restorePlaceholders(translated, protectedPayload.params);
        } catch (err) {
            lastErr = err;
            await sleep(600 * (attempt + 1));
        }
    }
    console.warn("  translate failed, keeping English:", text.slice(0, 60), lastErr && lastErr.message);
    return text;
}

function loadModule(code) {
    const file = path.join(ROOT, code + ".js");
    delete require.cache[require.resolve(file)];
    return require(file);
}

function loadOptional(code) {
    const file = path.join(ROOT, code + ".js");
    if (!fs.existsSync(file)) {
        return {};
    }
    delete require.cache[require.resolve(file)];
    return require(file);
}

function serializeJs(value, indent) {
    indent = indent || 0;
    const pad = "    ".repeat(indent);
    const padInner = "    ".repeat(indent + 1);
    if (typeof value === "string") {
        return JSON.stringify(value);
    }
    if (!isPlainObject(value)) {
        return JSON.stringify(value);
    }
    const keys = Object.keys(value);
    if (!keys.length) {
        return "{}";
    }
    const lines = ["{"];
    keys.forEach(function (key, idx) {
        const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
        const comma = idx < keys.length - 1 ? "," : "";
        const child = value[key];
        if (isPlainObject(child)) {
            lines.push(padInner + safeKey + ": " + serializeJs(child, indent + 1) + comma);
        } else {
            lines.push(padInner + safeKey + ": " + serializeJs(child, indent + 1) + comma);
        }
    });
    lines.push(pad + "}");
    return lines.join("\n");
}

function writeCatalogFile(code, kind, tree) {
    const meta = LOCALE_META[code];
    const isExtra = kind === "extra";
    const fileName = isExtra ? code + "-extra.js" : code + ".js";
    const globalName = isExtra ? meta.globalExtra : meta.globalBase;
    const varName = isExtra ? meta.varExtra : meta.varBase;
    const title = isExtra
        ? meta.name + " supplemental string catalog — mirrors src/strings/en-extra.js."
        : meta.name + " string catalog — mirrors src/strings/en.js structure.";
    const body =
        "/**\n" +
        " * " +
        title +
        "\n" +
        " */\n" +
        "(function (global) {\n" +
        '    "use strict";\n\n' +
        "    const " +
        varName +
        " = " +
        serializeJs(tree, 1) +
        ";\n\n" +
        '    if (typeof module === "object" && module && module.exports) {\n' +
        "        module.exports = " +
        varName +
        ";\n" +
        "    } else {\n" +
        "        global." +
        globalName +
        " = " +
        varName +
        ";\n" +
        "    }\n" +
        '})(typeof window !== "undefined" ? window : globalThis);\n';
    fs.writeFileSync(path.join(ROOT, fileName), body, "utf8");
}

async function buildLocaleTree(enTree, existingTree, locale, full) {
    const enFlat = flatten(enTree);
    const existingFlat = flatten(existingTree || {});
    const out = deepClone(enTree);
    const keys = Object.keys(enFlat);
    let translated = 0;
    let kept = 0;
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const enVal = enFlat[key];
        if (LANGUAGE_LABELS[key]) {
            setPath(out, key, LANGUAGE_LABELS[key]);
            kept++;
            continue;
        }
        const existing = existingFlat[key];
        if (!full && typeof existing === "string" && existing.length > 0) {
            setPath(out, key, existing);
            kept++;
            continue;
        }
        const translatedVal = await translateOne(enVal, locale);
        setPath(out, key, translatedVal);
        translated++;
        if (translated % 25 === 0) {
            process.stdout.write(
                "  " + locale + " " + (full ? "full" : "fill") + " " + translated + "/" + keys.length + "\r",
            );
        }
        await sleep(40);
    }
    if (translated) {
        process.stdout.write("\n");
    }
    console.log("  " + locale + ": kept " + kept + ", translated " + translated);
    return out;
}

async function main() {
    // Ensure EN has Bengali/Portuguese language labels before syncing others
    const enExtraPath = path.join(ROOT, "en-extra.js");
    let enExtraSrc = fs.readFileSync(enExtraPath, "utf8");
    if (!enExtraSrc.includes("languageBengali")) {
        enExtraSrc = enExtraSrc.replace(
            '"languageNorwegian": "Norsk",',
            '"languageNorwegian": "Norsk",\n            "languageBengali": "বাংলা",\n            "languagePortuguese": "Português",',
        );
        fs.writeFileSync(enExtraPath, enExtraSrc, "utf8");
        console.log("Added languageBengali / languagePortuguese to en-extra.js");
    }

    const enBase = loadModule("en");
    const enExtra = loadModule("en-extra");

    const allTargets = EXISTING_LOCALES.concat(NEW_LOCALES);
    for (let i = 0; i < allTargets.length; i++) {
        const code = allTargets[i];
        const full = NEW_LOCALES.includes(code);
        console.log("\n=== " + code + (full ? " (full)" : " (fill missing)") + " ===");
        const existingBase = full ? {} : loadOptional(code);
        const existingExtra = full ? {} : loadOptional(code + "-extra");
        const baseTree = await buildLocaleTree(enBase, existingBase, code, full);
        const extraTree = await buildLocaleTree(enExtra, existingExtra, code, full);
        // Ensure language labels exist even if older extras used different nesting
        Object.keys(LANGUAGE_LABELS).forEach(function (key) {
            if (getPath(enExtra, key) !== undefined || key.indexOf("languageBengali") >= 0 || key.indexOf("languagePortuguese") >= 0) {
                setPath(extraTree, key, LANGUAGE_LABELS[key]);
            }
        });
        writeCatalogFile(code, "base", baseTree);
        writeCatalogFile(code, "extra", extraTree);
        console.log("  wrote " + code + ".js + " + code + "-extra.js");
    }
    console.log("\nDone. Wire bn/pt into index.js, prefs, and HTML loaders if not already.");
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
