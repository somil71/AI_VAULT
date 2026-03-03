const express = require("express");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const { createAccessLogger } = require("../services/securityAudit");
const { getQueueHealth } = require("../services/jobQueue");

const router = express.Router();

router.get(
    "/queue-health",
    createAccessLogger("admin_route_access", { domain: "system.queue-health" }),
    auth,
    requireRole(["admin"]),
    async (req, res) => {
        try {
            const data = await getQueueHealth();
            return res.json({
                success: true,
                data,
            });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
);

module.exports = router;
