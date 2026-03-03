const express = require("express");
const axios = require("axios");
const PhishingResult = require("../models/PhishingResult");
const ActivityEvent = require("../models/ActivityEvent");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const { createAccessLogger } = require("../services/securityAudit");

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// Standardized Response Helper
const success = (res, data) => res.json({ status: "success", data });
const error = (res, status, msg, errCode) => res.status(status).json({ status: "error", error: errCode || "Error", message: msg });

function dayKey(date) {
    return new Date(date).toISOString().slice(0, 10);
}

function toCountMap(items, valueGetter = () => 1) {
    const map = new Map();
    for (const item of items) {
        const key = dayKey(item.createdAt || item.analyzedAt || Date.now());
        map.set(key, (map.get(key) || 0) + valueGetter(item));
    }
    return map;
}

function buildUserFilter(req) {
    // Admins can see everything, users only see their own data
    if (req.user.role === "admin") {
        const filter = {};
        if (req.query.walletAddress) filter.walletAddress = String(req.query.walletAddress).toLowerCase();
        if (req.query.userEmail) filter.userEmail = String(req.query.userEmail).toLowerCase();
        return filter;
    }
    // Strict isolation for standard users
    return {
        $or: [
            { userEmail: req.user.email.toLowerCase() },
            { userId: req.user.userId }
        ]
    };
}

function normalize(value, min, max) {
    if (max <= min) return 0;
    const clamped = Math.max(min, Math.min(max, value));
    return ((clamped - min) / (max - min)) * 100;
}

function riskCategory(score) {
    if (score < 30) return "Low";
    if (score < 55) return "Moderate";
    if (score < 75) return "High";
    return "Critical";
}

async function tryDetectDrift(payload) {
    try {
        const resp = await axios.post(`${AI_SERVICE_URL}/detect-drift`, payload, { timeout: 12000 });
        if (resp.data?.status === "success" && resp.data?.data) return resp.data.data;
        return { alerts: [], status: "unavailable" };
    } catch {
        return { alerts: [], status: "unavailable" };
    }
}

// ── GET /api/v1/stats/dashboard ───────────────────────────────────────────────
router.get("/dashboard", auth, async (req, res) => {
    try {
        const days = Math.min(Number(req.query.days || 30), 365);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const filter = buildUserFilter(req);
        const activityFilter = { ...filter, createdAt: { $gte: since } };
        const phishingFilter = { ...filter, analyzedAt: { $gte: since } };

        const [phishingHistory, activityEvents] = await Promise.all([
            PhishingResult.find(phishingFilter).sort({ analyzedAt: 1 }).lean(),
            ActivityEvent.find(activityFilter).sort({ createdAt: 1 }).lean(),
        ]);

        const totalProtectedAssets = activityEvents.filter((e) => e.type === "document_uploaded").length;
        const suspiciousAlerts = activityEvents.filter((e) => e.type === "watchlist_alert_triggered").length;
        const highRiskScams = phishingHistory.filter((item) => ["HIGH", "CRITICAL"].includes(item.riskLevel)).length;

        const avgRisk = phishingHistory.length > 0
            ? phishingHistory.reduce((sum, item) => sum + Number(item.risk_score || 0), 0) / phishingHistory.length
            : 0;

        const anomalyEvents = activityEvents.filter((e) => e.type === "transaction_analyzed");
        const anomalyAverage = anomalyEvents.length > 0
            ? anomalyEvents.reduce((sum, item) => sum + Number(item.metadata?.overallRisk || 0), 0) / anomalyEvents.length
            : 0;

        const watchlistHitScore = normalize(suspiciousAlerts, 0, 20);
        const vaultActivityScore = normalize(totalProtectedAssets, 0, 25);
        const emergencyConfigured = activityEvents.some((e) => e.type === "emergency_triggered");
        const emergencyScore = emergencyConfigured ? 15 : 45;

        const compositeRisk = Math.round(
            0.4 * (avgRisk * 100) +
            0.25 * anomalyAverage +
            0.15 * watchlistHitScore +
            0.1 * vaultActivityScore +
            0.1 * emergencyScore
        );

        const category = riskCategory(compositeRisk);
        const riskExplanation = `Risk is ${category.toLowerCase()} based on recent security signals.`;

        const scamDistribution = {
            low: phishingHistory.filter((x) => (x.risk_score || 0) < 0.25).length,
            medium: phishingHistory.filter((x) => (x.risk_score || 0) >= 0.25 && (x.risk_score || 0) < 0.5).length,
            high: phishingHistory.filter((x) => (x.risk_score || 0) >= 0.5 && (x.risk_score || 0) < 0.75).length,
            critical: phishingHistory.filter((x) => (x.risk_score || 0) >= 0.75).length,
        };

        const riskTrendMap = new Map();
        phishingHistory.forEach((item) => {
            const key = dayKey(item.analyzedAt);
            const bucket = riskTrendMap.get(key) || { total: 0, count: 0 };
            bucket.total += Number((item.risk_score || 0) * 100);
            bucket.count += 1;
            riskTrendMap.set(key, bucket);
        });

        const riskTrend = Array.from(riskTrendMap.entries()).map(([date, value]) => ({
            date,
            score: Number((value.total / Math.max(1, value.count)).toFixed(2)),
        }));

        const docsPerDayMap = toCountMap(activityEvents.filter((e) => e.type === "document_uploaded"));
        const vaultGrowth = Array.from(docsPerDayMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .reduce((acc, [date, count]) => {
                const prev = acc.length > 0 ? acc[acc.length - 1].count : 0;
                acc.push({ date, count: prev + count });
                return acc;
            }, []);

        const alertDailyMap = toCountMap(activityEvents.filter((e) => e.type === "watchlist_alert_triggered"));
        const alertFrequency = Array.from(alertDailyMap.entries()).map(([date, count]) => ({ date, count }));

        const feed = activityEvents
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 30)
            .map((event) => ({
                id: event._id,
                type: event.type,
                createdAt: event.createdAt,
                metadata: event.metadata || {},
            }));

        return success(res, {
            generatedAt: new Date().toISOString(),
            kpis: {
                total_protected_assets: totalProtectedAssets,
                risk_exposure_score: compositeRisk,
                suspicious_alerts_30d: suspiciousAlerts + highRiskScams,
                vault_health_status: totalProtectedAssets > 0 ? "Healthy" : "Needs Setup",
            },
            risk_intelligence: {
                score: compositeRisk,
                category,
                explanation: riskExplanation,
                suggested_actions: ["Check high-risk URLs", "Monitor new transactions"],
            },
            charts: {
                risk_trend: riskTrend,
                scam_probability_distribution: scamDistribution,
                vault_growth: vaultGrowth,
                alert_frequency: alertFrequency,
            },
            activity_feed: feed
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        return res.status(500).json({ status: "error", error: "DashboardStatsError", message: error.message });
    }
});

// ── GET /api/v1/stats/admin ───────────────────────────────────────────────────
router.get("/admin", createAccessLogger("admin_route_access", { domain: "stats" }), auth, requireRole(["admin"]), async (req, res) => {
    try {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [phishingHistory, activityEvents] = await Promise.all([
            PhishingResult.find({ analyzedAt: { $gte: since } }).lean(),
            ActivityEvent.find({ createdAt: { $gte: since } }).lean(),
        ]);

        const categories = phishingHistory.reduce((acc, item) => {
            const key = item.scam_category || item.riskLevel || "UNKNOWN";
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        const topScamCategories = Object.entries(categories)
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return success(res, {
            total_scans_30d: phishingHistory.length,
            top_scam_categories: topScamCategories,
            system_wide_activity: activityEvents.length
        });
    } catch (error) {
        return res.status(500).json({ status: "error", error: "AdminStatsError", message: error.message });
    }
});

module.exports = router;
