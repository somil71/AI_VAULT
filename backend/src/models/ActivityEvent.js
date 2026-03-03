const mongoose = require("mongoose");

const ActivityEventSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            required: true,
            enum: [
                "document_uploaded",
                "scam_analyzed",
                "proof_generated",
                "emergency_triggered",
                "watchlist_alert_triggered",
                "transaction_analyzed",
                "identity_minted",
                "auth",
            ],
        },
        walletAddress: { type: String, default: null, index: true },
        userEmail: { type: String, default: null, index: true },
        riskScore: { type: Number, default: null },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        createdAt: { type: Date, default: Date.now, index: true },
    },
    { versionKey: false },
);

module.exports = mongoose.model("ActivityEvent", ActivityEventSchema);

