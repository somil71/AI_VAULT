const mongoose = require("mongoose");

/**
 * LoginAttempt model — tracks failed login attempts for account lockout.
 * Stores IP, email, timestamp, and user agent for security forensics.
 * Uses a TTL index to auto-clean old records after 24 hours.
 */
const LoginAttemptSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            index: true,
        },
        ip: {
            type: String,
            default: null,
        },
        userAgent: {
            type: String,
            default: null,
        },
        success: {
            type: Boolean,
            required: true,
        },
        reason: {
            type: String,
            default: null,
        },
        timestamp: {
            type: Date,
            default: Date.now,
            index: { expireAfterSeconds: 86400 }, // auto-delete after 24h
        },
    },
    { versionKey: false }
);

LoginAttemptSchema.index({ email: 1, timestamp: -1 });

/**
 * Counts failed login attempts for an email within the lockout window.
 * @param {string} email - User email
 * @param {number} windowMinutes - Lookback window in minutes
 * @returns {Promise<number>} Number of failed attempts
 */
LoginAttemptSchema.statics.countRecentFailures = async function (email, windowMinutes = 15) {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    return this.countDocuments({
        email: email.toLowerCase(),
        success: false,
        timestamp: { $gte: cutoff },
    });
};

module.exports = mongoose.model("LoginAttempt", LoginAttemptSchema);
