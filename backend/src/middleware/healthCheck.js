const axios = require("axios");
const mongoose = require("mongoose");

/**
 * Enhanced health check middleware.
 * Checks connectivity to all dependencies and returns structured status.
 *
 * GET /api/health → {
 *   status: 'healthy' | 'degraded' | 'unhealthy',
 *   mongodb: { connected: bool },
 *   aiService: { reachable: bool, modelsLoaded: bool },
 *   blockchain: { nodeReachable: bool, chainId: int },
 *   uptime: seconds,
 *   timestamp: ISO string
 * }
 */
async function healthCheck(req, res) {
    const checks = {};
    let overallStatus = "healthy";

    // ── MongoDB ────────────────────────────────────────────────
    try {
        const mongoState = mongoose.connection.readyState;
        checks.mongodb = { connected: mongoState === 1 };
        if (mongoState !== 1) overallStatus = "degraded";
    } catch {
        checks.mongodb = { connected: false };
        overallStatus = "degraded";
    }

    // ── AI Service ─────────────────────────────────────────────
    const aiUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
    try {
        const aiRes = await axios.get(`${aiUrl}/health`, { timeout: 3000 });
        checks.aiService = {
            reachable: true,
            modelsLoaded: aiRes.data?.data?.model_ready === true,
        };
    } catch {
        checks.aiService = { reachable: false, modelsLoaded: false };
        overallStatus = "degraded";
    }

    // ── Blockchain Node ────────────────────────────────────────
    const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
    try {
        const rpcRes = await axios.post(rpcUrl, {
            jsonrpc: "2.0",
            method: "eth_chainId",
            params: [],
            id: 1,
        }, { timeout: 2000 });
        const chainId = parseInt(rpcRes.data?.result, 16);
        checks.blockchain = { nodeReachable: true, chainId };
    } catch {
        checks.blockchain = { nodeReachable: false, chainId: null };
        // Blockchain being down doesn't make the whole system unhealthy
    }

    // ── Final Status ───────────────────────────────────────────
    if (!checks.mongodb.connected) {
        overallStatus = "unhealthy";
    }

    const statusCode = overallStatus === "unhealthy" ? 503 : 200;

    res.status(statusCode).json({
        status: overallStatus,
        ...checks,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
    });
}

module.exports = healthCheck;
