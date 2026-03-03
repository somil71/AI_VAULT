const jwt = require("jsonwebtoken");
const { logSecurityEvent } = require("../services/securityAudit");

/**
 * JWT authentication middleware.
 * Attaches userId to req object if token is valid.
 */
module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        logSecurityEvent(req, {
            action: "jwt_auth_failed",
            allowed: false,
            statusCode: 401,
            metadata: { reason: "missing_or_invalid_authorization_header" },
        });
        return res.status(401).json({ status: "error", error: "AuthenticationRequired", message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    if (!process.env.JWT_SECRET) {
        console.error("CRITICAL: JWT_SECRET environment variable is missing.");
        return res.status(500).json({ status: "error", error: "InternalConfigurationError" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role || "user",
        };
        next();
    } catch (err) {
        logSecurityEvent(req, {
            action: "jwt_auth_failed",
            allowed: false,
            statusCode: 401,
            metadata: { reason: "invalid_or_expired_token", error: err.message },
        });
        res.status(401).json({ status: "error", error: "InvalidToken", message: "Invalid or expired token" });
    }
};
