const mongoose = require("mongoose");

/**
 * PhishingResult model – stores historical analysis results.
 * Standardized for LifeVault AI v2.0
 */
const PhishingResultSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, index: true },
    userEmail: { type: String, index: true },
    walletAddress: { type: String, index: true },
    inputText: { type: String, default: null },
    inputUrl: { type: String, default: null },
    risk_score: { type: Number, required: true }, // 0-1
    riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], required: true },
    confidence: { type: Number, default: 0 }, // 0-1
    reasoning: [String],
    scam_category: { type: String, default: "general_phishing" },
    model_version: { type: String, default: "v2.0" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    analyzedAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model("PhishingResult", PhishingResultSchema);
