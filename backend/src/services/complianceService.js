const AdminAuditLog = require("../models/AdminAuditLog");

/**
 * Compliance Service
 * Handles SOC2-readiness features like evidence collection and audit logging.
 */
class ComplianceService {
    /**
     * Records an administrative action for the audit trail.
     */
    static async logAdminAction(req, action, targetId, targetType, changes = {}) {
        try {
            await AdminAuditLog.create({
                adminId: req.userId,
                action,
                targetId,
                targetType,
                changes,
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
            });
        } catch (error) {
            console.error("[COMPLIANCE] Audit log failed:", error.message);
        }
    }

    /**
     * Generates a monthly evidence bundle for SOC2.
     * Stub for automated evidence collection script.
     */
    static async generateEvidenceBundle() {
        // Collects: active users list, auth failure stats, 2FA coverage, DB backup status.
        return {
            period: new Date().toISOString().slice(0, 7),
            evidence: ["auth_logs", "administrative_changes", "backup_confirmation"],
            status: "ready_for_review"
        };
    }
}

module.exports = { ComplianceService };
