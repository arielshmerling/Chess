/* eslint-disable */


console.log("Tests run")
//const { table } = require('console');
const { ChessGame } = require('../src/ChessGame')
const { Brain } = require('../src/brain')
const assert = require("assert");
const initalState = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false}`
let game;

before(() => {
    game = new ChessGame();
})/*  */




describe('Move Validation', () => {

    it("Check Validation not changing state", () => {
        let state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,{"color":"white","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"black","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[{"color":"black","pieceType":0},{"color":"black","pieceType":0}],"check":false,"checkmate":false,"draw":false,"drawReason":"","resigned":"","outOfTime":"","whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":2,"col":4},"target":{"row":3,"col":4},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        source = { row: 1, col: 6 }
        target = { row: 0, col: 7 }
        assert.equal(JSON.stringify(game.GameState), state);
        assert.equal(game.validateMove(source, target, "white").valid, true);
        assert.equal(JSON.stringify(game.GameState), state);


    });

    it('Test Move Validation inputs', () => {
        //Arrange
        game.loadGame(initalState);

        // Action
        source = { row: "6", col: "D" }
        target = { row: "4", col: "D" }
        let result1 = game.validateMove(null, target, "white");
        let result2 = game.validateMove(source, null, "white");
        let result3 = game.validateMove(source, target, "white");
        let result4 = game.validateMove(game.square("ERR", 2), game.square(1, 3), "white");
        let result5 = game.validateMove(game.square(1, "ERR"), game.square(1, 3), "white");
        let result6 = game.validateMove(game.square(1, 2), game.square("ERR", 3), "white");
        let result7 = game.validateMove(game.square(1, 2), game.square(1, "ERR"), "white");
        let result8 = game.validateMove(game.square(10, 20), game.square(10, 10), "white");
        let result9 = game.validateMove(game.square(4, 4), game.square(5, 4), "white");

        // Assert
        assert.equal(result1.valid, false);
        assert.equal(result1.reason, game.Reasons.INVALID_SOURCE_TARGET);
        assert.equal(result2.valid, false);
        assert.equal(result2.reason, game.Reasons.INVALID_SOURCE_TARGET);
        assert.equal(result3.valid, false);
        assert.equal(result3.reason, game.Reasons.INVALID_SOURCE_TARGET);
        assert.equal(result4.valid, false);
        assert.equal(result4.reason, game.Reasons.INVALID_SOURCE_TARGET);
        assert.equal(result5.valid, false);
        assert.equal(result5.reason, game.Reasons.INVALID_SOURCE_TARGET);
        assert.equal(result6.valid, false);
        assert.equal(result7.reason, game.Reasons.INVALID_SOURCE_TARGET);
        assert.equal(result8.valid, false);
        assert.equal(result8.reason, game.Reasons.OUT_OF_BOUNDS);
        assert.equal(result9.valid, false);
        assert.equal(result9.reason, game.Reasons.NO_SOURCE_PIECE);
    })
});

describe('Verify that Check can be canceled', () => {
    it('Verify that Check can be canceled', () => {
        //Arrange
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},null,{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,{"color":"black","pieceType":2},{"color":"black","pieceType":0},null,null],[null,null,null,{"color":"black","pieceType":0},null,null,null,null],[{"color":"white","pieceType":3},null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},null,{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":0}],"algebricNotation":"","check":true,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"lastMove":{"valid":true,"source":{"row":5,"col":1},"target":{"row":4,"col":0},"piece":{"color":"white","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"check":true}}`
        game.loadGame(state);

        source = { row: 0, col: 2 }
        target = { row: 1, col: 3 }

        assert.equal(game.Check, true);

        game.makeMove(source, target);



        // Assert
        assert.equal(game.Check, false);
    });
})

describe('Verify Available Moves', () => {
    it('Verify Available Moves', () => {
        //Arrange      
        game.loadGame(initalState);
        source = { row: 6, col: 4 }
        // // Action
        let result = game.possibleMoves(source);
        console.log(result)
        // Assert
        assert.ok(result.length > 0, "No moves are available");
    });


    it("Can't move if's not your turn", () => {
        //Arrange
        state = `{"board":[[{"color":"black","pieceType":1},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":4},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":1}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null],[null,null,null,null,null,null,null,{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":1},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":4},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":1}]],"turn":"white","capturedPiecesList":[],"lastMove":{"valid":true,"source":{"row":1,"col":7},"target":{"row":2,"col":7},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false},"check":false,"checkmate":false,"whiteKingMoved":true,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true}`;
        game.loadGame(state);

        // Action
        source = { row: 4, col: 0 }
        target = { row: 5, col: 0 }
        let move = game.validateMove(source, target, "black");
        // Assert
        assert.equal(move.valid, false)
        assert.equal(move.reason, game.Reasons.NOT_YOUR_TURN)

    });
})

describe('Verify can flip board', () => {
    it('Verify Available Moves', () => {
        //Arrange      
        game.startNewGame();
        game.loadGame(initalState);


        let verifyCall = false;
        game.OnUpdate = () => {
            verifyCall = true
        }

        source = { row: 6, col: 3 }
        target = { row: 4, col: 3 }
        let move = game.makeMove(source, target);
        assert.equal(move.valid, true);
        assert.equal(game.WhitePlayerView, true);

        game.WhitePlayerView = false;
        assert.equal(game.WhitePlayerView, false);

        game.WhitePlayerView = true;
        assert.equal(game.WhitePlayerView, true);

        assert.equal(verifyCall, true);
        game.OnUpdate = null;
    });
})

describe("Checkmate rules", () => {
    it("verify the black player can checkmate", () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"black","pieceType":0},null,null,null],[null,null,null,null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"black","capturedPiecesList":[],"check":false,"checkmate":false,"draw":false,"drawReason":"","resigned":"","outOfTime":"","whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":6,"col":6},"target":{"row":4,"col":6},"piece":{"color":"white","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`
        game.loadGame(state);
        assert.equal(game.Checkmate, false)
        source = { row: 0, col: 3 }
        target = { row: 4, col: 7 }
        const move = game.makeMove(source, target);
        assert.equal(move.valid, true, "Move should be allowed");
        assert.ok(game.GameOverReason.indexOf("Checkmate") != -1);
        assert.equal(game.ResultMove.moveStr, "0-1");
    });
});

describe('Verify Cant Make A Move After Checkmate', () => {
    it('Verify Cant Make A Move After Checkmate', () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},null,{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,{"color":"black","pieceType":2},{"color":"black","pieceType":0},null,null],[null,null,null,{"color":"black","pieceType":0},null,null,null,null],[{"color":"white","pieceType":3},null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},null,{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":0}],"algebricNotation":"","check":true,"checkmate":true,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"lastMove":{"valid":true,"source":{"row":5,"col":1},"target":{"row":4,"col":0},"piece":{"color":"white","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"check":true}}`
        game.loadGame(state);
        assert.equal(game.Checkmate, true)
        source = { row: 0, col: 2 }
        target = { row: 1, col: 3 }

        let move = game.validateMove(source, target);

        // Assert

        assert.equal(move.valid, false, "Move should be invalid after checkmate");
        assert.equal(move.reason, game.Reasons.GAME_OVER, "The reasib for invalid move should be Game Over");

        ;
    });
})

describe('Verify Cant Make A Move After Draw', () => {
    it('Verify Cant Make A Move After Draw', () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},    {"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},null,{"color":"black","pieceType":4}],    [{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,null,    {"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,{"color":"black","pieceType":2},    {"color":"black","pieceType":0},null,null],[null,null,null,{"color":"black","pieceType":0},null,null,null,null],    [{"color":"white","pieceType":3},null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],    [{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},    {"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},null,{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],    "turn": "black","capturedPiecesList":[{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":0}],    "algebricNotation":"","check":false,"checkmate":false,"draw":true,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"lastMove":{"valid":true,"source":{"row":5,"col":1},"target":{"row":4,"col":0},"piece":{"color":"white","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"check":true}}`;
        game.loadGame(state);

        source = { row: 0, col: 2 }
        target = { row: 1, col: 3 }

        let move = game.validateMove(source, target);


        // Assert
        assert.equal(move.valid, false, "Move should be invalid after draw");
        assert.equal(move.reason, game.Reasons.GAME_OVER, "The reason for invalid move should be Game Over");

    });
})



describe('Pawn Can Move One Step Forward', () => {
    it('White Pawn Can Move One Step Forward', () => {
        //Arrange        
        game.loadGame(initalState);

        // Action
        source = { row: 6, col: 1 }
        target = { row: 5, col: 1 }
        let move = game.validateMove(source, target, "white");

        // Assert       
        assert.equal(move.valid, true, "A Pawn should be move once step forward to an empty square.\n Reason for failure: " + move.reason);
    });

    it('Black Pawn Can Move One Step Forward', () => {
        //Arrange        
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.e4 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":6,"col":4},"target":{"row":4,"col":4},"piece":{"color":"white","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`
        game.loadGame(state);

        // Action
        source = { row: 1, col: 1 }
        target = { row: 2, col: 1 }
        let move = game.validateMove(source, target, "black");

        // Assert       
        assert.equal(move.valid, true, "A Pawn should be move once step forward to an empty square.\n Reason for failure: " + move.reason);
    });


    it('White Pawn Can Move One Step Forward, when board is flipped (black`s view)', () => {
        //Arrange        
        const state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false}`
        game.loadGame(state);

        // Action
        source = { row: 1, col: 1 }
        target = { row: 2, col: 1 }
        let move = game.validateMove(source, target, "white");

        // Assert       
        assert.equal(move.valid, true, "A Pawn should be move once step forward to an empty square.\n Reason for failure: " + move.reason);
    });

    it('Black Pawn Can Move One Step Forward, when board is flipped (black`s view)', () => {
        //Arrange        
        const state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.e4 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":4},"target":{"row":3,"col":4},"piece":{"color":"white","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":false}}`
        game.loadGame(state);

        // Action
        source = { row: 6, col: 1 }
        target = { row: 5, col: 1 }
        let move = game.validateMove(source, target, "black");

        // Assert       
        assert.equal(move.valid, true, "A Pawn should be move once step forward to an empty square.\n Reason for failure: " + move.reason);
    });
})

describe('Pawn Can Move Two Steps Forward on Start', () => {
    it('White Pawn Can Move Two Steps Forward on Start', () => {

        //Arrange
        game.loadGame(initalState);

        // Action
        source = { row: 6, col: 1 }
        target = { row: 4, col: 1 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, true, "A Pawn should be able to move two steps forward to an empty square at start.\n Reason for failure: " + move.reason)

    });

    it('Black Pawn Can Move Two Steps Forward on Start', () => {

        //Arrange
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.e4 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":6,"col":4},"target":{"row":4,"col":4},"piece":{"color":"white","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`
        game.loadGame(state);

        // Action
        source = { row: 1, col: 1 }
        target = { row: 3, col: 1 }
        let move = game.validateMove(source, target, "black");

        // Assert
        assert.equal(move.valid, true, "A Pawn should be able to move two steps forward to an empty square at start.\n Reason for failure: " + move.reason)

    });

    it('White Pawn Can Move Two Steps Forward on Start , when board is flipped (black`s view)', () => {

        //Arrange
        const state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false}`
        game.loadGame(state);

        // Action
        source = { row: 1, col: 1 }
        target = { row: 3, col: 1 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, true, "A Pawn should be able to move two steps forward to an empty square at start.\n Reason for failure: " + move.reason)

    });

    it('Black Pawn Can Move Two Steps Forward on Start , when board is flipped (black`s view)', () => {

        //Arrange
        const state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.e4 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":4},"target":{"row":3,"col":4},"piece":{"color":"white","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":false}}`
        game.loadGame(state);

        // Action
        source = { row: 6, col: 1 }
        target = { row: 4, col: 1 }
        let move = game.validateMove(source, target, "black");

        // Assert
        assert.equal(move.valid, true, "A Pawn should be able to move two steps forward to an empty square at start.\n Reason for failure: " + move.reason)

    });
})

describe("Pawn Can't Move two Steps Forward in not on start", () => {
    it("White Pawn Can't Move two Steps Forward in not on start", () => {
        //Arrange
        state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e3 2.h5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":7},"target":{"row":3,"col":7},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);

        // Action
        source = { row: 5, col: 4 }
        target = { row: 3, col: 4 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, false, "A Pawn should not be able to move two steps forward to an empty square if not at starting position.\n Reason for failure: " + move.reason)
    });


    it("Black Pawn Can't Move two Steps Forward in not on start", () => {
        //Arrange
        state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,{"color":"black","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Kh3 2.e6 3.Kg1 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":5,"col":7},"target":{"row":7,"col":6},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);

        // Action
        source = { row: 2, col: 4 }
        target = { row: 4, col: 4 }
        let move = game.validateMove(source, target, "black");

        // Assert
        assert.equal(move.valid, false, "A Pawn should not be able to move two steps forward to an empty square if not at starting position.\n Reason for failure: " + move.reason)
    });


    it("White Pawn Can't Move two Steps Forward in not on start, when board is flipped (black`s view)", () => {
        //Arrange
        state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,{"color":"white","pieceType":0},null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e3 2.h5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":7},"target":{"row":3,"col":7},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);

        // Action
        source = { row: 2, col: 3 }
        target = { row: 4, col: 3 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, false, "A Pawn should not be able to move two steps forward to an empty square if not at starting position.\n Reason for failure: " + move.reason)
    });


    it("Black Pawn Can't Move two Steps Forward in not on start , when board is flipped (black`s view)", () => {
        //Arrange
        state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,{"color":"black","pieceType":0},null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Kh3 2.e6 3.Kg1 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":5,"col":7},"target":{"row":7,"col":6},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);

        // Action
        source = { row: 5, col: 3 }
        target = { row: 3, col: 3 }
        let move = game.validateMove(source, target, "black");

        // Assert
        assert.equal(move.valid, false, "A Pawn should not be able to move two steps forward to an empty square if not at starting position.\n Reason for failure: " + move.reason)
    });
})

describe("Pawn Can't Move backwards", () => {
    it("White Pawn Can't Move backwards", () => {
        //Arrange
        state = `{"board":[[{"color":"black","pieceType":1},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":4},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":1}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null],[null,null,null,null,null,null,null,{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":1},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":4},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":1}]],"turn":"white","capturedPiecesList":[],"lastMove":{"valid":true,"source":{"row":1,"col":7},"target":{"row":2,"col":7},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false},"check":false,"checkmate":false,"whiteKingMoved":true,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true}`;
        game.loadGame(state);

        // Action
        source = { row: 4, col: 0 }
        target = { row: 5, col: 0 }
        let move = game.validateMove(source, target, "white");
        // Assert
        assert.equal(move.valid, false, "A Pawn should not be able to move backwards.\n Reason for failure: " + move.reason)

    });

    it("Black Pawn Can't Move backwards", () => {
        //Arrange
        state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Kh3 2.a5 3.Kg1 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":5,"col":7},"target":{"row":7,"col":6},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);

        // Action
        source = { row: 3, col: 0 }
        target = { row: 2, col: 0 }
        let move = game.validateMove(source, target, "black");

        // Assert
        assert.equal(move.valid, false, "A Pawn should not be able to move backwards.\n Reason for failure: " + move.reason)

    });

    it("White Pawn Can't Move backwards , when board is flipped (black`s view)", () => {
        //Arrange
        state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,{"color":"black","pieceType":2}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},null,{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.a4 2.Kh6 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":7,"col":6},"target":{"row":5,"col":7},"piece":{"color":"black","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":false}}`;
        game.loadGame(state);

        // Action
        source = { row: 3, col: 0 }
        target = { row: 2, col: 0 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, false, "A Pawn should not be able to move backwards.\n Reason for failure: " + move.reason)

    });

    it("Black Pawn Can't Move backwards , when board is flipped (black`s view)", () => {
        //Arrange
        state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Ka3 2.a5 3.Kb1 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":2,"col":0},"target":{"row":0,"col":1},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":false}}`;
        game.loadGame(state);

        // Action
        source = { row: 4, col: 0 }
        target = { row: 5, col: 0 }
        let move = game.validateMove(source, target, "black");

        // Assert
        assert.equal(move.valid, false, "A Pawn should not be able to move backwards.\n Reason for failure: " + move.reason)

    });
})

describe("Pawn Can EnnPassant Left", () => {
    it("White Pawn Can EnnPassant Left", () => {
        const state = `{"board":[[{"color":"black","pieceType":4},null,{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":2},null,null,null,null,null,null,null],[null,null,null,{"color":"black","pieceType":0},{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.Ka6 3.e5 4.d5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":3},"target":{"row":3,"col":3},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.loadGame(state);
        let moves = game.possibleMoves(game.square(3, 4));
        assert.equal(moves.length, 2, "The number of available move should be 2.")
        assert.equal(moves[0].target.row, 2)
        assert.equal(moves[0].target.col, 3)
        assert.equal(moves[1].target.row, 2)
        assert.equal(moves[1].target.col, 4)
    });

    it("White Pawn Can EnnPassant Right, when board is flipped (black's view)", () => {
        const state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,{"color":"white","pieceType":0},{"color":"black","pieceType":0},null,null,null],[{"color":"black","pieceType":2},null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},null,{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e5 2.Kh3 3.e4 4.d4 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":3},"target":{"row":4,"col":4},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        let moves = game.possibleMoves(game.square(4, 3));
        assert.equal(moves.length, 2, "The number of available move should be 2.")
        assert.equal(moves[0].target.row, 5)
        assert.equal(moves[0].target.col, 3)
        assert.equal(moves[1].target.row, 5)
        assert.equal(moves[1].target.col, 4)
    });


    it("Enn passant canot be done after a hit", () => {
        const state = `{"board":[[null,null,null,{"color":"black","pieceType":4},null,null,{"color":"black","pieceType":1},null],[{"color":"black","pieceType":0},null,null,{"color":"black","pieceType":4},null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,{"color":"black","pieceType":0},{"color":"black","pieceType":2},null,null,null,null,null],[null,null,{"color":"black","pieceType":2},{"color":"black","pieceType":0},null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":3},null,null,{"color":"white","pieceType":0},null,null],[{"color":"white","pieceType":3},null,null,null,{"color":"white","pieceType":4},{"color":"white","pieceType":1},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,{"color":"white","pieceType":4},null,null,null,null]],"turn":"white","capturedPiecesList":[{"color":"white","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"black","pieceType":5},{"color":"white","pieceType":5},{"color":"black","pieceType":3},{"color":"white","pieceType":2},{"color":"black","pieceType":0},{"color":"white","pieceType":0}],"algebricNotation":"1.d4 2.Nf6 3.c4 4.e6 5.Nc3 6.Bb4 7.Qc2 8.d5 9.a3 10.Bbxc3+ 11.Qcxc3 12.Ne4 13.Qc2 14.c5 15.dxc5 16.Nc6 17.cxd5 18.exd5 19.Nf3 20.Qa5+ 21.Bd2 22.Qaxc5 23.Qcxc5 24.Nexc5 25.Be3 26.Ne4 27.Nd4 28. 0-0 29.Rd1 30.Be6 31.f3 32.Nd6 33.Ndxe6 34.fxe6 35.Bc5 36.Rd8 37.e4 38.Re8 39.exd5 40.exd5+ 41.Kf2 42.b6 43.Be3 44.Re5 45.Bd3 46.Rf8 47.Rc1 48.Na5 49.Bd4 50.Re7 51.Re1 52.Rd7 53.Bc3 54.Nb3 55.Rd1 56.Nc5 57.Re5 58.Nf7 59.Re3 60.Nd6 61.Bb1 62.Nc4 63.Re2 64.Rd8 65.Ba2 66.b5 67.b3 68.d4 ","lastMove":{"valid":true,"source":{"row":3,"col":3},"target":{"row":4,"col":3},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true},"check":false,"checkmate":false,"draw":false,"drawReason":"","resigned":false,"outOfTime":false,"whiteKingMoved":true,"blackKingMoved":true,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":true,"queensideBlackRookMoved":true,"kingsideWhiteRookMoved":true,"kingsideBlackRookMoved":false}`
        game.loadGame(state);
        // Action
        source = { row: 4, col: 3 }
        target = { row: 5, col: 2 }
        let move = game.makeMove(source, target, "black");
        assert.equal(move.ennPassant, false)
        assert.equal(game.Check, false)
        assert.equal(move.valid, true)
    })


    it("Black Pawn Can EnnPassant Left", () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,{"color":"white","pieceType":0},{"color":"black","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Kh3 2.e5 3.Kg1 4.e4 5.d4 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":6,"col":3},"target":{"row":4,"col":3},"piece":{"color":"white","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        let moves = game.possibleMoves(game.square(4, 4));
        assert.equal(moves.length, 2, "The number of available move should be 2.")
        assert.equal(moves[0].target.row, 5)
        assert.equal(moves[0].target.col, 3)
        assert.equal(moves[1].target.row, 5)
        assert.equal(moves[1].target.col, 4)
    });

    it("Black Pawn Can EnnPassant Right, when board is flipped (black's view)", () => {
        const state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,{"color":"black","pieceType":0},{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Kh6 2.e4 3.Kg8 4.e5 5.d5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":6,"col":3},"target":{"row":3,"col":4},"piece":{"color":"white","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        let moves = game.possibleMoves(game.square(3, 3));
        assert.equal(moves.length, 2, "The number of available move should be 2.")
        assert.equal(moves[0].target.row, 2)
        assert.equal(moves[0].target.col, 3)
        assert.equal(moves[1].target.row, 2)
        assert.equal(moves[1].target.col, 4)
    });
})

describe("Pawn Can EnnPassant Right", () => {
    it("White Pawn Can EnnPassant Right", () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},null,{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,{"color":"black","pieceType":2}],[null,null,null,null,{"color":"white","pieceType":0},{"color":"black","pieceType":0},null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.Kh6 3.e5 4.f5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":5},"target":{"row":3,"col":5},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        let moves = game.possibleMoves(game.square(3, 4));
        assert.equal(moves.length, 2, "The number of available move should be 2.")
        assert.equal(moves[0].target.row, 2)
        assert.equal(moves[0].target.col, 4)
        assert.equal(moves[1].target.row, 2)
        assert.equal(moves[1].target.col, 5)
    });

    it("White Pawn Can EnnPassant Left, when board is flipped (black's view)", () => {
        const state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,{"color":"black","pieceType":0},{"color":"white","pieceType":0},null,null,null,null],[{"color":"black","pieceType":2},null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},null,{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.Kh6 3.e5 4.f5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":5},"target":{"row":4,"col":2},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        let moves = game.possibleMoves(game.square(4, 3));
        assert.equal(moves.length, 2, "The number of available move should be 2.")
        assert.equal(moves[0].target.row, 5)
        assert.equal(moves[0].target.col, 2)
        assert.equal(moves[1].target.row, 5)
        assert.equal(moves[1].target.col, 3)
    });


    it("Black Pawn Can EnnPassant Right", () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,{"color":"black","pieceType":0},{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Kh3 2.d5 3.Kg1 4.d4 5.e4 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":6,"col":4},"target":{"row":4,"col":4},"piece":{"color":"white","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        let moves = game.possibleMoves(game.square(4, 3));
        assert.equal(moves.length, 2, "The number of available move should be 2.")
        assert.equal(moves[0].target.row, 5)
        assert.equal(moves[0].target.col, 3)
        assert.equal(moves[1].target.row, 5)
        assert.equal(moves[1].target.col, 4)
    });

    it("Black Pawn Can EnnPassant Left, when board is flipped (black's view)", () => {
        const state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,{"color":"white","pieceType":0},{"color":"black","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Kh6 2.d4 3.Kg8 4.d5 5.e5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":6,"col":4},"target":{"row":3,"col":3},"piece":{"color":"white","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        let moves = game.possibleMoves(game.square(3, 4));
        assert.equal(moves.length, 2, "The number of available move should be 2.")
        assert.equal(moves[0].target.row, 2)
        assert.equal(moves[0].target.col, 3)
        assert.equal(moves[1].target.row, 2)
        assert.equal(moves[1].target.col, 4)
    });
})

describe(`EnnPassant Tests`, () => {
    it(`White Pawn Can't EnnPassant left, since opponent EP expose move was not the last move`, () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,{"color":"black","pieceType":0},{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,{"color":"white","pieceType":2}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},null,{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.Ka6 3.e5 4.d5 5.Kh3 6.Kb8 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":2,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":2,"col":0},"target":{"row":0,"col":1},"piece":{"color":"black","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.loadGame(state);
        let moves = game.possibleMoves(game.square(3, 4));
        // Assert
        assert.equal(moves.length, 1, "Only one move should be valid in this position")
        assert.equal(moves[0].target.row, 2)
        assert.equal(moves[0].target.col, 4)
    });

    it(`White Pawn Can't EnnPassant Right, since opponent EP expose move was not the last move`, () => {
        const state = `{"board":[[{"color":"black","pieceType":4},null,{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":2},null,null,null,null,null,null,null],[null,null,null,null,{"color":"white","pieceType":0},{"color":"black","pieceType":0},null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.Ka6 3.e5 4.Kb8 5.Kh3 6.f5 7.Kg1 8.Ka6 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":2,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":0,"col":1},"target":{"row":2,"col":0},"piece":{"color":"black","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.loadGame(state);
        let moves = game.possibleMoves(game.square(3, 4));
        // Assert
        assert.equal(moves.length, 1, "Only one move should be valid in this position")
        assert.equal(moves[0].target.row, 2)
        assert.equal(moves[0].target.col, 4)
    });

    it(`White Pawn Can't EnnPassant left, since opponent EP expose move was not the last move, on flip board (Black's view)`, () => {
        const state = `{ "board": [[{ "color": "white", "pieceType": 4 }, { "color": "white", "pieceType": 2 }, { "color": "white", "pieceType": 3 }, { "color": "white", "pieceType": 1 }, { "color": "white", "pieceType": 5 }, { "color": "white", "pieceType": 3 }, { "color": "white", "pieceType": 2 }, { "color": "white", "pieceType": 4 }], [{ "color": "white", "pieceType": 0 }, { "color": "white", "pieceType": 0 }, { "color": "white", "pieceType": 0 }, null, { "color": "white", "pieceType": 0 }, { "color": "white", "pieceType": 0 }, { "color": "white", "pieceType": 0 }, { "color": "white", "pieceType": 0 }], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, { "color": "black", "pieceType": 0 }, { "color": "white", "pieceType": 0 }, null, null, null, null], [{ "color": "black", "pieceType": 2 }, null, null, null, null, null, null, null], [{ "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }, null, { "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }], [{ "color": "black", "pieceType": 4 }, null, { "color": "black", "pieceType": 3 }, { "color": "black", "pieceType": 1 }, { "color": "black", "pieceType": 5 }, { "color": "black", "pieceType": 3 }, { "color": "black", "pieceType": 2 }, { "color": "black", "pieceType": 4 }]], "turn": "white", "capturedPiecesList": [], "algebricNotation": "1.e5 2.Kh3 3.e4 4.Kg1 5.Kh6 6.f4 7.Kg8 8.Kh3 ", "check": false, "checkmate": false, "draw": false, "whiteKingMoved": false, "blackKingMoved": false, "farWhiteRookMoved": false, "farBlackRookMoved": false, "nearWhiteRookMoved": false, "nearBlackRookMoved": false, "whitePlayerView": false, "fiftyMovesCounter": 2, "promoting": false, "queensideWhiteRookMoved": false, "queensideBlackRookMoved": false, "kingsideWhiteRookMoved": false, "kingsideBlackRookMoved": false, "lastMove": { "valid": true, "source": { "row": 0, "col": 6 }, "target": { "row": 5, "col": 0 }, "piece": { "color": "black", "pieceType": 2 }, "promotion": false, "ennPassant": false, "capturedPiece": null, "hitSquare": null, "turn": false, "castling": false, "whitePlayerView": true } }`;
        game.loadGame(state);
        let moves = game.possibleMoves(game.square(4, 3));
        // Assert
        assert.equal(moves.length, 1, "Only one move should be valid in this position")
        assert.equal(moves[0].target.row, 5)
        assert.equal(moves[0].target.col, 3)
    });


    it(`White Pawn Can't EnnPassant Right, since opponent EP expose move was not the last move, on flip board (Black's view)`, () => {
        const state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},null,{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,{"color":"white","pieceType":2}],[null,null,null,null,null,null,null,null],[null,null,{"color":"white","pieceType":0},{"color":"black","pieceType":0},null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.c4 2.Kh6 3.c5 4.d5 5.Kh3 6.Kg8 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":2,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":5,"col":7},"target":{"row":7,"col":6},"piece":{"color":"black","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":false}}`;
        game.loadGame(state);
        let moves = game.possibleMoves(game.square(4, 2));
        // Assert
        assert.equal(moves.length, 1, "Only one move should be valid in this position")
        assert.equal(moves[0].target.row, 5)
        assert.equal(moves[0].target.col, 2)
    });

    it(`Black Pawn Can't EnnPassant left, since opponent EP expose move was not the last move`, () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},null,{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null],[null,null,null,null,null,null,null,{"color":"black","pieceType":2}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,{"color":"white","pieceType":0},{"color":"black","pieceType":0}],[{"color":"white","pieceType":2},null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},null,{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Kh3 2.h5 3.Kg1 4.h4 5.g4 6.Kh6 7.Ka3 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":2,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":7,"col":1},"target":{"row":5,"col":0},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        let moves = game.possibleMoves(game.square(4, 7));
        // Assert
        assert.equal(moves.length, 1, "Only one move should be valid in this position")
        assert.equal(moves[0].target.row, 5)
        assert.equal(moves[0].target.col, 7)
    });

    it(`Black Pawn Can't EnnPassant Right, since opponent EP expose move was not the last move`, () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},null,{"color":"black","pieceType":4}],[null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,{"color":"black","pieceType":2}],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"white","pieceType":0},null,null,null,null,null,null],[null,null,null,null,null,null,null,{"color":"white","pieceType":2}],[{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},null,{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Kh3 2.a5 3.Kg1 4.a4 5.b4 6.Kh6 7.Kh3 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":2,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":7,"col":6},"target":{"row":5,"col":7},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        let moves = game.possibleMoves(game.square(4, 0));
        // Assert
        assert.equal(moves.length, 1, "Only one move should be valid in this position")
        assert.equal(moves[0].target.row, 5)
        assert.equal(moves[0].target.col, 0)
    });

    it(`Black Pawn Can't EnnPassant left, since opponent EP expose move was not the last move, on flip board (Black's view)`, () => {
        const state = `{"board":[[{"color":"white","pieceType":4},null,{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0}],[{"color":"white","pieceType":2},null,null,null,null,null,null,null],[null,null,null,null,null,null,{"color":"white","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":2},null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null],[{"color":"black","pieceType":4},null,{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Kh6 2.a4 3.Kg8 4.a5 5.b5 6.Kh3 7.Kh6 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":2,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":7,"col":6},"target":{"row":2,"col":0},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        let moves = game.possibleMoves(game.square(3, 7));
        // Assert
        assert.equal(moves.length, 1, "Only one move should be valid in this position")
        assert.equal(moves[0].target.row, 2)
        assert.equal(moves[0].target.col, 7)
    });


    it(`Black Pawn Can't EnnPassant Right, since opponent EP expose move was not the last move, on flip board (Black's view)`, () => {
        const state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},null,{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,{"color":"white","pieceType":2}],[{"color":"black","pieceType":0},{"color":"white","pieceType":0},null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,{"color":"black","pieceType":2}],[null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},null,{"color":"black","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Kh3 2.a5 3.Kg1 4.a4 5.b4 6.Kh6 7.Kh3 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":2,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":0,"col":6},"target":{"row":2,"col":7},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":false}}`;
        game.loadGame(state);
        let moves = game.possibleMoves(game.square(3, 0));
        // Assert
        assert.equal(moves.length, 1, "Only one move should be valid in this position")
        assert.equal(moves[0].target.row, 2)
        assert.equal(moves[0].target.col, 0)
    });


    it(`White Pawn Can't EnnPassant Right, since the opponenet piece is not a pawn`, () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},null,{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"white","pieceType":0},{"color":"black","pieceType":2},null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.Kh6 3.e5 4.Kf5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":2,"col":7},"target":{"row":3,"col":5},"piece":{"color":"black","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        let moves = game.possibleMoves(game.square(3, 4));
        // Assert
        assert.equal(moves.length, 1, "Only one move should be valid in this position")
        assert.equal(moves[0].target.row, 2)
        assert.equal(moves[0].target.col, 4)
    });

    it(`White Pawn Can't EnnPassant Right, since the no opponenet piece next to it`, () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"white","pieceType":0},null,null,{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.h6 3.e5 4.h5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":2,"col":7},"target":{"row":3,"col":7},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.startNewGame();
        game.loadGame(state);


        source = { row: 3, col: 4 }
        target = { row: 2, col: 5 }
        let move = game.validateMove(source, target, "white");
        // Assert
        assert.equal(move.valid, false, "Should be invalid move")
    });
})

describe("EnnPassant data recorded", () => {
    it("EnnPassant data recorded", () => {
        const state = `{"board":[[{"color":"black","pieceType":4},null,{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":2},null,null,null,null,null,null,null],[null,null,null,{"color":"black","pieceType":0},{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.Ka6 3.e5 4.d5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":3},"target":{"row":3,"col":3},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.startNewGame("white");
        game.loadGame(state);
        source = { row: 3, col: 4 }
        target = { row: 2, col: 3 }
        let move = game.makeMove(source, target, true);

        // Assert
        assert.equal(move.valid, true);
        assert.equal(move.ennPassant, true);
        assert.equal(move.hitSquare.row, 3);
        assert.equal(move.hitSquare.col, 3);
        assert.equal(move.capturedPiece.pieceType, game.PAWN);
    });
})

describe("Pawn Can Hit Left", () => {
    it("White Pawn Can Hit Left", () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,{"color":"black","pieceType":0},null,null,null,null],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.d5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":3},"target":{"row":3,"col":3},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.loadGame(state);
        source = { row: 3, col: 4 }
        target = { row: 2, col: 3 }
        let options = game.possibleMoves(game.square(4, 4));

        // Assert
        assert.equal(options.length, 2);
        assert.equal(options[0].target.row, 3);
        assert.equal(options[0].target.col, 3);
        assert.equal(options[1].target.row, 3);
        assert.equal(options[1].target.col, 4);
    });

    it("Black Pawn Can Hit Left", () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"black","pieceType":0},null,null,null],[null,null,null,{"color":"white","pieceType":0},null,null,null,null],[null,null,null,null,null,null,null,{"color":"white","pieceType":2}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},null,{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.d4 2.e5 3.Kh3 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":7,"col":6},"target":{"row":5,"col":7},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        let options = game.possibleMoves(game.square(3, 4));

        // Assert
        assert.equal(options.length, 2);
        assert.equal(options[0].target.row, 4);
        assert.equal(options[0].target.col, 3);
        assert.equal(options[1].target.row, 4);
        assert.equal(options[1].target.col, 4);
    });

    it(`White Pawn Can Hit Left , when the board is flipped (black's view)`, () => {
        const state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,{"color":"white","pieceType":0},null,null,null,null],[null,null,{"color":"black","pieceType":0},null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.d4 2.c5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":6,"col":2},"target":{"row":4,"col":2},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":false}}`;

        game.loadGame(state);
        source = { row: 3, col: 3 }
        target = { row: 4, col: 2 }
        let options = game.possibleMoves(game.square(3, 3));

        // Assert
        assert.equal(options.length, 2);
        assert.equal(options[0].target.row, 4);
        assert.equal(options[0].target.col, 2);
        assert.equal(options[1].target.row, 4);
        assert.equal(options[1].target.col, 3);
    });

    it(`Black Pawn Can Hit Left , when the board is flipped (black's view)`, () => {
        const state = `{"board":[[{"color":"white","pieceType":4},null,{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":2},null,null,null,null,null,null,null],[null,null,{"color":"white","pieceType":0},null,null,null,null,null],[null,null,null,{"color":"black","pieceType":0},null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.f5 2.e4 3.Kh6 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":7,"col":6},"target":{"row":2,"col":0},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;

        game.loadGame(state);
        let options = game.possibleMoves(game.square(4, 3));

        // Assert
        assert.equal(options.length, 2);
        assert.equal(options[0].target.row, 3);
        assert.equal(options[0].target.col, 2);
        assert.equal(options[1].target.row, 3);
        assert.equal(options[1].target.col, 3);
    });



})

describe('Pawn Can Hit Right', () => {
    it('White Pawn Can Hit Right', () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,{"color":"black","pieceType":0},null,null],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.f5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":5},"target":{"row":3,"col":5},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.startNewGame("white");
        game.loadGame(state);
        source = { row: 3, col: 4 }
        target = { row: 2, col: 3 }
        let options = game.possibleMoves(game.square(4, 4));

        // Assert
        assert.equal(options.length, 2);
        assert.equal(options[0].target.row, 3);
        assert.equal(options[0].target.col, 4);
        assert.equal(options[1].target.row, 3);
        assert.equal(options[1].target.col, 5);
    });


    it('Black Pawn Can Hit Right', () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"black","pieceType":0},null,null,null],[null,null,null,null,null,{"color":"white","pieceType":0},null,null],[null,null,null,null,null,null,null,{"color":"white","pieceType":2}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},null,{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.f4 2.e5 3.Kh3 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":7,"col":6},"target":{"row":5,"col":7},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        source = { row: 3, col: 4 }
        target = { row: 4, col: 5 }
        let options = game.possibleMoves(game.square(3, 4));

        // Assert
        assert.equal(options.length, 2);
        assert.equal(options[0].target.row, 4);
        assert.equal(options[0].target.col, 4);
        assert.equal(options[1].target.row, 4);
        assert.equal(options[1].target.col, 5);
    });//


    it("White Pawn Can Hit Right, When board is flipped (black's view)", () => {
        const state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,{"color":"white","pieceType":0},null,null,null,null],[null,null,null,null,{"color":"black","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e5 2.d4 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":3},"target":{"row":4,"col":4},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        source = { row: 3, col: 3 }
        target = { row: 4, col: 4 }
        let options = game.possibleMoves(game.square(3, 3));

        // Assert
        assert.equal(options.length, 2);
        assert.equal(options[0].target.row, 4);
        assert.equal(options[0].target.col, 3);
        assert.equal(options[1].target.row, 4);
        assert.equal(options[1].target.col, 4);
    });

    it("Black Pawn Can Hit Right, When board is flipped (black's view)", () => {
        const state = `{"board":[[{"color":"white","pieceType":4},null,{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":2},null,null,null,null,null,null,null],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,{"color":"black","pieceType":0},null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.d5 2.e4 3.Kh6 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":7,"col":6},"target":{"row":2,"col":0},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        let options = game.possibleMoves(game.square(4, 3));

        // Assert
        assert.equal(options.length, 2);
        assert.equal(options[0].target.row, 3);
        assert.equal(options[0].target.col, 3);
        assert.equal(options[1].target.row, 3);
        assert.equal(options[1].target.col, 4);
    });


})

describe("Piece is captured after a Pawn has hit", () => {
    it("Piece is captured after a Pawn has hit", () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,{"color":"black","pieceType":0},null,null],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.f5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":5},"target":{"row":3,"col":5},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;

        game.loadGame(state);
        source = { row: 4, col: 4 }
        target = { row: 3, col: 5 }
        let move = game.makeMove(source, target);

        // Assert
        assert.equal(move.valid, true);
        assert.equal(move.hitSquare.row, 3)
        assert.equal(move.hitSquare.col, 5)
        assert.equal(move.capturedPiece.pieceType, game.PAWN);
    });
})

describe("Pawn Can Check After a Hit", () => {
    it("Pawn Can Check After a Hit", () => {
        const state = `{ "board": [[{ "color": "black", "pieceType": 4 }, { "color": "black", "pieceType": 2 }, { "color": "black", "pieceType": 3 }, { "color": "black", "pieceType": 5 }, { "color": "black", "pieceType": 1 }, { "color": "black", "pieceType": 3 }, { "color": "black", "pieceType": 2 }, { "color": "black", "pieceType": 4 }], [{ "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }], [null, null, null, null, { "color": "white", "pieceType": 0 }, null, null, null], [null, null, null, null, null, null, null, { "color": "white", "pieceType": 5 }], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [{ "color": "white", "pieceType": 0 }, { "color": "white", "pieceType": 0 }, { "color": "white", "pieceType": 0 }, { "color": "white", "pieceType": 0 }, null, { "color": "white", "pieceType": 0 }, { "color": "white", "pieceType": 0 }, { "color": "white", "pieceType": 0 }], [{ "color": "white", "pieceType": 4 }, { "color": "white", "pieceType": 2 }, { "color": "white", "pieceType": 3 }, null, { "color": "white", "pieceType": 1 }, { "color": "white", "pieceType": 3 }, { "color": "white", "pieceType": 2 }, { "color": "white", "pieceType": 4 }]], "turn": "white", "capturedPiecesList": [], "algebricNotation": "1.e4 2.Ka6 3.Qh5 4.Kb8 5.e5 6.Ka6 7.e6 8.Kb8 ", "check": false, "checkmate": false, "draw": false, "whiteKingMoved": false, "blackKingMoved": false, "farWhiteRookMoved": false, "farBlackRookMoved": false, "nearWhiteRookMoved": false, "nearBlackRookMoved": false, "whitePlayerView": true, "fiftyMovesCounter": 1, "promoting": false, "queensideWhiteRookMoved": false, "queensideBlackRookMoved": false, "kingsideWhiteRookMoved": false, "kingsideBlackRookMoved": false, "lastMove": { "valid": true, "source": { "row": 2, "col": 0 }, "target": { "row": 0, "col": 1 }, "piece": { "color": "black", "pieceType": 2 }, "promotion": false, "ennPassant": false, "capturedPiece": null, "hitSquare": null, "turn": false, "castling": false } }`;

        game.loadGame(state);
        source = { row: 2, col: 4 }
        target = { row: 1, col: 5 }
        let move = game.makeMove(source, target);

        // Assert      
        assert(game.Check)

        game.loadGame(state);
        source = { row: 2, col: 4 }
        target = { row: 1, col: 3 }
        move = game.makeMove(source, target);

        // Assert
        assert(game.Check)
    });
})

describe("Pawn Can Check", () => {
    it("White Pawn Can Check Left when board is on black view", () => {
        const state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,{"color":"white","pieceType":0},null,null,null,{"color":"black","pieceType":2}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},null,{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.d4 2.Kh6 3.d5 4.Kg8 5.d6 6.Kh6 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":7,"col":6},"target":{"row":5,"col":7},"piece":{"color":"black","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.loadGame(state);
        source = { row: 5, col: 3 }
        target = { row: 6, col: 2 }
        let move = game.makeMove(source, target);

        // Assert
        assert.ok(game.Check)

    });

    it("White Pawn Can Check Right when board is on black view", () => {
        const state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,{"color":"white","pieceType":0},null,null,null,{"color":"black","pieceType":2}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},null,{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.d4 2.Kh6 3.d5 4.Kg8 5.d6 6.Kh6 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":7,"col":6},"target":{"row":5,"col":7},"piece":{"color":"black","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;

        game.loadGame(state);
        source = { row: 5, col: 3 }
        target = { row: 6, col: 4 }
        move = game.makeMove(source, target);

        // Assert
        assert.ok(game.Check)
    });



    it("Black Pawn Can Check Left when board is on black view", () => {
        const state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,{"color":"black","pieceType":0},null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Kh3 2.d5 3.Kg1 4.d4 5.Kh3 6.d3 7.Kg1 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":2,"col":7},"target":{"row":0,"col":6},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false}}`;
        game.loadGame(state);
        source = { row: 2, col: 3 }
        target = { row: 1, col: 2 }
        game.makeMove(source, target);

        // Assert
        assert.ok(game.Check)
    });


    it("Black Pawn Can Check Right when board is on black view", () => {
        const state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,{"color":"black","pieceType":0},null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Kh3 2.d5 3.Kg1 4.d4 5.Kh3 6.d3 7.Kg1 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":2,"col":7},"target":{"row":0,"col":6},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false}}`;
        game.loadGame(state);
        source = { row: 2, col: 3 }
        target = { row: 1, col: 4 }
        game.makeMove(source, target);

        // Assert
        assert.ok(game.Check)
    });


    it("Black Pawn Can Check Left when board is on white view", () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"black","pieceType":0},null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Kh3 2.e5 3.Kg1 4.e4 5.Kh3 6.e3 7.Kg1 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":5,"col":7},"target":{"row":7,"col":6},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false}}`;
        game.loadGame(state);
        source = { row: 5, col: 4 }
        target = { row: 6, col: 3 }
        game.makeMove(source, target);
        // Assert
        assert.ok(game.Check)
    });

    it("Black Pawn Can Check Right when board is on white view", () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"black","pieceType":0},null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Kh3 2.e5 3.Kg1 4.e4 5.Kh3 6.e3 7.Kg1 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":5,"col":7},"target":{"row":7,"col":6},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false}}`;
        game.loadGame(state);
        source = { row: 5, col: 4 }
        target = { row: 6, col: 5 }
        game.makeMove(source, target);
        // Assert
        assert.ok(game.Check)
    });


    describe('', () => {
        it('', () => {

        });
    })


})

describe("Cant Move Pieces Which Dont Eliminate The Threat After a Check", () => {
    it("Cant Move Pieces Which Dont Eliminate The Threat After a Check", () => {
        //Arrange
        let checkState = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,{"color":"black","pieceType":0},null,{"color":"white","pieceType":5}],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},null,{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.e4 2.f5 3.Qh5+ ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"lastMove":{"valid":true,"source":{"row":7,"col":3},"target":{"row":3,"col":7},"piece":{"color":"white","pieceType":5},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false}}`
        game.loadGame(checkState);

        // Action
        source = { row: 0, col: 6 }
        target = { row: 2, col: 5 }
        let move = game.validateMove(source, target, "black");

        // Assert
        assert.equal(move.valid, false)
    });
})

describe("Can Move Pieces On Check If Their movement Eliminate The Threat", () => {
    it("Can Move Pieces On Check If Their movement Eliminate The Threat", () => {
        //Arrange
        let checkState = `{"board":[[{"color":"black","pieceType":1},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":4},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":1}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,{"color":"black","pieceType":0},null,{"color":"white","pieceType":4}],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":1},{"color":"white","pieceType":2},{"color":"white","pieceType":3},null,{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":1}]],"turn":"black","capturedPiecesList":[],"lastMove":{"valid":true,"source":{"row":7,"col":3},"target":{"row":3,"col":7},"piece":{"color":"white","pieceType":4},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false},"check":true,"checkmate":false,"whiteKingMoved":true,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true}`
        game.loadGame(checkState);

        // Action
        source = { row: 1, col: 6 }
        target = { row: 2, col: 6 }
        let move = game.validateMove(source, target, "black");

        // Assert
        assert.equal(move.valid, true);
    });
})

describe("Can't Move Pieces On Check If They could Eliminate The Threat, But Choose Other Move", () => {
    it("Can't Move Pieces On Check If They could Eliminate The Threat, But Choose Other Move", () => {
        //Arrange
        let checkState = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,{"color":"black","pieceType":0},null,{"color":"white","pieceType":5}],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},null,{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.e4 2.f5 3.Qh5+ ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"lastMove":{"valid":true,"source":{"row":7,"col":3},"target":{"row":3,"col":7},"piece":{"color":"white","pieceType":5},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false}}`
        game.loadGame(checkState);

        // Action
        source = { row: 1, col: 6 }
        target = { row: 3, col: 6 }
        let move = game.validateMove(source, target, "black");

        // Assert
        assert.equal(move.valid, false);
    });
})

describe("Exposing Threat Is Illegal", () => {
    it("If a move reveals threat on the king - it is illegal", () => {
        //Arrange
        let state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":0},null,null,null,null,null,null,null],[null,null,null,null,null,null,null,{"color":"white","pieceType":5}],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},null,{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.e4 2.a6 3.Qh5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"lastMove":{"valid":true,"source":{"row":7,"col":3},"target":{"row":3,"col":7},"piece":{"color":"white","pieceType":5},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false}}`
        game.loadGame(state);

        // Action
        source = { row: 1, col: 5 }
        target = { row: 3, col: 5 }
        let move = game.validateMove(source, target, "black");

        // Assert
        assert.equal(move.valid, false);
    });
})

describe("King Simple moves tests", () => {
    it(`A King Can't Step A Threatened Square`, () => {
        let state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},null,{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"white","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":5}],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":1},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},null,{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[{"color":"white","pieceType":0}],"algebricNotation":"1.e4 2.e5 3.f4 4.exf4 5.Ke2 6.Qh4 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":true,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":2,"promoting":false,"lastMove":{"valid":true,"source":{"row":0,"col":3},"target":{"row":4,"col":7},"piece":{"color":"black","pieceType":5},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 6, col: 4 }
        target = { row: 6, col: 5 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, false);
        assert.equal(move.reason, game.Reasons.PIECE_MOVE_ILLEGAL);
    });

    it(`A King can't move to same square`, () => {
        let state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},null,{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"white","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":5}],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":1},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},null,{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[{"color":"white","pieceType":0}],"algebricNotation":"1.e4 2.e5 3.f4 4.exf4 5.Ke2 6.Qh4 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":true,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":2,"promoting":false,"lastMove":{"valid":true,"source":{"row":0,"col":3},"target":{"row":4,"col":7},"piece":{"color":"black","pieceType":5},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 6, col: 4 }
        target = { row: 6, col: 4 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, false);
        assert.equal(move.reason, game.Reasons.PIECE_MOVE_ILLEGAL);
    });
})

describe('Castling tests', () => {

    it("King side white rook movement is registered when occurs", () => {
        //Arrange
        let kingsideWhiteRookMoved = false;
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},null,null,{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,{"color":"black","pieceType":2},null,null],[null,null,{"color":"black","pieceType":3},null,{"color":"black","pieceType":0},null,null,null],[null,null,{"color":"white","pieceType":3},null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,{"color":"white","pieceType":2},null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},null,null,{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.e5 3.Kf3 4.Kf6 5.Bc4 6.Bc5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":4,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":0,"col":5},"target":{"row":3,"col":2},"piece":{"color":"black","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`
        game.loadGame(state);

        // // Action
        source = { row: 7, col: 7 }
        target = { row: 7, col: 6 }


        assert.equal(game.GameState.kingsideWhiteRookMoved, false);
        let move = game.makeMove(source, target, "white");

        // Assert
        assert.equal(game.GameState.kingsideWhiteRookMoved, true);

    })

    it("King side Black rook movement is registered when occurs", () => {
        //Arrange
        let kingsideBlackRookMoved = false;
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},null,null,{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,{"color":"black","pieceType":2},null,null],[null,null,{"color":"black","pieceType":3},null,{"color":"black","pieceType":0},null,null,null],[null,null,{"color":"white","pieceType":3},null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,{"color":"white","pieceType":2},null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},null,{"color":"white","pieceType":4},{"color":"white","pieceType":1},null]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.e4 2.e5 3.Bc4 4.Bc5 5.Kf3 6.Kf6 7. 0-0 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":true,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":5,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":7,"col":4},"target":{"row":7,"col":6},"piece":{"color":"white","pieceType":1},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":true,"whitePlayerView":true,"kingsideCastling":true}}`
        game.loadGame(state);
        game.OnUpdate = (state) => {
            kingsideBlackRookMoved = state.kingsideBlackRookMoved
        }

        // // Action
        source = { row: 0, col: 7 }
        target = { row: 0, col: 6 }
        game.forceUpdate();
        assert.equal(kingsideBlackRookMoved, false);
        let move = game.makeMove(source, target, "white");

        // Assert
        assert.equal(kingsideBlackRookMoved, true);

    })

    it("Queen side white rook movement is registered when occurs", () => {
        //Arrange
        let queensideWhiteRookMoved = false;
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},null,null,{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,{"color":"black","pieceType":2},null,null],[null,null,{"color":"black","pieceType":3},null,{"color":"black","pieceType":0},null,null,null],[null,null,{"color":"white","pieceType":3},null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,{"color":"white","pieceType":2},null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},null,null,{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.e5 3.Kf3 4.Kf6 5.Bc4 6.Bc5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":4,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":0,"col":5},"target":{"row":3,"col":2},"piece":{"color":"black","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`
        game.loadGame(state);
        game.OnUpdate = (state) => {
            queensideWhiteRookMoved = state.queensideWhiteRookMoved;
        }

        // // Action
        source = { row: 7, col: 0 }
        target = { row: 7, col: 2 }
        game.forceUpdate();
        // assert.equal(queensideWhiteRookMoved, false);
        let move = game.makeMove(source, target, "white");

        // Assert       
        assert.equal(queensideWhiteRookMoved, true);

    })

    it("Queen side Black rook movement is registered when occurs", () => {
        //Arrange
        let queensideBlackRookMoved = false;
        const state = `{"board":[[{"color":"black","pieceType":4},null,null,null,{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,{"color":"black","pieceType":2},null,null,null,null,null],[null,null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"white","pieceType":3},{"color":"white","pieceType":5}],[null,null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"black","pieceType":3},{"color":"black","pieceType":5}],[null,null,{"color":"white","pieceType":2},{"color":"white","pieceType":3},null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},null,null,null,{"color":"white","pieceType":1},null,{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.e4 2.e5 3.Qh5 4.Qh4 5.d4 6.d5 7.Bg5 8.Bg4 9.Kc3 10.Kc6 11.Bd3 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":5,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":7,"col":5},"target":{"row":5,"col":3},"piece":{"color":"white","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`
        game.loadGame(state);
        game.OnUpdate = (state) => {
            queensideBlackRookMoved = state.queensideBlackRookMoved;
        }

        // // Action
        source = { row: 0, col: 0 }
        target = { row: 0, col: 1 }
        game.forceUpdate();
        assert.equal(queensideBlackRookMoved, false);
        let move = game.makeMove(source, target, "white");

        // Assert       
        assert.equal(queensideBlackRookMoved, true);

    })

    it("Queen side Black rook movement is registered when occurs, when board is flipped", () => {
        //Arrange
        let queensideBlackRookMoved = false;
        const state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},null,{"color":"white","pieceType":1},null,null,null,{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,{"color":"white","pieceType":2},null,null],[{"color":"black","pieceType":5},{"color":"black","pieceType":3},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,null],[{"color":"white","pieceType":5},{"color":"white","pieceType":3},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"white","pieceType":3},null],[null,null,null,null,null,{"color":"black","pieceType":2},null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},null,null,null,{"color":"black","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.e5 2.e4 3.Qh4 4.Qh5 5.d5 6.d4 7.Bg4 8.Bg5 9.Kc6 10.Kc3 11.Bg5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":5,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":0,"col":2},"target":{"row":4,"col":6},"piece":{"color":"white","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":false}}`
        game.loadGame(state);
        game.OnUpdate = (state) => {
            queensideBlackRookMoved = state.queensideBlackRookMoved;
        }

        // // Action
        source = { row: 7, col: 7 }
        target = { row: 7, col: 6 }
        game.forceUpdate();
        assert.equal(queensideBlackRookMoved, false);
        let move = game.makeMove(source, target, "white");

        // Assert       
        assert.equal(queensideBlackRookMoved, true);

    })

    it("Should allow a white king to KingSide castle when all conditions are met", () => {
        //Arrange
        let state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},null,null,{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,{"color":"black","pieceType":2},null,null],[null,null,{"color":"black","pieceType":3},null,{"color":"black","pieceType":0},null,null,null],[null,null,{"color":"white","pieceType":3},null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,{"color":"white","pieceType":2},null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},null,null,{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.e5 3.Kf3 4.Kf6 5.Bc4 6.Bc5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":4,"promoting":false,"lastMove":{"valid":true,"source":{"row":0,"col":5},"target":{"row":3,"col":2},"piece":{"color":"black","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 7, col: 4 }
        target = { row: 7, col: 6 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, true);
    });

    it("Should allow a white king to QueenSide castle when all conditions are met", () => {
        //Arrange
        let state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[null,null,null,null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"white","pieceType":3},{"color":"white","pieceType":5}],[null,null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,null],[null,null,{"color":"white","pieceType":2},null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},null,null,null,{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.e5 3.Qh5 4.d5 5.d4 6.c5 7.Bg5 8.b5 9.Kc3 10.a5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":0},"target":{"row":3,"col":0},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);

        // // Action
        source = { row: 7, col: 4 }
        target = { row: 7, col: 2 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, true);
    });

    it("Should allow a white king to KingSide castle when all conditions are met, on a flip board", () => {
        //Arrange
        let state = `{"board":[[{"color":"white","pieceType":4},null,null,{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,{"color":"white","pieceType":2},null,null,null,null,null],[null,null,null,{"color":"white","pieceType":0},null,{"color":"white","pieceType":3},null,null],[null,null,null,{"color":"black","pieceType":0},null,{"color":"black","pieceType":3},null,null],[null,null,{"color":"black","pieceType":2},null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},null,null,{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.Kf6 2.Kf3 3.Kg8 4.Kg1 5.Kf6 6.Kf3 7.Kg8 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":4,"promoting":false,"lastMove":{"valid":true,"source":{"row":0,"col":5},"target":{"row":4,"col":5},"piece":{"color":"black","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 0, col: 3 }
        target = { row: 0, col: 1 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, true);
    });

    it("Should allow a white king to QueenSide castle when all conditions are met, on a flip board", () => {
        //Arrange
        let state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},null,null,null,{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,{"color":"white","pieceType":2},null,null],[null,null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,null],[{"color":"white","pieceType":5},{"color":"white","pieceType":3},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null],[null,null,null,null,null,null,null,{"color":"black","pieceType":2}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,null,null,{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},null,{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.d4 2.d5 3.Qa5 4.e5 5.e4 6.Kh6 7.Bb5 8.f5 9.Kf3 10.g5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":6,"col":6},"target":{"row":4,"col":6},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 0, col: 3 }
        target = { row: 0, col: 5 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, true);
    });

    it("King can't castle if he already moved", () => {
        //Arrange
        let state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},null,null,{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,{"color":"black","pieceType":2},null,null],[null,null,{"color":"black","pieceType":3},null,{"color":"black","pieceType":0},null,null,null],[null,null,{"color":"white","pieceType":3},null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,{"color":"white","pieceType":2},null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},null,null,{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.e5 3.Kf3 4.Kf6 5.Bc4 6.Bc5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":true,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":4,"promoting":false,"lastMove":{"valid":true,"source":{"row":0,"col":5},"target":{"row":3,"col":2},"piece":{"color":"black","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 7, col: 4 }
        target = { row: 7, col: 6 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, false);
    });

    it("White King can't KingSide castle if the near Rook has already moved", () => {
        //Arrange White View
        let state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},null,null,{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,{"color":"black","pieceType":2},null,null],[null,null,{"color":"black","pieceType":3},null,{"color":"black","pieceType":0},null,null,null],[null,null,{"color":"white","pieceType":3},null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,{"color":"white","pieceType":2},null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},null,null,{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.e5 3.Bc4 4.Bc5 5.Kf3 6.Kf6 7.Rg1 8.Ka6 9.Rh1 10.Kb8 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":true,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":8,"promoting":false,"lastMove":{"valid":true,"source":{"row":2,"col":0},"target":{"row":0,"col":1},"piece":{"color":"black","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 7, col: 4 }
        target = { row: 7, col: 6 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, false);



    });

    it("White King can't KingSide castle if the near Rook has already moved, in flipped board (black's view)", () => {


        //Arrange - Black View
        state = `{"board":[[{"color":"white","pieceType":4},null,null,{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},null,{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,{"color":"white","pieceType":2},null,null,null,null,{"color":"white","pieceType":2}],[null,null,null,{"color":"white","pieceType":0},null,{"color":"white","pieceType":3},null,null],[null,null,null,{"color":"black","pieceType":0},null,{"color":"black","pieceType":3},null,null],[null,null,{"color":"black","pieceType":2},null,null,null,null,{"color":"black","pieceType":2}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},null,null,{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},null,{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":true,"kingsideBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":10,"promoting":false,"lastMove":{"valid":true,"source":{"row":7,"col":6},"target":{"row":5,"col":7},"piece":{"color":"black","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 0, col: 3 }
        target = { row: 0, col: 1 }
        move = game.validateMove(source, target, "white");

        // Assert

        assert.equal(move.valid, false);
    });

    it("White King can't QueenSide castle if the far Rook has already moved", () => {
        //Arrange White View
        let state = `{"board":[[{"color":"black","pieceType":4},null,null,null,{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,{"color":"black","pieceType":2},{"color":"black","pieceType":0},null,null,null,null],[null,null,null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":3},{"color":"black","pieceType":5},null],[null,null,null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":3},{"color":"white","pieceType":5},null],[null,null,{"color":"white","pieceType":2},{"color":"white","pieceType":0},null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},null,null,null,{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.e5 3.Qg4 4.Qg5 5.d3 6.d6 7.Bf4 8.Bf5 9.Kc3 10.Kc6 11.Ke2 12.Kf6 13.Ke1 14.Kg8 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":true,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":8,"promoting":false,"lastMove":{"valid":true,"source":{"row":2,"col":5},"target":{"row":0,"col":6},"piece":{"color":"black","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 7, col: 4 }
        target = { row: 7, col: 2 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, false);



    });

    it("White King can't QueenSide castle if the far Rook has already moved, in flipped board (black's view)", () => {


        //Arrange - Black View
        state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},null,null,null,{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":2},null,null],[null,{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":0},null,null,null,null],[null,{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":0},null,null,null,null],[null,null,null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":2},null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},null,null,null,{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"","check":false,"checkmate":false,"draw":false,"whiteKingMoved":true,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":8,"promoting":false,"lastMove":{"valid":true,"source":{"row":5,"col":0},"target":{"row":7,"col":1},"piece":{"color":"black","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 0, col: 3 }
        target = { row: 0, col: 1 }
        move = game.validateMove(source, target, "white");

        // Assert

        assert.equal(move.valid, false);
    });

    it("Black King can't KingSide castle if the near Rook has already moved", () => {
        let state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},null,null,{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,{"color":"black","pieceType":2},null,null],[null,null,{"color":"black","pieceType":3},null,{"color":"black","pieceType":0},null,null,null],[null,null,{"color":"white","pieceType":3},null,{"color":"white","pieceType":0},null,null,null],[{"color":"white","pieceType":2},null,null,null,null,{"color":"white","pieceType":2},null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},null,{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},null,null,{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.e4 2.e5 3.Bc4 4.Bc5 5.Kf3 6.Kf6 7.Ka3 8.Rg8 9.Kb1 10.Rh8 11.Ka3 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":true,"whitePlayerView":true,"fiftyMovesCounter":9,"promoting":false,"lastMove":{"valid":true,"source":{"row":7,"col":1},"target":{"row":5,"col":0},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 0, col: 4 }
        target = { row: 0, col: 6 }
        let move = game.validateMove(source, target, "black");


        assert.equal(move.valid, false);


    });

    it("Black King can't KingSide castle if the near Rook has already moved, in flipped board (black's view)", () => {


        //Arrange Black View
        state = `{"board":[[{"color":"white","pieceType":4},null,null,{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},null,{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,{"color":"white","pieceType":2},null,null,null,null,{"color":"white","pieceType":2}],[null,null,null,{"color":"white","pieceType":0},null,{"color":"white","pieceType":3},null,null],[null,null,null,{"color":"black","pieceType":0},null,{"color":"black","pieceType":3},null,null],[null,null,{"color":"black","pieceType":2},null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},null,null,{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":true,"whitePlayerView":false,"fiftyMovesCounter":9,"promoting":false,"lastMove":{"valid":true,"source":{"row":0,"col":6},"target":{"row":2,"col":7},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 7, col: 3 }
        target = { row: 7, col: 1 }
        move = game.validateMove(source, target, "black");

        // Assert
        assert.equal(move.valid, false);
    });

    it("Black King can't QueenSide castle if the far Rook has already moved", () => {
        //Arrange
        //conditions for far black castling are met except the relevant rook moved.
        let state = `{"board":[[{"color":"black","pieceType":4},null,null,null,{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,{"color":"black","pieceType":2},null,null,null,null,null],[null,null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":3},{"color":"black","pieceType":5},null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Kh3 2.e5 3.Kg1 4.d5 5.Kh3 6.Bf5 7.Kg1 8.Qg5 9.Kh3 10.Kc6 11.Kg1 12.Ke7 13.Kh3 14.Ke8 15.Kg1 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":true,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":11,"promoting":false,"lastMove":{"valid":true,"source":{"row":5,"col":7},"target":{"row":7,"col":6},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 0, col: 4 }
        target = { row: 0, col: 2 }
        let move = game.validateMove(source, target, "black");

        // Assert
        assert.equal(move.valid, false);

    });

    it("Black King can't QueenSide castle if the far Rook has already moved, in flipped board (black's view)", () => {
        //Arrange Black View
        state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,{"color":"black","pieceType":3},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null],[null,null,null,null,{"color":"black","pieceType":5},{"color":"black","pieceType":2},null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},null,null,null,{"color":"black","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":true,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":11,"promoting":false,"lastMove":{"valid":true,"source":{"row":2,"col":0},"target":{"row":0,"col":1},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 7, col: 3 }
        target = { row: 7, col: 5 }
        move = game.validateMove(source, target, "black");

        // Assert
        assert.equal(move.valid, false);
    });

    it("White King can't castle if another piece exist between him and rook", () => {
        //Arrange

        let state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,{"color":"white","pieceType":3},{"color":"white","pieceType":5}],[null,null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},null,null,{"color":"white","pieceType":2},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.Kh6 3.Qh5 4.Kg8 5.d4 6.Kh6 7.Bg5 8.Kg8 9.Kc3 10.Kh6 11.Kd1 12.Kg8 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":7,"promoting":false,"lastMove":{"valid":true,"source":{"row":2,"col":7},"target":{"row":0,"col":6},"piece":{"color":"black","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 7, col: 4 }
        target = { row: 7, col: 2 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, false);
    });

    it("White King can't castle if another piece exist between him and rook 2", () => {
        //Arrange

        let state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,{"color":"black","pieceType":0},null,null,null,{"color":"white","pieceType":3},{"color":"white","pieceType":5}],[null,null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},null,null,{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.Kh6 3.Qh5 4.Kg8 5.d4 6.Kh6 7.Bg5 8.Kg8 9.Kc3 10.Kh6 11.Kd1 12.Kg8 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"lastMove":{"valid":true,"source":{"row":2,"col":2},"target":{"row":3,"col":2},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);

        // // Action
        source = { row: 7, col: 4 }
        target = { row: 7, col: 2 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, false);
    });

    it("Black King can't castle if another piece exist between him and rook 2", () => {
        //Arrange

        let state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},null,null,{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,{"color":"black","pieceType":5},null,null,null,null],[null,null,null,{"color":"black","pieceType":0},null,{"color":"black","pieceType":3},null,null],[null,null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,null],[null,null,{"color":"white","pieceType":0},null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"black","capturedPiecesList":[],"check":false,"checkmate":false,"draw":false,"drawReason":"","resigned":"","outOfTime":"","whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":6,"col":2},"target":{"row":5,"col":2},"piece":{"color":"white","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);

        // // Action
        source = { row: 0, col: 4 }
        target = { row: 0, col: 2 }
        let move = game.validateMove(source, target, "black");

        // Assert
        assert.equal(move.valid, false);
    });

    it("White King can't castle if another piece exist between him and rook 2 flipped board", () => {
        //Arrange

        let state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},null,null,{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"black","pieceType":0},null,null,null,{"color":"white","pieceType":5},null,null,null],[null,null,{"color":"white","pieceType":3},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"check":false,"checkmate":false,"draw":false,"drawReason":"","resigned":"","outOfTime":"","whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":3,"col":0},"target":{"row":2,"col":0},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 0, col: 3 }
        target = { row: 0, col: 5 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, false);
    });

    it("Black King can't castle if another piece exist between him and rook 2 flipped board", () => {
        //Arrange

        let state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[null,{"color":"black","pieceType":3},null,{"color":"white","pieceType":0},null,null,null,null],[{"color":"white","pieceType":0},null,null,null,{"color":"black","pieceType":0},null,null,null],[null,null,null,null,{"color":"black","pieceType":5},null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},null,null,{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn":"black","capturedPiecesList":[],"check":false,"checkmate":false,"draw":false,"drawReason":"","resigned":"","outOfTime":"","whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":3,"col":0},"target":{"row":4,"col":0},"piece":{"color":"white","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 7, col: 3 }
        target = { row: 7, col: 5 }
        let move = game.validateMove(source, target, "black");

        // Assert
        assert.equal(move.valid, false);
    });




    it("White King can't castle if it is in Check", () => {
        //Arrange
        let state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},null,null,{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,{"color":"black","pieceType":2}],[null,null,null,null,{"color":"black","pieceType":0},null,null,null],[null,{"color":"black","pieceType":3},{"color":"white","pieceType":3},null,{"color":"white","pieceType":0},null,null,null],[null,null,null,{"color":"white","pieceType":0},null,{"color":"white","pieceType":2},null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},null,null,{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.e5 3.Bc4 4.Bc5 5.Kf3 6.Kh6 7.d3 8.Bb4+ ","check":true,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":3,"col":2},"target":{"row":4,"col":1},"piece":{"color":"black","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true,"check":true}}`;
        game.loadGame(state);

        // // Action
        source = { row: 7, col: 4 }
        target = { row: 7, col: 6 }
        let move = game.validateMove(source, target, "white");

        // Assert
        let part1 = move.valid == false;

        return part1;
    });

    it("White King can't castle if path is under threat", () => {
        //Arrange
        let state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},null,null,{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":3},{"color":"black","pieceType":0},null,null,null,null,null,null],[null,null,null,{"color":"white","pieceType":3},{"color":"black","pieceType":0},null,{"color":"black","pieceType":5},null],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,{"color":"white","pieceType":2},null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},null,null,{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.e5 3.Bc4 4.Qg5 5.Bd5 6.b6 7.Kf3 8.Ba6 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":2,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":0,"col":2},"target":{"row":2,"col":0},"piece":{"color":"black","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);

        // // Action
        source = { row: 7, col: 4 }
        target = { row: 7, col: 6 }
        let move = game.validateMove(source, target, "white");

        // Assert
        let part1 = move.valid == false;

        return part1;
    });

    it("White King can't castle if target is under threat, When board is flipped", () => {
        //Arrange
        let state = `{"board":[[{"color":"white","pieceType":4},null,null,{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,{"color":"white","pieceType":0},null,null,null,null,null],[null,{"color":"black","pieceType":2},null,{"color":"white","pieceType":0},null,{"color":"white","pieceType":3},null,null],[null,{"color":"white","pieceType":2},null,{"color":"black","pieceType":0},null,{"color":"black","pieceType":3},null,null],[null,null,{"color":"black","pieceType":5},null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},null,null,{"color":"black","pieceType":1},null,{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e5 2.e4 3.Kf6 4.Kf3 5.Bc5 6.Bc4 7.Kg4 8.Kg5 9.f6 10.Qf3 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":0,"col":3},"target":{"row":5,"col":2},"piece":{"color":"black","pieceType":5},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);

        // // Action
        source = { row: 0, col: 3 }
        target = { row: 0, col: 1 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, false, "should not be valid since under threat")

    });

    it("White King can't kingside castle if path is under threat, When board is flipped", () => {
        //Arrange
        let state = `{"board":[[{"color":"white","pieceType":4},null,null,{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},null,{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,{"color":"white","pieceType":0},null,null,null,null,{"color":"white","pieceType":2}],[null,{"color":"black","pieceType":2},null,{"color":"white","pieceType":0},null,{"color":"black","pieceType":5},null,null],[null,{"color":"white","pieceType":2},null,{"color":"black","pieceType":0},null,null,null,null],[null,null,null,null,{"color":"black","pieceType":3},null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},null,null,{"color":"black","pieceType":1},null,{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[{"color":"white","pieceType":3}],"algebricNotation":"1.e5 2.e4 3.Kf6 4.Kf3 5.Bc5 6.Bc4 7.Kg4 8.Kg5 9.f6 10.Qf3 11.Kh3 12.Qh6 13.Kg1 14.Qhxf4 15.Kh3 16.Be6 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":2,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":4,"col":5},"target":{"row":5,"col":4},"piece":{"color":"black","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 0, col: 3 }
        target = { row: 0, col: 1 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, false, "should not be valid since under threat")

    });

    it("White King can't queenside castle if path is under threat, When board is flipped", () => {
        //Arrange
        let state = `{"board":[[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":1},null,null,null,{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,{"color":"white","pieceType":3}],[null,null,null,null,null,null,null,{"color":"black","pieceType":5}],[null,null,null,null,null,{"color":"black","pieceType":0},{"color":"white","pieceType":2},null],[null,null,null,null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":1},null,{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn": "black","capturedPiecesList":[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":5}],"algebricNotation":"1.f4 2.f5 3.Qh4 4.Qg6 5.g4 6.Qgxg4 7.Kf3 8.Qgxf4 9.Kg5 10.Qfxh4 11.Bh3 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":0,"col":5},"target":{"row":2,"col":7},"piece":{"color":"white","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 0, col: 3 }
        target = { row: 0, col: 5 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, false, "should not be valid since under threat")

    });




    it("Black King can't castle if it is in Check", () => {
        //Arrange
        let state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},null,null,{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,{"color":"black","pieceType":0},null,null,null,{"color":"black","pieceType":2}],[null,{"color":"white","pieceType":3},null,null,{"color":"black","pieceType":0},null,null,null],[null,{"color":"black","pieceType":3},null,null,{"color":"white","pieceType":0},null,null,null],[null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":2},null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},null,null,{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.e4 2.e5 3.Bc4 4.Qg5 5.Bd5 6.Qf4 7.c3 8.d6 9.Bb5+ ","check":true,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":4,"col":2},"target":{"row":3,"col":1},"piece":{"color":"white","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true,"check":true}}`;
        game.loadGame(state);

        // // Action
        source = { row: 0, col: 4 }
        target = { row: 0, col: 6 }
        let move = game.validateMove(source, target, "white");

        // Assert
        let part1 = move.valid == false;

        return part1;
    });

    it("Black King can't castle if path is under threat", () => {
        //Arrange
        let state = `{"board":[[{"color":"white","pieceType":4},null,null,{"color":"white","pieceType":1},{"color":"white","pieceType":5},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,null,{"color":"white","pieceType":0},null,null,null,null,null],[null,{"color":"black","pieceType":2},null,{"color":"white","pieceType":0},null,{"color":"white","pieceType":3},null,null],[null,{"color":"white","pieceType":2},null,{"color":"black","pieceType":0},null,{"color":"black","pieceType":3},null,null],[null,null,{"color":"black","pieceType":5},null,null,null,null,null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[{"color":"black","pieceType":4},null,null,{"color":"black","pieceType":1},null,{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e5 2.e4 3.Kf6 4.Kf3 5.Bc5 6.Bc4 7.Kg4 8.Kg5 9.f6 10.Qf3 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":false,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":0,"col":3},"target":{"row":5,"col":2},"piece":{"color":"black","pieceType":5},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);

        // // Action
        source = { row: 0, col: 4 }
        target = { row: 0, col: 2 }
        let move = game.validateMove(source, target, "white");

        // Assert
        assert.equal(move.valid, false, "should not be valid since under threat")
    });
})

describe("Draw tests", () => {
    it("Stalemate cases a draw", () => {
        let verifyCall = false;
        game.OnDraw = () => {
            verifyCall = true
        }
        //Arrange
        let state = `{"board":[[null,null,null,null,null,null,null,null],[null,{"color":"white","pieceType":5},null,null,null,null,null,null],[null,null,null,null,null,null,null,{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,{"color":"black","pieceType":1}],[null,null,null,null,{"color":"white","pieceType":2},null,null,null],[null,null,null,null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,null,null],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},null,{"color":"white","pieceType":1},{"color":"white","pieceType":3},null,{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":0},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4},{"color":"black","pieceType":0},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4},{"color":"black","pieceType":0}],"algebricNotation":"1.e4 2.f5 3.exf5 4.g6 5.fxg6 6.e6 7.gxh7 8.e5 9.hxg8 10.e4 11.Qgxh8 12.e3 13.Qc3 14.exf2 15.Qcxc7 16.fxg1 17.Qcxc8 18.Qgxh1 19.Qcxb8 20.Qhxh2 21.Qbxa8 22.Qhxg2 23.Qaxb7 24.Qd5 25.Qbxa7 26.Qdxa2 27.Qa6 28.Qf7 29.Kc3 30.Qc8 31.Kd5 32.Qd8 33.Be2 34.Qg7 35.Bh5+ 36.Qf7 37.d4 38.d5 39.Qd3 40.e5 41.Qa3 42.Kf6 43.Qaxa7 44.Kc6 45.Qaxa8 46.e4 47.d5 48.exd5 49.e5 50.dxe6 51.c5 52.exf7+ 53.Kexf7 54.Qg4 55.Kf6 56.Qgxc8 57.Kg5 58.Qcxb8 59.Kh5 60.h3 61.Kh6 62.g3 63.Kh5 64.f3 65.Kh6 66.Qbxa8 67.Kh5 68.Qaxa7 69.c4 70.Qa6 71.c3 72.Qb6 73.cxb2 74.Ke2 75.Qc8 76.Qbxb2 77.Qb8 78.Kc3 79.Qc8 80.Ke4 81.b6 82.Qbxb6 83.Qb8 84.Qbxb8 85.Kh6 86.Qbxf8 87.Kh5 88.Qfxg8 89.Kh6 90.Qgxh8 91.Kh5 92.Qhxg7 93.h6 94.Qa7 95.Kg6 96.Qb7 97.Kh5 ","check":true,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":true,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":4,"promoting":false,"lastMove":{"valid":true,"source":{"row":2,"col":6},"target":{"row":3,"col":7},"piece":{"color":"black","pieceType":1},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 1, col: 1 }
        target = { row: 2, col: 1 }
        let move = game.makeMove(source, target);

        // Assert
        assert.equal(game.Draw, true)
        assert.equal(verifyCall, true);
        assert.equal(game.DrawReason, "Stalemate");
        assert.equal(game.ResultMove.moveStr, "1/2-1/2");
    });

    it("50 Moves cases a draw", () => {
        //Arrange
        let verifyCall = false;
        game.OnDraw = () => {
            verifyCall = true
        }
        let state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},null,{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,{"color":"white","pieceType":2},null,{"color":"black","pieceType":2},null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},null,{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.Kh3 2.Kh6 3.Kf4 4.Kf5 5.Kd5 6.Kd4 7.Kf4 8.Kf5 9.Kd5 10.Kd4 11.Kf4 12.Kf5 13.Kd5 14.Kd4 15.Kf4 16.Kf5 17.Kd5 18.Kd4 19.Kf4 20.Kf5 21.Kd5 22.Kd4 23.Kf4 24.Kf5 25.Kd5 26.Kd4 27.Kf4 28.Kf5 29.Kd5 30.Kd4 31.Kf4 32.Kf5 33.Kd5 34.Kd4 35.Kf4 36.Kf5 37.Kd5 38.Kd4 39.Kf4 40.Kf5 41.Kd5 42.Kd4 43.Kf4 44.Kf5 45.Kd5 46.Kd4 47.Kf4 48.Kf5 49.Kd5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":49,"promoting":false,"lastMove":{"valid":true,"source":{"row":4,"col":5},"target":{"row":3,"col":3},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false}}`;
        game.loadGame(state);


        // // Action
        source = { row: 3, col: 5 }
        target = { row: 4, col: 3 }

        // Assert no draw before move
        if (game.Draw) return false;
        game.makeMove(source, target);

        // Assert
        assert.equal(game.Draw, true)
        assert.equal(verifyCall, true);
        assert.equal(game.DrawReason, "50 Moves");
    });

    it("Insufficient pieces cases a draw - Option 1", () => {
        let verifyCall = false;
        game.OnDraw = () => {
            verifyCall = true
        }
        let state = `{"board":[[null,null,{"color":"black","pieceType":3},null,{"color":"black","pieceType":1},null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,{"color":"black","pieceType":5},null,null,null,null],[null,null,null,{"color":"white","pieceType":1},null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,{"color":"white","pieceType":3},null,null]],"turn":"white","capturedPiecesList":[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":2},{"color":"black","pieceType":4},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":2},{"color":"black","pieceType":0},{"color":"white","pieceType":4},{"color":"black","pieceType":2},{"color":"white","pieceType":0},{"color":"black","pieceType":4},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":0},{"color":"white","pieceType":5},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":5},{"color":"white","pieceType":0},{"color":"white","pieceType":3},{"color":"black","pieceType":3},{"color":"black","pieceType":5}],"algebricNotation":"1.e4 2.f5 3.exf5 4.g6 5.fxg6 6.e6 7.gxh7 8.e5 9.hxg8 10.e4 11.Qgxh8 12.e3 13.Qc3 14.exf2 15.Qcxc7 16.fxg1 17.Qcxb7 18.Qgxh1 19.Qbxb8 20.Qhxh2 21.Qbxa8 22.Qhxg2 23.Qaxa7 24.Qd5 25.Qe3+ 26.Kf7 27.Qe2 28.Qdxa2 29.Qe3 30.Qaxa1 31.Qe2 32.Qaxb1 33.Qe3 34.Qbxb2 35.Qe2 36.Qb1 37.Qe7+ 38.Qdxe7+ 39.Kf2 40.Qbxc2 41.Bb2 42.d5 43.Qh5+ 44.Qg6 45.Qhxd5+ 46.Ke8 47.d4 48.Bh6 49.Qd8+ 50.Qexd8 51.Bg7 52.Qgxg7 53.Ke2 54.Be3 55.Kexe3 56.Qd3+ 57.Kexd3 ","check":true,"checkmate":false,"draw":false,"whiteKingMoved":true,"blackKingMoved":true,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"lastMove":{"valid":true,"source":{"row":1,"col":6},"target":{"row":4,"col":3},"piece":{"color":"black","pieceType":5},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"check":true}}`;
        game.loadGame(state);

        // // Action
        source = { row: 5, col: 3 }
        target = { row: 4, col: 3 }

        // Assert no draw before move
        if (game.Draw) return false;
        game.makeMove(source, target);

        // Assert
        assert.equal(game.Draw, true)
        assert.equal(verifyCall, true);
        assert.equal(game.DrawReason, "insufficient Materials");
    });


    it("Insufficient pieces cases a draw - Option 2", () => {
        let verifyCall = false;
        game.OnDraw = () => {
            verifyCall = true
        }
        let state = `{"board":[[null,null,null,null,{"color":"black","pieceType":1},null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,{"color":"black","pieceType":5},null,null],[null,null,null,null,null,{"color":"white","pieceType":1},null,null],[null,null,null,null,null,null,null,null]],"turn":"white","capturedPiecesList":[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":2},{"color":"black","pieceType":4},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":2},{"color":"black","pieceType":0},{"color":"white","pieceType":4},{"color":"black","pieceType":2},{"color":"white","pieceType":0},{"color":"black","pieceType":4},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":0},{"color":"white","pieceType":5},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":5},{"color":"white","pieceType":0},{"color":"white","pieceType":3},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"white","pieceType":3}],"algebricNotation":"1.Ke2 2.Bg4+ 3.Ke1 4.Be2 5.Kexe2 6.Qh4 7.Bh3 8.Qhxh3 9.Kf2 10.Qf3+ ","check":true,"checkmate":false,"draw":false,"whiteKingMoved":true,"blackKingMoved":true,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":2,"promoting":false,"lastMove":{"valid":true,"source":{"row":5,"col":7},"target":{"row":5,"col":5},"piece":{"color":"black","pieceType":5},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true,"check":true}}`;
        game.loadGame(state);

        // // Action
        source = { row: 6, col: 5 }
        target = { row: 5, col: 5 }

        // Assert no draw before move
        if (game.Draw) return false;
        game.makeMove(source, target);

        // Assert
        assert.equal(game.Draw, true)
        assert.equal(verifyCall, true);
        assert.equal(game.DrawReason, "insufficient Materials");
    });


    it("Insufficient pieces cases a draw - Option 3", () => {
        let verifyCall = false;
        game.OnDraw = () => {
            verifyCall = true
        }
        let state = `{"board":[[null,null,null,null,{"color":"black","pieceType":1},null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,{"color":"white","pieceType":3}],[null,null,null,null,{"color":"white","pieceType":1},{"color":"black","pieceType":5},null,null],[null,null,null,null,null,null,null,null]],"turn":"white","capturedPiecesList":[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":2},{"color":"black","pieceType":4},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":2},{"color":"black","pieceType":0},{"color":"white","pieceType":4},{"color":"black","pieceType":2},{"color":"white","pieceType":0},{"color":"black","pieceType":4},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":0},{"color":"white","pieceType":5},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":5},{"color":"white","pieceType":0},{"color":"white","pieceType":3},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":3}],"algebricNotation":"1.Ke2 2.Bg4+ 3.Ke1 4.Be2 5.Kexe2 6.Qh4 7.Bh3 8.Qf2+ ","check":true,"checkmate":false,"draw":false,"whiteKingMoved":true,"blackKingMoved":true,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":3,"promoting":false,"lastMove":{"valid":true,"source":{"row":4,"col":7},"target":{"row":6,"col":5},"piece":{"color":"black","pieceType":5},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true,"check":true}}`;
        game.loadGame(state);

        game.


            // // Action
            source = { row: 6, col: 4 }
        target = { row: 6, col: 5 }

        // Assert no draw before move
        if (game.Draw) return false;
        game.makeMove(source, target);

        // Assert
        assert.equal(game.Draw, true)
        assert.equal(verifyCall, true);
        assert.equal(game.DrawReason, "insufficient Materials");
    });


    it("Insufficient pieces cases a draw - Option 4", () => {
        let verifyCall = false;
        game.OnDraw = () => {
            verifyCall = true
        }
        let state = `{"board":[[null,null,null,null,{"color":"black","pieceType":1},null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,{"color":"black","pieceType":3}],[null,null,null,null,null,null,null,null],[null,null,null,{"color":"black","pieceType":5},{"color":"white","pieceType":1},null,null,null]],"turn":"white","capturedPiecesList":[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":2},{"color":"black","pieceType":4},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":2},{"color":"black","pieceType":0},{"color":"white","pieceType":4},{"color":"black","pieceType":2},{"color":"white","pieceType":0},{"color":"black","pieceType":4},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":0},{"color":"white","pieceType":5},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":5},{"color":"white","pieceType":0},{"color":"white","pieceType":3},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"white","pieceType":3}],"algebricNotation":"1.Ke2 2.Bg4+ 3.Ke1 4.Qd3 5.Bh3 6.Qd4 7.Kf1 8.Bgxh3+ 9.Ke1 10.Qd1+ ","check":true,"checkmate":false,"draw":false,"whiteKingMoved":true,"blackKingMoved":true,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":2,"promoting":false,"lastMove":{"valid":true,"source":{"row":4,"col":3},"target":{"row":7,"col":3},"piece":{"color":"black","pieceType":5},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true,"check":true}}`;
        game.loadGame(state);

        // // Action
        source = { row: 7, col: 4 }
        target = { row: 7, col: 3 }

        // Assert no draw before move
        if (game.Draw) return false;
        game.makeMove(source, target);

        // Assert
        assert.equal(game.Draw, true)
        assert.equal(verifyCall, true);
        assert.equal(game.DrawReason, "insufficient Materials");
    });

    it("Insufficient pieces cases a draw - Option 5", () => {
        let verifyCall = false;
        game.OnDraw = () => {
            verifyCall = true
        }
        let state = `{"board":[[null,null,null,null,{"color":"black","pieceType":1},null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,{"color":"black","pieceType":2}],[null,null,null,null,null,null,null,null],[null,null,null,{"color":"black","pieceType":5},{"color":"white","pieceType":1},null,null,null]],"turn":"white","capturedPiecesList":[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":2},{"color":"black","pieceType":4},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":2},{"color":"black","pieceType":0},{"color":"white","pieceType":4},{"color":"black","pieceType":2},{"color":"white","pieceType":0},{"color":"black","pieceType":4},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":0},{"color":"white","pieceType":5},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":5},{"color":"white","pieceType":0},{"color":"white","pieceType":3},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"white","pieceType":3}],"algebricNotation":"1.Ke2 2.Bg4+ 3.Ke1 4.Qd3 5.Bh3 6.Qd4 7.Kf1 8.Bgxh3+ 9.Ke1 10.Qd1+ ","check":true,"checkmate":false,"draw":false,"whiteKingMoved":true,"blackKingMoved":true,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":2,"promoting":false,"lastMove":{"valid":true,"source":{"row":4,"col":3},"target":{"row":7,"col":3},"piece":{"color":"black","pieceType":5},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true,"check":true}}`;
        game.loadGame(state);

        // // Action
        source = { row: 7, col: 4 }
        target = { row: 7, col: 3 }

        // Assert no draw before move
        if (game.Draw) return false;
        game.makeMove(source, target);

        // Assert
        assert.equal(game.Draw, true)
        assert.equal(verifyCall, true);
        assert.equal(game.DrawReason, "insufficient Materials");
    });



    it("Threefold Repetition cases a draw", () => {
        let verifyCall = false;
        let source, target;

        game.OnDraw = () => {
            verifyCall = true
        }
        game.startNewGame();
        game.loadGame(initalState);

        for (let i = 0; i < 2; i++) {
            // // Action

            source = { row: 7, col: 6 }
            target = { row: 5, col: 7 }
            assert.equal(game.Draw, false, "No Draw yet")
            game.makeMove(source, target);

            source = { row: 0, col: 6 }
            target = { row: 2, col: 5 }
            assert.equal(game.Draw, false, "No Draw yet")
            game.makeMove(source, target);

            source = { row: 5, col: 7 }
            target = { row: 7, col: 6 }
            assert.equal(game.Draw, false, "No Draw yet")
            game.makeMove(source, target);


            source = { row: 2, col: 5 }
            target = { row: 0, col: 6 }
            assert.equal(game.Draw, false, "No Draw yet")
            game.makeMove(source, target);
        }

        // source = { row: 7, col: 6 }
        // target = { row: 5, col: 7 }
        // assert.equal(game.Draw, false, "No Draw yet")
        // game.makeMove(source, target);

        // Assert
        assert.equal(game.Draw, true, "Should be Draw ")
        assert.equal(verifyCall, true);
        game.OnDraw = null
        assert.equal(game.DrawReason, "Threefold Repetition");
        assert.equal(game.DrawReason, game.GameOverReason);

    });
})


describe("Events Test", () => {
    it("should call the OnUpdate when registered to this event", () => {
        let verifyCall = false;
        game.OnUpdate = () => {
            verifyCall = true
        }
        game.startNewGame();
        assert.equal(verifyCall, true);
    });

    it("should call the OnUpdate when forcing an update", () => {
        let verifyCall = false;
        game.OnUpdate = () => {
            verifyCall = true
        }
        game.forceUpdate();
        assert.equal(verifyCall, true);
    });

    it("should call the OnDraw when registered to this event", () => {
        let verifyCall = false;
        game.OnDraw = () => {
            verifyCall = true
        }
        game.startNewGame();
        //Arrange
        let state = `{"board":[[null,null,null,null,null,null,null,null],[null,{"color":"white","pieceType":5},null,null,null,null,null,null],[null,null,null,null,null,null,null,{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,{"color":"black","pieceType":1}],[null,null,null,null,{"color":"white","pieceType":2},null,null,null],[null,null,null,null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,null,null],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},null,{"color":"white","pieceType":1},{"color":"white","pieceType":3},null,{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":0},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4},{"color":"black","pieceType":0},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":5},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4},{"color":"black","pieceType":0}],"algebricNotation":"1.e4 2.f5 3.exf5 4.g6 5.fxg6 6.e6 7.gxh7 8.e5 9.hxg8 10.e4 11.Qgxh8 12.e3 13.Qc3 14.exf2 15.Qcxc7 16.fxg1 17.Qcxc8 18.Qgxh1 19.Qcxb8 20.Qhxh2 21.Qbxa8 22.Qhxg2 23.Qaxb7 24.Qd5 25.Qbxa7 26.Qdxa2 27.Qa6 28.Qf7 29.Kc3 30.Qc8 31.Kd5 32.Qd8 33.Be2 34.Qg7 35.Bh5+ 36.Qf7 37.d4 38.d5 39.Qd3 40.e5 41.Qa3 42.Kf6 43.Qaxa7 44.Kc6 45.Qaxa8 46.e4 47.d5 48.exd5 49.e5 50.dxe6 51.c5 52.exf7+ 53.Kexf7 54.Qg4 55.Kf6 56.Qgxc8 57.Kg5 58.Qcxb8 59.Kh5 60.h3 61.Kh6 62.g3 63.Kh5 64.f3 65.Kh6 66.Qbxa8 67.Kh5 68.Qaxa7 69.c4 70.Qa6 71.c3 72.Qb6 73.cxb2 74.Ke2 75.Qc8 76.Qbxb2 77.Qb8 78.Kc3 79.Qc8 80.Ke4 81.b6 82.Qbxb6 83.Qb8 84.Qbxb8 85.Kh6 86.Qbxf8 87.Kh5 88.Qfxg8 89.Kh6 90.Qgxh8 91.Kh5 92.Qhxg7 93.h6 94.Qa7 95.Kg6 96.Qb7 97.Kh5 ","check":true,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":true,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":4,"promoting":false,"lastMove":{"valid":true,"source":{"row":2,"col":6},"target":{"row":3,"col":7},"piece":{"color":"black","pieceType":1},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false}}`;
        game.loadGame(state);

        // // Action
        source = { row: 1, col: 1 }
        target = { row: 2, col: 1 }
        let move = game.makeMove(source, target);

        // Assert
        assert.equal(game.Draw, true)
        assert.equal(verifyCall, true);
    });

    it("should call the OnCheck when registered to this event", () => {
        let verifyCall = false;
        game.OnCheck = () => {
            verifyCall = true
        }
        const state = `{ "board": [[{ "color": "black", "pieceType": 4 }, { "color": "black", "pieceType": 2 }, { "color": "black", "pieceType": 3 }, { "color": "black", "pieceType": 5 }, { "color": "black", "pieceType": 1 }, { "color": "black", "pieceType": 3 }, { "color": "black", "pieceType": 2 }, { "color": "black", "pieceType": 4 }], [{ "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }, { "color": "black", "pieceType": 0 }], [null, null, null, null, { "color": "white", "pieceType": 0 }, null, null, null], [null, null, null, null, null, null, null, { "color": "white", "pieceType": 5 }], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [{ "color": "white", "pieceType": 0 }, { "color": "white", "pieceType": 0 }, { "color": "white", "pieceType": 0 }, { "color": "white", "pieceType": 0 }, null, { "color": "white", "pieceType": 0 }, { "color": "white", "pieceType": 0 }, { "color": "white", "pieceType": 0 }], [{ "color": "white", "pieceType": 4 }, { "color": "white", "pieceType": 2 }, { "color": "white", "pieceType": 3 }, null, { "color": "white", "pieceType": 1 }, { "color": "white", "pieceType": 3 }, { "color": "white", "pieceType": 2 }, { "color": "white", "pieceType": 4 }]], "turn": "white", "capturedPiecesList": [], "algebricNotation": "1.e4 2.Ka6 3.Qh5 4.Kb8 5.e5 6.Ka6 7.e6 8.Kb8 ", "check": false, "checkmate": false, "draw": false, "whiteKingMoved": false, "blackKingMoved": false, "farWhiteRookMoved": false, "farBlackRookMoved": false, "nearWhiteRookMoved": false, "nearBlackRookMoved": false, "whitePlayerView": true, "fiftyMovesCounter": 1, "promoting": false, "queensideWhiteRookMoved": false, "queensideBlackRookMoved": false, "kingsideWhiteRookMoved": false, "kingsideBlackRookMoved": false, "lastMove": { "valid": true, "source": { "row": 2, "col": 0 }, "target": { "row": 0, "col": 1 }, "piece": { "color": "black", "pieceType": 2 }, "promotion": false, "ennPassant": false, "capturedPiece": null, "hitSquare": null, "turn": false, "castling": false } }`;

        game.loadGame(state);
        source = { row: 2, col: 4 }
        target = { row: 1, col: 5 }
        let move = game.makeMove(source, target);

        // Assert      
        assert(game.Check)

        // Assert
        assert.equal(game.Check, true)
        assert.equal(verifyCall, true);
    });

    it("should call the OnCheckmate when registered to this event", () => {
        let verifyCall = false;
        game.OnCheckmate = () => {
            verifyCall = true
        }
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},null],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,{"color":"white","pieceType":2}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},null,{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.f5 3.Kh3 4.g5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":6},"target":{"row":3,"col":6},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        assert.ok(game.GameOverReason == "");
        source = { row: 7, col: 3 }
        target = { row: 3, col: 7 }
        let move = game.makeMove(source, target);

        // Assert
        assert.equal(game.Checkmate, true)
        assert.equal(verifyCall, true);
        assert.ok(game.GameOverReason.indexOf("Checkmate") != -1);
        assert.equal(game.ResultMove.moveStr, "1-0");

    });


    it("should call the Undo when registered to this event", () => {
        let verifyCall = false;
        game.OnUndo = () => {
            verifyCall = true
        }
        game.startNewGame();
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},null],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,{"color":"white","pieceType":2}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},null,{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.f5 3.Kh3 4.g5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":6},"target":{"row":3,"col":6},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        source = { row: 7, col: 3 }
        target = { row: 3, col: 7 }
        assert.equal(game.Checkmate, false, "The game should NOT be in Checkmate state at this point")
        let move = game.makeMove(source, target);
        assert.equal(game.Checkmate, true, "The game should be in Checkmate state at this point")
        game.undo();
        assert.equal(game.Checkmate, false, "The game should NOT be in Checkmate state at this point")
        assert.equal(verifyCall, true);
    });

    it("should call the OnPromotion when registered to this event", () => {
        let verifyCall = false;
        let promotingStatus = false;
        game.OnPromotion = () => {
            verifyCall = true
        }

        game.OnUpdate = (state) => {
            promotingStatus = state.promoting;
        }
        game.startNewGame();
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,null,{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"black","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],"algebricNotation":"1.e4 2.f5 3.exf5 4.g6 5.fxg6 6.e5 7.gxh7 8.e4 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"lastMove":{"valid":true,"source":{"row":3,"col":4},"target":{"row":4,"col":4},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        source = { row: 1, col: 7 }
        target = { row: 0, col: 6 }

        let move = game.makeMove(source, target);
        assert.equal(move.promotion, true, "The move should indicate a promotion")
        game.completePromotion(move, 5)
        // game.undo();
        // assert.equal(move.promotion, false, "The move should NOT indicate a promotion")
        assert.equal(verifyCall, true);
        assert.equal(promotingStatus, false);
    });





});

describe("Last Move Tests", () => {
    it("Last Move can be retrived", () => {
        let verifyCall = false;

        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},null],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,{"color":"white","pieceType":2}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},null,{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.f5 3.Kh3 4.g5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":6},"target":{"row":3,"col":6},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        source = { row: 7, col: 3 }
        target = { row: 3, col: 7 }
        let move = game.makeMove(source, target);

        // Assert
        const lastMove = game.Moves[game.Moves.length - 1]
        assert.equal(lastMove.target.row, 3)
        assert.equal(lastMove.target.col, 7)

    });
});

/*
describe("Algebric Noatation Tests", () => {
    it("should add 1-0 On Checkmate, When White Wins", () => {

        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},null],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,{"color":"white","pieceType":2}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},null,{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.f5 3.Kh3 4.g5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":6},"target":{"row":3,"col":6},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.loadGame(state);
        source = { row: 7, col: 3 }
        target = { row: 3, col: 7 }
        let move = game.makeMove(source, target);
        move.loadGame

        // Assert
        assert.ok(game.GameState.algebricNotation.indexOf("1-0") > 0)
        assert.ok(game.GameState.algebricNotation.indexOf("#") > 0)
    })

    it("should add 0-1 On Checkmate, When Black Wins", () => {

        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"black","pieceType":0},null,null,null],[null,null,null,null,null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[],"algebricNotation":"1.f4 2.e5 3.g4 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":6,"col":6},"target":{"row":4,"col":6},"piece":{"color":"white","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
        game.startNewGame()
        game.loadGame(state);
        source = { row: 0, col: 3 }
        target = { row: 4, col: 7 }
        let move = game.makeMove(source, target);
        move.loadGame

        // Assert
        assert.ok(game.GameState.algebricNotation.indexOf("0-1") > 0)
        assert.ok(game.GameState.algebricNotation.indexOf("#") > 0)
    })

    it("should add 0-0 when kingside castling", () => {

        const state = `{"board":[[{"color":"black","pieceType":4},null,null,{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,{"color":"black","pieceType":2},null,null,null,null,null],[null,null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,null],[null,null,null,null,null,{"color":"white","pieceType":0},{"color":"black","pieceType":3},null],[null,null,null,null,null,{"color":"white","pieceType":2},null,{"color":"white","pieceType":3}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},null,null,{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[{"color":"white","pieceType":0}],"algebricNotation":"1.f4 2.e5 3.g4 4.Kc6 5.Kf3 6.d5 7.Bh3 8.Bcxg4 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":0,"col":2},"target":{"row":4,"col":6},"piece":{"color":"black","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":{"color":"white","pieceType":0},"hitSquare":{"row":4,"col":6},"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.startNewGame()
        game.loadGame(state);
        source = { row: 7, col: 4 }
        target = { row: 7, col: 6 }
        let move = game.makeMove(source, target);
        move.loadGame

        // Assert
        assert.ok(game.GameState.algebricNotation.indexOf(" 0-0") > 0)
    })

    it("should add 0-0-0 when queenside castling", () => {

        const state = `{"board":[[{"color":"black","pieceType":4},null,null,null,{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,{"color":"black","pieceType":2},null,null,null,null,null],[null,null,null,{"color":"black","pieceType":0},{"color":"white","pieceType":2},null,null,null],[null,null,null,null,null,{"color":"white","pieceType":0},{"color":"black","pieceType":3},{"color":"black","pieceType":5}],[null,null,null,null,null,null,null,{"color":"white","pieceType":3}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,null,{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},null,{"color":"white","pieceType":1},null,{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[{"color":"white","pieceType":0},{"color":"black","pieceType":0}],"algebricNotation":"1.f4 2.e5 3.g4 4.Kc6 5.Kf3 6.d5 7.Bh3 8.Bcxg4 9.Kfxe5 10.Qh4+ 11.Kf1 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":true,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":2,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":7,"col":4},"target":{"row":7,"col":5},"piece":{"color":"white","pieceType":1},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
        game.startNewGame()
        game.loadGame(state);
        source = { row: 0, col: 4 }
        target = { row: 0, col: 2 }
        let move = game.makeMove(source, target);
        move.loadGame

        // Assert
        assert.ok(game.GameState.algebricNotation.indexOf(" 0-0-0") > 0)
    })
})
*/


describe("Rook Moves", () => {
    it("should allow move horizontally", () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null],[null,null,null,{"color":"black","pieceType":0},null,null,null,{"color":"black","pieceType":4}],[null,null,null,null,null,null,null,{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,{"color":"white","pieceType":0}],[null,null,null,{"color":"white","pieceType":0},null,null,null,{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},null]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.h4 2.h5 3.Rh3 4.Rh6 5.d3 6.d6 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":true,"kingsideBlackRookMoved":true,"lastMove":{"valid":true,"source":{"row":1,"col":3},"target":{"row":2,"col":3},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.startNewGame()
        game.loadGame(state);
        source = { row: 5, col: 7 }
        target = { row: 5, col: 5 }
        let moves = game.possibleMoves(source);
        //console.log(moves)
        // Assert
        assert.equal(moves.length, 5, "Should have 5 options");
        assert.equal(moves[0].target.row, 5)
        assert.equal(moves[0].target.col, 4)
        assert.equal(moves[1].target.row, 5)
        assert.equal(moves[1].target.col, 5)
        assert.equal(moves[2].target.row, 5)
        assert.equal(moves[2].target.col, 6)
    })

    it("should allow move vertically", () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,{"color":"white","pieceType":0}],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.h4 2.h5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":7},"target":{"row":3,"col":7},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.startNewGame()
        game.loadGame(state);
        source = { row: 7, col: 7 }
        target = { row: 5, col: 7 }
        let moves = game.possibleMoves(source);
        console.log(moves)
        // Assert
        assert.equal(moves.length, 2, "Should have 5 options");
        assert.equal(moves[0].target.row, 5)
        assert.equal(moves[0].target.col, 7)
        assert.equal(moves[1].target.row, 6)
        assert.equal(moves[1].target.col, 7)

    })

    it("should not allow move horizontally when oher tool is blocking", () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},null],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null],[null,null,null,{"color":"black","pieceType":0},null,null,null,{"color":"black","pieceType":4}],[null,null,null,null,null,null,null,{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,{"color":"white","pieceType":0}],[null,null,null,{"color":"white","pieceType":0},null,null,null,{"color":"white","pieceType":4}],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},null]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.h4 2.h5 3.Rh3 4.Rh6 5.d3 6.d6 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":true,"kingsideBlackRookMoved":true,"lastMove":{"valid":true,"source":{"row":1,"col":3},"target":{"row":2,"col":3},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.startNewGame()
        game.loadGame(state);
        source = { row: 5, col: 7 }
        target = { row: 5, col: 1 }
        let move = game.validateMove(source, target, "white");
        // console.log(move)
        // Assert
        assert.equal(move.valid, false, "Should not allow ");
        assert.equal(move.reason, game.Reasons.PIECE_MOVE_ILLEGAL, "Should not allow ");

    })
});

describe("Bishop Moves", () => {
    it("should allow move diagonally", () => {
        const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,{"color":"white","pieceType":3},null,null,null,null,null],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},null,{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e3 2.Kh6 3.Bc4 4.Kg8 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":3,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":2,"col":7},"target":{"row":0,"col":6},"piece":{"color":"black","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.startNewGame()
        game.loadGame(state);
        source = { row: 4, col: 2 }
        target = { row: 5, col: 5 }
        let moves = game.possibleMoves(source);
        console.log(moves)
        // Assert
        assert.equal(moves.length, 9, "Should have 9 options");
        assert.equal(moves[0].target.row, 1)
        assert.equal(moves[0].target.col, 5)

        assert.equal(moves[1].target.row, 2)
        assert.equal(moves[1].target.col, 0)

        assert.equal(moves[2].target.row, 2)
        assert.equal(moves[2].target.col, 4)

        assert.equal(moves[3].target.row, 3)
        assert.equal(moves[3].target.col, 1)

        assert.equal(moves[4].target.row, 3)
        assert.equal(moves[4].target.col, 3)

        assert.equal(moves[5].target.row, 5)
        assert.equal(moves[5].target.col, 1)

        assert.equal(moves[6].target.row, 5)
        assert.equal(moves[6].target.col, 3)

        assert.equal(moves[7].target.row, 6)
        assert.equal(moves[7].target.col, 4)

        assert.equal(moves[8].target.row, 7)
        assert.equal(moves[8].target.col, 5)
    })


});


describe("ChessGame Properties test", () => {
    it("GameTimeLength", () => {
        game.startNewGame()
        game.loadGame(initalState);
        game.GameTimeLength = 60 * 60 * 0.5;
        assert.equal(game.GameTimeLength, 60 * 60 * 0.5);
    });

    it("OutOfTime white", () => {
        game.startNewGame()
        game.loadGame(initalState);
        game.OutOfTime = "white";
        assert.equal(game.OutOfTime, "white");
        assert.equal(game.ResultMove.moveStr, "0-1");

    });

    it("OutOfTime black", () => {
        game.startNewGame()
        game.loadGame(initalState);
        game.OutOfTime = "black";
        assert.equal(game.OutOfTime, "black");
        assert.equal(game.ResultMove.moveStr, "1-0");

    });

    it("Result move is null if game is not over", () => {
        game.startNewGame()
        game.loadGame(initalState);
        assert.equal(game.GameOver, false);
        assert.equal(game.ResultMove, null);
        assert.equal(game.LastMove, null);

    });
    it("Last move property returns the last move", () => {
        game.startNewGame()
        game.loadGame(initalState);
        assert.equal(game.GameOver, false);
        assert.equal(game.ResultMove, null);
        assert.equal(game.LastMove, null);

    });
});

describe("Special cases", () => {
    it("reveal check", () => {
        const state = `{"board":[[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":5},{"color":"black","pieceType":2},null,null,null,null,null,null],[null,null,{"color":"black","pieceType":0},null,{"color":"white","pieceType":0},null,{"color":"black","pieceType":0},null],[null,{"color":"black","pieceType":1},null,{"color":"white","pieceType":0},{"color":"white","pieceType":2},null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":3},null,null,{"color":"white","pieceType":3},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,{"color":"white","pieceType":4},null,null,{"color":"white","pieceType":1},null,null,{"color":"white","pieceType":4}]],"turn":"white","capturedPiecesList":[{"color":"black","pieceType":4},{"color":"black","pieceType":3},{"color":"white","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":2},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":0},{"color":"black","pieceType":5},{"color":"black","pieceType":0},{"color":"black","pieceType":4}],"algebricNotation":"1.e4 2.b5 3.Qf3 4.f5 5.Kh3 6.a6 7.Kg5 8.d5 9.Qh5+ 10.g6 11.Qh6 12.b4 13.Qg7 14.Bd7 15.Qgxh8 16.Kf6 17.Qg8 18.Qc8 19.Qf7+ 20.Kd8 21.Qfxf8+ 22.Be8 23.Kf7+ 24.Kd7 25.Be2 26.Bexf7 27.Qfxf7 28.g5 29.Qfxh7 30.d4 31.Qhxf5+ 32.e6 33.Qfxf6 34.Kc6 35.Bf3 36.Ra7 37.e5+ 38.Kc5 39.d3 40.Rb7 41.Kd2 42.Qd7 43.Ke4+ 44.Kb6 45.c3 46.dxc3 47.bxc3 48.Qd5 49.cxb4 50.Qb5 51.Qfxe6+ 52.Qc6 53.Be3+ 54.Kb5 55.Be2 56.Kd7 57.d4+ 58.Kbxb4 59.Bd2+ 60.Ka4 61.Qexc6+ 62.Ka3 63.Bc1+ 64.Rb2 65.Qcxa6+ 66.Kb4 67.Bcxb2 68.Kb6 69.Rb1 70.c5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":true,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":true,"queensideBlackRookMoved":true,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":1,"col":2},"target":{"row":3,"col":2},"piece":{"color":"black","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
        game.startNewGame()
        game.loadGame(state);
        source = { row: 6, col: 1 }
        target = { row: 5, col: 2 }
        game.makeMove(source, target, "white");
        //console.log(moves)
        // Assert
        assert.equal(game.Checkmate, true, "Should be checkmate");
        assert.deepEqual(game.LastMove.source, source, "Should be checkmate");
        assert.deepEqual(game.LastMove.target, target, "Should be checkmate");

    })

    it("illegal move threat by knight", () => {
        const state = `{"board":[[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":5},{"color":"black","pieceType":2},null,null,null,null,null,null],[null,null,{"color":"black","pieceType":0},null,{"color":"white","pieceType":0},null,{"color":"black","pieceType":0},null],[null,{"color":"black","pieceType":1},null,{"color":"white","pieceType":0},{"color":"white","pieceType":2},null,null,null],[null,null,{"color":"white","pieceType":3},null,null,null,null,null],[{"color":"white","pieceType":0},null,null,null,{"color":"white","pieceType":3},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,{"color":"white","pieceType":4},null,null,{"color":"white","pieceType":1},null,null,{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[{"color":"black","pieceType":4},{"color":"black","pieceType":3},{"color":"white","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":2},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":0},{"color":"black","pieceType":5},{"color":"black","pieceType":0},{"color":"black","pieceType":4}],"algebricNotation":"1.e4 2.Bc3+ ","check":true,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":true,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":true,"queensideBlackRookMoved":true,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":6,"col":1},"target":{"row":5,"col":2},"piece":{"color":"white","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true,"check":true}}`;
        game.startNewGame()
        game.loadGame(state);
        source = { row: 4, col: 1 }
        target = { row: 5, col: 2 }
        let move = game.validateMove(source, target, "black");
        //console.log(moves)
        // Assert
        assert.equal(move.valid, false, "Should be invalid move");
    })

    it("White Player resigned on intial state", () => {
        game.startNewGame()
        game.loadGame(initalState);
        game.resign("white");
        assert.equal(game.GameOverReason, "white Player Resigned.");
    })

    it("Black Player resigned on intial state", () => {
        game.startNewGame()
        game.loadGame(initalState);
        game.resign("black");
        assert.equal(game.GameOverReason, "black Player Resigned.");
    })

    it("Black Player resigned on non intial state", () => {
        const state = `{"board":[[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":5},{"color":"black","pieceType":2},null,null,null,null,null,null],[null,null,{"color":"black","pieceType":0},null,{"color":"white","pieceType":0},null,{"color":"black","pieceType":0},null],[null,{"color":"black","pieceType":1},null,{"color":"white","pieceType":0},{"color":"white","pieceType":2},null,null,null],[null,null,{"color":"white","pieceType":3},null,null,null,null,null],[{"color":"white","pieceType":0},null,null,null,{"color":"white","pieceType":3},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,{"color":"white","pieceType":4},null,null,{"color":"white","pieceType":1},null,null,{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[{"color":"black","pieceType":4},{"color":"black","pieceType":3},{"color":"white","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":2},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":0},{"color":"black","pieceType":5},{"color":"black","pieceType":0},{"color":"black","pieceType":4}],"algebricNotation":"1.e4 2.Bc3+ ","check":true,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":true,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":true,"queensideBlackRookMoved":true,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":6,"col":1},"target":{"row":5,"col":2},"piece":{"color":"white","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true,"check":true}}`;
        game.startNewGame()
        game.loadGame(state);
        game.resign("black");
        assert.equal(game.ResultMove.moveStr, "1-0");
    })

    it("White Player resigned on non intial state", () => {
        const state = `{"board":[[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":5},{"color":"black","pieceType":2},null,null,null,null,null,null],[null,null,{"color":"black","pieceType":0},null,{"color":"white","pieceType":0},null,{"color":"black","pieceType":0},null],[null,{"color":"black","pieceType":1},null,{"color":"white","pieceType":0},{"color":"white","pieceType":2},null,null,null],[null,null,{"color":"white","pieceType":3},null,null,null,null,null],[{"color":"white","pieceType":0},null,null,null,{"color":"white","pieceType":3},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,{"color":"white","pieceType":4},null,null,{"color":"white","pieceType":1},null,null,{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[{"color":"black","pieceType":4},{"color":"black","pieceType":3},{"color":"white","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":2},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":0},{"color":"black","pieceType":5},{"color":"black","pieceType":0},{"color":"black","pieceType":4}],"algebricNotation":"1.e4 2.Bc3+ ","check":true,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":true,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":true,"queensideBlackRookMoved":true,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":6,"col":1},"target":{"row":5,"col":2},"piece":{"color":"white","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true,"check":true}}`;
        game.startNewGame()
        game.loadGame(state);
        game.resign("white");
        assert.equal(game.ResultMove.moveStr, "0-1");
    })

    it("White Player accepted a draw offer", () => {
        const state = `{"board":[[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":5},{"color":"black","pieceType":2},null,null,null,null,null,null],[null,null,{"color":"black","pieceType":0},null,{"color":"white","pieceType":0},null,{"color":"black","pieceType":0},null],[null,{"color":"black","pieceType":1},null,{"color":"white","pieceType":0},{"color":"white","pieceType":2},null,null,null],[null,null,{"color":"white","pieceType":3},null,null,null,null,null],[{"color":"white","pieceType":0},null,null,null,{"color":"white","pieceType":3},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,{"color":"white","pieceType":4},null,null,{"color":"white","pieceType":1},null,null,{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[{"color":"black","pieceType":4},{"color":"black","pieceType":3},{"color":"white","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":2},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":0},{"color":"black","pieceType":5},{"color":"black","pieceType":0},{"color":"black","pieceType":4}],"algebricNotation":"1.e4 2.Bc3+ ","check":true,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":true,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":true,"queensideBlackRookMoved":true,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":6,"col":1},"target":{"row":5,"col":2},"piece":{"color":"white","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true,"check":true}}`;
        game.startNewGame()
        game.loadGame(state);
        game.drawOfferAccepted("white");
        assert.equal(game.ResultMove.moveStr, "1/2-1/2");
        assert.equal(game.DrawReason, "white player's draw offer accepted");
    })

    it("White Player accepted a draw offer", () => {
        const state = `{"board":[[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":5},{"color":"black","pieceType":2},null,null,null,null,null,null],[null,null,{"color":"black","pieceType":0},null,{"color":"white","pieceType":0},null,{"color":"black","pieceType":0},null],[null,{"color":"black","pieceType":1},null,{"color":"white","pieceType":0},{"color":"white","pieceType":2},null,null,null],[null,null,{"color":"white","pieceType":3},null,null,null,null,null],[{"color":"white","pieceType":0},null,null,null,{"color":"white","pieceType":3},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[null,{"color":"white","pieceType":4},null,null,{"color":"white","pieceType":1},null,null,{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[{"color":"black","pieceType":4},{"color":"black","pieceType":3},{"color":"white","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":2},{"color":"white","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"white","pieceType":0},{"color":"black","pieceType":5},{"color":"black","pieceType":0},{"color":"black","pieceType":4}],"algebricNotation":"1.e4 2.Bc3+ ","check":true,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":true,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":true,"queensideBlackRookMoved":true,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":6,"col":1},"target":{"row":5,"col":2},"piece":{"color":"white","pieceType":3},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true,"check":true}}`;
        game.startNewGame()
        game.loadGame(state);
        game.drawOfferAccepted("black");
        assert.equal(game.ResultMove.moveStr, "1/2-1/2");
        assert.equal(game.DrawReason, "black player's draw offer accepted");
    })

    //state = '{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,{"color":"white","pieceType":0},null,null,null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn":"black","capturedPiecesList":[],"check":false,"checkmate":false,"draw":false,"drawReason":"","resigned":"","outOfTime":"","whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":0,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":6,"col":4},"target":{"row":4,"col":4},"piece":{"color":"white","pieceType":0},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}';
})


// describe("Brain cases", () => {
//     it("depth1 check", async () => {
//         const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},null,{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,null,null,null,null,null],[null,null,null,{"color":"black","pieceType":5},null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,{"color":"white","pieceType":2},null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},null,{"color":"white","pieceType":3},{"color":"white","pieceType":5},{"color":"white","pieceType":1},{"color":"white","pieceType":3},{"color":"white","pieceType":2},{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[{"color":"black","pieceType":0},{"color":"white","pieceType":0}],"algebricNotation":"1.e4 2.d5 3.exd5 4.Qdxd5 5.Kc3 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":7,"col":1},"target":{"row":5,"col":2},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
//         game.startNewGame()
//         game.loadGame(state);
//         let brain = new Brain();

//         let move = await brain.nextMove(game);
//         console.log(move);

//         assert.notEqual(move.target.row, 6, "");
//     })
// })

// describe("Brain cases", () => {
//     it("depth2 check", async () => {
//         const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},null,{"color":"black","pieceType":5},{"color":"black","pieceType":1},{"color":"black","pieceType":3},{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},{"color":"black","pieceType":0}],[null,null,null,{"color":"black","pieceType":0},null,null,null,null],[null,null,{"color":"black","pieceType":0},null,{"color":"black","pieceType":0},null,{"color":"white","pieceType":2},null],[null,null,null,null,{"color":"white","pieceType":0},null,{"color":"white","pieceType":5},null],[null,null,null,null,null,null,null,null],[{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},null,{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},{"color":"white","pieceType":2},{"color":"white","pieceType":3},null,{"color":"white","pieceType":1},{"color":"white","pieceType":3},null,{"color":"white","pieceType":4}]],"turn": "black","capturedPiecesList":[{"color":"white","pieceType":0},{"color":"black","pieceType":3}],"algebricNotation":"1.e4 2.e6 3.Qf3 4.e5 5.Kh3 6.d6 7.g4 8.Bcxg4 9.Qfxg4 10.c5 11.Kg5 ","check":false,"checkmate":false,"draw":false,"whiteKingMoved":false,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":5,"col":7},"target":{"row":3,"col":6},"piece":{"color":"white","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"white","castling":false,"whitePlayerView":true}}`;
//         game.startNewGame()
//         game.loadGame(state);
//         let brain = new Brain();

//         let move = await brain.nextMove(game);
//         console.log(move);

//         assert.ok(move.piece.pieceType != QUEEN &&
//             move.target.row != 3 &&
//             move.target.col != 6, "wrong move");
//     })
// })

// describe("Brain cases", () => {


//     it("suicide test", async () => {

//         const state = `{"board":[[{"color":"black","pieceType":4},{"color":"black","pieceType":2},{"color":"black","pieceType":3},null,{"color":"black","pieceType":1},null,{"color":"black","pieceType":2},{"color":"black","pieceType":4}],[{"color":"black","pieceType":0},null,{"color":"black","pieceType":5},{"color":"black","pieceType":0},{"color":"black","pieceType":0},null,{"color":"black","pieceType":3},{"color":"black","pieceType":0}],[null,{"color":"black","pieceType":0},null,null,null,{"color":"black","pieceType":0},{"color":"black","pieceType":0},null],[null,null,{"color":"black","pieceType":0},{"color":"white","pieceType":0},null,null,null,null],[{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},null,{"color":"white","pieceType":0},null,null,null],[null,null,{"color":"white","pieceType":2},{"color":"white","pieceType":3},null,{"color":"white","pieceType":2},{"color":"white","pieceType":0},null],[null,{"color":"white","pieceType":0},null,{"color":"white","pieceType":3},null,{"color":"white","pieceType":0},null,{"color":"white","pieceType":0}],[{"color":"white","pieceType":4},null,null,{"color":"white","pieceType":5},null,{"color":"white","pieceType":4},{"color":"white","pieceType":1},null]],"turn":"white","capturedPiecesList":[],"algebricNotation":"1.e4 2.b6 3.d4 4.g6 5.Kf3 6.Bg7 7.a3 8.f6 9.a4 10.Bf8 11.c4 12.Bg7 13.d5 14.Ka6 15.Bd2 16.c5 17.Bd3 18.Kc7 19. 0-0 20.Ka6 21.Kc3 22.Qc7 23.g3 24.Kb8 ","check":false,"checkmate":false,"draw":false,"resigned":false,"whiteKingMoved":true,"blackKingMoved":false,"farWhiteRookMoved":false,"farBlackRookMoved":false,"nearWhiteRookMoved":false,"nearBlackRookMoved":false,"whitePlayerView":true,"fiftyMovesCounter":1,"promoting":false,"queensideWhiteRookMoved":false,"queensideBlackRookMoved":false,"kingsideWhiteRookMoved":false,"kingsideBlackRookMoved":false,"lastMove":{"valid":true,"source":{"row":2,"col":0},"target":{"row":0,"col":1},"piece":{"color":"black","pieceType":2},"promotion":false,"ennPassant":false,"capturedPiece":null,"hitSquare":null,"turn":"black","castling":false,"whitePlayerView":true}}`;
//         game.startNewGame()
//         game.loadGame(state);
//         source = { row: 5, col: 2 }
//         target = { row: 3, col: 1 }
//         let move = game.makeMove(source, target, "white");
//         let brain = new Brain();
//         let brainMove = await brain.nextMove(game);
//         console.log("Selected move: " + game.getPGNMoveNotation(brainMove) + ", score=" + brainMove.score);

//         //assert.ok(move.score >= 0, "wrong move");
//     }).timeout(10000)
// })


describe("PGN Move Tests", () => {

    it("e4", () => {
        const move = game.parsePGNMove("e4", "white");
        assert.equal(move.source, null);
        assert.deepEqual(move.target, { row: 4, col: 4 });
        assert.equal(move.moveStr, "e4");
        assert.equal(move.piece, game.PAWN);
    });
    it("O-O white", () => {
        const move = game.parsePGNMove("O-O", "white");
        assert.equal(move.castling, true);
        assert.equal(move.kingSide, true);
        assert.equal(move.moveStr, "O-O");
        assert.equal(move.piece, game.KING);
        assert.deepEqual(move.target, { row: 7, col: 6 });
    });

    it("O-O-O white", () => {
        const move = game.parsePGNMove("O-O-O", "white");
        assert.equal(move.castling, true);
        assert.equal(move.queenSide, true);
        assert.equal(move.moveStr, "O-O-O");
        assert.equal(move.piece, game.KING);
        assert.deepEqual(move.target, { row: 7, col: 2 });
    });

    it("O-O black", () => {
        const move = game.parsePGNMove("O-O", "black");
        assert.equal(move.castling, true);
        assert.equal(move.kingSide, true);
        assert.equal(move.moveStr, "O-O");
        assert.equal(move.piece, game.KING);
        assert.deepEqual(move.target, { row: 0, col: 6 });
    });

    it("O-O-O black", () => {
        const move = game.parsePGNMove("O-O-O", "black");
        assert.equal(move.castling, true);
        assert.equal(move.queenSide, true);
        assert.equal(move.moveStr, "O-O-O");
        assert.equal(move.piece, game.KING);
        assert.deepEqual(move.target, { row: 0, col: 2 });
    });

    it("Pawn Move", () => {
        game.loadGame(initalState);
        const move = game.convertPGNMove({ moveStr: "e4", color: "white" });
        assert.deepEqual(move.source, { row: 6, col: 4 });
        assert.deepEqual(move.target, { row: 4, col: 4 });
        assert.equal(move.valid, true);
        assert.equal(move.moveStr, "e4");
        assert.equal(move.piece, game.PAWN);
    });

    it("Pawn Capture", () => {
        game.loadGame(initalState);
        const move = game.convertPGNMove({ moveStr: "exd4", color: "white" });
        assert.deepEqual(move.source, { row: 5, col: 4 });
        assert.deepEqual(move.target, { row: 4, col: 3 });
        assert.equal(move.valid, true);
        assert.equal(move.capture, true);
        assert.equal(move.moveStr, "exd4");
        assert.equal(move.piece, game.PAWN);
    });

    it("Pawn Promotion", () => {
        game.loadGame(initalState);
        const move = game.convertPGNMove({ moveStr: "gxh8=Q", color: "white" });
        assert.deepEqual(move.source, { row: 1, col: 6 });
        assert.deepEqual(move.target, { row: 0, col: 7 });
        assert.equal(move.valid, true);
        assert.equal(move.capture, true);
        assert.equal(move.promotedTo, 'Q');
        assert.equal(move.moveStr, "gxh8=Q");
        assert.equal(move.piece, game.PAWN);
    });

    it("Check", () => {
        game.loadGame(initalState);
        const move = game.convertPGNMove({ moveStr: "Qe4+", color: "white" });
        assert.deepEqual(move.target, { row: 4, col: 4 });
        assert.equal(move.valid, true);
        assert.equal(move.check, true);
        assert.equal(move.moveStr, "Qe4+");
        assert.equal(move.piece, game.QUEEN);
    });

    it("Checkmate", () => {
        game.loadGame(initalState);
        const move = game.convertPGNMove({ moveStr: "Qe4#", color: "white" });
        assert.deepEqual(move.target, { row: 4, col: 4 });
        assert.equal(move.valid, true);
        assert.equal(move.checkmate, true);
        assert.equal(move.moveStr, "Qe4#");
        assert.equal(move.piece, game.QUEEN);
    });


    it("Knight Move", () => {
        game.loadGame(initalState);
        const move = game.convertPGNMove({ moveStr: "Nc3", color: "white" });
        assert.deepEqual(move.source, { row: 7, col: 1 });
        assert.deepEqual(move.target, { row: 5, col: 2 });
        assert.equal(move.valid, true);
        assert.equal(move.moveStr, "Nc3");
        assert.equal(move.piece, game.KNIGHT);
    });


});

describe("Rgex", () => {
    it("1", () => {
        const moveRegex = /([RNBKQ])?([a-h])?([1-8])?([x])?([a-h][1-8])?([=][RNBQ])?([+#])?/gm
        let move = "Rxd8";
        move = "Nxb5+"

        move = "f8=Q"
        const array = [...move.matchAll(moveRegex)][0];
        const p = {
            moveStr: array[0],
            piece: ChessGame.PAWN,
        }

        if (array[1]) { p.piece = array[1]; }
        if (array[2] || array[3]) { p.source = { file: array[2], rank: array[3] }; }
        if (array[4]) { p.capture = true; }
        if (array[5]) { p.target = { file: array[5].toString().charAt(0), rank: array[5].toString().charAt(1) } }
        else { p.target = p.source; p.source = null }
        if (array[6]) { p.promotedTo = array[6].toString().charAt(1) }
        if (array[7]) {
            if (array[7] == '+') p.check = true;
            if (array[7] == '#') p.checkmate = true;
        }

        console.log(p)
    })
})



