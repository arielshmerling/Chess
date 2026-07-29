#!/usr/bin/env node
/**
 * Rebuild docs/srs-traceability-matrix.csv from:
 *   docs/srs-shmerling-chess.md
 *   docs/traceability-auto-hints.json
 *   docs/traceability-manual-hints.json
 *
 * Usage: node scripts/build-srs-traceability-matrix.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srs = fs.readFileSync(path.join(root, "docs/srs-shmerling-chess.md"), "utf8");
const autoDoc = JSON.parse(
    fs.readFileSync(path.join(root, "docs/traceability-auto-hints.json"), "utf8"),
);
const manDoc = JSON.parse(
    fs.readFileSync(path.join(root, "docs/traceability-manual-hints.json"), "utf8"),
);

const autoById = Object.fromEntries(autoDoc.requirements.map((r) => [r.id, r]));
const manById = Object.fromEntries(manDoc.requirements.map((r) => [r.id, r]));

const reqRe = /^\- \*\*((?:FR|NFR|IF)-[A-Z0-9]+-\d+|CON-\d+|ASM-\d+)\*\* — (.+)$/gm;
const fromSrs = [];
let match;
while ((match = reqRe.exec(srs)) !== null) {
    fromSrs.push({
        id: match[1],
        statement: match[2].replace(/\*\*/g, "").trim(),
    });
}

function csvEscape(value) {
    const text = value == null ? "" : String(value);
    if (/[",\n\r]/.test(text)) {
        return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
}

function joinList(arr) {
    return arr && arr.length ? arr.join(" | ") : "";
}

function overall(autoCov, manCov) {
    if (autoCov === "full" || manCov === "full") {
        return "Covered";
    }
    if (autoCov === "partial" || manCov === "partial") {
        return "Partial";
    }
    return "Gap";
}

function priority(statement) {
    if (/\bMust\b/i.test(statement)) {
        return "Must";
    }
    if (/\bShould\b/i.test(statement)) {
        return "Should";
    }
    if (/\bMay\b/i.test(statement)) {
        return "May";
    }
    return "";
}

function coverageMethod(autoCov, manCov) {
    const hasAuto = autoCov && autoCov !== "none";
    const hasManual = manCov && manCov !== "none";
    if (hasAuto && hasManual) {
        return "Automatic + Manual";
    }
    if (hasAuto) {
        return "Automatic only";
    }
    if (hasManual) {
        return "Manual only";
    }
    return "None";
}

const header = [
    "Requirement ID",
    "Priority",
    "Statement",
    "Coverage Method",
    "Automatic Coverage",
    "Automatic Tests",
    "Manual Coverage",
    "Manual Tests",
    "Overall Status",
    "Notes",
];

const lines = [header.map(csvEscape).join(",")];
let covered = 0;
let partial = 0;
let gap = 0;

for (const req of fromSrs) {
    const auto = autoById[req.id] || {};
    const man = manById[req.id] || {};
    const autoCov = auto.auto_coverage || "none";
    const manCov = man.manual_coverage || "none";
    const status = overall(autoCov, manCov);
    if (status === "Covered") {
        covered += 1;
    } else if (status === "Partial") {
        partial += 1;
    } else {
        gap += 1;
    }
    lines.push(
        [
            req.id,
            priority(req.statement),
            req.statement,
            coverageMethod(autoCov, manCov),
            autoCov,
            joinList(auto.auto_tests),
            manCov,
            joinList(man.manual_refs),
            status,
            [auto.notes, man.notes].filter(Boolean).join(" "),
        ]
            .map(csvEscape)
            .join(","),
    );
}

const out = path.join(root, "docs/srs-traceability-matrix.csv");
fs.writeFileSync(out, lines.join("\n") + "\n");
console.log("Wrote", out, {
    requirements: fromSrs.length,
    covered,
    partial,
    gap,
});
