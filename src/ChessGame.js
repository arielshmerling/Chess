

/**
 * Chess Game State
 */
class ChessGameState {
    board = [
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null]
    ];

    turn = "white";
    capturedPiecesList = [];
    lastMove = null;
    check = false;
    checkmate = false;
    draw = false;
    drawReason = "";
    resigned = "";
    outOfTime = "";
    whiteKingMoved = false;
    blackKingMoved = false;
    farWhiteRookMoved = false;
    farBlackRookMoved = false;
    nearWhiteRookMoved = false;
    nearBlackRookMoved = false;
    whitePlayerView = false;
    fiftyMovesCounter = 0;
}

/**
 * Chess Game
 */
class ChessGame {

    // private fields
    #snapshots = [];
    #undoList = [];
    #moves = [];
    #undoMoves = [];
    #analysis = false;
    #simulation = false;
    #searchMode = false;
    #state = null;
    #gameLength = 60 * 60 * 1.5; // default - 1.5 hours

    //events
    OnUpdate = null;
    OnDraw = null;
    OnCheck = null;
    OnCheckmate = null;
    OnPromotion = null;
    OnUndo = null;
    OnRedo = null;

    async raiseEvent(event, param) {
        if (!this.#analysis) {
            if (event != null) {
                await event(param);
            }
        }
    }

    /**
     * The constructor method for the ChessGame class.
     */
    constructor(isWhitePlayerView = true) {

        this.#state = new ChessGameState();
        this.#state.whitePlayerView = isWhitePlayerView;
        console.log("Chess Game Created");
    }

    //Getters/Setters

    /**
      * Define a getter for the current turn.
      */
    get Turn() {
        // Return the value of turn ("white" or "black")
        return this.#state.turn;
    }

    /**
      * returns true if the game has ended.
      */
    get GameOver() {
        return this.#endOfGame();
    }

    /**
     * Define a getter for the current game view, white view or black view.
     * Determine if the board is flipped or not
     */
    get WhitePlayerView() {
        return this.#state.whitePlayerView;
    }

    /**
     * Set the white player view and flip the board if necessary.
     */
    set WhitePlayerView(value) {
        if (this.#state.whitePlayerView != value) {
            this.#state.whitePlayerView = value;
            this.#flipBoard();
        }
    }

    /**
     * Set the player's timer clocks in seconds
     * @param {int} value
     */
    set GameTimeLength(value) {
        this.#gameLength = value;

    }

    /**
    * Get the game total length in seconds  
    */
    get GameTimeLength() {
        return this.#gameLength;
    }

    /**
    * returns true if the game is out of time  
    */
    get OutOfTime() {
        return this.#state.outOfTime;
    }

    /**
    * update that the game is out of time  
    * * @param {string} value - The color of the player who is out of time 
    */
    set OutOfTime(value) {
        this.#state.outOfTime = value;
    }

    /**
   * returns true if the game is in search mode
   */
    get SearchMode() {
        return this.#searchMode;
    }

    /**
    * update that the game is in Search Mode
    * * @param {string} value - The color of the player who is out of time 
    */
    set SearchMode(value) {
        this.#searchMode = value;
    }

    /**
     * 
 * Get the checkmate state of the game.
 * @return {boolean} Returns true if the game is in Checkmate state
 */
    get Checkmate() {

        return this.#state.checkmate;
    }

    /**
      * 
  * Get the Check state of the game.
  * @returns {boolean} Returns true if the game is in Check state
  */
    get Check() {
        return this.#state.check;
    }

    /**
     * 
 * Get the Draw state of the game.
 * @returns {boolean} Returns true if the game is in Draw state
 */
    get Draw() {
        return this.#state.draw;
    }

    /**
   * 
* Get the Draw reason of the game.
* @returns {string} Returns Draw reason
*/
    get DrawReason() {
        return this.#state.drawReason;
    }

    /**
    * 
    * Get the Game Over reason of the game.
    * @returns {string} Returns the reason why the game ended
    */
    get GameOverReason() {
        if (this.GameOver) {

            if (this.#state.resigned) {
                return `${this.#state.resigned} Player Resigned.`;
            }

            if (this.Checkmate) {
                return `Checkmate. ${this.opponent(this.Turn)} won.`;
            }

            if (this.Draw) {
                return this.DrawReason;
            }
        }
        return "";
    }

    /**
    * 
    * Get the string represents the game result (1-0, 0-1, 1/2-1/2, *).
    * @returns {string} The game result string
    */
    get ResultMove() {
        if (this.GameOver) {

            if (this.Draw) {
                return { moveStr: "1/2-1/2" };
            }

            if (this.Checkmate) {
                if (this.Turn == "black") {
                    return { moveStr: "1-0" };
                }
                else {
                    return { moveStr: "0-1" };
                }
            }

            if (this.#state.resigned && this.#state.resigned != "") {
                if (this.#state.resigned == "black") {
                    return { moveStr: "1-0" };
                }
                else {
                    return { moveStr: "0-1" };
                }
            }

            if (this.#state.outOfTime != "") {
                if (this.#state.outOfTime == "black") {
                    return { moveStr: "1-0" };
                }
                else {
                    return { moveStr: "0-1" };
                }
            }


        }
        return null;
    }

    /**
    * 
    * Returns array of moves since the begining of the game
    */
    get Moves() {
        return this.#moves;
    }

    /**
     * 
     * Returns the last move of the game
     */
    get LastMove() {
        if (this.#moves.length > 0) {
            return this.#moves[this.#moves.length - 1];
        }
        return null;
    }

    /**
    * 
    * Returns the current game state
    */
    get GameState() {

        return this.#state;
    }

    /**
    * 
    * Returns a shorter version of the current game state
    */
    get SavedGameState() {

        return this.#stripState(JSON.stringify(this.#state));
    }

    // public methods 

    /**
     * Start a new game.
     * 
     * This method initializes the game state and board, and sets up any parameters or flags.
     */
    startNewGame(isWhitePlayerView = true) {
        this.#state.whitePlayerView = isWhitePlayerView;
        this.#initGameFlags();
        this.#initBoard();
        this.raiseEvent(this.OnUpdate, this.#state);
        this.#recordState();
    }

    /**
     * Sets the state to indicate that the given player has resigned.
     *
     * @param {string} resignedPlayer The player who has resigned ("white"/"black" or "White"/"Black").
     */
    resign(resignedPlayer) {
        this.#state.resigned = (resignedPlayer && resignedPlayer.toLowerCase()) || "";
    }

    /**
     * Accepts a draw offer made by the given player.
     *
     * @param {string} offeredBy The player who made the draw offer.
     */
    drawOfferAccepted(offeredBy) {
        this.#state.draw = true;
        this.#state.drawReason = offeredBy + " player's draw offer accepted";
        this.raiseEvent(this.OnDraw, this.#state.drawReason);
    }

    /**
     * Validates a move in the game.
     *
     * @param {Object} source - The position of the piece being moved.
     * @param {Object} target - The position where the piece is moving to.
     * @param {Number} color - The color of the player making the move (either ""white"" or ""black"").
     * 
     */
    validateMove(source, target, color) {

        let isValid = false;
        const move = {
            valid: false,
            source: source,
            target: target,
            piece: null,
            reason: "",
            whitePlayerView: this.WhitePlayerView,
        };

        // Check if the source and target coordinates are invalid
        if (source == null || target == null || isNaN(source.row) || isNaN(source.col) || isNaN(target.row) || isNaN(target.col)) {
            move.reason = this.Reasons.INVALID_SOURCE_TARGET;
            return move;
        }

        // Check if the target is out of bounds
        if ((target.row < 0) || (target.col < 0) || (target.row > this.BOARD_ROWS - 1) || (target.col > this.BOARD_COLUMNS - 1)) {
            move.reason = this.Reasons.OUT_OF_BOUNDS;
            return move;
        }

        // Get the piece at the source position
        move.piece = this.#state.board[source.row][source.col];

        // Check if there is no piece at the source position
        if (move.piece == null) {
            move.reason = this.Reasons.NO_SOURCE_PIECE;
            return move;
        }

        // Check if the game has ended
        if (this.#endOfGame()) {
            move.reason = this.Reasons.GAME_OVER;
            return move;
        }

        // Check if a promotion is in progress
        if (this.#state.promoting) {
            move.reason = this.Reasons.PROMOTION_IN_PROGRESS;
            return move;
        }

        // Check if it's not the player's turn
        if (!this.#isValidTurn(source, color)) {
            move.reason = this.Reasons.NOT_YOUR_TURN;
            return move;
        }

        // Check if the piece move is illegal
        if (!this.#isValidPieceMove(source, target, color)) {
            move.reason = this.Reasons.PIECE_MOVE_ILLEGAL;
            return move;
        }

        // Set the initial validity to true
        isValid = true;

        if (this.#state.check) {
            // If player is under attack and can't remove the threat, invalid move
            if (!this.#canRemoveChessThreat(source, target, this.opponent(color))) {
                isValid = false;
            }
        }
        else {
            // If player is not under attack but exposes their king, invalid move
            if (this.#newThreatCreated(source, target, color)) {
                isValid = false;
            }
        }

        // Set the final validity flag
        move.valid = isValid;
        return move;
    }

    /**
    * Returns a list of possible moves from a given source position.
    *
    * @param {Object} sourcePosition - The current position of the piece being considered for a move.
    */
    possibleMoves(sourcePosition) {

        const options = [];
        this.#updateState();
        for (let i = 0; i < this.BOARD_ROWS; i++) {
            for (let j = 0; j < this.BOARD_COLUMNS; j++) {

                const moveObj = this.validateMove(sourcePosition, { row: i, col: j }, this.Turn);
                if (moveObj.valid) {

                    if (moveObj.piece.pieceType == this.PAWN && this.#promotionDone(moveObj.source, moveObj.target, moveObj)) {

                        const queenOption = { ...moveObj }; queenOption.selectedPiece = this.QUEEN; options.push(queenOption);
                        const rookOption = { ...moveObj }; rookOption.selectedPiece = this.ROOK; options.push(rookOption);
                        const bishopOption = { ...moveObj }; bishopOption.selectedPiece = this.BISHOP; options.push(bishopOption);
                        const knightOption = { ...moveObj }; knightOption.selectedPiece = this.KNIGHT; options.push(knightOption);
                        continue;
                    }

                    options.push(moveObj);
                }

            }
        }

        return options;
    }

    /**
     * Returns a list of possible moves to the given target position.
     *
     * @param {object} targetPosition The target position.
     * @example const options = possibleMovesToTarget({ row: 0, col: 1 });
     */
    possibleMovesToTarget(targetPosition) {

        const options = [];
        this.#updateState();
        for (let i = 0; i < this.BOARD_ROWS; i++) {
            for (let j = 0; j < this.BOARD_COLUMNS; j++) {
                const moveObj = this.validateMove({ row: i, col: j }, targetPosition, this.Turn);
                if (moveObj.valid) {
                    if (moveObj.piece.pieceType == this.PAWN && this.#promotionDone(moveObj.source, moveObj.target, moveObj)) {
                        const queenOption = { ...moveObj }; queenOption.selectedPiece = this.QUEEN; options.push(queenOption);
                        const rookOption = { ...moveObj }; rookOption.selectedPiece = this.ROOK; options.push(rookOption);
                        const bishopOption = { ...moveObj }; bishopOption.selectedPiece = this.BISHOP; options.push(bishopOption);
                        const knightOption = { ...moveObj }; knightOption.selectedPiece = this.KNIGHT; options.push(knightOption);
                        continue;
                    }
                    options.push(moveObj);
                }
            }
        }
        return options;
    }

    /**
    * Perform a chess move from the source position to the target position.
    * Assuming the move has already been validated
    *
    * @param {Object} source - The current position of the piece being moved (row, column).
    * @param {Object} target - The target position where the piece will be moved (row, column).
    * @return {Object} The updated game state after the move is made.
    * @example const move = makeMove({ row: 0, col: 1 },{ row: 1, col: 1 });
    */
    makeMove(source, target) {

        const move = {
            valid: true,
            source: source,
            target: target,
            piece: this.#state.board[source.row][source.col],
            promotion: false,
            ennPassant: false,
            capturedPiece: null,
            hitSquare: null,
            turn: this.Turn,
            castling: false,
            whitePlayerView: this.WhitePlayerView,
        };

        this.#simulation = false;
        this.#undoList = [];

        // 1. perform the move
        this.#performMove(move);

        // 2. analyze the status
        this.#analyzeGameStatus(move); // move.turn

        // 3. complete the move
        this.#completeMove();

        return move;
    }

    /**
     * Undo a move by reverting to the previous game state.
     */
    undo() {
        const current = this.#snapshots.pop(); // remove current Snapshot

        const previousSnapshot = this.#snapshots.pop();
        if (previousSnapshot) {

            const previousState = JSON.parse(previousSnapshot);
            this.#state = previousState;
            if (!this.#simulation) {
                this.#undoList.push(current);
                this.raiseEvent(this.OnUndo, this.#moves);
                const lastMoveRemoved = this.#moves.pop();
                this.#undoMoves.push(lastMoveRemoved);
            }
        }
        this.#recordState();
    }

    /**
    * Redo a move by reverting to the previous undo operation.
    */
    redo() {
        const lastUndo = this.#undoList.pop(); // remove current Snapshot
        if (lastUndo) {
            const previousState = JSON.parse(lastUndo);
            this.#state = previousState;
            if (!this.#simulation) {

                const lastMoveRemoved = this.#undoMoves.pop();
                if (lastMoveRemoved) {
                    this.#moves.push(lastMoveRemoved);
                }
                this.raiseEvent(this.OnUpdate, this.#state);
            }
            this.#recordState();
        }
    }

    /**
     * Force an update of the game state.
     *
     * @see OnUpdate for more information on what this function does.
     */
    forceUpdate() {
        if (this.OnUpdate) {
            this.OnUpdate(this.#state);
        }
    }

    /**
     * Completes a promotion by updating the game with the user selected piece.
     *
     * @param {Object} lastMove - The last move made in the game, including the piece being promoted.     
     */
    completePromotion(lastMove) {

        lastMove.moveStr = this.getPGNMoveNotation(lastMove);
        this.#addPiece(lastMove.target.row, lastMove.target.col, lastMove.piece.color, lastMove.selectedPiece);
        this.#state.promoting = false;

        // Safety check: ensure moves array is not empty before accessing last element
        if (this.#moves.length > 0) {
            this.#moves[this.#moves.length - 1] = lastMove;
            
        } else {
            // If moves array is empty, push the move instead
            console.warn("completePromotion: moves array was empty, pushing move instead");
            this.#moves.push(lastMove);
        }
        this.#state.turn = this.opponent(this.Turn);
        this.#updateState();
        this.#analyzeGameStatus(lastMove);
        if (this.OnUpdate) {
            this.OnUpdate(this.#state);
        }
    }

    /** Loads a saved game state from a string representation.
    *
    * @param { savedStateStr } - The JSON - encoded game state to load.
    */
    loadGame(savedStateStr) {
        const loadingState = JSON.parse(savedStateStr);

        // Clear all internal state arrays to prevent corruption from previous games
        // This is critical when reusing a ChessGame instance (e.g., in worker threads)
        this.#snapshots = [];
        this.#moves = [];
        this.#undoList = [];
        this.#undoMoves = [];

        this.#state = loadingState;

        // Safety check: if promoting flag is set but moves array is empty, reset promoting
        // This can happen if state was corrupted or loaded from an inconsistent state
        if (this.#state.promoting && this.#moves.length === 0) {
            console.warn("loadGame: promoting flag was true but moves array is empty, resetting promoting");
            this.#state.promoting = false;
        }

        this.#recordState();
        if (this.OnUpdate) {
            this.OnUpdate(this.#state);
        }
    }

    /** Loads a saved game state from a string representation.
        *
        * @param { savedStateStr } - The JSON - encoded game state to load.
        */
    loadMoves(moves) {
        this.#moves = moves;
        if (this.OnUpdate) { this.OnUpdate(this.#state); }
    }

    /**
     * Flips a chess move by reversing its source and target squares.
     *
     * @param {Object} move - The chess move to flip.
     * @return {Object} The flipped chess move.
     */
    flipMove(move) {
        const clone = this.cloneMove(move);
        if (clone) {
            clone.target.col = this.BOARD_COLUMNS - 1 - move.target.col;
            clone.target.row = this.BOARD_ROWS - 1 - move.target.row;
            clone.source.col = this.BOARD_COLUMNS - 1 - move.source.col;
            clone.source.row = this.BOARD_ROWS - 1 - move.source.row;
        }
        return clone;
    }

    cloneMove(move) {
        const clone = { ...move };

        clone.source = this.square(move.row, move.col);
        clone.source = this.square(move.row, move.col);
        clone.piece = { ...move.piece };
        return clone;
    }

    parsePGNMove(move, color) {

        const moveRegex = /([RNBKQ])?([a-h])?([1-8])?([x])?([a-h][1-8])?([=][RNBQ])?([+#])?/gm;
        const cols = "abcdefgh";
        const array = [...move.matchAll(moveRegex)][0];
        let col, row;
        const result = {
            moveStr: array[0],
            piece: this.PAWN,
        };

        if (move.indexOf("O-O-O") != -1) {
            if (color == "white") { col = 2; row = 7; }
            else { col = 2; row = 0; }
            result.castling = true;
            result.queenSide = true;
            result.piece = this.letterToPiece("K");
            result.target = this.square(row, col);
            result.moveStr = move;
            result.check = move.indexOf("+") != -1;
            result.checkmate = move.indexOf("#") != -1;
            return result;
        }
        else if (move.indexOf("O-O") != -1) {
            if (color == "white") { col = 6; row = 7; }
            else { col = 6; row = 0; }
            result.castling = true;
            result.kingSide = true;
            result.piece = this.letterToPiece("K");
            result.target = this.square(row, col);
            result.moveStr = move;
            result.check = move.indexOf("+") != -1;
            result.checkmate = move.indexOf("#") != -1;
            return result;
        }

        else {
            if (array[1]) { result.piece = this.letterToPiece(array[1]); }
            if (array[2]) { col = cols.indexOf(array[2]); }
            if (array[3]) { row = this.BOARD_ROWS - parseInt(array[3]); }
            if (col !== undefined || row !== undefined) {
                result.source = { row: row, col: col };
            }

            if (array[4]) { result.capture = true; }
            if (array[5]) {
                result.target = { col: cols.indexOf(array[5].charAt(0)), row: this.BOARD_ROWS - parseInt(array[5].charAt(1)) };
            }
            else {
                result.target = result.source;
                result.source = null;
            }
            if (array[6]) { result.promotedTo = array[6].charAt(1); }
            if (array[7]) {
                if (array[7] == "+") { result.check = true; }
                if (array[7] == "#") { result.checkmate = true; }
            }
            return result;
        }
    }

    isResultMove(move) {
        if (move.moveStr == "1/2-1/2" || move.moveStr == "0-1" || move.moveStr == "1-0" || move.moveStr == "*") { return true; }
        return false;
    }

    convertPGNMove(pgnMove) {

        const move = this.parsePGNMove(pgnMove.moveStr, pgnMove.color);
        const source = this.#findSource(move, pgnMove.color);
        move.source = source;
        move.whitePlayerView = true;
        move.valid = true;

        return move;
    }

    isAmbiguousMove(move) {
        let ambiguousInfo = null;
        this.#analysis = true;
        this.undo();
        const options = this.possibleMovesToTarget(move.target);
        const moreSpecificOptions = options.filter(option =>
            option.piece.pieceType == move.piece.pieceType && option.piece.color == move.piece.color);

        if (moreSpecificOptions.length > 1 && !moreSpecificOptions[0].promotion) {
            ambiguousInfo = {};
            ambiguousInfo.sameCol = moreSpecificOptions[0].source.col == moreSpecificOptions[1].source.col;
        }

        this.redo();
        this.#analysis = false;

        return ambiguousInfo;
    }

    getPGNMoveNotation(move) {

        if (this.SearchMode) {
            return;
        }

        const letters = ["a", "b", "c", "d", "e", "f", "g", "h"];
        const moveString = [];

        if (move.castling) {
            return move.kingsideCastling ? "O-O" : "O-O-O";
        }

        const PIECE = 0, SOURCE_ROW = 2, SOURCE_COL = 1, CAPTURE = 3, TARGET_COL = 4, TARGET_ROW = 5, PROMOTION = 6, PROMOTION_PIECE = 7, ALERT = 8;


        moveString[PIECE] = this.pieceToLetter(move.piece.pieceType);
        const ambiguousInfo = this.isAmbiguousMove(move);
        if (ambiguousInfo) {
            if (ambiguousInfo.sameCol) {
                moveString[SOURCE_ROW] = this.#state.whitePlayerView ?
                    this.BOARD_ROWS - move.source.row :
                    move.source.row + 1;
            }
            else {
                moveString[SOURCE_COL] = this.#state.whitePlayerView ?
                    letters[move.source.col] :
                    letters[this.BOARD_COLUMNS - move.source.col - 1];
            }
        }

        if (move.hitSquare) {
            moveString[CAPTURE] = "x";
            if (move.piece.pieceType == this.PAWN) {
                moveString[SOURCE_COL] = this.#state.whitePlayerView ?
                    letters[move.source.col] :
                    letters[this.BOARD_COLUMNS - move.source.col - 1];
            }
        }


        moveString[TARGET_COL] = this.#state.whitePlayerView ?
            letters[move.target.col] :
            letters[this.BOARD_COLUMNS - move.target.col - 1];

        moveString[TARGET_ROW] = this.#state.whitePlayerView ?
            this.BOARD_ROWS - move.target.row :
            move.target.row + 1;

        if (move.promotion) {
            moveString[PROMOTION] = "=";
            moveString[PROMOTION_PIECE] = this.pieceToLetter(move.selectedPiece);
        }

        if (move.check) {
            moveString[ALERT] = "+";
        }

        if (move.checkmate) {
            moveString[ALERT] = "#";
        }

        const result = moveString.join("");
        return result;
    }

    letterToPiece(letter) {
        switch (letter) {

            case "R":
                return this.ROOK;
            case "N":
                return this.KNIGHT;
            case "B":
                return this.BISHOP;
            case "K":
                return this.KING;
            case "Q":
                return this.QUEEN;
            default:
                return this.PAWN;
        }
    }

    opponent(color) {
        if (color == "white") { return "black"; }
        return "white";
    }

    colorName(color) {
        if (color == "white") { return "White"; }
        else if (color == "black") { return "Black"; }
        else { return "ERROR"; }


    }

    pieceName(piece) {

        switch (piece) {
            case this.PAWN:
                return "Pawn";
            case this.ROOK:
                return "Rook";
            case this.KNIGHT:
                return "Knight";
            case this.BISHOP:
                return "Bishop";
            case this.KING:
                return "King";
            case this.QUEEN:
                return "Queen";
            default:
                return "Error";
        }
    }


    pieceToLetter(piece) {
        switch (piece) {

            case this.ROOK:
                return "R";
            case this.KNIGHT:
                return "N";
            case this.BISHOP:
                return "B";
            case this.KING:
                return "K";
            case this.QUEEN:
                return "Q";
            default:
                return "";
        }
    }

    square = (i, j) => {
        return { row: i, col: j };
    };


    //private methods

    #flipBoard() {
        const newBoard = Array.from({ length: this.BOARD_ROWS }, () => Array(this.BOARD_COLUMNS).fill(null));
        for (let i = 0; i < this.BOARD_ROWS; i++) {
            for (let j = 0; j < this.BOARD_COLUMNS; j++) {
                newBoard[i][j] = this.#state.board[this.BOARD_ROWS - 1 - i][this.BOARD_COLUMNS - 1 - j];
            }
        }

        if (this.#state.lastMove) {
            this.#state.lastMove.target.col = this.BOARD_COLUMNS - 1 - this.#state.lastMove.target.col;
            this.#state.lastMove.target.row = this.BOARD_ROWS - 1 - this.#state.lastMove.target.row;
        }

        this.#state.board = newBoard;
        this.#updateState();
        if (this.OnUpdate) { this.OnUpdate(this.#state); }
    }

    #initBoard() {

        const pos = this.#getBoardViewSettings();

        this.#state.board = Array.from({ length: this.BOARD_ROWS }, () => Array(this.BOARD_COLUMNS).fill(null));
        this.#addPiece(pos.whiteRow, 0, "white", this.ROOK);
        this.#addPiece(pos.whiteRow, 1, "white", this.KNIGHT);
        this.#addPiece(pos.whiteRow, 2, "white", this.BISHOP);
        this.#addPiece(pos.whiteRow, pos.queenCol, "white", this.QUEEN);
        this.#addPiece(pos.whiteRow, pos.kingCol, "white", this.KING);
        this.#addPiece(pos.whiteRow, 5, "white", this.BISHOP);
        this.#addPiece(pos.whiteRow, 6, "white", this.KNIGHT);
        this.#addPiece(pos.whiteRow, 7, "white", this.ROOK);

        this.#addPiece(pos.blackRow, 0, "black", this.ROOK);
        this.#addPiece(pos.blackRow, 1, "black", this.KNIGHT);
        this.#addPiece(pos.blackRow, 2, "black", this.BISHOP);
        this.#addPiece(pos.blackRow, pos.queenCol, "black", this.QUEEN);
        this.#addPiece(pos.blackRow, pos.kingCol, "black", this.KING);
        this.#addPiece(pos.blackRow, 5, "black", this.BISHOP);
        this.#addPiece(pos.blackRow, 6, "black", this.KNIGHT);
        this.#addPiece(pos.blackRow, 7, "black", this.ROOK);

        for (let i = 0; i < this.BOARD_COLUMNS; i++) {
            this.#addPiece(pos.whitePawnRow, i, "white", this.PAWN);
            this.#addPiece(pos.blackPawnRow, i, "black", this.PAWN);
        }

    }

    #addPiece(row, column, color, pieceType) {

        const piece = {
            color: color,
            pieceType: pieceType,
        };
        this.#state.board[row][column] = piece;
    }

    #getBoardViewSettings() {

        if (this.#state.whitePlayerView) {
            return {
                whiteRow: 7,
                blackRow: 0,
                whitePawnRow: 6,
                blackPawnRow: 1,
                kingCol: 4,
                queenCol: 3,
                forward: -1,
                ennPassantRow: 3,
                whitePromotionRow: 0,
                blackPromotionRow: 7
            };
        }
        else {
            return {
                whiteRow: 0,
                blackRow: 7,
                whitePawnRow: 1,
                blackPawnRow: 6,
                kingCol: 3,
                queenCol: 4,
                forward: 1,
                ennPassantRow: 4,
                whitePromotionRow: 7,
                blackPromotionRow: 0
            };
        }
    }

    #initGameFlags() {


        this.#state.turn = "white";
        this.#state.resigned = "";
        this.#state.checkmate = false;
        this.#state.check = false;
        this.#state.draw = false;
        this.#simulation = false;
        this.#state.promoting = false;
        this.#state.lastMove = undefined;
        this.#state.capturedPiecesList = [];
        this.#state.whiteKingMoved = false;
        this.#state.blackKingMoved = false;
        this.#state.queensideWhiteRookMoved = false;
        this.#state.queensideBlackRookMoved = false;
        this.#state.kingsideWhiteRookMoved = false;
        this.#state.kingsideBlackRookMoved = false;
        this.#state.outOfTime = "";
        this.#snapshots = [];
        this.#moves = [];
        this.#undoList = [];
        this.#analysis = false;
    }

    async #performMove(move) {

        if (move == null) {
            console.log("ERROR Perfoming Null move");
        }

        if (move.piece == null) {
            console.log("ERROR move.piece == Null ");
        }

        const source = move.source;
        const target = move.target;
        // record capturing
        const piece = this.#state.board[target.row][target.col];
        if (piece) {
            this.#state.capturedPiecesList.push(piece);
            this.#state.capturedPiecesList.sort((a, b) => b.pieceType - a.pieceType);
            //displayMessage(`Captured a ${ColorName(piece.color)} ${PieceName(piece.pieceType)}`);
            //console.log("capture a piece:" + piece.pieceType)
            move.capturedPiece = piece;
            move.hitSquare = { row: target.row, col: target.col };
        }


        //update board
        this.#state.board[target.row][target.col] = this.#state.board[source.row][source.col];
        this.#state.board[source.row][source.col] = null;


        // Special Rook events

        if (move.piece.pieceType == this.ROOK) {
            const kingsideRookColumn = (this.#state.whitePlayerView ? 7 : 0);
            const queensideRookColumn = (this.#state.whitePlayerView ? 0 : 7);

            this.#state.kingsideWhiteRookMoved = this.#state.kingsideWhiteRookMoved || (move.piece.color == "white" && move.source.col == kingsideRookColumn);
            this.#state.queensideWhiteRookMoved = this.#state.queensideWhiteRookMoved || (move.piece.color == "white" && move.source.col == queensideRookColumn);
            this.#state.kingsideBlackRookMoved = this.#state.kingsideBlackRookMoved || (move.piece.color == "black" && move.source.col == kingsideRookColumn);
            this.#state.queensideBlackRookMoved = this.#state.queensideBlackRookMoved || (move.piece.color == "black" && move.source.col == queensideRookColumn);
        }

        // Special King events
        if (move.piece.pieceType == this.KING) {

            if (this.#castlingMoveDone(source, target)) {
                this.#completeCastling(source, target, move);
            }

            if (move.piece.pieceType == this.KING && move.piece.color == "white") {
                this.#state.whiteKingMoved = true;
            }
            if (move.piece.pieceType == this.KING && move.piece.color == "black") {
                this.#state.blackKingMoved = true;
            }
        }

        // Special Pawn events
        if (move.piece.pieceType == this.PAWN) {
            if (this.#ennPassantDone(source, target, move)) {

                this.#state.capturedPiecesList.push(move.capturedPiece);
                this.#state.capturedPiecesList.sort((a, b) => b.pieceType - a.pieceType);
                //console.log("capture a piece by enn Passant:" + move.capturedPiece.pieceType)
                this.#state.board[move.hitSquare.row][move.hitSquare.col] = null;
            }

            if (this.#promotionDone(source, target, move)) {
                this.#state.promoting = true;
                if (this.OnPromotion && !this.#simulation) {
                    
                    this.raiseEvent(this.OnPromotion, this.Turn);
                    //this.#recordState(); //??
                }
                //console.log(`Promotion Move performed. Pending Selection piece...`);
            }
        }

        // 50 moves rule - If a piece was taken or a Pawn moved
        if (move.piece.pieceType == this.PAWN || move.capturedPiece != null) {
            this.#state.fiftyMovesCounter = 0;
        }
        else {
            this.#state.fiftyMovesCounter++;
        }

        this.#state.lastMove = move;
        if (!this.#state.promoting) {   
            this.#state.turn = this.opponent(this.Turn);
        }
        this.#recordState();
        if (!this.#simulation) {
            move.moveStr = this.getPGNMoveNotation(move);
            this.#moves.push(move);
        }
    }

    #analyzeGameStatus(move) {

        const threateningColor = move.piece.color;


        if (this.#isCheck(threateningColor)) {

            if (!this.#simulation) {
                move.check = true;
                this.#state.check = true;
                this.#updateState();
                this.raiseEvent(this.OnCheck, this.Turn);
            }

            if (this.#isCheckMate(threateningColor)) {
                if (!this.#simulation) {
                    move.checkmate = true;
                    this.#state.checkmate = true;
                    this.#updateState();
                    this.raiseEvent(this.OnCheckmate, this.opponent(this.Turn));
                }
            }
        }
        else {

            this.#state.check = false;
            this.#updateState();

            if (!this.#state.promoting && this.#isCheckMate((threateningColor))) {
                if (!this.#simulation) {
                    move.draw = true;
                    this.#state.draw = true;
                    this.#state.drawReason = "Stalemate";
                    this.#updateState();
                    this.raiseEvent(this.OnDraw, "Stalemate");

                }

            }

        }

        if (this.#state.fiftyMovesCounter == 50) {
            //console.log("Draw - 50 Moves without a capture or pawn movement!")
            if (!this.#simulation) {
                move.draw = true;
                this.#state.draw = true;
                this.#state.drawReason = "50 Moves";
                this.#updateState();
                this.raiseEvent(this.OnDraw, "50 Moves");
            }
        }

        if (this.#insufficientMaterials()) {
            if (!this.#simulation) {
                move.draw = true;
                this.#state.draw = true;
                this.#state.drawReason = "insufficient Materials";
                this.#updateState();

                this.raiseEvent(this.OnDraw, "insufficient Materials");
            }
        }

        if (this.#threefoldRepetition()) {


            if (!this.#simulation) {
                move.draw = true;
                this.#state.draw = true;
                this.#state.drawReason = "Threefold Repetition";
                this.#updateState();
                this.raiseEvent(this.OnDraw, "Threefold Repetition");
            }
        }

    }

    #completeMove() {

        if (this.#moves.length > 0) {
            const lastMove = this.#moves.pop();
            lastMove.moveStr = this.getPGNMoveNotation(lastMove);
            this.#moves.push(lastMove);
        }

        if (this.OnUpdate) { this.OnUpdate(this.#state); }
    }

    #castlingMoveDone(source, target) {
        return ((source.row == target.row) && (Math.abs(source.col - target.col) == 2));
    }

    #completeCastling(source, target, move) {

        let rookSourceColOffset, rookTargetColOffset;
        if (this.#state.whitePlayerView) {
            rookSourceColOffset = (source.col > target.col) ? -2 : 1;
            rookTargetColOffset = (source.col > target.col) ? 1 : -1;
        }
        else {
            rookSourceColOffset = (source.col > target.col) ? -1 : 2;
            rookTargetColOffset = (source.col > target.col) ? 1 : -1;
        }
        this.#state.board[target.row][target.col + rookTargetColOffset] = this.#state.board[target.row][target.col + rookSourceColOffset];
        this.#state.board[target.row][target.col + rookSourceColOffset] = null;

        move.castling = true;

        if (this.#state.whitePlayerView) {
            move.kingsideCastling = rookSourceColOffset == 1;
        }
        else {
            move.kingsideCastling = rookSourceColOffset == -1;
        }

    }

    #promotionDone(source, target, move) {

        const settings = this.#getBoardViewSettings();

        if (move.piece.pieceType == this.PAWN &&
            (this.Turn == "white" && target.row == settings.whitePromotionRow) ||
            (this.Turn == "black" && target.row == settings.blackPromotionRow)) {
            move.promotion = true;
            return true;
        }
    }

    #ennPassantDone(source, target, move) {

        const settings = this.#getBoardViewSettings();

        // commenting out this code, target cell will always be occupied by a pawn since we've just did that, in previous step in the calling method
        //if (this.#state.board[target.row][target.col] == null || this.#state.board[target.row][target.col].pieceType != this.PAWN)
        //    return false;

        if (this.Turn == "black") { //"black"
            settings.forward *= -1;
            settings.ennPassantRow += settings.forward;
        }

        // En passant Left
        if (source.row == settings.ennPassantRow &&          // Pawn is on the ennPassant Row
            //this.#state.board[target.row][target.col] == null &&         // Target Square is empty
            source.row + settings.forward == target.row &&   // Target is one row ahead
            source.col - 1 == target.col &&                  // Target is one column to the left
            this.#state.board[source.row][source.col - 1] != null &&     // Square to the left isn't empty, and
            this.#state.board[source.row][source.col - 1].color == this.opponent(this.Turn) && // occupied by an opponent piece
            this.#state.lastMove.piece.pieceType == this.PAWN &&                         // the last moved piece was a pawn
            this.#state.lastMove.piece.color == this.opponent(this.Turn) &&              // the last moved pawn was opponent
            this.#state.lastMove.target.row == settings.ennPassantRow && // the last moved pawn arrived to the enn passant row
            Math.abs(this.#state.lastMove.source.row - this.#state.lastMove.target.row) == 2 && // the last move was double move
            this.#state.lastMove.target.col == source.col - 1            // the last moved pawn arrived to the enn passant col
        ) {
            move.capturedPiece = this.#state.board[this.#state.lastMove.target.row][this.#state.lastMove.target.col];
            move.hitSquare = { row: source.row, col: source.col - 1 };
            move.ennPassant = true;
            return true;
        }


        // En passant Right
        if (source.row == settings.ennPassantRow &&
            //this.#state.board[target.row][target.col] == null &&
            source.row + settings.forward == target.row &&
            source.col + 1 == target.col &&
            this.#state.board[source.row][source.col + 1] != null &&
            this.#state.board[source.row][source.col + 1].color == this.opponent(this.Turn) &&
            this.#state.lastMove.piece.pieceType == this.PAWN &&
            this.#state.lastMove.piece.color == this.opponent(this.Turn) &&
            this.#state.lastMove.target.row == settings.ennPassantRow &&
            Math.abs(this.#state.lastMove.source.row - this.#state.lastMove.target.row) == 2 && // the last move was double move
            this.#state.lastMove.target.col == source.col + 1

        ) {
            move.capturedPiece = this.#state.board[source.row][source.col + 1];
            move.hitSquare = { row: source.row, col: source.col + 1 };
            move.ennPassant = true;
            return true;
        }
        return false;

    }

    #isValidTurn(source, color) {
        return this.#state.board[source.row][source.col] != null &&
            this.#state.board[source.row][source.col].color == color;
    }

    #isValidPieceMove(source, target, color) {

        const sourcePiece = this.#state.board[source.row][source.col];
        const pieceType = sourcePiece.pieceType;

        switch (pieceType) {
            case this.PAWN:
                return this.#validatePawnMove(source, target, color);
            case this.ROOK:
                return this.#validateRookMove(source, target, color);
            case this.KNIGHT:
                return this.#validateKnightMove(source, target, color);
            case this.BISHOP:
                return this.#validateBishopMove(source, target, color);
            case this.QUEEN:
                return this.#validateQueenMove(source, target, color);
            case this.KING:
                return this.#validateKingMove(source, target, color);
            default:
                console.log("Unknown Piece");
                return false;
        }
    }

    #validatePawnMove(source, target, color) {

        const settings = this.#getBoardViewSettings();

        if (this.Turn == "black") { //"black"
            settings.forward *= -1;
            settings.ennPassantRow += settings.forward;
        }

        // General Move  - One step forward, same column, no piece in target Square
        if (source.row + settings.forward == target.row &&
            source.col == target.col &&
            (this.#state.board[target.row][target.col] == null)
        ) {
            return true;
        }

        // First Move (Double step) - Two steps forward , same column, pwn on his inital position, no piece with the same color in target Square, no piece on the skipping Square  
        if (source.row + settings.forward * 2 == target.row &&
            source.col == target.col &&
            (source.row == settings.whitePawnRow && this.Turn == "white" || source.row == settings.blackPawnRow && this.Turn == "black") &&
            (this.#state.board[target.row][target.col] == null) &&
            (this.#state.board[source.row + settings.forward][target.col] == null)

        ) {
            return true;
        }

        // Hit
        if (source.row + settings.forward == target.row &&
            (source.col + 1 == target.col || source.col - 1 == target.col) &&
            (this.#state.board[target.row][target.col] != null &&
                this.#state.board[target.row][target.col].color == this.opponent(this.Turn))
        ) {
            return true;
        }


        // En passant Left
        if (source.row == settings.ennPassantRow && this.#state.board[target.row][target.col] == null &&
            source.row + settings.forward == target.row &&
            source.col - 1 == target.col &&
            this.#state.board[source.row][source.col - 1] != null &&
            this.#state.board[source.row][source.col - 1].color == this.opponent(color) &&
            this.#state.lastMove.piece.pieceType == this.PAWN &&
            this.#state.lastMove.piece.color == this.opponent(color) &&
            this.#state.lastMove.target.row == settings.ennPassantRow &&
            this.#state.lastMove.target.col == source.col - 1

        ) { return true; }

        // En passant Right
        if (source.row == settings.ennPassantRow && this.#state.board[target.row][target.col] == null &&
            source.row + settings.forward == target.row &&
            source.col + 1 == target.col &&
            this.#state.board[source.row][source.col + 1] != null &&
            this.#state.board[source.row][source.col + 1].color == this.opponent(color) &&
            this.#state.lastMove.piece.pieceType == this.PAWN &&
            this.#state.lastMove.piece.color == this.opponent(color) &&
            this.#state.lastMove.target.row == settings.ennPassantRow &&
            this.#state.lastMove.target.col == source.col + 1
        ) { return true; }

        return false;
    }

    #validateRookMove(source, target) {

        //let settings = #getBoardViewSettings();
        let valid = false;

        // if target is empty or has opponenet piece
        if (this.#state.board[target.row][target.col] == null || this.#state.board[target.row][target.col].color == this.opponent(this.Turn)) {

            // If the move is horizontal
            if (target.row == source.row) {
                // check if the move is to the right or to the left
                if (source.col > target.col) {
                    // Making sure that each Square on the path is empty                        
                    for (let i = source.col - 1; i > target.col; i--) {
                        if (this.#state.board[target.row][i] != null) { return false; }
                    }


                    // If the loop haven't caused exiting the , then it's OK.
                    valid = true;

                }
                else {
                    for (let i = source.col + 1; i < target.col; i++) {
                        if (this.#state.board[target.row][i] != null) { return false; }
                    }

                    valid = true;

                }
            } else {
                // If the movement isn't horizontal
                //If the movement is vertical
                if (source.col == target.col) {
                    if (source.row > target.row) {
                        for (let i = source.row - 1; i > target.row; i--) {
                            if (this.#state.board[i][target.col] != null) { return false; }
                        }
                        valid = true;
                    }
                    else {

                        for (let i = source.row + 1; i < target.row; i++) {
                            if (this.#state.board[i][target.col] != null) { return false; }
                        }
                        valid = true;
                    }


                }
            }
        }

        if (valid) { return true; }


        return false;
    }

    #validateQueenMove(source, target) {
        if (this.#state.board[target.row][target.col] == null || this.#state.board[target.row][target.col].color == this.opponent(this.Turn)) {
            const bishopValidation = this.#validateBishopMove(source, target);
            const rookValidation = this.#validateRookMove(source, target);
            return bishopValidation || rookValidation;
        }
    }

    #validateKnightMove(source, target) {

        if (this.#state.board[target.row][target.col] == null || this.#state.board[target.row][target.col].color == this.opponent(this.Turn)) {
            if (Math.abs(target.row - source.row) == 1 && Math.abs(target.col - source.col) == 2 ||
                Math.abs(target.row - source.row) == 2 && Math.abs(target.col - source.col) == 1) { return true; }
            else { return false; }
        }
    }

    #validateBishopMove(source, target) {

        let stepRow, j;

        // If the taget color is the same as the piece's color
        if (this.#state.board[target.row][target.col] == null || this.#state.board[target.row][target.col].color == this.opponent(this.Turn)) {
            // Bishop can move only on his own color's Squares (Diagonally)
            if ((source.row + source.col) % 2 == (target.row + target.col) % 2) {
                //Diagonal Check                        
                if ((Math.abs(target.row - source.row) == Math.abs(target.col - source.col))) {
                    // going down
                    if (source.row > target.row) {
                        stepRow = -1;//loop counter decreases
                        j = source.col;
                        // the path verifying loop doesn't include the original and the target Square,
                        // only the Squares in the middle of the path
                        //**********************                            
                        for (let i = source.row + stepRow; i > target.row; i += stepRow) {
                            // if (target.row > source.row) {
                            //     if (target.col > source.col)
                            //         j += stepRow;
                            //     else
                            //         j += (stepRow * -1);
                            // }
                            // else {
                            if (target.col > source.col) { j += (stepRow * -1); }
                            else { j += stepRow; }
                            // }

                            if (this.#state.board[i][j] != null) { return false; }
                        }
                    }
                    else {
                        stepRow = 1; //loop counter increases   
                        j = source.col;
                        // the path verifying loop doesn't include the original and the target Square,
                        // only the Squares in the middle of the path
                        //**********************                            
                        for (let i = source.row + stepRow; i < target.row; i += stepRow) {
                            //if (target.row > source.row) {
                            if (target.col > source.col) { j += stepRow; }
                            else { j += (stepRow * -1); }

                            if (this.#state.board[i][j] != null) { return false; }
                        }
                    }
                    return true;
                }
            }
        }
        return false;
    }

    #inBounds(row, col) {
        if (row < this.BOARD_ROWS &&
            row >= 0 &&
            col < this.BOARD_COLUMNS &&
            col >= 0) { return true; }
        return false;
    }

    #oppnnentKing(row, col) {

        if (!this.#inBounds(row, col)) { return false; }

        if (this.#state.board[row][col] &&
            this.#state.board[row][col].pieceType == this.KING &&
            this.#state.board[row][col].color == this.opponent(this.Turn)) { return true; }
        return false;
    }

    #validateKingMove(source, target, color) {

        // if there a king in the target Square
        if (this.#state.board[target.row][target.col] && this.#state.board[target.row][target.col].pieceType == this.KING) { return false; }


        // if the original and the target Square are the same, this isn't a move - exit method  
        // needed only for Check verification, because according to the UI, this cannot be done at all

        // can't happan ,because of previous check
        // if ((source.row == target.row) && (source.col == target.col))
        //     return false;


        // target Square is not in the opponent king area
        if (this.#oppnnentKing(target.row + 1, target.col + 1)) { return false; }
        if (this.#oppnnentKing(target.row + 1, target.col)) { return false; }
        if (this.#oppnnentKing(target.row + 1, target.col - 1)) { return false; }
        if (this.#oppnnentKing(target.row, target.col + 1)) { return false; }
        if (this.#oppnnentKing(target.row, target.col - 1)) { return false; }
        if (this.#oppnnentKing(target.row - 1, target.col + 1)) { return false; }
        if (this.#oppnnentKing(target.row - 1, target.col)) { return false; }
        if (this.#oppnnentKing(target.row - 1, target.col - 1)) { return false; }

        // if(#underThreat())


        if (this.#underThreat(this.square(target.row, target.col), this.opponent(color))) { return false; }


        if (this.#state.board[target.row][target.col] == null || this.#state.board[target.row][target.col].color == this.opponent(color)) {

            // regular king move
            if (Math.abs(source.row - target.row) <= 1 && Math.abs(source.col - target.col) <= 1) {
                return true;
            }

            // castling check 
            if ((source.row == target.row) && (Math.abs(source.col - target.col) == 2)) {
                if ((color == "white" && !this.#state.whiteKingMoved) || (color == "black" && !this.#state.blackKingMoved)) {

                    if (this.#state.check) { return false; }


                    // check rook didn't move yet
                    const kingsideKingTargetColumn = (this.#state.whitePlayerView ? 6 : 1);
                    const queensideKingTargetColumn = (this.#state.whitePlayerView ? 2 : 5);

                    if (color == "white" && target.col == kingsideKingTargetColumn && this.#state.kingsideWhiteRookMoved) {
                        // console.log("can't castle due to kingside white rook move")
                        return false;
                    }

                    if (color == "white" && target.col == queensideKingTargetColumn && this.#state.queensideWhiteRookMoved) {
                        // console.log("can't castle due to queenside white rook move")
                        return false;
                    }

                    if (color == "black" && target.col == kingsideKingTargetColumn && this.#state.kingsideBlackRookMoved) {
                        //   console.log("can't castle due to kingside black rook move")
                        return false;
                    }

                    if (color == "black" && target.col == queensideKingTargetColumn && this.#state.queensideBlackRookMoved) {
                        //   console.log("can't castle due to queenside Black rook move")
                        return false;
                    }

                    //Check path is clear

                    if (this.#state.whitePlayerView) {
                        // queenside
                        if (target.col < source.col) {
                            if (this.#state.board[source.row][source.col - 1] != null || this.#underThreat(this.square(source.row, source.col - 1), this.opponent(color)) ||
                                this.#state.board[source.row][source.col - 2] != null || this.#underThreat(this.square(source.row, source.col - 2), this.opponent(color)) ||
                                this.#state.board[source.row][source.col - 3] != null) {
                                //console.log("Large castling not possible area is not clear (White View)")
                                return false;
                            }
                        }
                        // king side
                        else {
                            if (this.#state.board[source.row][source.col + 1] != null || this.#underThreat(this.square(source.row, source.col + 1), this.opponent(color)) ||
                                this.#state.board[source.row][source.col + 2] != null || this.#underThreat(this.square(source.row, source.col + 2), this.opponent(color))) {
                                // console.log("Small castling not possible area is not clear (White View)")
                                return false;
                            }
                        }
                    }
                    else { //Black View
                        //kingside
                        if (target.col < source.col) {
                            if (this.#state.board[source.row][source.col - 1] != null || this.#underThreat(this.square(source.row, source.col - 1), this.opponent(color)) ||
                                this.#state.board[source.row][source.col - 2] != null || this.#underThreat(this.square(source.row, source.col - 2), this.opponent(color))
                            ) {
                                // console.log("Large castling not possible area is not clear (Black View)")
                                return false;
                            }
                        }
                        // queenside
                        else {
                            if (this.#state.board[source.row][source.col + 1] != null || this.#underThreat(this.square(source.row, source.col + 1), this.opponent(color)) ||
                                this.#state.board[source.row][source.col + 2] != null || this.#underThreat(this.square(source.row, source.col + 2), this.opponent(color)) ||
                                this.#state.board[source.row][source.col + 3] != null) {
                                //  console.log("Small castling not possible area is not clear (Black View)")
                                return false;
                            }
                        }
                    }

                    const offset = (source.col > target.col) ? 1 : -1;
                    if (this.#state.board[target.row][target.col + offset] == null) {
                        if (!this.#underThreat(target, this.opponent(color)) &&
                            !this.#underThreat({ row: target.row, col: target.col + offset }, this.opponent(color))) { return true; }
                    }
                }
            }
            return false;
        }
        return false;
    }

    #underThreat(position, threateningColor) {

        const row = position.row;
        const col = position.col;
        let underAttack = false;

        if (!this.#inBounds(row, col)) { return false; }

        // scanning right side of the row
        for (let i = col + 1; i < 8; i++) {

            if (this.#state.board[row][i] == null) {
                continue; // can't be threthend by nothing
            }

            if (this.#state.board[row][i].color != threateningColor) {
                break; // one of my piece blocks the threat
            }

            const threateningPieceType = this.#state.board[row][i].pieceType;
            if (this.#state.board[row][i].color == threateningColor) {
                if ((threateningPieceType == this.QUEEN || threateningPieceType == this.ROOK)) {
                    // queen or rook at the same line is a threat
                    //   console.log("Square (" + row + "," + col + ") is under threat of a " + PieceName(this.#state.board[row][i].pieceType) + " " + row + ", " + i)
                    underAttack = true;
                    break;
                }
                else {
                    break; //blockin piece
                }
            }
        }

        // scanning left side of the row
        for (let i = col - 1; i >= 0; i--) {
            if (this.#state.board[row][i] == null) {
                continue; // can't be threthend by nothing
            }

            if (this.#state.board[row][i].color != threateningColor) {
                break; // one of my piece blocks the threat
            }

            const threateningPieceType = this.#state.board[row][i].pieceType;
            if (this.#state.board[row][i].color == threateningColor) {
                if (threateningPieceType == this.QUEEN || threateningPieceType == this.ROOK) {
                    // queen or rook at the same line is a threat
                    //console.log("Square (" + row + "," + col + ")" + "under threat of a " + PieceName(this.#state.board[row][i].pieceType) + " " + row + "," + i)
                    underAttack = true;
                    break;
                }
                else { break; }
            }
        }

        //check columns
        // scanning down
        for (let i = row + 1; i < 8; i++) {


            if (this.#state.board[i][col] == null) {
                continue; // can't be threthend by nothing
            }

            if (this.#state.board[i][col].color != threateningColor) {
                break; // one of my piece blocks the threat
            }

            const threateningPieceType = this.#state.board[i][col].pieceType;

            if (this.#state.board[i][col].color == threateningColor) {

                if ((threateningPieceType == this.QUEEN || threateningPieceType == this.ROOK)) {
                    // queen or rook at the same line is a threat
                    //console.log("Square (" + row + "," + col + ")" + "under threat of a " + PieceName(this.#state.board[i][col].pieceType) + "  " + i + ", " + col)
                    underAttack = true;
                    break;
                }
                else { break; }
            }
        }

        // scanning up
        for (let i = row - 1; i >= 0; i--) {

            if (this.#state.board[i][col] == null) {
                continue; // can't be threthend by nothing
            }

            if (this.#state.board[i][col].color != threateningColor) {
                break; // one of my piece blocks the threat
            }

            const threateningPieceType = this.#state.board[i][col].pieceType;
            if (this.#state.board[i][col].color == threateningColor) {
                if ((threateningPieceType == this.QUEEN || threateningPieceType == this.ROOK)) {
                    // queen or rook at the same line is a threat
                    //console.debug("Square (" + row + "," + col + ")" + "under threat of a " + PieceName(this.#state.board[i][col].pieceType) + " " + i + "," + col)
                    underAttack = true;
                    break;
                }
                else { break; }
            }
        }

        // check diagonals
        for (let i = row + 1, j = col + 1; i < 8 && j < 8; i++, j++) {
            if (this.#state.board[i][j] == null) {
                continue; // can't be threthend by nothing
            }

            if (this.#state.board[i][j].color != threateningColor) {
                break; // one of my piece blocks the threat
            }

            const threateningPieceType = this.#state.board[i][j].pieceType;
            if (this.#state.board[i][j].color == threateningColor) {
                if (threateningPieceType == this.QUEEN || threateningPieceType == this.BISHOP) {
                    //console.debug("Square (" + row + "," + col + ")" + "under threat of a " + PieceName(this.#state.board[i][j].pieceType) + " " + i + "," + j)
                    // queen or rook at the same line is a threat
                    underAttack = true;
                    break;
                }
                else { break; }
            }
        }


        for (let i = row + 1, j = col - 1; i < 8 && j >= 0; i++, j--) {
            if (this.#state.board[i][j] == null) {
                continue; // can't be threthend by nothing
            }

            if (this.#state.board[i][j].color != threateningColor) {
                break; // one of my piece blocks the threat
            }

            const threateningPieceType = this.#state.board[i][j].pieceType;
            if (this.#state.board[i][j].color == threateningColor) {
                if (threateningPieceType == this.QUEEN || threateningPieceType == this.BISHOP) {
                    //console.debug("Square (" + row + "," + col + ")" + "under threat of a " + PieceName(this.#state.board[i][j].pieceType) + " " + i + "," + j)

                    // queen or rook at the same line is a threat
                    underAttack = true;
                    break;
                }
                else { break; }
            }
        }

        for (let i = row - 1, j = col - 1; i >= 0 && j >= 0; i--, j--) {
            if (this.#state.board[i][j] == null) {
                continue; // can't be threthend by nothing
            }

            if (this.#state.board[i][j].color != threateningColor) {
                break; // one of my piece blocks the threat
            }

            const threateningPieceType = this.#state.board[i][j].pieceType;
            if (this.#state.board[i][j].color == threateningColor) {
                if (threateningPieceType == this.QUEEN || threateningPieceType == this.BISHOP) {
                    //console.log("Square (" + row + "," + col + ")" + "under threat of a " + PieceName(this.#state.board[i][j].pieceType) + " " + i + "," + j)
                    // queen or rook at the same line is a threat
                    underAttack = true;
                    break;
                } else {
                    break;
                }
            }
        }

        for (let i = row - 1, j = col + 1; i >= 0 && j < 8; i--, j++) {
            if (this.#state.board[i][j] == null) {
                continue; // can't be threthend by nothing
            }

            if (this.#state.board[i][j].color != threateningColor) {
                break; // one of my piece blocks the threat
            }

            const threateningPieceType = this.#state.board[i][j].pieceType;
            if (this.#state.board[i][j].color == threateningColor) {
                if (threateningPieceType == this.QUEEN || threateningPieceType == this.BISHOP) {
                    //console.log("Square (" + row + "," + col + ")" + "under threat of a " + PieceName(this.#state.board[i][j].pieceType) + " " + i + "," + j)
                    // queen or rook at the same line is a threat
                    underAttack = true;
                    break;
                } else {
                    break;
                }
            }
        }

        // check knight
        const knightPositions = [
            [row + 1, col + 2],
            [row - 1, col + 2],
            [row + 1, col - 2],
            [row - 1, col - 2],
            [row + 2, col + 1],
            [row - 2, col + 1],
            [row + 2, col - 1],
            [row - 2, col - 1]
        ];

        for (let i = 0; i < 8; i++) {
            const x = knightPositions[i][0];
            const y = knightPositions[i][1];
            if (x >= 0 && x < 8 && y >= 0 && y < 8) {

                if (this.#state.board[x][y] == null) {
                    continue; // can't be threthend by nothing
                }

                const threateningPieceType = this.#state.board[x][y].pieceType;
                if (this.#state.board[x][y].color == threateningColor) {
                    if (threateningPieceType == this.KNIGHT) {
                        // console.log("Square (" + row + "," + col + ")" + "under threat of a " + PieceName(this.#state.board[x][y].pieceType) + " " + x + "," + y)
                        underAttack = true;
                        break;
                    } else {
                        continue;
                    }
                }
            }
        }

        //check pawns
        let pawnPositions = undefined;

        // if attaching to the top direction - color and board position need to be different -> using XOR
        if (threateningColor == "black" ^ !this.WhitePlayerView) {
            // attacking pawn one row above the king
            pawnPositions = [
                [row - 1, col - 1],
                [row - 1, col + 1]
            ];
        }
        else {
            // attacking pawn one row under the king
            pawnPositions = [
                [row + 1, col - 1],
                [row + 1, col + 1]
            ];
        }

        for (let i = 0; i < 2; i++) {
            const x = pawnPositions[i][0];
            const y = pawnPositions[i][1];
            if (x >= 0 && x < 8 && y >= 0 && y < 8) {
                if (this.#state.board[x][y] == null) {
                    continue; // can't be threthend by nothing
                }

                if (this.#state.board[x][y].color != threateningColor) {
                    continue; // can't be threthend by you own piece
                }

                const threateningPieceType = this.#state.board[x][y].pieceType;
                if (this.#state.board[x][y].color == threateningColor) {
                    if (threateningPieceType == this.PAWN) {
                        //  console.log("Square (" + row + "," + col + ")" + "under threat of a " + PieceName(this.#state.board[x][y].pieceType) + " " + x + "," + y)
                        underAttack = true;
                        break;
                    } else {
                        break;
                    }
                }
            }
        }

        return underAttack;
    }

    #endOfGame() {

        if (this.#state.checkmate) { return true; }
        if (this.#state.draw) { return true; }
        if (this.#state.resigned) { return true; }
        if (this.#state.outOfTime) { return true; }

        return false;
    }

    #isCheck(threateningColor) {

        const position = this.#findKingPosition(this.opponent(threateningColor));
        if (position == null) {
            console.log("ERROR !!! Where's the king? threatning color:" + this.colorName(threateningColor));
        }
        return this.#underThreat(position, threateningColor);
    }

    #findKingPosition(color) {
        for (let i = 0; i < this.BOARD_ROWS; i++) {
            for (let j = 0; j < this.BOARD_COLUMNS; j++) {
                const piece = this.#state.board[i][j];
                if (piece != null && piece.color == color && piece.pieceType == this.KING) { return { row: i, col: j }; }
            }
        }
    }

    #newThreatCreated(source, target, threateningColor) {
        let retValue = false;
        const move = {
            valid: true,
            source: source,
            target: target,
            piece: this.#state.board[source.row][source.col],
            promotion: false,
            ennPassant: false,
            capturedPiece: null,
            hitSquare: null,
            turn: threateningColor,
            castling: false,
            whitePlayerView: this.WhitePlayerView,
        };

        if (!this.#state.check) {

            this.#simulation = true;

            this.#performMove(move);

            //verify if check was canceled
            if (this.#isCheck(this.opponent(threateningColor))) {
                retValue = true;
            }
            else {
                retValue = false;
            }

            //recall move
            this.undo();
            this.#simulation = false;
        }
        return retValue;
    }

    #canRemoveChessThreat(source, target, threateningColor) {
        // Simulate move by the threatening Color, and return true if Check occur, then undo
        let retValue;
        const move = {
            valid: true,
            source: source,
            target: target,
            piece: this.#state.board[source.row][source.col],
            promotion: false,
            ennPassant: false,
            capturedPiece: null,
            hitSquare: null,
            turn: this.opponent(threateningColor),
            castling: false,
            whitePlayerView: this.WhitePlayerView,
        };

        this.#simulation = true;
        this.#performMove(move);

        //verify if the move canceled the check
        if (this.#isCheck(threateningColor)) {
            retValue = false;
            move.check = false;
        }
        else {
            retValue = true;
            move.check = true;
        }

        //recall move
        this.undo();

        this.#simulation = false;
        return retValue;

    }

    #isCheckMate(threateningColor) {
        const C2 = this.opponent(threateningColor);;
        for (let i = 0; i < this.BOARD_ROWS; i++) {
            for (let j = 0; j < this.BOARD_COLUMNS; j++) {
                if (this.#state.board[i][j] != null && this.#state.board[i][j].color == C2) // search for a piece with the same color as the one that recieve a Check warning
                {
                    for (let i2 = 0; i2 < this.BOARD_ROWS; i2++) {
                        for (let j2 = 0; j2 < this.BOARD_COLUMNS; j2++) {
                            //try all positions
                            const source = this.square(i, j);
                            const target = this.square(i2, j2);
                            if (this.validateMove(source, target, C2).valid) {
                                if (this.#canRemoveChessThreat(source, target, threateningColor)) {
                                    //console.log(`"possible move:(${source.row},${source.col})->(${target.row},${target.col})`)
                                    return false;
                                }
                            }
                        }
                    }
                }
            }
        }
        return true;
    }

    #insufficientMaterials() {
        let count = 0;              // Counts how many non-empty Squares are present on the board        
        const board = this.#state.board;
        let whiteBishop;
        let blackBishop;
        let whiteKnight;
        let blackKnight;
        let whiteBishopPosition;
        let blackBishopPosition;

        /*
        king versus king
        king and bishop versus king
        king and knight versus king
        king and bishop versus king and bishop with the bishops on the same color.
         */
        for (let i = 0; i < this.BOARD_ROWS; i++) {
            for (var j = 0; j < this.BOARD_COLUMNS; j++) {
                if (board[i][j]) {
                    if (board[i][j] != null) {
                        count++;
                    }
                    if (board[i][j].pieceType == this.BISHOP) {
                        if (board[i][j].color == "white") {
                            whiteBishop = true;
                            whiteBishopPosition = this.square(i, j);
                        }
                        else {
                            blackBishop = true;
                            blackBishopPosition = this.square(i, j);
                        }
                    }
                    else if (board[i][j].pieceType == this.KNIGHT) {

                        if (board[i][j].color == "white") {
                            whiteKnight = true;
                        }
                        else {
                            blackKnight = true;
                        }
                    }

                }
            }
        }


        // If two kings have remained
        if (count == 2) {
            return true;
        }

        // If a king have remained against a king and a Bishop, or against a king and a Knight.
        if (count == 3) {
            if (whiteBishop || blackBishop || whiteKnight || blackKnight) {
                return true;
            }
        }

        if (count == 4) {
            if (whiteBishop && blackBishop) {
                if ((whiteBishopPosition.row + whiteBishopPosition.col) % 2 == (blackBishopPosition.row + blackBishopPosition.col) % 2) { return true; }
            }
        }

        return false;
    }

    #threefoldRepetition() {

        let sum = 0;
        let lastSnapshot = this.#snapshots[this.#snapshots.length - 1];
        lastSnapshot = this.#stripState(lastSnapshot);
        for (let snapshot of this.#snapshots) {
            snapshot = this.#stripState(snapshot);
            if (snapshot == lastSnapshot) {
                sum++;
            }
        }
        if (sum >= 3) { return true; }
        return false;
    }

    #recordState() {
        const str = JSON.stringify(this.#state);
        this.#snapshots.push(str);
    }

    #updateState() {
        this.#snapshots.pop();
        this.#recordState();
    }

    #stripState(snapshotStr) {
        const snapshot = JSON.parse(snapshotStr);
        delete snapshot.capturedPiecesList;
        delete snapshot.lastMove;
        delete snapshot.fiftyMovesCounter;
        return JSON.stringify(snapshot);

    }

    #findSource(pgnMove, turn) {

        let row, col, colLetter;
        const cols = "abcdefgh";
        const forward = turn == "white" ? 1 : -1;
        const piece = pgnMove.piece;
        const target = pgnMove.target;
        //let hint;
        const options = [];
        //let sourceCol, sourceRow;

        if (pgnMove.source) {
            if (pgnMove.source.row && pgnMove.source.col) { return pgnMove.source; }
        }


        let move = pgnMove.moveStr;
        move = move.replace("+", "");
        move = move.replace("#", "");
        move = move.replace("x", "");
        // if (piece == this.PAWN && move.length == 3)
        //     hint = move.charAt(0)
        // else if (move.length == 4) {
        //     hint = move.charAt(1)
        // }


        switch (piece) {
            case this.PAWN:

                if (pgnMove.moveStr.indexOf("x") > 0) {
                    colLetter = pgnMove.moveStr.charAt(0);
                    col = cols.indexOf(colLetter);
                    row = target.row + forward;
                    return this.square(row, col);
                }

                //hit left
                if (pgnMove.moveStr.indexOf("x") > 0 && (this.#state.board[target.row + forward][target.col + 1].pieceType == this.PAWN) && this.validateMove(this.square(target.row + forward, target.col + 1), target, this.Turn).valid) { options.push(this.square(target.row + forward, target.col + 1)); }

                //hit right
                if (pgnMove.moveStr.indexOf("x") > 0 && (this.#state.board[target.row + forward][target.col - 1].pieceType == this.PAWN) && this.validateMove(this.square(target.row + forward, target.col - 1), target, this.Turn).valid) { options.push(this.square(target.row + forward, target.col - 1)); }

                // default move
                if (this.#state.board[target.row + forward][target.col] && this.#state.board[target.row + forward][target.col].pieceType == this.PAWN && this.validateMove(this.square(target.row + forward, target.col), target, this.Turn).valid) { options.push(this.square(target.row + forward, target.col)); }

                // first double move
                if (this.#state.board[target.row + (forward * 2)][target.col] && this.#state.board[target.row + (forward * 2)][target.col].pieceType == this.PAWN && this.validateMove(this.square(target.row + (forward * 2), target.col), target, this.Turn).valid) { options.push(this.square(target.row + (forward * 2), target.col)); }

                if (options.length == 1) { return options[0]; }
                else {
                    const chosenOption = options.filter(o => pgnMove.source && (o.row == pgnMove.source.row || o.col == pgnMove.source.col))[0];
                    if (chosenOption) { return chosenOption; }
                    else { return options[0]; }
                }


            case this.ROOK:

                for (let i = 1; target.row + i < this.BOARD_ROWS; i++) {
                    if (this.#state.board[target.row + i][target.col] == null) { continue; }
                    if (this.#state.board[target.row + i][target.col].color == turn &&
                        this.#state.board[target.row + i][target.col].pieceType == this.ROOK &&
                        this.validateMove(this.square(target.row + i, target.col), target, this.Turn).valid) {
                        options.push(this.square(target.row + i, target.col));
                        //return Square(target.row + i, target.col)
                    } else { break; }
                }
                for (let i = 1; target.col + i < this.BOARD_ROWS; i++) {
                    if (this.#state.board[target.row][target.col + i] == null) { continue; }
                    if (this.#state.board[target.row][target.col + i].color == turn &&
                        this.#state.board[target.row][target.col + i].pieceType == this.ROOK &&
                        this.validateMove(this.square(target.row, target.col + i), target, this.Turn).valid) {
                        options.push(this.square(target.row, target.col + i));
                    } else { break; }
                }
                for (let i = 1; target.col - i >= 0; i++) {
                    if (this.#state.board[target.row][target.col - i] == null) { continue; }
                    if (this.#state.board[target.row][target.col - i].color == turn &&
                        this.#state.board[target.row][target.col - i].pieceType == this.ROOK &&
                        this.validateMove(this.square(target.row, target.col - i), target, this.Turn).valid) {
                        options.push(this.square(target.row, target.col - i));
                    } else { break; }
                }

                for (let i = 1; target.row - i >= 0; i++) {
                    if (this.#state.board[target.row - i][target.col] == null) { continue; }
                    if (this.#state.board[target.row - i][target.col].color == turn &&
                        this.#state.board[target.row - i][target.col].pieceType == this.ROOK &&
                        this.validateMove(this.square(target.row - i, target.col), target, this.Turn).valid) {
                        options.push(this.square(target.row - i, target.col));
                    } else { break; }
                }

                if (options.length == 1) { return options[0]; }
                else {
                    const chosenOption = options.filter(o => pgnMove.source && (o.row == pgnMove.source.row || o.col == pgnMove.source.col))[0];
                    if (chosenOption) { return chosenOption; }
                    else { return options[0]; }
                }


            case this.KNIGHT:
                if (target.row + 1 < this.BOARD_ROWS && target.col + 2 < this.BOARD_COLUMNS &&
                    this.#state.board[target.row + 1][target.col + 2] &&
                    this.#state.board[target.row + 1][target.col + 2].color == turn &&
                    this.#state.board[target.row + 1][target.col + 2].pieceType == this.KNIGHT &&
                    this.validateMove(this.square(target.row + 1, target.col + 2), target, this.Turn).valid) { options.push(this.square(target.row + 1, target.col + 2)); }

                if (target.row + 2 < this.BOARD_ROWS && target.col + 1 < this.BOARD_COLUMNS &&
                    this.#state.board[target.row + 2][target.col + 1] &&
                    this.#state.board[target.row + 2][target.col + 1].color == turn &&
                    this.#state.board[target.row + 2][target.col + 1].pieceType == this.KNIGHT &&
                    this.validateMove(this.square(target.row + 2, target.col + 1), target, this.Turn).valid) { options.push(this.square(target.row + 2, target.col + 1)); }

                if (target.row + 1 < this.BOARD_ROWS && target.col - 2 >= 0 &&
                    this.#state.board[target.row + 1][target.col - 2] &&
                    this.#state.board[target.row + 1][target.col - 2].color == turn &&
                    this.#state.board[target.row + 1][target.col - 2].pieceType == this.KNIGHT &&
                    this.validateMove(this.square(target.row + 1, target.col - 2), target, this.Turn).valid) { options.push(this.square(target.row + 1, target.col - 2)); }

                if (target.row + 2 < this.BOARD_ROWS && target.col - 1 >= 0 &&
                    this.#state.board[target.row + 2][target.col - 1] &&
                    this.#state.board[target.row + 2][target.col - 1].color == turn &&
                    this.#state.board[target.row + 2][target.col - 1].pieceType == this.KNIGHT &&
                    this.validateMove(this.square(target.row + 2, target.col - 1), target, this.Turn).valid) { options.push(this.square(target.row + 2, target.col - 1)); }

                if (target.row - 1 >= 0 && target.col - 2 >= 0 &&
                    this.#state.board[target.row - 1][target.col - 2] &&
                    this.#state.board[target.row - 1][target.col - 2].color == turn &&
                    this.#state.board[target.row - 1][target.col - 2].pieceType == this.KNIGHT &&
                    this.validateMove(this.square(target.row - 1, target.col - 2), target, this.Turn).valid) { options.push(this.square(target.row - 1, target.col - 2)); }

                if (target.row - 2 >= 0 && target.col + 1 < this.BOARD_COLUMNS &&
                    this.#state.board[target.row - 2][target.col + 1] &&
                    this.#state.board[target.row - 2][target.col + 1].color == turn &&
                    this.#state.board[target.row - 2][target.col + 1].pieceType == this.KNIGHT &&
                    this.validateMove(this.square(target.row - 2, target.col + 1), target, this.Turn).valid) { options.push(this.square(target.row - 2, target.col + 1)); }

                if (target.row - 1 >= 0 && target.col + 2 >= 0 &&
                    this.#state.board[target.row - 1][target.col + 2] &&
                    this.#state.board[target.row - 1][target.col + 2].color == turn &&
                    this.#state.board[target.row - 1][target.col + 2].pieceType == this.KNIGHT &&
                    this.validateMove(this.square(target.row - 1, target.col + 2), target, this.Turn).valid) { options.push(this.square(target.row - 1, target.col + 2)); }

                if (target.row - 2 >= 0 && target.col - 1 >= 0 &&
                    this.#state.board[target.row - 2][target.col - 1] &&
                    this.#state.board[target.row - 2][target.col - 1].color == turn &&
                    this.#state.board[target.row - 2][target.col - 1].pieceType == this.KNIGHT &&
                    this.validateMove(this.square(target.row - 2, target.col - 1), target, this.Turn).valid) { options.push(this.square(target.row - 2, target.col - 1)); }

                if (options.length == 1) { return options[0]; }
                else {
                    const chosenOption = options.filter(o => pgnMove.source && (o.row == pgnMove.source.row || o.col == pgnMove.source.col))[0];
                    if (chosenOption) { return chosenOption; }
                    else { return options[0]; }
                }

            case this.BISHOP:

                for (let i = 1; target.row + i < this.BOARD_ROWS && target.col + i < this.BOARD_COLUMNS; i++) {

                    if (this.#state.board[target.row + i][target.col + i] == null) { continue; }

                    if ((this.#state.board[target.row + i][target.col + i].color == turn) &&
                        (this.#state.board[target.row + i][target.col + i].pieceType == this.BISHOP) &&
                        (this.validateMove(this.square(target.row + i, target.col + i), target, this.Turn).valid)) { return this.square(target.row + i, target.col + i); }


                    else { break; }

                }


                for (let i = 1; target.row - i >= 0 && target.col - i >= 0; i++) {
                    if (this.#state.board[target.row - i][target.col - i] == null) { continue; }

                    if ((this.#state.board[target.row - i][target.col - i].color == turn) &&
                        (this.#state.board[target.row - i][target.col - i].pieceType == this.BISHOP) &&
                        (this.validateMove(this.square(target.row - i, target.col - i), target, this.Turn).valid)) {
                        return this.square(target.row - i, target.col - i);


                    } else { break; }

                }

                for (let i = 1; target.row - i >= 0 && target.col + i < this.BOARD_COLUMNS; i++) {

                    if (this.#state.board[target.row - i][target.col + i] == null) { continue; }

                    if ((this.#state.board[target.row - i][target.col + i].color == turn) &&
                        (this.#state.board[target.row - i][target.col + i].pieceType == this.BISHOP) &&
                        (this.validateMove(this.square(target.row - i, target.col + i), target, this.Turn).valid)) { return this.square(target.row - i, target.col + i); }

                    else { break; }

                }

                for (let i = 1; target.row + i < this.BOARD_ROWS && target.col - i >= 0; i++) {

                    if (this.#state.board[target.row + i][target.col - i] == null) { continue; }

                    if ((this.#state.board[target.row + i][target.col - i].color == turn) &&
                        (this.#state.board[target.row + i][target.col - i].pieceType == this.BISHOP) &&
                        (this.validateMove(this.square(target.row + i, target.col - i), target, this.Turn).valid)) { return this.square(target.row + i, target.col - i); }

                    else { break; }
                }

                break;

            case this.KING:


                if (target.row + 1 < this.BOARD_ROWS && target.col - 1 >= 0) {
                    const square = this.square(target.row + 1, target.col - 1);
                    const piece = this.#state.board[target.row + 1][target.col - 1];
                    if (piece && piece.color == turn && piece.pieceType == this.KING && this.validateMove(square, target, this.Turn).valid) { return square; }
                }
                if (target.row + 1 < this.BOARD_ROWS) {
                    const square = this.square(target.row + 1, target.col);
                    const piece = this.#state.board[target.row + 1][target.col];
                    if (piece && piece.color == turn && piece.pieceType == this.KING && this.validateMove(square, target, this.Turn).valid) { return square; }
                }
                if (target.row + 1 < this.BOARD_ROWS && target.col + 1 < this.BOARD_COLUMNS) {
                    const square = this.square(target.row + 1, target.col + 1);
                    const piece = this.#state.board[target.row + 1][target.col + 1];
                    if (piece && piece.color == turn && piece.pieceType == this.KING && this.validateMove(square, target, this.Turn).valid) { return square; }
                }
                if (target.col - 1 >= 0) {
                    const square = this.square(target.row, target.col - 1);
                    const piece = this.#state.board[target.row][target.col - 1];
                    if (piece && piece.color == turn && piece.pieceType == this.KING && this.validateMove(square, target, this.Turn).valid) { return square; }
                }

                if (target.col + 1 < this.BOARD_COLUMNS) {
                    const square = this.square(target.row, target.col + 1);
                    const piece = this.#state.board[target.row][target.col + 1];
                    if (piece && piece.color == turn && piece.pieceType == this.KING && this.validateMove(square, target, this.Turn).valid) { return square; }
                }

                if (target.row - 1 >= 0 && target.col - 1 >= 0) {
                    const square = this.square(target.row - 1, target.col - 1);
                    const piece = this.#state.board[target.row - 1][target.col - 1];
                    if (piece && piece.color == turn && piece.pieceType == this.KING && this.validateMove(square, target, this.Turn).valid) { return square; }
                }

                if (target.row - 1 >= 0) {
                    const square = this.square(target.row - 1, target.col);
                    const piece = this.#state.board[target.row - 1][target.col];
                    if (piece && piece.color == turn && piece.pieceType == this.KING && this.validateMove(square, target, this.Turn).valid) { return square; }
                }

                if (target.row - 1 >= 0 && target.col + 1 < this.BOARD_COLUMNS) {
                    const square = this.square(target.row - 1, target.col + 1);
                    const piece = this.#state.board[target.row - 1][target.col + 1];
                    if (piece && piece.color == turn && piece.pieceType == this.KING && this.validateMove(square, target, this.Turn).valid) { return square; }
                }

                if (target.col + 2 < this.BOARD_COLUMNS) {
                    const square = this.square(target.row, target.col + 2);
                    const piece = this.#state.board[target.row][target.col + 2];
                    if (piece && piece.color == turn && piece.pieceType == this.KING && this.validateMove(square, target, this.Turn).valid) { return square; }
                }
                if (target.col - 2 >= 0) {
                    const square = this.square(target.row, target.col - 2);
                    const piece = this.#state.board[target.row][target.col - 2];
                    if (piece && piece.color == turn && piece.pieceType == this.KING && this.validateMove(square, target, this.Turn).valid) { return square; }
                }

                break;

            case this.QUEEN:


                for (let i = 1; target.row + i < this.BOARD_ROWS && target.col + i < this.BOARD_COLUMNS; i++) {

                    const piece = this.#state.board[target.row + i][target.col + i];
                    const square = this.square(target.row + i, target.col + i);
                    if (piece == null) { continue; }

                    if (piece.color == turn &&
                        piece.pieceType == this.QUEEN &&
                        this.validateMove(square, target, this.Turn).valid) { options.push(square); }
                    else { break; }

                }

                for (let i = 1; target.row - i >= 0 && target.col - i >= 0; i++) {

                    const piece = this.#state.board[target.row - i][target.col - i];
                    const square = this.square(target.row - i, target.col - i);
                    if (piece == null) { continue; }

                    if (piece.color == turn &&
                        piece.pieceType == this.QUEEN &&
                        this.validateMove(square, target, this.Turn).valid) { options.push(square); }
                    else { break; }
                }


                for (let i = 1; target.row - i >= 0 && target.col + i < this.BOARD_COLUMNS; i++) {

                    const square = this.square(target.row - i, target.col + i);
                    const piece = this.#state.board[target.row - i][target.col + i];
                    if (piece == null) { continue; }

                    if (piece.color == turn &&
                        piece.pieceType == this.QUEEN &&
                        this.validateMove(square, target, this.Turn).valid) { options.push(square); }
                    else { break; }

                }


                for (let i = 1; target.row + i < this.BOARD_ROWS && target.col - i >= 0; i++) {

                    const square = this.square(target.row + i, target.col - i);
                    const piece = this.#state.board[target.row + i][target.col - i];
                    if (piece == null) { continue; }

                    if (piece.color == turn &&
                        piece.pieceType == this.QUEEN &&
                        this.validateMove(square, target, this.Turn).valid) { options.push(square); }

                    else { break; }

                }


                //////


                for (let i = 1; target.row + i < this.BOARD_ROWS; i++) {
                    const square = this.square(target.row + i, target.col);
                    const piece = this.#state.board[target.row + i][target.col];
                    if (piece == null) { continue; }

                    if (piece.color == turn &&
                        piece.pieceType == this.QUEEN &&
                        this.validateMove(square, target, this.Turn).valid) { options.push(square); }
                    else { break; }
                }

                for (let i = 1; target.col + i < this.BOARD_ROWS; i++) {
                    const square = this.square(target.row, target.col + i);
                    const piece = this.#state.board[target.row][target.col + i];
                    if (piece == null) { continue; }

                    if (piece.color == turn &&
                        piece.pieceType == this.QUEEN &&
                        this.validateMove(square, target, this.Turn).valid) { options.push(square); }
                    else { break; }
                }
                for (let i = 1; target.col - i >= 0; i++) {
                    const square = this.square(target.row, target.col - i);
                    const piece = this.#state.board[target.row][target.col - i];
                    if (piece == null) { continue; }
                    if (piece.color == turn &&
                        piece.pieceType == this.QUEEN &&
                        this.validateMove(square, target, this.Turn).valid) {
                        options.push(square);
                    } else { break; }
                }

                for (let i = 1; target.row - i >= 0; i++) {
                    const square = this.square(target.row - i, target.col);
                    const piece = this.#state.board[target.row - i][target.col];
                    if (piece == null) { continue; }
                    if (piece.color == turn &&
                        piece.pieceType == this.QUEEN &&
                        this.validateMove(square, target, this.Turn).valid) {
                        options.push(square);
                    } else { break; }
                }

                if (options.length == 1) { return options[0]; }
                else {
                    const chosenOption = options.filter(o => pgnMove.source && (o.row == pgnMove.source.row || o.col == pgnMove.source.col))[0];
                    if (chosenOption) { return chosenOption; }
                    else { return options[0]; }
                }

            default:
                throw new Error("unknown piecee");
        }

        throw new Error("Cannot find move:" + move);

    }


    Reasons = {
        INVALID_SOURCE_TARGET: "Invalid source or target inputs",
        OUT_OF_BOUNDS: "Row or Column are out of the bounds of the board",
        NO_SOURCE_PIECE: "There is no piece in the source Square",
        GAME_OVER: "Game Over",
        PROMOTION_IN_PROGRESS: "Promotion in Progress, waiting for user selection",
        NOT_YOUR_TURN: "This is not your turn",
        PIECE_MOVE_ILLEGAL: "Illegal piece move",
    };

    PAWN = 0;
    KING = 1;
    KNIGHT = 2;
    BISHOP = 3;
    ROOK = 4;
    QUEEN = 5;
    BOARD_ROWS = 8;
    BOARD_COLUMNS = 8;
}


function isServerSide() {
    return !(typeof window != "undefined" && window.document);
}


if (isServerSide()) {

    exports.ChessGame = ChessGame;

}