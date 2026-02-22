class MessageProcessor {
    handlers = {
        "move": this.onMoveReceived,
        "info": this.onInfoReceived,
        "cmd": this.onCommandReceived
    };
    process(game, message) {
        const func = this.handlers[message.type];
        func(game, message);
    }

    onMoveReceived() { }
    onInfoReceived() { }
    onCommandReceived() { }

}

module.exports = { MessageProcessor };