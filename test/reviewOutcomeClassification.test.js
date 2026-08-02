"use strict";

const assert = require("assert");

/**
 * Mirror of Play captureReviewOutcome classification (reason + score).
 * Kept in unit test form so timeout vs checkmate does not regress.
 */
function classifyFromReasonAndScore(reasonHint, resultStr, stateFlags) {
    let endKind = null;
    const st = stateFlags || {};
    if (st.draw) {
        endKind = "draw";
    } else if (st.outOfTime) {
        endKind = "timeout";
    } else if (st.checkmate) {
        endKind = "checkmate";
    } else if (st.resigned) {
        endKind = "resign";
    }
    if (!endKind && reasonHint) {
        const reason = String(reasonHint).toLowerCase();
        if (/out\s*of\s*time|timeout|flag|time'?s?\s*up/.test(reason)) {
            endKind = "timeout";
        } else if (/resign/.test(reason)) {
            endKind = "resign";
        } else if (/checkmate/.test(reason)) {
            endKind = "checkmate";
        } else if (/draw|stalemate|repetition|material|agreement|50/.test(reason)) {
            endKind = "draw";
        }
    }
    if (!endKind && resultStr === "1/2-1/2") {
        endKind = "draw";
    }
    /* Must not assume checkmate for bare 1-0 / 0-1 */
    return endKind;
}

describe("review outcome classification", function () {
    it("classifies Out Of Time reason as timeout, not checkmate", function () {
        const kind = classifyFromReasonAndScore("Out Of Time. white lost", "0-1", {});
        assert.strictEqual(kind, "timeout");
    });

    it("classifies checkmate from state flag", function () {
        const kind = classifyFromReasonAndScore("", "1-0", { checkmate: true });
        assert.strictEqual(kind, "checkmate");
    });

    it("does not invent checkmate from score alone", function () {
        const kind = classifyFromReasonAndScore("", "0-1", {});
        assert.strictEqual(kind, null);
    });

    it("classifies resign from reason", function () {
        const kind = classifyFromReasonAndScore("white Player Resigned.", "0-1", {});
        assert.strictEqual(kind, "resign");
    });
});
