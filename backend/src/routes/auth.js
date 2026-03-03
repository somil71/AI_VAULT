const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

/**
 * Generates both access and refresh tokens for a user.
 */
function generateTokens(user) {
    const payload = {
        userId: user._id,
        email: user.email,
        role: user.role || "user",
        version: user.refreshTokenVersion || 0
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

    return { accessToken, refreshToken };
}

/**
 * POST /api/v1/auth/register
 */
router.post("/register", async (req, res) => {
    try {
        const { email, password, walletAddress } = req.body;
        if (!email || !password) {
            return res.status(400).json({ status: "error", error: "BadRequest", message: "Email and password are required" });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({
            email,
            password: hashedPassword,
            walletAddress: walletAddress || null,
            lastLoginAt: new Date(),
            meta: {
                userAgent: req.headers["user-agent"] || "unknown",
                ip: req.ip || "unknown"
            }
        });

        await user.save();
        const { accessToken, refreshToken } = generateTokens(user);

        res.status(201).json({
            status: "success",
            data: {
                accessToken,
                refreshToken,
                user: { id: user._id, email: user.email, walletAddress: user.walletAddress, role: user.role }
            }
        });
    } catch (err) {
        if (err.code === 11000 || (err.message && err.message.includes("already exists"))) {
            return res.status(409).json({ status: "error", error: "DuplicateEntry", message: "User already exists" });
        }
        res.status(500).json({ status: "error", error: "RegistrationFailed", message: err.message });
    }
});

/**
 * POST /api/v1/auth/login
 */
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ status: "error", error: "Unauthorized", message: "Invalid credentials" });
        }

        // Update login stats
        user.lastLoginAt = new Date();
        user.meta.set("lastUserAgent", req.headers["user-agent"]);
        user.meta.set("lastIp", req.ip);
        await user.save();

        const { accessToken, refreshToken } = generateTokens(user);

        res.json({
            status: "success",
            data: {
                accessToken,
                refreshToken,
                user: { id: user._id, email: user.email, walletAddress: user.walletAddress, role: user.role }
            }
        });
    } catch (err) {
        res.status(500).json({ status: "error", error: "LoginFailed", message: err.message });
    }
});

/**
 * POST /api/v1/auth/refresh
 * Rotate tokens using a valid refresh token.
 */
router.post("/refresh", async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(400).json({ status: "error", error: "BadRequest", message: "Refresh token required" });

        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user || user.refreshTokenVersion !== decoded.version) {
            return res.status(401).json({ status: "error", error: "Unauthorized", message: "Invalid or revoked token" });
        }

        const tokens = generateTokens(user);
        res.json({ status: "success", data: tokens });
    } catch (err) {
        res.status(401).json({ status: "error", error: "Unauthorized", message: "Token expired or invalid" });
    }
});

/**
 * POST /api/v1/auth/logout
 * Blacklist token via version increment.
 */
router.post("/logout", auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (user) {
            user.refreshTokenVersion += 1;
            await user.save();
        }
        res.json({ status: "success", message: "Logged out and tokens revoked" });
    } catch (err) {
        res.status(500).json({ status: "error", error: "LogoutFailed", message: err.message });
    }
});

/**
 * GET /api/v1/auth/me
 */
router.get("/me", auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password -refreshTokenVersion");
        res.json({ status: "success", data: { user } });
    } catch (err) {
        res.status(500).json({ status: "error", error: "FetchFailed", message: err.message });
    }
});

module.exports = router;
module.exports.generateTokens = generateTokens;
