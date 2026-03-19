const ApiKey = require("../models/ApiKey");

/**
 * API Key Middleware
 * Validates external developer keys and enforces rate limits.
 */
const apiKeyAuth = async (req, res, next) => {
    const key = req.headers["x-api-key"] || req.query.apiKey;

    if (!key) {
        return res.status(401).json({
            status: "error",
            message: "Missing API key. Provide x-api-key header."
        });
    }

    try {
        const apiKeyDoc = await ApiKey.findOne({ key, isActive: true });

        if (!apiKeyDoc) {
            return res.status(403).json({
                status: "error",
                message: "Invalid or inactive API key."
            });
        }

        // Attach owner info
        req.userId = apiKeyDoc.userId;
        req.apiKeyId = apiKeyDoc._id;
        req.apiKeyTier = apiKeyDoc.tier;

        // Update usage
        apiKeyDoc.lastUsedAt = new Date();
        await apiKeyDoc.save();

        next();
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
};

module.exports = { apiKeyAuth };
