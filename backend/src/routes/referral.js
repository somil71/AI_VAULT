const express = require("express");
const router = express.Router();
const { ReferralService } = require("../services/referralService");
const { auth } = require("../middleware/auth");

const success = (res, data) => res.json({ status: "success", data });

/**
 * Referral Stats
 */
router.get("/stats", auth, async (req, res) => {
    try {
        const stats = await ReferralService.getStats(req.userId);
        return success(res, stats);
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
});

/**
 * Regenerate Referral Code
 */
router.post("/regenerate", auth, async (req, res) => {
    try {
        const code = await ReferralService.generateCode(req.userId);
        return success(res, { code });
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
});

module.exports = router;
