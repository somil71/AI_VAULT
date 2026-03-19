const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { alertService } = require("../services/alertService");

/**
 * GET /api/v1/alerts/stream
 * SSE Endpoint for real-time security notifications.
 */
router.get("/stream", auth, (req, res) => {
    // Standard SSE Headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Register client in the hub
    alertService.addClient(req.userId, res);

    // Keep connection alive with a heartbeat
    const heartbeat = setInterval(() => {
        res.write(": heartbeat\n\n");
    }, 30000);

    // Clean up heartbeat on close
    res.on("close", () => clearInterval(heartbeat));
});

/**
 * POST /api/v1/alerts/test (Admin/Internal only)
 * Triggers a test alert for the current user.
 */
router.post("/test", auth, (req, res) => {
    const alert = alertService.createThreatAlert("info", {
        title: "Test Notification",
        message: "LifeVault real-time connection is active.",
        metadata: { source: "manual_test" }
    });
    alertService.sendAlert(req.userId, alert);
    res.json({ status: "success", message: "Alert sent" });
});

module.exports = router;
