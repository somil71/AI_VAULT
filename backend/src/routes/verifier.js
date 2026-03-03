const express = require("express");
const { verifySelectiveProof } = require("../services/blockchain");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const { createAccessLogger } = require("../services/securityAudit");

const router = express.Router();

router.get("/contract-address", (req, res) => {
    return res.json({
        success: true,
        data: {
            address: process.env.VERIFIER_CONTRACT || process.env.SELECTIVE_VERIFIER_ADDRESS || null,
            claimTypes: {
                0: "AGE_ABOVE_18",
                1: "INCOME_ABOVE_X",
                2: "DEGREE_VERIFIED",
            },
        },
    });
});

router.post("/generate-proof", createAccessLogger("sensitive_blockchain_relay_access", { relay: "verifier.verifySelectiveProof" }), auth, requireRole(["user", "admin"]), async (req, res) => {
    try {
        const { hash, signature } = req.body || {};
        if (!hash || !signature) {
            return res.status(400).json({ success: false, error: "hash and signature are required" });
        }

        const result = await verifySelectiveProof(hash, signature);
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
