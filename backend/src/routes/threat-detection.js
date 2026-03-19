const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { apiKeyAuth } = require("../middleware/apiKeyAuth");
const { modeContext } = require("../middleware/modeContext");
const phishingRoutes = require("./phishing");
const transactionRoutes = require("./transactions");
const reputationRoutes = require("./reputation");

// Apply Mode Context globally for threat detection
router.use(modeContext);

/**
 * Capability Module: Threat Detection
 * Consolidates all AI-driven security analysis.
 */

// Legacy Phishing Routes (Integrated)
router.use("/phishing", phishingRoutes);

// Legacy Transaction Routes (Integrated)
router.use("/transactions", transactionRoutes);

// Legacy Wallet Reputation Routes (Integrated)
router.use("/reputation", reputationRoutes);

// Unified Analyze Endpoint (The future of the API)
router.post("/analyze", async (req, res, next) => {
    // Hybrid Auth: JWT or API Key
    if (req.headers.authorization) return auth(req, res, next);
    return apiKeyAuth(req, res, next);
}, phishingRoutes); // Maps to the standard analyze logic in phishing.js

module.exports = router;
