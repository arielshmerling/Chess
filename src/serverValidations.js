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

const webSocketMessageSchema =
    Joi.alternatives().try(
        Joi.object({
            username: Joi.string().required().escapeHTML(),
            gameId: wsGameId,
            type: Joi.string().valid("move", "info", "cmd").required(),
            isWhite: Joi.bool().required(),
            data: Joi.object({
                capturedPiece: Joi.required(),
                castling: Joi.bool().required(),
                ennPassant: Joi.bool().required(),
                hitSquare: Joi.object({
                    row: Joi.number().min(0).max(7).optional(),
                    col: Joi.number().min(0).max(7).optional(),
                }).allow(null),
                moveStr: Joi.string().min(2).max(10).required().escapeHTML(),
                moveTime: Joi.number().required(),
                piece: Joi.object({
                    color: Joi.string().valid("white", "black").required(),
                    pieceType: Joi.number().min(0).max(5).required(),
                }).required(),
                promotion: Joi.bool().required(),
                selectedPiece: Joi.number().min(2).max(5).optional(),
                source: Joi.object({
                    row: Joi.number().min(0).max(7).required(),
                    col: Joi.number().min(0).max(7).required(),
                }).required(),
                target: Joi.object({
                    row: Joi.number().min(0).max(7).required(),
                    col: Joi.number().min(0).max(7).required(),
                }).required(),
                turn: Joi.string().valid("white", "black").required(),
                valid: Joi.bool().required(),
                whitePlayerView: Joi.bool().required(),
                check: Joi.bool().optional(),
                checkmate: Joi.bool().optional(),
                kingsideCastling: Joi.bool().optional(),
                draw: Joi.bool().optional(),
            }).optional(),
        }),
        Joi.object({
            gameId: wsGameId,
            info: Joi.string().valid(
                "offer rematch", "rematch", "resign", "offer draw",
                "move accepted", "draw accepted", "draw declined", "rematch declined", "rematch accepted",
                "outOfTime", "Opponent resigned", "chat", "clockSync",
                "game over", "move validated successfully", "move validation failed"
            ).required(),
            isWhite: Joi.bool().optional(),
            moveTime: Joi.number().optional(),
            moveStr: Joi.alternatives().try(Joi.string().escapeHTML(), Joi.valid(null, "")).optional(),
            type: Joi.string().valid("info", "command").required(),
            userId: Joi.string().hex().length(24).optional().escapeHTML(),
            username: Joi.string().optional(),
            data: Joi.any().optional(),
            whiteTimer: Joi.number().optional(),
            blackTimer: Joi.number().optional(),
        }),
        Joi.object({
            type: Joi.string().valid("cmd").required(),
            info: Joi.string().valid("setState", "undo", "redo").required(),
            data: Joi.object().required(),
            gameId: wsGameId,
            userId: Joi.string().hex().length(24).required().escapeHTML(),
            username: Joi.string().required(),
            isWhite: Joi.bool().required(),
        }),
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

