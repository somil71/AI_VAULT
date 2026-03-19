/**
 * Feature Flag Service — Advanced Deployment Toggle
 * Decouples 'Code Deployment' from 'Feature Release'.
 */

const FEATURE_FLAGS = {
    ZK_IDENTITY_VERIFICATION: process.env.ENABLE_ZK === "true" || false,
    MULTI_CHAIN_VAULT: process.env.ENABLE_MULTI_CHAIN === "true" || false,
    ENTERPRISE_BULK_SCAN: true, // Core capability
    ADVANCED_ML_EXPLAINABILITY: true, // Enabled in Phase 2
    REAL_TIME_ALERTS_SSE: true // Enabled in Phase 3
};

class FeatureFlagService {
    /**
     * Checks if a specific feature is enabled globally.
     */
    static isEnabled(featureName) {
        return !!FEATURE_FLAGS[featureName];
    }

    /**
     * Returns the full state of active features for client-side sync.
     */
    static getActiveFlags() {
        return FEATURE_FLAGS;
    }
}

/**
 * Middleware factory to gate routes by feature flag.
 */
const requireFeature = (featureName) => (req, res, next) => {
    if (!FeatureFlagService.isEnabled(featureName)) {
        return res.status(503).json({
            status: "error",
            code: "FeatureDisabled",
            message: `The '${featureName}' capability is currently in development/disabled.`
        });
    }
    next();
};

module.exports = { FeatureFlagService, requireFeature };
