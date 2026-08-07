/**
 * Review / gameId validation — ObjectId, UUID, and PGN catalog ids.
 */
"use strict";

const assert = require("assert");
const { validate } = require("../src/serverValidations");

describe("serverValidations review / id", function () {
    it("accepts PGN catalog ids for review", function () {
        assert.doesNotThrow(function () {
            validate({ id: "Nakamura.pgn:0", type: "pgn" }, "review");
        });
        assert.doesNotThrow(function () {
            validate({ id: "Carlsen.pgn:1234", type: "pgn" }, "review");
        });
    });

    it("rejects path-like PGN ids", function () {
        assert.throws(function () {
            validate({ id: "../secret.pgn:0", type: "pgn" }, "review");
        });
        assert.throws(function () {
            validate({ id: "Opennings/foo.pgn:0", type: "pgn" }, "review");
        });
    });

    it("accepts PGN catalog ids for game id schema", function () {
        assert.doesNotThrow(function () {
            validate({ id: "Fischer.pgn:42" }, "id");
        });
    });

    it("still accepts ObjectId and UUID", function () {
        assert.doesNotThrow(function () {
            validate({ id: "507f1f77bcf86cd799439011", type: "history" }, "review");
        });
        assert.doesNotThrow(function () {
            validate({ id: "550e8400-e29b-41d4-a716-446655440000", type: "pgn" }, "review");
        });
    });
});
