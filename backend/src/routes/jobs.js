const express = require("express");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const { getJobById } = require("../services/jobQueue");

const router = express.Router();

router.get("/:id", auth, requireRole(["user", "admin"]), async (req, res) => {
    try {
        const job = await getJobById(req.params.id);
        if (!job) {
            return res.status(404).json({ success: false, error: "Job not found" });
        }

        return res.json({
            success: true,
            status: job.status,
            result: job.result || null,
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
