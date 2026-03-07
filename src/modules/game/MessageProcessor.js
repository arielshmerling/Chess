class MessageProcessor {
    handlers = {
        "move": this.onMoveReceived,
        "info": this.onInfoReceived,
        "cmd": this.onCommandReceived
    };
    async process(game, message) {
        const func = this.handlers[message.type];
        const result = func(game, message);
        if (result && typeof result.then === "function") {
            await result;
        }
    }

    onMoveReceived() { }
    onInfoReceived() { }
    onCommandReceived() { }

}

module.exports = { MessageProcessor };