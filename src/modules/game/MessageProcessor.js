class MessageProcessor {
    handlers = {
        "move": this.onMoveReceived,
        "info": this.onInfoReceived,
        "cmd": this.onCommandReceived
    };
    async process(game, message) {
        const func = this.handlers[message.type];
        if (typeof func !== "function") {
            return;
        }
        /* Must call with processor as `this` (handlers are unbound method refs). */
        const result = func.call(this, game, message);
        if (result && typeof result.then === "function") {
            await result;
        }
    }

    onMoveReceived() { }
    onInfoReceived() { }
    onCommandReceived() { }

}

module.exports = { MessageProcessor };