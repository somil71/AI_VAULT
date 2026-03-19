const mongoose = require("mongoose");

/**
 * RefreshToken model — stores hashed refresh tokens in MongoDB.
 * Each token maps to a user and has an expiry. Tokens are hashed with SHA-256
 * before storage so that even DB compromise does not leak reusable tokens.
 */
const RefreshTokenSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        tokenHash: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expireAfterSeconds: 0 }, // TTL auto-delete
        },
        revokedAt: {
            type: Date,
            default: null,
        },
        createdByIp: {
            type: String,
            default: null,
        },
        userAgent: {
            type: String,
            default: null,
        },
    },
    { timestamps: true, versionKey: false }
);

RefreshTokenSchema.index({ userId: 1, tokenHash: 1 });

module.exports = mongoose.model("RefreshToken", RefreshTokenSchema);
