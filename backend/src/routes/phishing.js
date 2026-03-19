const express = require("express");
const axios = require("axios");
const PhishingResult = require("../models/PhishingResult");
const { auth } = require("../middleware/auth");
const { apiKeyAuth } = require("../middleware/apiKeyAuth");
const requireRole = require("../middleware/requireRole");
const { enqueueJob } = require("../services/jobQueue");
const { strictLimiter } = require("../middleware/rateLimiter");
const { abuseMonitor } = require("../middleware/abuseMonitor");
const { ThreatGraphService } = require("../services/threatGraphService");

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

        // 1. Community Block Check (Free & Instant)
        if (url) {
            const communityCheck = await ThreatGraphService.isCommunityBlocked(url);
            if (communityCheck.blocked) {
                return success(res, {
                    risk_score: 0.99,
                    risk_level: "CRITICAL",
                    confidence: 1.0,
                    reasoning: [`Community Confirmed Block (${communityCheck.reportCount} reports)`],
                    scam_category: "community_confirmed",
                    analyzedAt: new Date().toISOString(),
                    source: "community_threat_graph"
                });
            }
        }

        // 2. ML Inference (if not blocked by community)
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

        // 3. Record Threat in Graph
        if (url && result.risk_score > 0.65) {
            ThreatGraphService.recordThreat(url, result.risk_score, req.userId)
                .catch(err => console.error("ThreatGraph recording failed:", err.message));
            
            // 3.1 Dispatch Real-time Alert (Phase 6 Prioritization)
            const { alertService } = require("../services/alertService");
            const alert = alertService.createThreatAlert("critical", {
                level: result.risk_level || "HIGH",
                title: "Malicious Content Detected",
                message: result.reasoning?.[0] || "LifeVault AI detected a high-risk security threat.",
                confidence: result.confidence || 0.0,
                metadata: { score: result.risk_score, url: url || "text", category: result.scam_category }
            });
            alertService.sendAlert(req.userId, alert);
        }

        // 4. Persistence
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
router.post("/analyze", strictLimiter, auth, abuseMonitor, analyzeSync);
router.post("/analyze/sync", strictLimiter, auth, abuseMonitor, analyzeSync);

/**
 * AI Phishing Analysis - Supports JWT or API Key
 */
router.post("/analyze/url", strictLimiter, async (req, res, next) => {
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        return auth(req, res, next);
    }
    return apiKeyAuth(req, res, next);
}, abuseMonitor, analyzeSync);

// Override logging for extension
router.post("/threat-events/override", auth, async (req, res) => {
    try {
        const { url, timestamp } = req.body;
        console.log(`[SECURITY] User ${req.userId} overrode threat block for ${url} at ${timestamp}`);
        return success(res, { logged: true });
    } catch (error) {
        return res.status(500).json({ status: "error", error: "LogFail", message: error.message });
    }
});

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

router.get("/community/stats", async (req, res) => {
    try {
        const stats = await ThreatGraphService.getGlobalStats();
        return success(res, stats);
    } catch (error) {
        return res.status(500).json({ status: "error", error: "StatsLoadError", message: error.message });
    }
});

/**
 * GET /api/v1/phishing/analyze/bulk
 * High-volume batch analysis for Enterprise users.
 */
router.post("/analyze/bulk", apiKeyAuth, requireMode("enterprise"), async (req, res) => {
    try {
        const { urls } = req.body;
        if (!Array.isArray(urls) || urls.length > 100) {
            return res.status(400).json({ error: "Provide an array of up to 100 URLs" });
        }

        // Process in parallel with internal sync logic
        const results = await Promise.all(urls.map(async (url) => {
            try {
                // Mocking the call to analyzeSync for each URL to avoid re-implementing logic
                const mockReq = { body: { url }, userId: req.userId, userEmail: req.userEmail };
                const mockRes = { json: (data) => data, status: () => ({ json: (data) => data }) };
                return await analyzeSync(mockReq, mockRes);
            } catch (err) {
                return { url, error: err.message };
            }
        }));

        return success(res, { 
            total: urls.length,
            results 
        });
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
});

module.exports = router;
