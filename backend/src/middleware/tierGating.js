/**
 * Tier Gating Middleware
 * 
 * Functions to restrict access based on user subscription level.
 */

const requireTier = (allowedTiers) => {
    return (req, res, next) => {
        const userTier = req.user?.tier || "free";
        
        if (allowedTiers.includes(userTier)) {
            return next();
        }

        return res.status(403).json({
            status: "error",
            error: "SubscriptionRequired",
            message: `This feature requires a ${allowedTiers.join(" or ")} subscription.`,
            meta: { currentTier: userTier, requiredTiers: allowedTiers }
        });
    };
};

module.exports = { requireTier };
