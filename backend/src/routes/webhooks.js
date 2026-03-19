const express = require("express");
const router = express.Router();
const Webhook = require("../models/Webhook");
const { auth } = require("../middleware/auth");
const crypto = require("crypto");

const success = (res, data) => res.json({ status: "success", data });

/**
 * Create Webhook (Enterprise Only)
 */
router.post("/register", auth, async (req, res) => {
    try {
        if (req.user.tier !== "enterprise" && req.user.role !== "admin") {
            return res.status(403).json({ error: "Enterprise tier required for Webhooks" });
        }

        const { url, events } = req.body;
        const newWebhook = new Webhook({
            userId: req.userId,
            url,
            events: events || ["threat.detected"],
            secret: crypto.randomBytes(24).toString("hex"),
        });

        await newWebhook.save();
        return success(res, newWebhook);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

/**
 * List Webhooks
 */
router.get("/", auth, async (req, res) => {
    try {
        const hooks = await Webhook.find({ userId: req.userId });
        return success(res, hooks);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

module.exports = router;
