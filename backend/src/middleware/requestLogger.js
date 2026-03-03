const crypto = require("crypto");

function nowIso() {
    return new Date().toISOString();
}

function requestLogger(req, res, next) {
    const requestId = crypto.randomUUID();
    const startNs = process.hrtime.bigint();

    req.requestId = requestId;
    req.startTimeNs = startNs;
    res.setHeader("x-request-id", requestId);

    res.on("finish", () => {
        const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
        const route = (req.originalUrl || req.url || "").split("?")[0];
        const logLine = {
            timestamp: nowIso(),
            requestId,
            method: req.method,
            route,
            status: res.statusCode,
            latencyMs: Number(elapsedMs.toFixed(2)),
            user: req.userId || null,
        };
        console.log(JSON.stringify(logLine));
    });

    next();
}

module.exports = requestLogger;
