class Player {
    userId;
    userName;
    channel;
    isWhite;

    constructor(userId, userName, isWhite = true) {
        this.userId = userId;
        this.userName = userName;
        this.isWhite = isWhite;
    }
}

module.exports = { Player };
