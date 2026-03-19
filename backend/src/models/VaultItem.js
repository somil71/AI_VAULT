const mongoose = require("mongoose");

/**
 * VaultItem Model
 * Represents an encrypted document, secret, or asset within a vault.
 */
const VaultItemSchema = new mongoose.Schema({
    vaultId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vault",
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    type: {
        type: String,
        enum: ["document", "credential", "private_key", "other"],
        default: "document",
    },
    // Reference to encrypted storage (IPFS hash or encrypted cloud path)
    storageRef: {
        type: String,
        required: true,
    },
    // On-chain anchor hash (for integrity)
    blockchainHash: {
        type: String,
        index: true,
    },
    encryptionIv: String, // Initialization Vector for AES
    tags: [String],
    isEncrypted: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("VaultItem", VaultItemSchema);
