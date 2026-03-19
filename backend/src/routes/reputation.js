const express = require("express");
const router = express.Router();
const { WalletReputationService } = require("../services/walletReputationService");
const { auth } = require("../middleware/auth");

const success = (res, data) => res.json({ status: "success", data });

/**
 * Public Reputation Endpoint
 * Allows anyone to check a wallet's trust score.
 */
router.get("/:address", async (req, res) => {
    try {
        const { address } = req.params;
        if (!address || !address.startsWith("0x")) {
            return res.status(400).json({ status: "error", error: "InvalidAddress", message: "Provide a valid Ethereum/Polygon address" });
        }

        const reputation = await WalletReputationService.calculateScore(address);
        return success(res, reputation);
    } catch (error) {
        return res.status(500).json({ status: "error", error: "ScoringError", message: error.message });
    }
});

/**
 * Global Reputation Stats
 */
router.get("/stats/global", async (req, res) => {
    try {
        const stats = await WalletReputationService.getGlobalStats();
        return success(res, stats);
    } catch (error) {
        return res.status(500).json({ status: "error", error: "StatsError", message: error.message });
    }
});

module.exports = router;
