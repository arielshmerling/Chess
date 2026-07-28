/**
 * Position evaluation formatting and status-bar tooltip chrome.
 *
 * Presentation only — the shell still calls Engine.evaluatePosition and the board overlay.
 */
(function (global) {
    "use strict";

    const t =
        typeof module === "object" && module && module.exports
            ? require("../strings/t-bridge").t
            : typeof global.ShmerlingT === "function"
              ? global.ShmerlingT
              : function (key) {
                    return key;
                };

    /**
     * @param {object|null|undefined} result
     * @returns {string}
     */
    function formatTotalText(result) {
        if (!result) {
            return "";
        }
        if (result.terminal === "checkmate") {
            return t("play.status.checkmate");
        }
        if (result.terminal === "draw") {
            return t("play.status.drawZero");
        }
        const value = result.total;
        if (!Number.isFinite(value)) {
            return "?";
        }
        if (Math.abs(value) >= 1000) {
            return String(Math.round(value));
        }
        const rounded = Math.round(value * 100) / 100;
        if (Number.isInteger(rounded)) {
            return (rounded > 0 ? "+" : "") + String(rounded);
        }
        const text = rounded.toFixed(2).replace(/\.?0+$/, "");
        return (rounded > 0 ? "+" : "") + text;
    }

    /**
     * @param {Array<{label: string, value?: number, text?: string}>|null|undefined} summary
     * @param {string} [totalText]
     * @returns {string}
     */
    function formatSummaryTooltip(summary, totalText) {
        const lines = (summary || []).map(function (item) {
            if (item.text != null && Number.isFinite(item.value)) {
                const sign = item.value > 0 ? "+" : "";
                return item.label + ": " + sign + item.value + " (" + item.text + ")";
            }
            if (item.text != null) {
                return item.label + ": " + item.text;
            }
            const sign = item.value > 0 ? "+" : "";
            return item.label + ": " + sign + item.value;
        });
        if (totalText) {
            lines.push(t("play.status.totalLabel", { value: totalText }));
        }
        return lines.join("\n");
    }

    /**
     * @param {HTMLElement|null} statusEl
     * @param {Array|null|undefined} summary
     * @param {string} [totalText]
     */
    function applyStatusTooltip(statusEl, summary, totalText) {
        if (!statusEl) {
            return;
        }
        const tooltip = formatSummaryTooltip(summary, totalText);
        if (tooltip) {
            statusEl.setAttribute("title", tooltip);
        } else {
            statusEl.removeAttribute("title");
        }
    }

    /**
     * @param {HTMLElement|null} statusEl
     */
    function clearStatusTooltip(statusEl) {
        if (statusEl) {
            statusEl.removeAttribute("title");
        }
    }

    /**
     * Status line after a successful evaluation.
     *
     * @param {object} result
     * @returns {string}
     */
    function statusMessage(result) {
        const sideLabel =
            result && result.sideToMove === "black" ? t("common.black") : t("common.white");
        const scoreText = formatTotalText(result);
        return t("play.status.evaluationLine", { side: sideLabel, score: scoreText });
    }

    const EvaluationDisplay = {
        formatTotalText: formatTotalText,
        formatSummaryTooltip: formatSummaryTooltip,
        applyStatusTooltip: applyStatusTooltip,
        clearStatusTooltip: clearStatusTooltip,
        statusMessage: statusMessage,
    };

    global.PlayEvaluationDisplay = EvaluationDisplay;

    if (typeof module === "object" && module && module.exports) {
        module.exports = EvaluationDisplay;
    }
})(typeof window !== "undefined" ? window : globalThis);
