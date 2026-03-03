const express = require("express");
const { mintIdentityNFT, storeDocumentHash } = require("../services/blockchain");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const { createAccessLogger } = require("../services/securityAudit");

const router = express.Router();

router.get("/status", (req, res) => {
    return res.json({
        success: true,
        data: {
            message: "Vault service operational",
            identityContract: process.env.IDENTITY_CONTRACT || process.env.IDENTITY_NFT_ADDRESS || null,
            vaultContract: process.env.VAULT_CONTRACT || process.env.VAULT_REGISTRY_ADDRESS || null,
        },
    });
});

router.post("/mint-identity", createAccessLogger("sensitive_blockchain_relay_access", { relay: "vault.mintIdentityNFT" }), auth, requireRole(["user", "admin"]), async (req, res) => {
    try {
        const { walletAddress } = req.body || {};
        if (!walletAddress) {
            return res.status(400).json({ success: false, error: "walletAddress is required" });
        }

        const result = await mintIdentityNFT(walletAddress);
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.post("/upload-document", createAccessLogger("sensitive_blockchain_relay_access", { relay: "vault.storeDocumentHash" }), auth, requireRole(["user", "admin"]), async (req, res) => {
    try {
        const { hash } = req.body || {};
        if (!hash) {
            return res.status(400).json({ success: false, error: "hash is required" });
        }

        const result = await storeDocumentHash(hash);
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
