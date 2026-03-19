const express = require("express");
const ActivityEvent = require("../models/ActivityEvent");
const auth = require("../middleware/auth");

const router = express.Router();

/**
 * Builds a MongoDB filter scoped to the authenticated user.
 * Admins can optionally filter by walletAddress/userEmail query params.
 * Regular users are restricted to their own data.
 */
function buildUserFilter(req) {
    if (req.user.role === "admin") {
        const filter = {};
        if (req.query.walletAddress) {
            filter.walletAddress = String(req.query.walletAddress).toLowerCase();
        }
        if (req.query.userEmail) {
            filter.userEmail = String(req.query.userEmail).toLowerCase();
        }
        if (req.query.type) {
            filter.type = String(req.query.type);
        }
        return filter;
    }
    // Standard users: strict isolation
    const filter = {
        $or: [
            { userEmail: (req.user.email || "").toLowerCase() },
            { userId: req.user.userId },
        ],
    };
    if (req.query.type) {
        filter.type = String(req.query.type);
    }
    return filter;
}

/**
 * POST /api/v1/activity/log
 * Log an activity event bound to the authenticated user.
 */
router.post("/log", auth, async (req, res) => {
    try {
        const { type, walletAddress, riskScore, metadata } = req.body || {};
        if (!type) {
            return res.status(400).json({ status: "error", error: "BadRequest", message: "type is required" });
        }

        const created = await ActivityEvent.create({
            type,
            userId: req.userId || null,
            walletAddress: walletAddress ? String(walletAddress).toLowerCase() : null,
            userEmail: req.userEmail ? String(req.userEmail).toLowerCase() : null,
            riskScore: typeof riskScore === "number" ? riskScore : null,
            metadata: metadata && typeof metadata === "object" ? metadata : {},
        });

        return res.json({ status: "success", data: { id: created._id, createdAt: created.createdAt } });
    } catch (error) {
        return res.status(500).json({ status: "error", error: "ActivityLogFailed", message: error.message });
    }
});

/**
 * GET /api/v1/activity/recent
 * Get recent activity events for the authenticated user.
 */
router.get("/recent", auth, async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit || 20), 100);
        const filter = buildUserFilter(req);
        const events = await ActivityEvent.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return res.json({ status: "success", data: { events } });
    } catch (error) {
        return res.status(500).json({ status: "error", error: "ActivityFetchFailed", message: error.message });
    }
});

/**
 * GET /api/v1/activity/summary
 * Get activity summary for the authenticated user.
 */
router.get("/summary", auth, async (req, res) => {
    try {
        const days = Math.min(Number(req.query.days || 30), 365);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const filter = buildUserFilter(req);
        filter.createdAt = { $gte: since };

        const [total, byType, alerts] = await Promise.all([
            ActivityEvent.countDocuments(filter),
            ActivityEvent.aggregate([
                { $match: filter },
                { $group: { _id: "$type", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            ActivityEvent.countDocuments({ ...filter, type: "watchlist_alert_triggered" }),
        ]);

        return res.json({
            status: "success",
            data: {
                total,
                alerts,
                byType: byType.map((item) => ({ type: item._id, count: item.count })),
            },
        });
    } catch (error) {
        return res.status(500).json({ status: "error", error: "SummaryFailed", message: error.message });
    }
});

/**
 * GET /api/v1/activity/export
 * Export activity events in CSV or JSON format.
 */
router.get("/export", auth, async (req, res) => {
    try {
        const format = req.query.format || "csv";
        const filter = buildUserFilter(req);
        const { AuditExportService } = require("../services/auditExportService");

        if (format === "csv") {
            const csv = await AuditExportService.generateCsv(req.userId, filter);
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", `attachment; filename=lifevault_audit_${Date.now()}.csv`);
            return res.send(csv);
        }

        const events = await ActivityEvent.find(filter).sort({ createdAt: -1 });
        return res.json({ status: "success", data: events });
    } catch (error) {
        return res.status(500).json({ status: "error", error: "ExportFailed", message: error.message });
    }
});

module.exports = router;
