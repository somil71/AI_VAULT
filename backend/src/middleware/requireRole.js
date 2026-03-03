const { logSecurityEvent } = require("../services/securityAudit");

module.exports = function requireRole(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.user) {
            logSecurityEvent(req, {
                action: "rbac_denied",
                allowed: false,
                statusCode: 401,
                metadata: { reason: "missing_user_context", allowedRoles },
            });
            return res.status(401).json({ error: "No token provided" });
        }

        const role = req.user.role || "user";
        if (!allowedRoles.includes(role)) {
            logSecurityEvent(req, {
                action: "rbac_denied",
                allowed: false,
                statusCode: 403,
                metadata: { reason: "insufficient_role", allowedRoles, actualRole: role },
            });
            return res.status(403).json({ error: "Forbidden" });
        }

        next();
    };
};
