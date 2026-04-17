const BaseJoi = require("joi");
const sanitizeHtml = require("sanitize-html");
const ExpressError = require("../src/utils/ExpressError");

const extention = (joi) => ({
    type: "string",
    base: joi.string(),
    messages: { "string.escapeHTML": "{{#label}} must not include HTML." },
    rules: {
        escapeHTML: {
            validate(value, helpers) {
                const clean = sanitizeHtml(value, {
                    allowedTags: [],
                    allowedAttributes: {},
                });
                if (clean !== value) {
                    return helpers.error("string.escapeHTML", { value });
                }
                return clean;
            }
        }
    }
});

const Joi = BaseJoi.extend(extention);

const gameTypeSchema = Joi.object({ gameType: Joi.number().min(1).max(3).required() });
const gameIdSchema = Joi.alternatives().try(
    Joi.object({ id: Joi.string().hex().length(24).required().escapeHTML() }),
    Joi.object({ id: Joi.string().uuid({ version: ["uuidv4"] }).required().escapeHTML() }),
);
const reviewSchema = Joi.object({
    id: Joi.alternatives().try(
        Joi.string().hex().length(24).required().escapeHTML(),
        Joi.string().uuid({ version: ["uuidv4"] }).required().escapeHTML()),
    type: Joi.string().valid("pgn", "history")
});

const credentialsSchema = Joi.object({
    username: Joi.string().required().escapeHTML(),
    password: Joi.string()
        .pattern(new RegExp("^[a-zA-Z0-9!@#$%&*]{1,30}$"))
        .required().escapeHTML(),

});

const searchScheme = Joi.string().escapeHTML();

// gameId: ObjectId (24 hex) for stored games, or UUID for practice (no DB)
const wsGameId = Joi.alternatives().try(
    Joi.string().hex().length(24).required().escapeHTML(),
    Joi.string().uuid({ version: ["uuidv4"] }).required().escapeHTML()
);

const wsPieceSchema = Joi.object({
    color: Joi.string().valid("white", "black").required(),
    pieceType: Joi.number().integer().min(0).max(5).required(),
}).strict();

const wsSquareSchema = Joi.object({
    row: Joi.number().integer().min(0).max(7).required(),
    col: Joi.number().integer().min(0).max(7).required(),
}).strict();

/** Move payload: player `move` messages and embedded `lastMove` in game state. */
const wsMoveDataSchema = Joi.object({
    capturedPiece: Joi.alternatives().try(wsPieceSchema, Joi.valid(null)).required(),
    castling: Joi.bool().required(),
    ennPassant: Joi.bool().required(),
    hitSquare: Joi.alternatives().try(wsSquareSchema, Joi.valid(null)).required(),
    moveStr: Joi.string().min(1).max(32).required().escapeHTML(),
    moveTime: Joi.number().required(),
    piece: wsPieceSchema.required(),
    promotion: Joi.bool().required(),
    selectedPiece: Joi.number().integer().min(2).max(5).optional(),
    source: wsSquareSchema.required(),
    target: wsSquareSchema.required(),
    turn: Joi.string().valid("white", "black").required(),
    valid: Joi.bool().required(),
    whitePlayerView: Joi.bool().required(),
    check: Joi.bool().optional(),
    checkmate: Joi.bool().optional(),
    kingsideCastling: Joi.bool().optional(),
    draw: Joi.bool().optional(),
}).strict();

const wsGameStateSchema = Joi.object({
    board: Joi.array().length(8).items(
        Joi.array().length(8).items(
            Joi.alternatives().try(Joi.valid(null), wsPieceSchema)
        )
    ).required(),
    turn: Joi.string().valid("white", "black").required(),
    capturedPiecesList: Joi.array().items(wsPieceSchema).required(),
    lastMove: Joi.alternatives().try(wsMoveDataSchema, Joi.valid(null)).optional(),
    check: Joi.bool().required(),
    checkmate: Joi.bool().required(),
    draw: Joi.bool().required(),
    drawReason: Joi.string().allow("").required(),
    resigned: Joi.string().allow("").required(),
    outOfTime: Joi.string().allow("").required(),
    whiteKingMoved: Joi.bool().required(),
    blackKingMoved: Joi.bool().required(),
    whitePlayerView: Joi.bool().required(),
    fiftyMovesCounter: Joi.number().integer().min(0).required(),
    promoting: Joi.bool().optional(),
    farWhiteRookMoved: Joi.bool().optional(),
    farBlackRookMoved: Joi.bool().optional(),
    nearWhiteRookMoved: Joi.bool().optional(),
    nearBlackRookMoved: Joi.bool().optional(),
    queensideWhiteRookMoved: Joi.bool().optional(),
    queensideBlackRookMoved: Joi.bool().optional(),
    kingsideWhiteRookMoved: Joi.bool().optional(),
    kingsideBlackRookMoved: Joi.bool().optional(),
}).strict();

const wsMoveMessageSchema = Joi.object({
    username: Joi.string().required().escapeHTML(),
    gameId: wsGameId,
    type: Joi.string().valid("move").required(),
    isWhite: Joi.bool().required(),
    data: wsMoveDataSchema.required(),
}).strict();

const wsInfoChatSchema = Joi.object({
    gameId: wsGameId,
    type: Joi.string().valid("info").required(),
    info: Joi.string().valid("chat").required(),
    data: Joi.string().max(2000).required().escapeHTML(),
    userId: Joi.string().hex().length(24).required().escapeHTML(),
    username: Joi.string().required().escapeHTML(),
    isWhite: Joi.bool().required(),
}).strict();

const wsInfoOutOfTimeSchema = Joi.object({
    gameId: wsGameId,
    type: Joi.string().valid("info").required(),
    info: Joi.string().valid("outOfTime").required(),
    userId: Joi.string().hex().length(24).required().escapeHTML(),
    username: Joi.string().required().escapeHTML(),
    isWhite: Joi.bool().required(),
    loser: Joi.string().valid("white", "black").required(),
}).strict();

const wsInfoClockSyncSchema = Joi.object({
    gameId: wsGameId,
    type: Joi.string().valid("info").required(),
    info: Joi.string().valid("clockSync").required(),
    whiteTimer: Joi.number().required(),
    blackTimer: Joi.number().required(),
}).strict();

/** Server → client (and safe if echoed); no user fields required. */
const wsInfoGameOverSchema = Joi.object({
    gameId: wsGameId,
    type: Joi.string().valid("info").required(),
    info: Joi.string().valid("game over").required(),
}).strict();

const wsInfoMoveAcceptedSchema = Joi.object({
    gameId: wsGameId,
    type: Joi.string().valid("info").required(),
    info: Joi.string().valid("move accepted").required(),
    userId: Joi.string().hex().length(24).required().escapeHTML(),
    username: Joi.string().required().escapeHTML(),
    isWhite: Joi.bool().required(),
    moveTime: Joi.number().required(),
    moveStr: Joi.alternatives().try(Joi.string().escapeHTML(), Joi.valid(null, "")).required(),
    whiteTimer: Joi.number().required(),
    blackTimer: Joi.number().required(),
}).strict();

const wsInfoGenericSchema = Joi.object({
    gameId: wsGameId,
    type: Joi.string().valid("info").required(),
    info: Joi.string().valid(
        "offer rematch", "rematch accepted", "rematch declined",
        "resign", "offer draw", "draw accepted", "draw declined"
    ).required(),
    userId: Joi.string().hex().length(24).required().escapeHTML(),
    username: Joi.string().required().escapeHTML(),
    isWhite: Joi.bool().required(),
    moveTime: Joi.number().optional(),
}).strict();

const wsCmdUndoRedoSchema = Joi.object({
    type: Joi.string().valid("cmd").required(),
    info: Joi.string().valid("undo", "redo").required(),
    gameId: wsGameId,
    userId: Joi.string().hex().length(24).required().escapeHTML(),
    username: Joi.string().required().escapeHTML(),
    isWhite: Joi.bool().required(),
}).strict();

const wsCmdSetStateSchema = Joi.object({
    type: Joi.string().valid("cmd").required(),
    info: Joi.string().valid("setState").required(),
    data: wsGameStateSchema.required(),
    gameId: wsGameId,
    userId: Joi.string().hex().length(24).required().escapeHTML(),
    username: Joi.string().required().escapeHTML(),
    isWhite: Joi.bool().required(),
}).strict();

const webSocketMessageSchema =
    Joi.alternatives().try(
        wsMoveMessageSchema,
        wsInfoChatSchema,
        wsInfoOutOfTimeSchema,
        wsInfoClockSyncSchema,
        wsInfoGameOverSchema,
        wsInfoMoveAcceptedSchema,
        wsInfoGenericSchema,
        wsCmdUndoRedoSchema,
        wsCmdSetStateSchema,
    );

const schemas = {
    "id": gameIdSchema,
    "gameType": gameTypeSchema,
    "review": reviewSchema,
    "credentials": credentialsSchema,
    "webSocketsMessage": webSocketMessageSchema,
    "search": searchScheme,
};

exports.validate = (obj, validator) => {

    const schema = schemas[validator];
    const { error } = schema.validate(obj);
    if (error) {
        // console.log(obj);
        const msg = error.details.map(el => el.message).join(",");
        throw new ExpressError(msg, 400);
    }
};

/**
 * Validates inbound game WebSocket payloads. Does not throw: returns { ok, value } or { ok, error }.
 */
exports.validateWebSocketMessage = (obj) => {
    const { error, value } = webSocketMessageSchema.validate(obj, { abortEarly: false });
    if (error) {
        const topDetails = error.details.map((d) => `${d.path.join(".") || "(root)"}: ${d.message}`).join("; ");
        let payloadPreview = "";
        try {
            payloadPreview = JSON.stringify(obj);
        } catch (stringifyErr) {
            payloadPreview = `[stringify error: ${stringifyErr && stringifyErr.message ? stringifyErr.message : stringifyErr}]`;
        }
        if (payloadPreview.length > 4000) {
            payloadPreview = payloadPreview.slice(0, 4000) + "…";
        }
        console.error("[WS validate] alternatives failed:", topDetails);
        console.error("[WS validate] payload:", payloadPreview);
        if (obj && obj.type === "info" && obj.info === "move accepted") {
            const onlyMoveAccepted = wsInfoMoveAcceptedSchema.validate(obj, { abortEarly: false });
            if (onlyMoveAccepted.error) {
                const moveDetails = onlyMoveAccepted.error.details
                    .map((d) => `${d.path.join(".") || "(root)"}: ${d.message}`)
                    .join("; ");
                console.error("[WS validate] move accepted schema alone:", moveDetails);
            }
        }
        const message = error.details.map((d) => d.message).join("; ");
        return { ok: false, error: message };
    }
    return { ok: true, value };
};

