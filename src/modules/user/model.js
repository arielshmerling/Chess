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
    date: {
        type: Date,
        default: mongoose.default.now,
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

    bookmarks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bookmark",
    }]

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
