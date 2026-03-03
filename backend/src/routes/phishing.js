const express = require("express");
const axios = require("axios");
const PhishingResult = require("../models/PhishingResult");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const { enqueueJob } = require("../services/jobQueue");

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

const success = (res, data) => res.json({ status: "success", data });

async function analyzeSync(req, res) {
    const requestId = req.requestId || "req-" + Date.now();
    try {
        const { text, url } = req.body || {};

        if (!text && !url) {
            return res.status(400).json({ status: "error", error: "BadRequest", message: "Provide text or url to analyze" });
        }

        const aiResponse = await axios.post(
            `${AI_SERVICE_URL}/analyze-phishing`,
            { text, url },
            { timeout: 30000 }
        );

        const aiBody = aiResponse.data;
        if (aiBody.status !== "success" || !aiBody.data) {
            return res.status(502).json({ status: "error", error: "AIServiceError", message: "Invalid response from AI" });
        }

        const result = aiBody.data;

        // Async persistence to not block client response
        PhishingResult.create({
            userId: req.userId || null,
            userEmail: req.userEmail || null,
            inputText: text || null,
            inputUrl: url || null,
            risk_score: result.risk_score,
            riskLevel: result.risk_level || "LOW",
            confidence: result.confidence,
            reasoning: result.reasoning || [],
            scam_category: result.scam_category || "general_phishing",
            model_version: aiBody.meta?.model_version || "v2.0"
        }).catch(err => console.error("History storage failed:", err.message));

        return success(res, {
            ...result,
            analyzedAt: new Date().toISOString()
        });
    } catch (error) {
        if (error.code === "ECONNREFUSED") {
            return res.status(503).json({
                status: "error",
                error: "AIServiceUnavailable",
                message: "AI service is offline"
            });
        }
        return res.status(error.response?.status || 500).json({
            status: "error",
            error: error.name || "ProcessingError",
            message: error.message,
            meta: { request_id: requestId }
        });
    }
}

// Protected routes
router.post("/analyze", auth, analyzeSync);
router.post("/analyze/sync", auth, analyzeSync);

router.post("/analyze-async", auth, requireRole(["user", "admin"]), async (req, res) => {
    try {
        const { text, url } = req.body || {};
        if (!text && !url) {
            return res.status(400).json({ status: "error", error: "BadRequest", message: "Input required" });
        }

        const job = await enqueueJob("phishing_analyze", { text: text || null, url: url || null });
        return success(res, {
            jobId: String(job._id),
            status: "pending"
        });
    } catch (error) {
        return res.status(500).json({ status: "error", error: "JobQueueError", message: error.message });
    }
});

router.get("/history", auth, async (req, res) => {
    try {
        const filter = req.user.role === "admin" ? {} : {
            $or: [{ userId: req.userId }, { userEmail: req.userEmail }]
        };
        const history = await PhishingResult.find(filter).sort({ analyzedAt: -1 }).limit(20);
        return success(res, { history });
    } catch (error) {
        return res.status(500).json({ status: "error", error: "HistoryLoadError", message: error.message });
    }
});

module.exports = router;

