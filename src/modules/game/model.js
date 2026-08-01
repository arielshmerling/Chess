

const mongoose = require("mongoose");
const ObjectId = require("mongodb").ObjectId;

const stateSchema = new mongoose.Schema({
    state: {
        type: String,
    },
    move: {
        type: String,
    },
});


const gameSchema = new mongoose.Schema({
    createBy: {
        type: String,
    },
    createByUserId: {
        type: ObjectId,
    },
    state: {
        type: String,
        default: "new"
    },
    reason: {
        type: String,
    },
    result: {
        type: String,
    },
    created: {
        type: Date,
        default: Date.now
    },
    whitePlayer: {
        type: String,
    },
    blackPlayer: {
        type: String,
    },
    gameType: {
        type: String,
    },
    /** When true, game is hidden from club homepage / active-games lists (not broadcast to lobby). */
    isPrivate: {
        type: Boolean,
        default: false,
    },

    /** Time control in minutes (optional; older docs may omit — inferred from move timers on review). */
    timeMinutes: {
        type: Number,
        min: 1,
        max: 180,
    },

    moves: [{
        type: String,
    }]
});


module.exports = {
    Game: mongoose.model("Game", gameSchema),
    State: mongoose.model("State", stateSchema),
};
