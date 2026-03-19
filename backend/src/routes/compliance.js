const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const { AuditService } = require("../services/auditService");

/**
 * GET /api/v1/compliance/verify
 * Triggers a full integrity scan of the SHA-256 audit chain.
 * Restricted to Admin users only.
 */
router.get("/verify", auth, requireRole(["admin"]), async (req, res) => {
    try {
        const report = await AuditService.verifyIntegrity();
        res.json({
            status: "success",
            data: report
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
});

/**
 * GET /api/v1/compliance/logs
 * Retrieves the chained audit logs for compliance review.
 */
router.get("/logs", auth, requireRole(["admin"]), async (req, res) => {
    try {
        const AdminAuditLog = require("../models/AdminAuditLog");
        const logs = await AdminAuditLog.find().sort({ timestamp: -1 }).limit(100);
        res.json({
            status: "success",
            data: {
                count: logs.length,
                logs
            }
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
});

module.exports = router;
