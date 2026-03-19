const mongoose = require("mongoose");

/**
 * Webhook Model
 * Used by B2B/Enterprise users to receive real-time threat intelligence.
 */
const WebhookSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    url: {
        type: String,
        required: true,
        trim: true,
    },
    secret: {
        type: String, // HMAC secret for verification
        required: true,
    },
    events: {
        type: [String],
        default: ["threat.detected", "threat.propagated"],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    lastTriggeredAt: Date,
    failCount: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model("Webhook", WebhookSchema);
