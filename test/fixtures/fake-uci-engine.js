/**
 * Fake UCI engine for unit tests (stdin/stdout).
 * Usage: node test/fixtures/fake-uci-engine.js
 */
"use strict";

const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, terminal: false });
let searching = false;
let searchTimer = null;
let lastSkillLevel = null;

function reply(line) {
    process.stdout.write(String(line) + "\n");
}

function clearSearch() {
    searching = false;
    if (searchTimer) {
        clearTimeout(searchTimer);
        searchTimer = null;
    }
}

function finishSearch(best) {
    clearSearch();
    reply(`bestmove ${best || "e7e5"}`);
}

rl.on("line", (line) => {
    const cmd = String(line || "").trim();
    if (cmd === "uci") {
        reply("id name FakeUCI");
        reply("id author ShmerlingTest");
        reply("uciok");
        return;
    }
    if (cmd === "isready") {
        reply("readyok");
        return;
    }
    if (cmd === "ucinewgame") {
        return;
    }
    if (cmd.startsWith("setoption ")) {
        const skillMatch = /name\s+Skill Level\s+value\s+(\d+)/i.exec(cmd);
        if (skillMatch) {
            lastSkillLevel = Number(skillMatch[1]);
        }
        return;
    }
    if (cmd.startsWith("position ")) {
        return;
    }
    if (cmd.startsWith("go ")) {
        searching = true;
        const assertSkill = process.env.FAKE_UCI_ASSERT_SKILL;
        if (assertSkill != null && assertSkill !== "") {
            const expected = Number(assertSkill);
            if (lastSkillLevel !== expected) {
                clearSearch();
                process.stderr.write(
                    `expected Skill Level ${expected}, got ${lastSkillLevel}\n`,
                );
                process.exit(2);
            }
        }
        const movetimeMatch = /movetime\s+(\d+)/.exec(cmd);
        const delay = movetimeMatch ? Math.min(Number(movetimeMatch[1]), 200) : 20;
        searchTimer = setTimeout(() => {
            // Prefer a legal black reply from startpos after e2e4 isn't known;
            // startpos fen turn is in the position command — default e7e5 / e2e4.
            const fenTurnBlack = false;
            finishSearch(fenTurnBlack ? "e2e4" : "e7e5");
        }, delay);
        return;
    }
    if (cmd === "stop") {
        if (searching) {
            finishSearch("e7e5");
        }
        return;
    }
    if (cmd === "quit") {
        clearSearch();
        rl.close();
        process.exit(0);
    }
});
