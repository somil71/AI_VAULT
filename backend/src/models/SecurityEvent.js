const mongoose = require("mongoose");

const SecurityEventSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
            default: null,
        },
        role: {
            type: String,
            default: "guest",
        },
        route: {
            type: String,
            required: true,
            index: true,
        },
        method: {
            type: String,
            required: true,
        },
        action: {
            type: String,
            required: true,
        },
        allowed: {
            type: Boolean,
            required: true,
        },
        statusCode: {
            type: Number,
            required: true,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        timestamp: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    { versionKey: false }
);

module.exports = mongoose.model("SecurityEvent", SecurityEventSchema);
