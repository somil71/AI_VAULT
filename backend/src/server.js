require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const Sentry = require("@sentry/node");
const axios = require("axios");

// Middlewares
const requestLogger = require("./middleware/requestLogger");
const responseWrapper = require("./middleware/responseWrapper");
const logger = require("./utils/logger");
const { startJobWorker } = require("./services/jobQueue");

// ── Environment Validation ───────────────────────────────────────────────────
const REQUIRED_ENV = ["JWT_SECRET", "MONGO_URI"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
    console.error(`FATAL: Missing mandatory environment variables: ${missing.join(", ")}`);
    process.exit(1);
}

// ── Observability Setup ──────────────────────────────────────────────────────
let sentryEnabled = false;
if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || "production" });
    sentryEnabled = true;
}

// ── Routes ───────────────────────────────────────────────────────────────────
const authRoutes = require("./routes/auth");
const walletAuthRoutes = require("./routes/walletAuth");
const phishingRoutes = require("./routes/phishing");
const transactionRoutes = require("./routes/transactions");
const vaultRoutes = require("./routes/vault");
const emergencyRoutes = require("./routes/emergency");
const verifierRoutes = require("./routes/verifier");
const activityRoutes = require("./routes/activity");
const statsRoutes = require("./routes/stats");

const app = express();
const PORT = Number(process.env.PORT || 5000);

if (sentryEnabled) app.use(Sentry.Handlers.requestHandler());

// ── Middleware Pipeline ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : ["http://localhost:3000"],
    credentials: true,
}));

app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);
app.use(responseWrapper); // Enforces status/data/meta

// ── Rate Limiting (Memory fallback, Redis pluggable) ─────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // Strict on auth (Production Value)
    message: { status: "error", error: "TooManyRequests", message: "Too many login/register attempts" },
});

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { status: "error", error: "TooManyRequests", message: "Too many requests" },
});

// ── API Routing (v1) ─────────────────────────────────────────────────────────

const v1 = express.Router();

// System Health with Dependency Validation
v1.get("/system/health", async (req, res) => {
    const aiUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
    let aiStatus = "disconnected";
    try {
        const resp = await axios.get(`${aiUrl}/health`, { timeout: 2000 });
        if (resp.data?.status === "success") aiStatus = "healthy";
    } catch {
        aiStatus = "down";
    }

    res.json({
        service: "eVault Backend Core",
        version: "2.1.0",
        uptime_seconds: process.uptime(),
        dependencies: {
            mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
            ai_service: aiStatus,
            blockchain_rpc: process.env.RPC_URL ? "configured" : "missing"
        }
    });
});

v1.use("/auth", authLimiter, authRoutes);
v1.use("/auth/wallet", authLimiter, walletAuthRoutes);
v1.use("/phishing", globalLimiter, phishingRoutes);
v1.use("/transactions", globalLimiter, transactionRoutes);
v1.use("/vault", globalLimiter, vaultRoutes);
v1.use("/emergency", globalLimiter, emergencyRoutes);
v1.use("/verifier", verifierRoutes);
v1.use("/activity", activityRoutes);
v1.use("/stats", statsRoutes);

app.use("/api/v1", v1);
app.use("/api", v1); // Legacy transition alias

// ── Error Handling & Lifecycle ───────────────────────────────────────────────
if (sentryEnabled) app.use(Sentry.Handlers.errorHandler());

app.use((err, req, res, next) => {
    logger.error("Unhandled error", { error: err.message, stack: err.stack, requestId: req.requestId });
    res.status(err.status || 500).json({
        error: err.name || "InternalServerError",
        message: err.message
    });
});

async function boot() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        logger.info("MongoDB Connection Established - Secure Cluster");

        const server = app.listen(PORT, () => {
            logger.info(`eVault Backend Core running on port ${PORT}`);
            startJobWorker();
        });

        // Graceful OS Term Signal Handling
        const shutdown = () => {
            logger.info("Shutting down eVault Backend...");
            server.close(() => {
                mongoose.connection.close();
                process.exit(0);
            });
        };
        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);

    } catch (err) {
        logger.error("Boot failure sequence initiated", { error: err.message });
        process.exit(1);
    }
}

boot();
