const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const LoginAttempt = require("../models/LoginAttempt");
const auth = require("../middleware/auth");
const { strictLimiter } = require("../middleware/rateLimiter");
const { logSecurityEvent } = require("../services/securityAudit");

const router = express.Router();

// ── Config ──────────────────────────────────────────────────────────────────
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MFA_TEMP_TOKEN_EXPIRY = "5m";

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Hashes a token string with SHA-256 for safe DB storage.
 * @param {string} token - Raw JWT refresh token
 * @returns {string} Hex-encoded SHA-256 hash
 */
function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generates short-lived access token and long-lived refresh token.
 * @param {object} user - Mongoose User document
 * @returns {{ accessToken: string, refreshToken: string }}
 */
function generateTokenPair(user) {
    const payload = {
        userId: user._id,
        email: user.email,
        role: user.role || "user",
        tier: user.tier || "free",
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = jwt.sign(
        { ...payload, type: "refresh" },
        process.env.JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
}

/**
 * Stores a hashed refresh token in MongoDB.
 * @param {string} userId - User's MongoDB _id
 * @param {string} rawToken - The raw refresh token JWT
 * @param {object} req - Express request (for IP/UA logging)
 */
async function storeRefreshToken(userId, rawToken, req) {
    await RefreshToken.create({
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
        createdByIp: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
    });
}

/**
 * Logs a login attempt for lockout tracking.
 * @param {string} email - Email attempted
 * @param {boolean} success - Whether login succeeded
 * @param {object} req - Express request
 * @param {string} [reason] - Failure reason
 */
async function recordLoginAttempt(email, success, req, reason = null) {
    LoginAttempt.create({
        email: email.toLowerCase(),
        ip: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
        success,
        reason,
    }).catch((err) => console.error("[Auth] Login attempt logging failed:", err.message));
}

/**
 * Checks if an account is locked due to too many failed attempts.
 * @param {object} user - User document
 * @returns {{ isLocked: boolean, minutesRemaining: number }}
 */
function checkAccountLock(user) {
    if (user.lockedUntil && user.lockedUntil > new Date()) {
        const minutesRemaining = Math.ceil((user.lockedUntil - Date.now()) / 60000);
        return { isLocked: true, minutesRemaining };
    }
    return { isLocked: false, minutesRemaining: 0 };
}

// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Creates a new user account and returns token pair.
 */
router.post("/register", strictLimiter, async (req, res) => {
    try {
        const { email, password, walletAddress, referralCode } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                status: "error",
                error: "BadRequest",
                message: "Email and password are required",
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                status: "error",
                error: "BadRequest",
                message: "Password must be at least 8 characters",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({
            email,
            password: hashedPassword,
            walletAddress: walletAddress || null,
            lastLoginAt: new Date(),
            meta: {
                userAgent: req.headers["user-agent"] || "unknown",
                ip: req.ip || "unknown",
            },
        });

        await user.save();
        
        // Generate referral code for the new user
        const { ReferralService } = require("../services/referralService");
        await ReferralService.generateCode(user._id);

        // Process referral if code provided
        if (referralCode) {
            await ReferralService.processReferral(user._id, referralCode);
        }

        const { accessToken, refreshToken } = generateTokenPair(user);
        await storeRefreshToken(user._id, refreshToken, req);

        logSecurityEvent(req, {
            userId: user._id,
            action: "user_registered",
            allowed: true,
            statusCode: 201,
        });

        res.status(201).json({
            status: "success",
            data: {
                accessToken,
                refreshToken,
                user: {
                    id: user._id,
                    email: user.email,
                    walletAddress: user.walletAddress,
                    role: user.role,
                    mfaEnabled: false,
                },
            },
        });
    } catch (err) {
        if (err.code === 11000 || (err.message && err.message.includes("already exists"))) {
            return res.status(409).json({
                status: "error",
                error: "DuplicateEntry",
                message: "User already exists",
            });
        }
        res.status(500).json({ status: "error", error: "RegistrationFailed", message: err.message });
    }
});

/**
 * POST /api/v1/auth/login
 * Authenticates user with email/password. Returns token pair or MFA challenge.
 * Implements account lockout after MAX_LOGIN_ATTEMPTS failed attempts.
 */
router.post("/login", strictLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                status: "error",
                error: "BadRequest",
                message: "Email and password are required",
            });
        }

        const user = await User.findOne({ email }).select("+mfaSecret");
        if (!user) {
            await recordLoginAttempt(email, false, req, "user_not_found");
            return res.status(401).json({
                status: "error",
                error: "Unauthorized",
                message: "Invalid credentials",
            });
        }

        // Check account lockout
        const { isLocked, minutesRemaining } = checkAccountLock(user);
        if (isLocked) {
            logSecurityEvent(req, {
                userId: user._id,
                action: "login_blocked_lockout",
                allowed: false,
                statusCode: 423,
                metadata: { minutesRemaining },
            });
            return res.status(423).json({
                status: "error",
                error: "AccountLocked",
                message: `Account temporarily locked. Try again in ${minutesRemaining} minute(s).`,
            });
        }

        // Verify password
        const passwordValid = await bcrypt.compare(password, user.password);
        if (!passwordValid) {
            user.failedLoginAttempts += 1;

            // Lock account if threshold exceeded
            if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
                user.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
                logSecurityEvent(req, {
                    userId: user._id,
                    action: "account_locked",
                    allowed: false,
                    statusCode: 423,
                    metadata: {
                        attempts: user.failedLoginAttempts,
                        lockDurationMinutes: LOCKOUT_DURATION_MS / 60000,
                    },
                });
            }

            await user.save();
            await recordLoginAttempt(email, false, req, "invalid_password");
            return res.status(401).json({
                status: "error",
                error: "Unauthorized",
                message: "Invalid credentials",
            });
        }

        // Password correct — check if MFA is enabled
        if (user.mfaEnabled && user.mfaSecret) {
            // Issue a temporary short-lived token for MFA completion
            const tempToken = jwt.sign(
                { userId: user._id, email: user.email, purpose: "mfa_challenge" },
                process.env.JWT_SECRET,
                { expiresIn: MFA_TEMP_TOKEN_EXPIRY }
            );

            return res.json({
                status: "success",
                data: {
                    requiresMfa: true,
                    tempToken,
                    message: "Enter your 6-digit authenticator code to complete login.",
                },
            });
        }

        // No MFA — complete login
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
        user.lastLoginAt = new Date();
        user.meta.set("lastUserAgent", req.headers["user-agent"]);
        user.meta.set("lastIp", req.ip);
        await user.save();

        const { accessToken, refreshToken } = generateTokenPair(user);
        await storeRefreshToken(user._id, refreshToken, req);
        await recordLoginAttempt(email, true, req);

        logSecurityEvent(req, {
            userId: user._id,
            action: "login_success",
            allowed: true,
            statusCode: 200,
        });

        res.json({
            status: "success",
            data: {
                accessToken,
                refreshToken,
                user: {
                    id: user._id,
                    email: user.email,
                    walletAddress: user.walletAddress,
                    role: user.role,
                    mfaEnabled: user.mfaEnabled,
                },
            },
        });
    } catch (err) {
        res.status(500).json({ status: "error", error: "LoginFailed", message: err.message });
    }
});

/**
 * POST /api/v1/auth/mfa/validate
 * Second step of MFA login — verifies the TOTP code using the temp token.
 */
router.post("/mfa/validate", strictLimiter, async (req, res) => {
    try {
        const { tempToken, totpCode } = req.body;
        if (!tempToken || !totpCode) {
            return res.status(400).json({
                status: "error",
                error: "BadRequest",
                message: "tempToken and totpCode are required",
            });
        }

        // Verify temp token
        let decoded;
        try {
            decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
        } catch {
            return res.status(401).json({
                status: "error",
                error: "Unauthorized",
                message: "MFA challenge expired. Please login again.",
            });
        }

        if (decoded.purpose !== "mfa_challenge") {
            return res.status(401).json({
                status: "error",
                error: "Unauthorized",
                message: "Invalid MFA token",
            });
        }

        const user = await User.findById(decoded.userId).select("+mfaSecret");
        if (!user || !user.mfaSecret) {
            return res.status(401).json({
                status: "error",
                error: "Unauthorized",
                message: "MFA not configured",
            });
        }

        // Verify TOTP code
        const isValid = speakeasy.totp.verify({
            secret: user.mfaSecret,
            encoding: "base32",
            token: String(totpCode),
            window: 1, // Allow 1 step drift (30s each direction)
        });

        if (!isValid) {
            logSecurityEvent(req, {
                userId: user._id,
                action: "mfa_validation_failed",
                allowed: false,
                statusCode: 401,
            });
            return res.status(401).json({
                status: "error",
                error: "Unauthorized",
                message: "Invalid authenticator code",
            });
        }

        // MFA valid — complete login
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
        user.lastLoginAt = new Date();
        user.meta.set("lastUserAgent", req.headers["user-agent"]);
        user.meta.set("lastIp", req.ip);
        await user.save();

        const { accessToken, refreshToken } = generateTokenPair(user);
        await storeRefreshToken(user._id, refreshToken, req);
        await recordLoginAttempt(user.email, true, req);

        logSecurityEvent(req, {
            userId: user._id,
            action: "mfa_login_success",
            allowed: true,
            statusCode: 200,
        });

        res.json({
            status: "success",
            data: {
                accessToken,
                refreshToken,
                user: {
                    id: user._id,
                    email: user.email,
                    walletAddress: user.walletAddress,
                    role: user.role,
                    mfaEnabled: true,
                },
            },
        });
    } catch (err) {
        res.status(500).json({ status: "error", error: "MFAValidationFailed", message: err.message });
    }
});

/**
 * POST /api/v1/auth/mfa/setup
 * Generates a TOTP secret and returns a QR code URI for authenticator app pairing.
 */
router.post("/mfa/setup", auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("+mfaSecret");
        if (!user) {
            return res.status(404).json({ status: "error", error: "NotFound", message: "User not found" });
        }

        if (user.mfaEnabled) {
            return res.status(400).json({
                status: "error",
                error: "BadRequest",
                message: "MFA is already enabled. Disable it first to re-setup.",
            });
        }

        // Generate TOTP secret
        const secret = speakeasy.generateSecret({
            name: `LifeVault AI (${user.email})`,
            issuer: "LifeVault AI",
            length: 20,
        });

        // Store secret (not yet enabled until verified)
        user.mfaSecret = secret.base32;
        await user.save();

        // Generate QR code as data URI
        const qrCodeDataUri = await QRCode.toDataURL(secret.otpauth_url);

        logSecurityEvent(req, {
            userId: user._id,
            action: "mfa_setup_initiated",
            allowed: true,
            statusCode: 200,
        });

        res.json({
            status: "success",
            data: {
                secret: secret.base32,
                otpauthUrl: secret.otpauth_url,
                qrCode: qrCodeDataUri,
                message: "Scan the QR code with your authenticator app, then verify with a 6-digit code.",
            },
        });
    } catch (err) {
        res.status(500).json({ status: "error", error: "MFASetupFailed", message: err.message });
    }
});

/**
 * POST /api/v1/auth/mfa/verify
 * Verifies the initial TOTP code after setup to activate MFA.
 */
router.post("/mfa/verify", auth, async (req, res) => {
    try {
        const { totpCode } = req.body;
        if (!totpCode) {
            return res.status(400).json({
                status: "error",
                error: "BadRequest",
                message: "totpCode is required",
            });
        }

        const user = await User.findById(req.userId).select("+mfaSecret");
        if (!user || !user.mfaSecret) {
            return res.status(400).json({
                status: "error",
                error: "BadRequest",
                message: "MFA secret not set. Call /mfa/setup first.",
            });
        }

        const isValid = speakeasy.totp.verify({
            secret: user.mfaSecret,
            encoding: "base32",
            token: String(totpCode),
            window: 1,
        });

        if (!isValid) {
            return res.status(401).json({
                status: "error",
                error: "Unauthorized",
                message: "Invalid authenticator code. Try again.",
            });
        }

        user.mfaEnabled = true;
        await user.save();

        logSecurityEvent(req, {
            userId: user._id,
            action: "mfa_enabled",
            allowed: true,
            statusCode: 200,
        });

        res.json({
            status: "success",
            data: {
                mfaEnabled: true,
                message: "MFA is now active. You will need your authenticator code on every login.",
            },
        });
    } catch (err) {
        res.status(500).json({ status: "error", error: "MFAVerifyFailed", message: err.message });
    }
});

/**
 * POST /api/v1/auth/mfa/disable
 * Disables MFA after verifying current TOTP code.
 */
router.post("/mfa/disable", auth, async (req, res) => {
    try {
        const { totpCode } = req.body;
        if (!totpCode) {
            return res.status(400).json({
                status: "error",
                error: "BadRequest",
                message: "totpCode is required to disable MFA",
            });
        }

        const user = await User.findById(req.userId).select("+mfaSecret");
        if (!user || !user.mfaEnabled) {
            return res.status(400).json({
                status: "error",
                error: "BadRequest",
                message: "MFA is not enabled",
            });
        }

        const isValid = speakeasy.totp.verify({
            secret: user.mfaSecret,
            encoding: "base32",
            token: String(totpCode),
            window: 1,
        });

        if (!isValid) {
            return res.status(401).json({
                status: "error",
                error: "Unauthorized",
                message: "Invalid authenticator code",
            });
        }

        user.mfaEnabled = false;
        user.mfaSecret = null;
        await user.save();

        logSecurityEvent(req, {
            userId: user._id,
            action: "mfa_disabled",
            allowed: true,
            statusCode: 200,
        });

        res.json({
            status: "success",
            data: { mfaEnabled: false, message: "MFA has been disabled." },
        });
    } catch (err) {
        res.status(500).json({ status: "error", error: "MFADisableFailed", message: err.message });
    }
});

/**
 * POST /api/v1/auth/refresh
 * Rotates refresh token — invalidates old, issues new pair.
 */
router.post("/refresh", async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({
                status: "error",
                error: "BadRequest",
                message: "Refresh token required",
            });
        }

        // Verify JWT signature and expiry
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        } catch {
            return res.status(401).json({
                status: "error",
                error: "Unauthorized",
                message: "Refresh token expired or invalid",
            });
        }

        if (decoded.type !== "refresh") {
            return res.status(401).json({
                status: "error",
                error: "Unauthorized",
                message: "Invalid token type",
            });
        }

        // Check that this token hash exists in DB (not revoked)
        const tokenHash = hashToken(refreshToken);
        const storedToken = await RefreshToken.findOne({ tokenHash });
        if (!storedToken || storedToken.revokedAt) {
            // Token reuse detected — possible theft. Revoke ALL tokens for this user.
            await RefreshToken.updateMany(
                { userId: decoded.userId },
                { revokedAt: new Date() }
            );
            logSecurityEvent(req, {
                userId: decoded.userId,
                action: "refresh_token_reuse_detected",
                allowed: false,
                statusCode: 401,
                metadata: { tokenHash },
            });
            return res.status(401).json({
                status: "error",
                error: "Unauthorized",
                message: "Token has been revoked. All sessions invalidated for security.",
            });
        }

        // Revoke old token
        storedToken.revokedAt = new Date();
        await storedToken.save();

        // Issue new pair
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({
                status: "error",
                error: "Unauthorized",
                message: "User not found",
            });
        }

        const newTokens = generateTokenPair(user);
        await storeRefreshToken(user._id, newTokens.refreshToken, req);

        res.json({ status: "success", data: newTokens });
    } catch (err) {
        res.status(401).json({
            status: "error",
            error: "Unauthorized",
            message: "Token rotation failed",
        });
    }
});

/**
 * POST /api/v1/auth/logout
 * Revokes the current refresh token and increments token version.
 */
router.post("/logout", auth, async (req, res) => {
    try {
        const { refreshToken } = req.body;

        // Revoke specific token if provided
        if (refreshToken) {
            const tokenHash = hashToken(refreshToken);
            await RefreshToken.updateOne({ tokenHash }, { revokedAt: new Date() });
        }

        // Also increment version to invalidate any other tokens
        const user = await User.findById(req.userId);
        if (user) {
            user.refreshTokenVersion += 1;
            await user.save();
        }

        // Revoke all refresh tokens for this user
        await RefreshToken.updateMany(
            { userId: req.userId, revokedAt: null },
            { revokedAt: new Date() }
        );

        logSecurityEvent(req, {
            userId: req.userId,
            action: "user_logout",
            allowed: true,
            statusCode: 200,
        });

        res.json({ status: "success", message: "Logged out. All sessions revoked." });
    } catch (err) {
        res.status(500).json({ status: "error", error: "LogoutFailed", message: err.message });
    }
});

/**
 * GET /api/v1/auth/me
 * Returns the current authenticated user's profile.
 */
router.get("/me", auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select(
            "-password -refreshTokenVersion -mfaSecret -failedLoginAttempts -lockedUntil"
        );
        res.json({ status: "success", data: { user } });
    } catch (err) {
        res.status(500).json({ status: "error", error: "FetchFailed", message: err.message });
    }
});

module.exports = router;
module.exports.generateTokens = generateTokenPair;
