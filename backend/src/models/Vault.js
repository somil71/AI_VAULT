const mongoose = require("mongoose");

/**
 * Vault Model
 * Represents a shared security container for teams or families.
 */
const VaultSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: String,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    // Multi-user ownership and RBAC
    members: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: { 
            type: String, 
            enum: ["owner", "admin", "viewer"], 
            default: "viewer" 
        },
        joinedAt: { type: Date, default: Date.now }
    }],
    // Policy for multi-sig (e.g. 2/3 approvals for release)
    policy: {
        minApprovals: { type: Number, default: 1 },
        cooldownHours: { type: Number, default: 24 }
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Vault", VaultSchema);
