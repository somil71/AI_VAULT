const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const { ethers } = require("ethers");
const User = require("../models/User");
const WalletNonce = require("../models/WalletNonce");
const { generateTokens } = require("./auth");

const router = express.Router();
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const APP_NAME = process.env.APP_NAME || "LifeVault";

function normalizeAddress(address) {
    return String(address || "").trim().toLowerCase();
}

function buildSignMessage(nonce) {
    return `Sign to authenticate to ${APP_NAME}.\nNonce: ${nonce}`;
}

async function findOrCreateWalletUser(walletAddress) {
    const normalizedWallet = normalizeAddress(walletAddress);

    let user = await User.findOne({ walletAddress: normalizedWallet });
    if (user) return user;

    const walletEmail = `${normalizedWallet}@wallet.lifevault.local`;
    user = await User.findOne({ email: walletEmail });
    if (user) {
        if (user.walletAddress !== normalizedWallet) {
            user.walletAddress = normalizedWallet;
            await user.save();
        }
        return user;
    }

    const randomPassword = crypto.randomBytes(24).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, 12);
    return User.create({
        email: walletEmail,
        password: hashedPassword,
        walletAddress: normalizedWallet,
    });
}

/**
 * GET /api/v1/auth/wallet/nonce
 * Generate a cryptographic nonce for wallet signature.
 */
router.get("/nonce", async (req, res) => {
    try {
        const walletAddress = normalizeAddress(req.query.walletAddress);
        if (!walletAddress) {
            return res.status(400).json({ status: "error", error: "BadRequest", message: "walletAddress is required" });
        }

        const nonce = crypto.randomBytes(16).toString("hex");
        const expiresAt = new Date(Date.now() + NONCE_TTL_MS);

        await WalletNonce.findOneAndUpdate(
            { walletAddress },
            { walletAddress, nonce, used: false, expiresAt, createdAt: new Date() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        return res.json({
            status: "success",
            data: {
                nonce,
                message: buildSignMessage(nonce),
                expiresAt: expiresAt.toISOString(),
            },
        });
    } catch (error) {
        return res.status(500).json({ status: "error", error: "NonceGenerationFailed", message: error.message });
    }
});

/**
 * POST /api/v1/auth/wallet/verify
 * Verify wallet signature → issue access + refresh tokens (unified with email auth).
 */
router.post("/verify", async (req, res) => {
    try {
        const { walletAddress, signature } = req.body || {};
        const normalizedWallet = normalizeAddress(walletAddress);

        if (!normalizedWallet || !signature) {
            return res.status(400).json({ status: "error", error: "BadRequest", message: "walletAddress and signature are required" });
        }

        // ── Nonce Lookup (enforces TTL) ──────────────────────────────────────
        const nonceDoc = await WalletNonce.findOne({
            walletAddress: normalizedWallet,
            used: false,
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 });

        if (!nonceDoc) {
            return res.status(400).json({ status: "error", error: "NonceExpired", message: "Nonce missing or expired. Request a new one." });
        }

        // ── Signature Verification (EIP-191) ────────────────────────────────
        const message = buildSignMessage(nonceDoc.nonce);
        let recoveredAddress;
        try {
            recoveredAddress = normalizeAddress(ethers.verifyMessage(message, signature));
        } catch {
            return res.status(401).json({ status: "error", error: "InvalidSignature", message: "Signature verification failed" });
        }

        if (recoveredAddress !== normalizedWallet) {
            return res.status(401).json({ status: "error", error: "AddressMismatch", message: "Signature does not match wallet address" });
        }

        // ── Replay Prevention (atomic nonce consumption) ─────────────────────
        const markUsed = await WalletNonce.findOneAndUpdate(
            { _id: nonceDoc._id, used: false },
            { $set: { used: true } },
            { new: true }
        );
        if (!markUsed) {
            return res.status(409).json({ status: "error", error: "NonceConsumed", message: "Nonce already used. Replay attack blocked." });
        }

        // ── User Resolution + Device Metadata ───────────────────────────────
        const user = await findOrCreateWalletUser(normalizedWallet);

        user.lastLoginAt = new Date();
        user.meta.set("lastUserAgent", req.headers["user-agent"] || "unknown");
        user.meta.set("lastIp", req.ip || "unknown");
        user.meta.set("loginMethod", "wallet");
        await user.save();

        // ── Token Generation (UNIFIED with email auth system) ────────────────
        const { accessToken, refreshToken } = generateTokens(user);

        return res.json({
            status: "success",
            data: {
                accessToken,
                refreshToken,
                user: {
                    id: user._id,
                    email: user.email,
                    walletAddress: user.walletAddress,
                    role: user.role,
                },
            },
        });
    } catch (error) {
        return res.status(500).json({ status: "error", error: "WalletAuthFailed", message: error.message });
    }
});

module.exports = router;
