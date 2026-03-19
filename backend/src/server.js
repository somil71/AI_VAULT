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
const { modeContext } = require("./middleware/modeContext");

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
const threatDetectionRoutes = require("./routes/threat-detection");
const vaultRoutes = require("./routes/vault");
const emergencyRoutes = require("./routes/emergency");
const verifierRoutes = require("./routes/verifier");
const activityRoutes = require("./routes/activity"); // Soon to be /audit & /alerts
const alertRoutes = require("./routes/alerts");
const billingRoutes = require("./routes/billing");
const complianceRoutes = require("./routes/compliance");
const reportRoutes = require("./routes/reports");
const referralRoutes = require("./routes/referral");
const developerRoutes = require("./routes/developer");
const webhookRoutes = require("./routes/webhooks");
const zkRoutes = require("./routes/zk");
const statsRoutes = require("./routes/stats");

const app = express();
const PORT = Number(process.env.PORT || 5000);

if (sentryEnabled) app.use(Sentry.Handlers.requestHandler());

// ── Middleware Pipeline ──────────────────────────────────────────────────────
const { sanitize } = require("./middleware/sanitize");

app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : ["http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
}));

// Phase 1: Payload Security (Reduce from 1mb to 10kb to prevent flooding)
app.use(express.json({ limit: "10kb" }));
app.use(sanitize); // Global recursive NoSQLi/XSS prevention
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

// Capability-Based Routing (Phase 1 Refactor)
v1.use(modeContext); // Global mode detection

v1.use("/auth", authLimiter, authRoutes);
v1.use("/threat-detection", globalLimiter, threatDetectionRoutes);
v1.use("/alerts", globalLimiter, alertRoutes); // SSE Notification Channel
v1.use("/vault", globalLimiter, vaultRoutes);
v1.use("/api-keys", globalLimiter, developerRoutes); // Renamed for clarity
v1.use("/compliance", globalLimiter, complianceRoutes); 
v1.use("/webhooks", globalLimiter, webhookRoutes);
v1.use("/zk", zkRoutes);
v1.use("/billing", billingRoutes);
v1.use("/compliance", activityRoutes); // activity.js now serves as audit/compliance base
v1.use("/emergency", globalLimiter, emergencyRoutes);
v1.use("/verifier", verifierRoutes);
v1.use("/user/reports", reportRoutes);
v1.use("/user/referral", referralRoutes);
v1.use("/stats", statsRoutes);

// Legacy compatibility shim
v1.use("/phishing", globalLimiter, threatDetectionRoutes);
v1.use("/transactions", globalLimiter, threatDetectionRoutes);
v1.use("/developer", developerRoutes);

// ...
v1.use("/wallet/reputation", globalLimiter, reputationRoutes);
v1.use("/webhooks", webhookRoutes);
v1.use("/zk", zkRoutes);
v1.use("/verifier", verifierRoutes);
v1.use("/billing", billingRoutes);
v1.use("/user/reports", reportRoutes);
v1.use("/user/referral", referralRoutes);
v1.use("/developer", developerRoutes);
v1.use("/activity", activityRoutes);
v1.use("/stats", statsRoutes);

app.use("/api/v1", v1);
app.use("/api", v1); // Legacy transition alias

// Phase 8: Enhanced Health Checks
v1.get("/health", async (req, res) => {
    try {
        const mongoStatus = mongoose.connection.readyState === 1 ? "CONNECTED" : "DISCONNECTED";
        const axios = require("axios");
        let aiStatus = "OFFLINE";
        try {
            const aiRes = await axios.get(`${process.env.AI_SERVICE_URL}/api/v1/health`, { timeout: 2000 });
            if (aiRes.status === 200) aiStatus = "ONLINE";
        } catch (e) { /* AI Offline */ }

        res.json({
            status: "success",
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            services: {
                database: mongoStatus,
                ai_inference: aiStatus,
                core_api: "RUNNING"
            }
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
});

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
