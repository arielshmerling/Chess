// Version 1.8
const { ChessGame } = require("./ChessGame");
const { State } = require("./modules/game/model");

class Brain {

    #game = new ChessGame();
    #depth = 0;
    #openings = [];
    MAX_DEPTH = 1;
    #canceling = false;


    constructor(maxDepth = 1) {
        if (maxDepth != null) {
            this.MAX_DEPTH = Math.min(5, Math.max(1, Number(maxDepth) || 1));
        }
        console.log("Chess Brain Created");
        this.#initOpenings();

    }

    get Version() {
        return "Brain v1.8";
    }


    async nextMove(game) {
        this.#depth = 0;
        const state = game.GameState;
        const strState = JSON.stringify(state);
        this.#game.loadGame(strState);
        // return new Promise((resolve, reject) => {
        //     setTimeout(async () => {
        let move = await this.#tryFindMatchState();
        //     if (this.#canceling) { reject(); }

        if (move) {
            return move;
            //   resolve(move);
        }
        else {
            this.#game.SearchMode = true;



            this.#suggestMove()

            this.#game.SearchMode = false;
            move = result;
            console.log("result from thread pool:", result); // result will be 2.
            if (move) {
                move.turn = this.#game.Turn;
                //           resolve(move);
                return move;
            }
            else {
                return null;
                //             reject(move);
            }



            // if (this.#canceling) { reject(); }
            console.log("OK");
        }
        //     }, 100);
        //    });
    }

    cancel() {
        this.#canceling = true;
    }

    #suggestMove() {

        this.#depth++;
        const moves = this.#allPossibleMoves();
        if (this.#depth > this.MAX_DEPTH) {
            return moves[0];
        }

        for (let i = 0; i < moves.length; i++) {
            // for (const move of moves) {
            const move = moves[i];
            move.score = this.#scoreMove(move);
        }
        if (this.#depth == 0) { console.log("*final score"); }
        const finalResult = this.#findBestMove(moves);
        this.#depth--;
        return finalResult;
    }

    #findBestMove(moves) {
        if (!moves || moves.length == 0) { return null; }
        const max = Math.max(...moves.map(o => o.score));
        moves = moves.filter(o => o.score == max);
        if (this.#depth == 1) {
            console.log("after all the number of options:" + moves.length);
        }
        const rand = Math.floor(Math.random() * moves.length);
        return moves[rand];
    }

    #allPossibleMoves() {
        let moves = [];
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {

                const source = this.#game.square(i, j);
                const options = this.#game.possibleMoves(source);
                if (options.length > 0) {
                    for (const move of options) {
                        moves = moves.concat(move);
                    }
                }
            }
        }
        return moves;
    }

    #stateScore(move) {

        let score = 0;
        const state = this.#game.GameState;
        const targetPiece = state.board[move.target.row][move.target.col];
        if (targetPiece == null) {
            score = 0;
        }
        else {
            score = this.#pieceValue(targetPiece.pieceType);
        }

        return score;
    }

    #scoreMove(move) {

        let score = this.#stateScore(move);

        this.#game.makeMove(move.source, move.target);
        if (this.#game.Checkmate) { score = 9999; }

        if (move.promotion) {
            switch (move.selectedPiece) {
                case this.#game.QUEEN:
                    score = 1100;
                    break;
                case this.#game.ROOK:
                    score = 1010;
                    break;
                case this.#game.KNIGHT:
                    score = 1005;
                    break;
                case this.#game.BISHOP:
                    score = 1000;
                    break;
            }
        }

        if (this.#game.Moves.length > 50) { // todo: calculate the number of left pieces
            if (this.#game.Check) { score += 3; }
        }

        if (this.#depth < this.MAX_DEPTH) {
            if (this.#canceling) { return; }
            const opponentMove = this.#suggestMove();
            if (opponentMove) {
                score -= opponentMove.score;
            }
        }
        this.#game.undo();
        return score;
    }

    #pieceValue(pieceType) {

        switch (pieceType) {
            case this.#game.PAWN:
                return 1;
            case this.#game.ROOK:
                return 5;
            case this.#game.KNIGHT:
                return 3;
            case this.#game.BISHOP:
                return 3;
            case this.#game.QUEEN:
                return 9;
            case this.#game.KING:
                return 10000;
            default:
                return 0;
        }
    }

    async #tryFindMatchState() {
        const gameState = this.#game.SavedGameState;
        const options = [];
        const stateStr = gameState;
        const findResult = await State.find({ state: stateStr });
        for await (const doc of findResult) {
            options.push(JSON.parse(doc.move));
        }
        const rand = Math.floor(Math.random() * options.length);
        console.log(options.length + " moves found, chosing option #" + rand);
        return options.length > 0 ? options[rand] : null;
    }

    #initOpenings() {

        this.#openings.push(
            {
                name: "firstWhite",
                state: "{\"board\":[[{\"color\":\"black\",\"pieceType\":4},{\"color\":\"black\",\"pieceType\":2},{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":5},{\"color\":\"black\",\"pieceType\":1},{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":2},{\"color\":\"black\",\"pieceType\":4}],[{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0}],[{\"color\":\"white\",\"pieceType\":4},{\"color\":\"white\",\"pieceType\":2},{\"color\":\"white\",\"pieceType\":3},{\"color\":\"white\",\"pieceType\":5},{\"color\":\"white\",\"pieceType\":1},{\"color\":\"white\",\"pieceType\":3},{\"color\":\"white\",\"pieceType\":2},{\"color\":\"white\",\"pieceType\":4}]],\"turn\":\"white\",\"capturedPiecesList\":[],\"check\":false,\"checkmate\":false,\"draw\":false,\"resigned\":false,\"whiteKingMoved\":false,\"blackKingMoved\":false,\"farWhiteRookMoved\":false,\"farBlackRookMoved\":false,\"nearWhiteRookMoved\":false,\"nearBlackRookMoved\":false,\"whitePlayerView\":true,\"fiftyMovesCounter\":0,\"promoting\":false,\"queensideWhiteRookMoved\":false,\"queensideBlackRookMoved\":false,\"kingsideWhiteRookMoved\":false,\"kingsideBlackRookMoved\":false}",
                move: "{\"valid\":true,\"source\":{\"row\":6,\"col\":4},\"target\":{\"row\":4,\"col\":4},\"piece\":{\"color\":\"white\",\"pieceType\":0},\"promotion\":false,\"ennPassant\":false,\"capturedPiece\":null,\"hitSquare\":null,\"turn\":\"white\",\"castling\":false,\"whitePlayerView\":true}"
            }
        );

        this.#openings.push(
            {
                name: "Sicilian defense",
                state: "{\"board\":[[{\"color\":\"black\",\"pieceType\":4},{\"color\":\"black\",\"pieceType\":2},{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":5},{\"color\":\"black\",\"pieceType\":1},{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":2},{\"color\":\"black\",\"pieceType\":4}],[{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,{\"color\":\"white\",\"pieceType\":0},null,null,null],[null,null,null,null,null,null,null,null],[{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},null,{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0}],[{\"color\":\"white\",\"pieceType\":4},{\"color\":\"white\",\"pieceType\":2},{\"color\":\"white\",\"pieceType\":3},{\"color\":\"white\",\"pieceType\":5},{\"color\":\"white\",\"pieceType\":1},{\"color\":\"white\",\"pieceType\":3},{\"color\":\"white\",\"pieceType\":2},{\"color\":\"white\",\"pieceType\":4}]],\"turn\":\"black\",\"capturedPiecesList\":[],\"check\":false,\"checkmate\":false,\"draw\":false,\"resigned\":false,\"whiteKingMoved\":false,\"blackKingMoved\":false,\"farWhiteRookMoved\":false,\"farBlackRookMoved\":false,\"nearWhiteRookMoved\":false,\"nearBlackRookMoved\":false,\"whitePlayerView\":true,\"fiftyMovesCounter\":0,\"promoting\":false,\"queensideWhiteRookMoved\":false,\"queensideBlackRookMoved\":false,\"kingsideWhiteRookMoved\":false,\"kingsideBlackRookMoved\":false,\"lastMove\":{\"valid\":true,\"source\":{\"row\":6,\"col\":4},\"target\":{\"row\":4,\"col\":4},\"piece\":{\"color\":\"white\",\"pieceType\":0},\"promotion\":false,\"ennPassant\":false,\"capturedPiece\":null,\"hitSquare\":null,\"turn\":\"white\",\"castling\":false,\"whitePlayerView\":true}}",
                move: "{\"valid\":true,\"source\":{\"row\":1,\"col\":2},\"target\":{\"row\":3,\"col\":2},\"piece\":{\"color\":\"black\",\"pieceType\":0},\"promotion\":false,\"ennPassant\":false,\"capturedPiece\":null,\"hitSquare\":null,\"turn\":\"black\",\"castling\":false,\"whitePlayerView\":true}"
            }
        );

        this.#openings.push(
            {
                name: "Alekhine's Defense",
                state: "{\"board\":[[{\"color\":\"black\",\"pieceType\":4},{\"color\":\"black\",\"pieceType\":2},{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":5},{\"color\":\"black\",\"pieceType\":1},{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":2},{\"color\":\"black\",\"pieceType\":4}],[{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,{\"color\":\"white\",\"pieceType\":0},null,null,null],[null,null,null,null,null,null,null,null],[{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},null,{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0}],[{\"color\":\"white\",\"pieceType\":4},{\"color\":\"white\",\"pieceType\":2},{\"color\":\"white\",\"pieceType\":3},{\"color\":\"white\",\"pieceType\":5},{\"color\":\"white\",\"pieceType\":1},{\"color\":\"white\",\"pieceType\":3},{\"color\":\"white\",\"pieceType\":2},{\"color\":\"white\",\"pieceType\":4}]],\"turn\":\"black\",\"capturedPiecesList\":[],\"check\":false,\"checkmate\":false,\"draw\":false,\"resigned\":false,\"whiteKingMoved\":false,\"blackKingMoved\":false,\"farWhiteRookMoved\":false,\"farBlackRookMoved\":false,\"nearWhiteRookMoved\":false,\"nearBlackRookMoved\":false,\"whitePlayerView\":true,\"fiftyMovesCounter\":0,\"promoting\":false,\"queensideWhiteRookMoved\":false,\"queensideBlackRookMoved\":false,\"kingsideWhiteRookMoved\":false,\"kingsideBlackRookMoved\":false,\"lastMove\":{\"valid\":true,\"source\":{\"row\":6,\"col\":4},\"target\":{\"row\":4,\"col\":4},\"piece\":{\"color\":\"white\",\"pieceType\":0},\"promotion\":false,\"ennPassant\":false,\"capturedPiece\":null,\"hitSquare\":null,\"turn\":\"white\",\"castling\":false,\"whitePlayerView\":true}}",
                move: "{\"valid\":true,\"source\":{\"row\":0,\"col\":6},\"target\":{\"row\":2,\"col\":5},\"piece\":{\"color\":\"black\",\"pieceType\":2},\"promotion\":false,\"ennPassant\":false,\"capturedPiece\":null,\"hitSquare\":null,\"turn\":\"black\",\"castling\":false,\"whitePlayerView\":true}"
            }
        );


        this.#openings.push({
            name: "Common response to e4",
            state: "{\"board\":[[{\"color\":\"black\",\"pieceType\":4},{\"color\":\"black\",\"pieceType\":2},{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":5},{\"color\":\"black\",\"pieceType\":1},{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":2},{\"color\":\"black\",\"pieceType\":4}],[{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,{\"color\":\"white\",\"pieceType\":0},null,null,null],[null,null,null,null,null,null,null,null],[{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},null,{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0}],[{\"color\":\"white\",\"pieceType\":4},{\"color\":\"white\",\"pieceType\":2},{\"color\":\"white\",\"pieceType\":3},{\"color\":\"white\",\"pieceType\":5},{\"color\":\"white\",\"pieceType\":1},{\"color\":\"white\",\"pieceType\":3},{\"color\":\"white\",\"pieceType\":2},{\"color\":\"white\",\"pieceType\":4}]],\"turn\":\"black\",\"capturedPiecesList\":[],\"check\":false,\"checkmate\":false,\"draw\":false,\"resigned\":false,\"whiteKingMoved\":false,\"blackKingMoved\":false,\"farWhiteRookMoved\":false,\"farBlackRookMoved\":false,\"nearWhiteRookMoved\":false,\"nearBlackRookMoved\":false,\"whitePlayerView\":true,\"fiftyMovesCounter\":0,\"promoting\":false,\"queensideWhiteRookMoved\":false,\"queensideBlackRookMoved\":false,\"kingsideWhiteRookMoved\":false,\"kingsideBlackRookMoved\":false,\"lastMove\":{\"valid\":true,\"source\":{\"row\":6,\"col\":4},\"target\":{\"row\":4,\"col\":4},\"piece\":{\"color\":\"white\",\"pieceType\":0},\"promotion\":false,\"ennPassant\":false,\"capturedPiece\":null,\"hitSquare\":null,\"turn\":\"white\",\"castling\":false,\"whitePlayerView\":true}}",
            move: "{\"valid\":true,\"source\":{\"row\":1,\"col\":4},\"target\":{\"row\":3,\"col\":4},\"piece\":{\"color\":\"black\",\"pieceType\":0},\"promotion\":false,\"ennPassant\":false,\"capturedPiece\":null,\"hitSquare\":null,\"turn\":\"black\",\"castling\":false,\"whitePlayerView\":true}"
        });
        this.#openings.push({
            name: "Sicilian response to Kf3 v1",
            state: "{\"board\":[[{\"color\":\"black\",\"pieceType\":4},{\"color\":\"black\",\"pieceType\":2},{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":5},{\"color\":\"black\",\"pieceType\":1},{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":2},{\"color\":\"black\",\"pieceType\":4}],[{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},null,{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0}],[null,null,null,null,null,null,null,null],[null,null,{\"color\":\"black\",\"pieceType\":0},null,null,null,null,null],[null,null,null,null,{\"color\":\"white\",\"pieceType\":0},null,null,null],[null,null,null,null,null,{\"color\":\"white\",\"pieceType\":2},null,null],[{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},null,{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0}],[{\"color\":\"white\",\"pieceType\":4},{\"color\":\"white\",\"pieceType\":2},{\"color\":\"white\",\"pieceType\":3},{\"color\":\"white\",\"pieceType\":5},{\"color\":\"white\",\"pieceType\":1},{\"color\":\"white\",\"pieceType\":3},null,{\"color\":\"white\",\"pieceType\":4}]],\"turn\":\"black\",\"capturedPiecesList\":[],\"check\":false,\"checkmate\":false,\"draw\":false,\"resigned\":false,\"whiteKingMoved\":false,\"blackKingMoved\":false,\"farWhiteRookMoved\":false,\"farBlackRookMoved\":false,\"nearWhiteRookMoved\":false,\"nearBlackRookMoved\":false,\"whitePlayerView\":true,\"fiftyMovesCounter\":1,\"promoting\":false,\"queensideWhiteRookMoved\":false,\"queensideBlackRookMoved\":false,\"kingsideWhiteRookMoved\":false,\"kingsideBlackRookMoved\":false,\"lastMove\":{\"valid\":true,\"source\":{\"row\":7,\"col\":6},\"target\":{\"row\":5,\"col\":5},\"piece\":{\"color\":\"white\",\"pieceType\":2},\"promotion\":false,\"ennPassant\":false,\"capturedPiece\":null,\"hitSquare\":null,\"turn\":\"white\",\"castling\":false,\"whitePlayerView\":true}}",
            move: "{\"valid\":true,\"source\":{\"row\":1,\"col\":3},\"target\":{\"row\":2,\"col\":3},\"piece\":{\"color\":\"black\",\"pieceType\":0},\"promotion\":false,\"ennPassant\":false,\"capturedPiece\":null,\"hitSquare\":null,\"turn\":\"black\",\"castling\":false,\"whitePlayerView\":true}"
        });

        this.#openings.push({
            name: "Sicilian response to Kf3 v2",
            state: "{\"board\":[[{\"color\":\"black\",\"pieceType\":4},{\"color\":\"black\",\"pieceType\":2},{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":5},{\"color\":\"black\",\"pieceType\":1},{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":2},{\"color\":\"black\",\"pieceType\":4}],[{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},null,{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0}],[null,null,null,null,null,null,null,null],[null,null,{\"color\":\"black\",\"pieceType\":0},null,null,null,null,null],[null,null,null,null,{\"color\":\"white\",\"pieceType\":0},null,null,null],[null,null,null,null,null,{\"color\":\"white\",\"pieceType\":2},null,null],[{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},null,{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0}],[{\"color\":\"white\",\"pieceType\":4},{\"color\":\"white\",\"pieceType\":2},{\"color\":\"white\",\"pieceType\":3},{\"color\":\"white\",\"pieceType\":5},{\"color\":\"white\",\"pieceType\":1},{\"color\":\"white\",\"pieceType\":3},null,{\"color\":\"white\",\"pieceType\":4}]],\"turn\":\"black\",\"capturedPiecesList\":[],\"check\":false,\"checkmate\":false,\"draw\":false,\"resigned\":false,\"whiteKingMoved\":false,\"blackKingMoved\":false,\"farWhiteRookMoved\":false,\"farBlackRookMoved\":false,\"nearWhiteRookMoved\":false,\"nearBlackRookMoved\":false,\"whitePlayerView\":true,\"fiftyMovesCounter\":1,\"promoting\":false,\"queensideWhiteRookMoved\":false,\"queensideBlackRookMoved\":false,\"kingsideWhiteRookMoved\":false,\"kingsideBlackRookMoved\":false,\"lastMove\":{\"valid\":true,\"source\":{\"row\":7,\"col\":6},\"target\":{\"row\":5,\"col\":5},\"piece\":{\"color\":\"white\",\"pieceType\":2},\"promotion\":false,\"ennPassant\":false,\"capturedPiece\":null,\"hitSquare\":null,\"turn\":\"white\",\"castling\":false,\"whitePlayerView\":true}}",
            move: "{\"valid\":true,\"source\":{\"row\":1,\"col\":4},\"target\":{\"row\":2,\"col\":4},\"piece\":{\"color\":\"black\",\"pieceType\":0},\"promotion\":false,\"ennPassant\":false,\"capturedPiece\":null,\"hitSquare\":null,\"turn\":\"black\",\"castling\":false,\"whitePlayerView\":true}"
        });

        this.#openings.push({
            name: "Sicilian response to Kf3 v3",
            state: "{\"board\":[[{\"color\":\"black\",\"pieceType\":4},{\"color\":\"black\",\"pieceType\":2},{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":5},{\"color\":\"black\",\"pieceType\":1},{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":2},{\"color\":\"black\",\"pieceType\":4}],[{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},null,{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0}],[null,null,null,null,null,null,null,null],[null,null,{\"color\":\"black\",\"pieceType\":0},null,null,null,null,null],[null,null,null,null,{\"color\":\"white\",\"pieceType\":0},null,null,null],[null,null,null,null,null,{\"color\":\"white\",\"pieceType\":2},null,null],[{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},null,{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0}],[{\"color\":\"white\",\"pieceType\":4},{\"color\":\"white\",\"pieceType\":2},{\"color\":\"white\",\"pieceType\":3},{\"color\":\"white\",\"pieceType\":5},{\"color\":\"white\",\"pieceType\":1},{\"color\":\"white\",\"pieceType\":3},null,{\"color\":\"white\",\"pieceType\":4}]],\"turn\":\"black\",\"capturedPiecesList\":[],\"check\":false,\"checkmate\":false,\"draw\":false,\"resigned\":false,\"whiteKingMoved\":false,\"blackKingMoved\":false,\"farWhiteRookMoved\":false,\"farBlackRookMoved\":false,\"nearWhiteRookMoved\":false,\"nearBlackRookMoved\":false,\"whitePlayerView\":true,\"fiftyMovesCounter\":1,\"promoting\":false,\"queensideWhiteRookMoved\":false,\"queensideBlackRookMoved\":false,\"kingsideWhiteRookMoved\":false,\"kingsideBlackRookMoved\":false,\"lastMove\":{\"valid\":true,\"source\":{\"row\":7,\"col\":6},\"target\":{\"row\":5,\"col\":5},\"piece\":{\"color\":\"white\",\"pieceType\":2},\"promotion\":false,\"ennPassant\":false,\"capturedPiece\":null,\"hitSquare\":null,\"turn\":\"white\",\"castling\":false,\"whitePlayerView\":true}}",
            move: "{\"valid\":true,\"source\":{\"row\":1,\"col\":6},\"target\":{\"row\":2,\"col\":6},\"piece\":{\"color\":\"black\",\"pieceType\":0},\"promotion\":false,\"ennPassant\":false,\"capturedPiece\":null,\"hitSquare\":null,\"turn\":\"black\",\"castling\":false,\"whitePlayerView\":true}"
        });

        this.#openings.push({
            name: "Sicilian response to Kf3 v4 popular",
            state: "{\"board\":[[{\"color\":\"black\",\"pieceType\":4},{\"color\":\"black\",\"pieceType\":2},{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":5},{\"color\":\"black\",\"pieceType\":1},{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":2},{\"color\":\"black\",\"pieceType\":4}],[{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},null,{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0}],[null,null,null,null,null,null,null,null],[null,null,{\"color\":\"black\",\"pieceType\":0},null,null,null,null,null],[null,null,null,null,{\"color\":\"white\",\"pieceType\":0},null,null,null],[null,null,null,null,null,{\"color\":\"white\",\"pieceType\":2},null,null],[{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},null,{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0}],[{\"color\":\"white\",\"pieceType\":4},{\"color\":\"white\",\"pieceType\":2},{\"color\":\"white\",\"pieceType\":3},{\"color\":\"white\",\"pieceType\":5},{\"color\":\"white\",\"pieceType\":1},{\"color\":\"white\",\"pieceType\":3},null,{\"color\":\"white\",\"pieceType\":4}]],\"turn\":\"black\",\"capturedPiecesList\":[],\"check\":false,\"checkmate\":false,\"draw\":false,\"resigned\":false,\"whiteKingMoved\":false,\"blackKingMoved\":false,\"farWhiteRookMoved\":false,\"farBlackRookMoved\":false,\"nearWhiteRookMoved\":false,\"nearBlackRookMoved\":false,\"whitePlayerView\":true,\"fiftyMovesCounter\":1,\"promoting\":false,\"queensideWhiteRookMoved\":false,\"queensideBlackRookMoved\":false,\"kingsideWhiteRookMoved\":false,\"kingsideBlackRookMoved\":false,\"lastMove\":{\"valid\":true,\"source\":{\"row\":7,\"col\":6},\"target\":{\"row\":5,\"col\":5},\"piece\":{\"color\":\"white\",\"pieceType\":2},\"promotion\":false,\"ennPassant\":false,\"capturedPiece\":null,\"hitSquare\":null,\"turn\":\"white\",\"castling\":false,\"whitePlayerView\":true}}",
            move: "{\"valid\":true,\"source\":{\"row\":0,\"col\":1},\"target\":{\"row\":2,\"col\":2},\"piece\":{\"color\":\"black\",\"pieceType\":2},\"promotion\":false,\"ennPassant\":false,\"capturedPiece\":null,\"hitSquare\":null,\"turn\":\"black\",\"castling\":false,\"whitePlayerView\":true}"
        });

        this.#openings.push({
            name: "Open Sicilian",
            state: "{\"board\":[[{\"color\":\"black\",\"pieceType\":4},null,{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":5},{\"color\":\"black\",\"pieceType\":1},{\"color\":\"black\",\"pieceType\":3},{\"color\":\"black\",\"pieceType\":2},{\"color\":\"black\",\"pieceType\":4}],[{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},null,{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0},{\"color\":\"black\",\"pieceType\":0}],[null,null,{\"color\":\"black\",\"pieceType\":2},null,null,null,null,null],[null,null,{\"color\":\"black\",\"pieceType\":0},null,null,null,null,null],[null,null,null,null,{\"color\":\"white\",\"pieceType\":0},null,null,null],[null,null,null,null,null,{\"color\":\"white\",\"pieceType\":2},null,null],[{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},null,{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0},{\"color\":\"white\",\"pieceType\":0}],[{\"color\":\"white\",\"pieceType\":4},{\"color\":\"white\",\"pieceType\":2},{\"color\":\"white\",\"pieceType\":3},{\"color\":\"white\",\"pieceType\":5},{\"color\":\"white\",\"pieceType\":1},{\"color\":\"white\",\"pieceType\":3},null,{\"color\":\"white\",\"pieceType\":4}]],\"turn\":\"white\",\"capturedPiecesList\":[],\"check\":false,\"checkmate\":false,\"draw\":false,\"resigned\":false,\"whiteKingMoved\":false,\"blackKingMoved\":false,\"farWhiteRookMoved\":false,\"farBlackRookMoved\":false,\"nearWhiteRookMoved\":false,\"nearBlackRookMoved\":false,\"whitePlayerView\":true,\"fiftyMovesCounter\":2,\"promoting\":false,\"queensideWhiteRookMoved\":false,\"queensideBlackRookMoved\":false,\"kingsideWhiteRookMoved\":false,\"kingsideBlackRookMoved\":false,\"lastMove\":{\"valid\":true,\"source\":{\"row\":0,\"col\":1},\"target\":{\"row\":2,\"col\":2},\"piece\":{\"color\":\"black\",\"pieceType\":2},\"promotion\":false,\"ennPassant\":false,\"capturedPiece\":null,\"hitSquare\":null,\"turn\":\"black\",\"castling\":false,\"whitePlayerView\":true}}",
            move: "{\"valid\":true,\"source\":{\"row\":6,\"col\":3},\"target\":{\"row\":4,\"col\":3},\"piece\":{\"color\":\"white\",\"pieceType\":0},\"promotion\":false,\"ennPassant\":false,\"capturedPiece\":null,\"hitSquare\":null,\"turn\":\"white\",\"castling\":false,\"whitePlayerView\":true}"
        });


    }
}

function isServerSide() {
    return !(typeof window != "undefined" && window.document);
}

if (isServerSide()) {
    module.exports = { Brain };
}