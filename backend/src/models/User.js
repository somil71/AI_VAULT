const mongoose = require("mongoose");

/**
 * User model – stores credentials and wallet address.
 *
 * INTEGRITY CONSTRAINTS:
 *   - email: unique, required, lowercase, indexed
 *   - walletAddress: unique (sparse — allows multiple nulls), lowercase, indexed
 */
const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
        match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
    },
    walletAddress: {
        type: String,
        default: null,
        lowercase: true,
        trim: true,
        unique: true,
        sparse: true,
        index: true,
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user",
        index: true,
    },
    // ── MFA Fields ──────────────────────────────────────────
    mfaSecret: {
        type: String,
        default: null,
        select: false, // never returned by default
    },
    mfaEnabled: {
        type: Boolean,
        default: false,
    },
    // ── Account Lockout Fields ──────────────────────────────
    failedLoginAttempts: {
        type: Number,
        default: 0,
    },
    lockedUntil: {
        type: Date,
        default: null,
    },
    // ── Timestamps ──────────────────────────────────────────
    createdAt: {
        type: Date,
        default: Date.now,
    },
    lastLoginAt: {
        type: Date,
        default: null,
    },
    refreshTokenVersion: {
        type: Number,
        default: 0,
    },
    stripeCustomerId: {
        type: String,
        default: null,
        index: true,
    },
    tier: {
        type: String,
        enum: ["free", "pro", "business", "enterprise"],
        default: "free",
        index: true,
    },
    referralCode: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    meta: {
        type: Map,
        of: String,
        default: {},
    },
});


UserSchema.index({ email: 1, walletAddress: 1 });

UserSchema.post("save", function (error, doc, next) {
    if (error.name === "MongoServerError" && error.code === 11000) {
        const field = Object.keys(error.keyPattern || {})[0] || "field";
        next(new Error("A user with that " + field + " already exists."));
    } else {
        next(error);
    }
});

module.exports = mongoose.model("User", UserSchema);
