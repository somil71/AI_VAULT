const mongoose = require("mongoose");

const WalletNonceSchema = new mongoose.Schema({
    walletAddress: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    nonce: {
        type: String,
        required: true,
    },
    used: {
        type: Boolean,
        default: false,
        index: true,
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 },
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model("WalletNonce", WalletNonceSchema);
