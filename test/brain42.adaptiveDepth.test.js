/**
 * Brain 4.2 adaptive search depth from root move count.
 * Run: npx mocha ./test/brain42.adaptiveDepth.test.js
 */
/* eslint-disable */

const assert = require("assert");
const {
    computeAdaptiveSearchDepth,
    estimateLeafEvaluations,
    resolveAdaptiveDepthSettings,
} = require("../src/brain42");
const { getDefaultConfig, sanitizeBrain42Config } = require("../src/modules/game/brainConfigService");

describe("Brain 4.2 adaptive depth", () => {
    const fullConfig = getDefaultConfig("brain42");

    it("returns base depth when adaptive depth is disabled", () => {
        const cfg = sanitizeBrain42Config({
            ...fullConfig,
            adaptiveDepth: { ...fullConfig.adaptiveDepth, enabled: false },
        });
        assert.strictEqual(computeAdaptiveSearchDepth(3, 5, cfg), 3);
        assert.strictEqual(computeAdaptiveSearchDepth(3, 40, cfg), 3);
    });

    it("keeps base depth at the reference root move count", () => {
        const ref = fullConfig.adaptiveDepth.referenceRootMoves;
        assert.strictEqual(computeAdaptiveSearchDepth(3, ref, fullConfig), 3);
    });

    it("searches deeper when root has fewer legal moves", () => {
        assert.ok(computeAdaptiveSearchDepth(3, 30, fullConfig) >= 3);
        assert.ok(computeAdaptiveSearchDepth(3, 8, fullConfig) > computeAdaptiveSearchDepth(3, 30, fullConfig));
        assert.ok(computeAdaptiveSearchDepth(3, 3, fullConfig) >= computeAdaptiveSearchDepth(3, 8, fullConfig));
    });

    it("searches shallower when root has more legal moves than reference", () => {
        const ref = fullConfig.adaptiveDepth.referenceRootMoves;
        assert.ok(computeAdaptiveSearchDepth(3, ref * 2, fullConfig) <= 3);
    });

    it("clamps to configured min and max search depth", () => {
        const cfg = sanitizeBrain42Config({
            ...fullConfig,
            adaptiveDepth: {
                ...fullConfig.adaptiveDepth,
                minSearchDepth: 2,
                maxSearchDepth: 4,
            },
        });
        assert.strictEqual(computeAdaptiveSearchDepth(2, 200, cfg), 2);
        assert.strictEqual(computeAdaptiveSearchDepth(3, 1, cfg), 4);
    });

    it("estimateLeafEvaluations grows with depth and root moves", () => {
        const low = estimateLeafEvaluations(10, 2, fullConfig);
        const high = estimateLeafEvaluations(10, 4, fullConfig);
        assert.ok(high > low);
        assert.ok(estimateLeafEvaluations(20, 3, fullConfig) > estimateLeafEvaluations(10, 3, fullConfig));
    });

    it("adaptive depth targets higher estimated leaf budget for sparse root positions", () => {
        const base = 3;
        const ref = fullConfig.adaptiveDepth.referenceRootMoves;
        const baseBudget = estimateLeafEvaluations(ref, base, fullConfig);
        const sparseDepth = computeAdaptiveSearchDepth(base, 8, 10, fullConfig);
        const sparseBudget = estimateLeafEvaluations(8, sparseDepth, fullConfig);
        assert.ok(sparseDepth > base);
        assert.ok(sparseBudget > baseBudget);
    });

    it("does not increase depth for sparse root moves when many pieces remain (check)", () => {
        assert.strictEqual(computeAdaptiveSearchDepth(3, 5, 32, fullConfig), 3);
        assert.strictEqual(computeAdaptiveSearchDepth(3, 3, 28, fullConfig), 3);
    });

    it("still increases depth for sparse root moves in low-material endgames", () => {
        assert.ok(computeAdaptiveSearchDepth(3, 5, 10, fullConfig) > 3);
        assert.ok(computeAdaptiveSearchDepth(3, 3, 8, fullConfig) >= computeAdaptiveSearchDepth(3, 5, 10, fullConfig));
    });

    it("partially scales depth increase between endgame and full-board piece counts", () => {
        const endgameDepth = computeAdaptiveSearchDepth(3, 8, 10, fullConfig);
        const midDepth = computeAdaptiveSearchDepth(3, 8, 18, fullConfig);
        const fullBoardDepth = computeAdaptiveSearchDepth(3, 8, 32, fullConfig);
        assert.ok(endgameDepth > midDepth);
        assert.ok(midDepth > fullBoardDepth);
        assert.strictEqual(fullBoardDepth, 3);
    });

    it("sanitized config includes adaptiveDepth piece-count thresholds", () => {
        const cfg = sanitizeBrain42Config(getDefaultConfig("brain42"));
        assert.strictEqual(cfg.adaptiveDepth.enabled, true);
        assert.strictEqual(cfg.adaptiveDepth.referenceRootMoves, 30);
        assert.strictEqual(cfg.adaptiveDepth.fullAdaptiveBelowTotalPieces, 12);
        assert.strictEqual(cfg.adaptiveDepth.noAdaptiveAboveTotalPieces, 24);
        assert.ok(resolveAdaptiveDepthSettings(cfg).avgBranchingFactor > 1);
    });
});
