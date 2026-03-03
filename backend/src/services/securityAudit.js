const mongoose = require("mongoose");
const SecurityEvent = require("../models/SecurityEvent");

function toRoute(req) {
    return String(req.originalUrl || req.url || "").split("?")[0];
}

function isValidObjectId(value) {
    if (!value) return false;
    return mongoose.Types.ObjectId.isValid(String(value));
}

function logSecurityEvent(req, payload = {}) {
    const role = payload.role || req.user?.role || "guest";
    const userIdRaw = payload.userId || req.userId || req.user?.userId || null;
    const event = {
        userId: isValidObjectId(userIdRaw) ? userIdRaw : null,
        role,
        route: payload.route || toRoute(req),
        method: payload.method || req.method,
        action: payload.action || "security_event",
        allowed: Boolean(payload.allowed),
        statusCode: Number(payload.statusCode || 0),
        metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
        timestamp: new Date(),
    };

    SecurityEvent.create(event).catch((error) => {
        console.error("[securityAudit] failed to write security event:", error.message);
    });
}

function createAccessLogger(action, metadata = {}) {
    return (req, res, next) => {
        res.on("finish", () => {
            logSecurityEvent(req, {
                action,
                allowed: res.statusCode < 400,
                statusCode: res.statusCode,
                metadata,
            });
        });
        next();
    };
}

module.exports = {
    logSecurityEvent,
    createAccessLogger,
};
