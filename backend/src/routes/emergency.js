const express = require("express");
const { triggerEmergencyRelease } = require("../services/blockchain");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const { createAccessLogger } = require("../services/securityAudit");

const router = express.Router();

router.get("/status/:address", (req, res) => {
    return res.json({
        success: true,
        data: {
            ownerAddress: req.params.address,
            contractAddress: process.env.EMERGENCY_CONTRACT || process.env.EMERGENCY_RELEASE_ADDRESS || null,
        },
    });
});

router.post("/trigger", createAccessLogger("sensitive_blockchain_relay_access", { relay: "emergency.triggerEmergencyRelease" }), auth, requireRole(["user", "admin"]), async (req, res) => {
    try {
        const { userAddress } = req.body || {};
        if (!userAddress) {
            return res.status(400).json({ success: false, error: "userAddress is required" });
        }

        const result = await triggerEmergencyRelease(userAddress);
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
