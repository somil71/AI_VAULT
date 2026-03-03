const mongoose = require("mongoose");
const crypto = require("crypto");

/**
 * AnomalyResult – persists transaction anomaly analysis results.
 *
 * inputHash: SHA-256 of the raw input payload (not the file itself)
 *            to allow idempotent duplicate detection.
 */
const AnomalyResultSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    inputHash: {
        type: String,
        required: true,
        index: true,
    },
    anomalyScore: {
        type: Number,
        required: true,
    },
    riskCategory: {
        type: String,
        enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        default: "LOW",
    },
    totalTransactions: {
        type: Number,
        default: 0,
    },
    flaggedCount: {
        type: Number,
        default: 0,
    },
    overallRiskScore: {
        type: Number,
        default: 0,
    },
    triggerFactors: {
        type: [String],
        default: [],
    },
    flaggedTransactions: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
    },
    summary: {
        type: String,
        default: "",
    },
    model_version: {
        type: String,
        default: "v2.1",
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
});

// Compound index for efficient user + time queries
AnomalyResultSchema.index({ userId: 1, createdAt: -1 });

/**
 * Compute SHA-256 hash of the transaction array for idempotency.
 */
AnomalyResultSchema.statics.computeInputHash = function (transactions) {
    const payload = JSON.stringify(
        transactions.map((t) => ({
            date: t.date,
            description: t.description,
            amount: t.amount,
            merchant: t.merchant,
        }))
    );
    return crypto.createHash("sha256").update(payload).digest("hex");
};

module.exports = mongoose.model("AnomalyResult", AnomalyResultSchema);
