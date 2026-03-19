const mongoose = require("mongoose");

/**
 * AdminAuditLog Model
 * Strict, immutable log of all administrative actions for SOC2 compliance.
 */
const AdminAuditLogSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    action: {
        type: String, // e.g., "USER_DEACTIVATE", "BILLING_OVERRIDE", "VAULT_FORCE_UNLOCK"
        required: true,
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true,
    },
    targetType: String, // "User", "Vault", "Transaction"
    changes: {
        before: mongoose.Schema.Types.Mixed,
        after: mongoose.Schema.Types.Mixed,
    },
    ipAddress: String,
    userAgent: String,
    timestamp: {
        type: Date,
        default: Date.now,
    },
    // Phase 6: Immutable Chaining
    previousHash: {
        type: String,
        default: "0",
        index: true
    },
    hash: {
        type: String,
        required: true,
        index: true
    }
});

// Logs are immutable (no updates allowed)
AdminAuditLogSchema.pre("save", function(next) {
    if (!this.isNew) return next(new Error("Audit logs cannot be modified"));
    next();
});

module.exports = mongoose.model("AdminAuditLog", AdminAuditLogSchema);
