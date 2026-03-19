const express = require("express");
const { VaultService } = require("../services/vaultService");
const auth = require("../middleware/auth");
const { createAccessLogger } = require("../services/securityAudit");

const router = express.Router();
const success = (res, data) => res.json({ status: "success", data });

/**
 * List all Vaults accessible to user
 */
router.get("/list", auth, async (req, res) => {
    try {
        const vaults = await VaultService.listUserVaults(req.userId);
        return success(res, vaults);
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
});

/**
 * Create a new Team Vault
 */
router.post("/create", auth, async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: "Name required" });
        const vault = await VaultService.createVault(req.userId, name, description);
        return success(res, vault);
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
});

/**
 * Invite member to Vault
 */
router.post("/invite", auth, async (req, res) => {
    try {
        const { vaultId, email, role } = req.body;
        const vault = await VaultService.addMember(vaultId, req.userId, email, role);
        return success(res, vault);
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
});

/**
 * List items in a specific vault
 */
router.get("/:vaultId/items", auth, async (req, res) => {
    try {
        const items = await VaultService.listVaultItems(req.params.vaultId, req.userId);
        return success(res, items);
    } catch (error) {
        return res.status(403).json({ status: "error", message: error.message });
    }
});

module.exports = router;

