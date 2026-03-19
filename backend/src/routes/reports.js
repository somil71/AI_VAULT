const express = require("express");
const router = express.Router();
const { ReportService } = require("../services/reportService");
const { auth } = require("../middleware/auth");
const { requireTier } = require("../middleware/tierGating");

const success = (res, data) => res.json({ status: "success", data });

/**
 * Monthly Security Report
 * Only available for Pro+ users as per implementation plan.
 */
router.get("/monthly", auth, requireTier(["pro", "business", "enterprise"]), async (req, res) => {
    try {
        const report = await ReportService.generateMonthlyReport(req.userId);
        return success(res, report);
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
});

module.exports = router;
