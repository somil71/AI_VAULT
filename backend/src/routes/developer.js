const express = require("express");
const router = express.Router();
const ApiKey = require("../models/ApiKey");
const { auth } = require("../middleware/auth");

const success = (res, data) => res.json({ status: "success", data });

/**
 * List all API Keys for the user
 */
router.get("/keys", auth, async (req, res) => {
    try {
        const keys = await ApiKey.find({ userId: req.userId }).sort({ createdAt: -1 });
        return success(res, keys);
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
});

/**
 * Create a new API Key
 */
router.post("/keys", auth, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: "Key name required" });

        const newKey = new ApiKey({
            userId: req.userId,
            name,
            key: ApiKey.generate(),
            tier: "basic"
        });

        await newKey.save();
        return success(res, newKey);
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
});

/**
 * Revoke an API Key
 */
router.delete("/keys/:id", auth, async (req, res) => {
    try {
        await ApiKey.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        return success(res, { message: "Key revoked" });
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
});

module.exports = router;
