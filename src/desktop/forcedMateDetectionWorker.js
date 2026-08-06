/**
 * Worker thread entry for forced-loss mate detection.
 * Keeps the Electron main / Node event loop responsive during endgame searches.
 */
"use strict";

const { parentPort } = require("worker_threads");
const { ChessGame } = require("../ChessGame");
const { detectForcedLossMate } = require("./forcedMateDetection");

if (!parentPort) {
    throw new Error("forcedMateDetectionWorker must run as a worker_threads Worker");
}

parentPort.on("message", (msg) => {
    const requestId = msg && msg.requestId;
    try {
        if (!msg || msg.gameStateJson == null) {
            throw new Error("Missing gameStateJson");
        }
        const game = new ChessGame(true);
        game.loadGame(String(msg.gameStateJson));
        const result = detectForcedLossMate(game, msg.opts || undefined);
        parentPort.postMessage({ requestId, result });
    } catch (err) {
        parentPort.postMessage({
            requestId,
            error: err && err.message ? err.message : String(err),
        });
    }
});
