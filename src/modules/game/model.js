

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

    moves: [{
        type: String,
    }]
});


module.exports = {
    Game: mongoose.model("Game", gameSchema),
    State: mongoose.model("State", stateSchema),
};
