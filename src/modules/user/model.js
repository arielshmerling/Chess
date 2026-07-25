const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const bookmarkSchema = new mongoose.Schema({
    state: {
        type: String,
    },

    moves: [{
        type: String,
    }],

    name: {
        type: String,
    },
    gameType: {
        type: String,
    },
    engine: {
        type: String,
        default: "brain43",
    },
    depth: {
        type: Number,
        min: 1,
        max: 5,
        default: 3,
    },
    date: {
        type: Date,
        default: mongoose.default.now,
    },

    originState: {
        type: String,
    },

    whitePlayerName: {
        type: String,
    },

    blackPlayerName: {
        type: String,
    },
});


const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, "Username cannot be blank"]
    },
    password: {
        type: String,
        required: [true, "Password cannot be blank"]
    },
    admin: {
        type: Boolean,
        required: [true, "admin cannot be blank"],
        default: false,
    },

    /** @deprecated Unused — admins always use /play; kept for existing Mongo documents. */
    preferPlayPage: {
        type: Boolean,
        default: false,
    },

    /** Web Play UI settings (themes, dock panels, gameplay prefs). */
    playUiSettings: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },

    /** Web Play custom theme store. */
    playCustomThemes: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    email: {
        type: String,
        required: [true, "email cannot be blank"],
    },
    level: {
        type: String,
        required: [true, "level cannot be blank"],
    },

    joinedDate: {
        type: Date,
        required: [true, "joinedDate cannot be blank"],
        default: Date.now,
    },

    lastLogin: {
        type: Date,
        required: [true, "lastLogin cannot be blank"],
        default: Date.now,
    },

    elo: {
        type: Number,
        required: [true, "elo cannot be blank"],
        default: 800,
    },

    friends: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],

    /** Pending incoming friend requests (sender user ids). */
    friendInvitesReceived: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],

    /** Pending outgoing friend requests (recipient user ids). */
    friendInvitesSent: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],

    bookmarks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bookmark",
    }],

    lastGameOptions: {
        color: { type: String, enum: ["white", "black"], default: "white" },
        engine: { type: String, default: "brain43" },
        difficulty: { type: Number, min: 1, max: 5, default: 3 },
        mouse: { type: String, enum: ["drag", "double"], default: "drag" },
        showAvailableMoves: { type: Boolean, default: true },
        /** Per-side clock budget for new single-player games (minutes). */
        timeMinutes: { type: Number, min: 1, max: 180, default: 90 },
        /** Last “Private” choice for Play Now (vs AI); not shown on club homepage when true. */
        isPrivate: { type: Boolean, default: false },
    },

});

userSchema.statics.authenticate = async function (username, password) {
    const foundUser = await this.findOne({ "username": { "$regex": username, $options: "i" } });
    const isValid = foundUser && await bcrypt.compare(password, foundUser.password);
    return isValid ? foundUser : false;
};

module.exports = {
    Bookmark: mongoose.model("Bookmark", bookmarkSchema),
    User: mongoose.model("User", userSchema),
};
