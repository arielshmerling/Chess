const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");
const pgnParser = {};

pgnParser.parsePGN = function (pgnString) {
    const games = [];
    const lines = pgnString.split("\n");

    let game = {};
    game.moves = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!line) {continue;}

        if (line.startsWith("[")) {
            const tag = line.substring(1, line.indexOf("]")).replaceAll(/"/g, "");
            const tagName = tag.substring(0, tag.indexOf(" ")).toLowerCase();
            game[tagName] = tag.substring(tag.indexOf(" ") + 1);
        }
        else {
            const moves = line.split(" ");
            //for (let move of moves) {
            for (let j = 0; j < moves.length; j++) {
                const move = moves[j];
                let gameMove;
                if (move === "1-0" || move === "0-1" || move === "1/2-1/2" || move === "*") {
                    game.moves.push({ moveStr: move });
                    game.Id = uuidv4();
                    games.push(game);
                    game = {};
                    game.moves = [];
                    continue;
                }
                else if (move.indexOf(".") > 0) {
                    gameMove = { moveStr: move.substring(move.indexOf(".") + 1), color: "white" };
                }
                else {
                    gameMove = { moveStr: move, color: "black" };
                }

                if (move != "") {
                    game.moves.push(gameMove);
                }
            }
        }
    }


    return games;
};

pgnParser.readFile = async function (filename) {

    try {
        const data = await fs.readFile(filename, "utf8");
        const pgn = pgnParser.parsePGN(data.toString());
        return pgn;
    }
    catch (error) {
        console.log(error);

    }
};

module.exports = pgnParser;

// Example usage:
