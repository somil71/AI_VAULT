const mongoose = require("mongoose");
const crypto = require("crypto");

/**
 * ApiKey Model
 * Manages external access for developers and third-party integrations.
 */
const ApiKeySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    key: {
        type: String,
        unique: true,
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    tier: {
        type: String,
        enum: ["basic", "premium", "enterprise"],
        default: "basic",
    },
    rateLimit: {
        type: Number,
        default: 1000, // requests per day
    },
    lastUsedAt: Date,
    isActive: {
        type: Boolean,
        default: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

/**
 * Generate a new random API key
 */
ApiKeySchema.statics.generate = function() {
    return 'lv_' + crypto.randomBytes(32).toString('hex');
};

module.exports = mongoose.model("ApiKey", ApiKeySchema);
