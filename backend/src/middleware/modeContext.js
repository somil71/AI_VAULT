/**
 * Mode Context Middleware
 * Distinguishes between 'consumer' and 'enterprise' requests.
 * Prepared for future split while maintaining a unified core.
 */
const modeContext = (req, res, next) => {
    // 1. Check if authenticated via API Key (Enterprise-first)
    if (req.apiKey) {
        req.mode = "enterprise";
    } 
    // 2. Check JWT User Tier
    else if (req.user && req.user.tier === "enterprise") {
        req.mode = "enterprise";
    } 
    // 3. Default to Consumer
    else {
        req.mode = "consumer";
    }

    res.setHeader("X-LifeVault-Mode", req.mode);
    next();
};

/**
 * Feature Gating Middleware
 * Restricts access based on the request mode.
 */
const requireMode = (mode) => (req, res, next) => {
    if (req.mode !== mode) {
        return res.status(403).json({
            status: "error",
            error: "ModeRestriction",
            message: `This feature is restricted to ${mode} mode.`
        });
    }
    next();
};

module.exports = { modeContext, requireMode };
