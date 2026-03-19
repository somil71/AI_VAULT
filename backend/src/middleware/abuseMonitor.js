const { alertService } = require("../services/alertService");
const securityAudit = require("../services/securityAudit");

/**
 * Abuse Monitor Middleware
 * Tracks per-user scan rates to detect automated abuse or scraping.
 * Limit: 50 scans per minute per User ID.
 */
const userScanCounts = new Map(); // userId -> { count: number, windowStart: number }

const abuseMonitor = (req, res, next) => {
    // We only track logged-in users. Anonymous abuse is handled by IP rate limiters.
    const userId = req.userId;
    if (!userId) return next();

    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const limit = 50;

    let userStats = userScanCounts.get(userId);

    if (!userStats || (now - userStats.windowStart) > windowMs) {
        // Reset or initialize window
        userStats = { count: 1, windowStart: now };
    } else {
        userStats.count++;
    }

    userScanCounts.set(userId, userStats);

    // Check for abuse
    if (userStats.count > limit) {
        console.warn(`[ABUSE_DETECTED] User ${userId} exceeded scan limit: ${userStats.count} in window`);

        // 1. Log Security Event
        securityAudit.logSecurityEvent(req, {
            action: "SCAN_LIMIT_EXCEEDED",
            allowed: false,
            statusCode: 429,
            metadata: { count: userStats.count },
        });

        // 2. Dispatch Critical Alert
        const alert = alertService.createThreatAlert("critical", {
            level: "CRITICAL",
            title: "Automated Abuse Detected",
            message: `User ${userId} is scanning at an abnormal rate (${userStats.count}/min). Potential scraper or bot.`,
            metadata: { userId, count: userStats.count, ip: req.ip }
        });
        alertService.sendAlert(userId, alert);

        return res.status(429).json({
            status: "error",
            error: "AbuseDetected",
            message: "Scan limit exceeded. Abnormal activity detected on this account."
        });
    }

    next();
};

module.exports = { abuseMonitor };
