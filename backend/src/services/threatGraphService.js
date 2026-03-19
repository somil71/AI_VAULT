const mongoose = require("mongoose");
const crypto = require("crypto");

/**
 * Threat Intelligence Schema
 * Stores anonymized threat data reported by users.
 */
const threatIntelligenceSchema = new mongoose.Schema({
    urlHash: { type: String, required: true, unique: true, index: true },
    domain: { type: String, required: true, index: true },
    firstSeenAt: { type: Date, default: Date.now },
    reportCount: { type: Number, default: 0 },
    lastScore: { type: Number, required: true },
    consensusLevel: { 
        type: String, 
        enum: ["CONFIRMED", "SUSPECTED", "CLEARED"], 
        default: "SUSPECTED" 
    },
    contributingUsers: { type: Number, default: 0 },
    blockedForAllAt: { type: Date, default: null }
}, {
    timestamps: true
});

const ThreatIntelligence = mongoose.model("ThreatIntelligence", threatIntelligenceSchema);
const WebhookService = require("./webhookService");

/**
 * Service to manage the community-driven threat graph.
 */
class ThreatGraphService {
    
    static async recordThreat(url, score, userId) {
        if (!url || score < 0.4) return;

        const urlHash = crypto.createHash("sha256").update(new URL(url).href).digest("hex");
        const domain = new URL(url).hostname;

        try {
            const entry = await ThreatIntelligence.findOneAndUpdate(
                { urlHash },
                {
                    $inc: { reportCount: 1, contributingUsers: 1 },
                    $set: { lastScore: score, domain },
                    $setOnInsert: { firstSeenAt: new Date() }
                },
                { upsert: true, new: true }
            );

            // Propagation logic: 3+ reports with high score = CONFIRMED block
            if (entry.reportCount >= 3 && entry.lastScore > 0.70 && entry.consensusLevel !== "CONFIRMED") {
                entry.consensusLevel = "CONFIRMED";
                entry.blockedForAllAt = new Date();
                await entry.save();
                console.log(`[THREAT_GRAPH] URL ${domain} moved to CONFIRMED block status.`);

                // Notify B2B Webhooks if newly blocked
                if (entry.reportCount === 3) { // Assuming 'entry.reportCount' is the current count after increment
                    WebhookService.notify("threat.propagated", {
                        url: url, // Use original URL for notification
                        reports: entry.reportCount,
                        avgRisk: entry.lastScore // Assuming lastScore is representative of avgRisk for now
                    });
                }
            }

            return entry;
        } catch (error) {
            console.error("Failed to record threat in graph:", error.message);
        }
    }

    static async isCommunityBlocked(url) {
        if (!url) return { blocked: false };
        
        try {
            const urlHash = crypto.createHash("sha256").update(new URL(url).href).digest("hex");
            const entry = await ThreatIntelligence.findOne({ urlHash });

            if (entry && entry.consensusLevel === "CONFIRMED") {
                return {
                    blocked: true,
                    reportCount: entry.reportCount,
                    consensusLevel: entry.consensusLevel
                };
            }

            return { blocked: false };
        } catch (error) {
            console.error("Community block lookup failed:", error.message);
            return { blocked: false };
        }
    }

    static async clearThreat(url, adminUserId) {
        // In a real app, we'd verify adminUserId role here or via middleware
        const urlHash = crypto.createHash("sha256").update(new URL(url).href).digest("hex");
        return await ThreatIntelligence.findOneAndUpdate(
            { urlHash },
            { $set: { consensusLevel: "CLEARED", blockedForAllAt: null } },
            { new: true }
        );
    }
    
    static async getGlobalStats() {
        return {
            confirmedCount: await ThreatIntelligence.countDocuments({ consensusLevel: "CONFIRMED" }),
            totalEntries: await ThreatIntelligence.countDocuments()
        };
    }
}

module.exports = { ThreatIntelligence, ThreatGraphService };
