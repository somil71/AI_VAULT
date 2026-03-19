const crypto = require("crypto");
const AdminAuditLog = require("../models/AdminAuditLog");

/**
 * Audit Service — SHA-256 Log Chainer
 * Ensures every administrative action is cryptographically linked to the previous one.
 */
class AuditService {
    /**
     * Records an immutable, chained audit log entry.
     */
    static async log(adminId, action, details = {}) {
        try {
            // 1. Get the hash of the latest entry (the 'tail' of the chain)
            const lastLog = await AdminAuditLog.findOne().sort({ timestamp: -1 });
            const previousHash = lastLog ? lastLog.hash : "0";

            // 2. Prepare the content for hashing
            const timestamp = new Date().toISOString();
            const content = JSON.stringify({
                adminId: adminId.toString(),
                action,
                details,
                timestamp,
                previousHash
            });

            // 3. Calculate the SHA-256 hash
            const hash = crypto.createHash("sha256").update(content).digest("hex");

            // 4. Persistence
            const newLog = await AdminAuditLog.create({
                adminId,
                action,
                details: details.changes || {},
                targetId: details.targetId,
                targetType: details.targetType,
                ipAddress: details.ipAddress,
                userAgent: details.userAgent,
                timestamp,
                previousHash,
                hash
            });

            return newLog;
        } catch (error) {
            console.error("[AUDIT_ERROR] Failed to record chained log:", error.message);
            // In high-compliance environments, we might want to throw or alert here.
            return null;
        }
    }

    /**
     * Verifies the integrity of the entire audit chain.
     * Returns a report of any broken links or tampered content.
     */
    static async verifyIntegrity() {
        // Sort by timestamp to rebuild the chain in order
        const logs = await AdminAuditLog.find().sort({ timestamp: 1 });
        let currentPreviousHash = "0";
        const failures = [];

        for (const log of logs) {
            // 1. Verify link integrity (is this log linked to the correct parent?)
            if (log.previousHash !== currentPreviousHash) {
                failures.push({ 
                    id: log._id, 
                    reason: "Chain Link Broken", 
                    expected: currentPreviousHash, 
                    actual: log.previousHash 
                });
            }

            // 2. Verify content integrity (has the data been altered?)
            const content = JSON.stringify({
                adminId: log.adminId.toString(),
                action: log.action,
                details: { 
                    changes: log.changes || {}, 
                    targetId: log.targetId?.toString(), 
                    targetType: log.targetType, 
                    ipAddress: log.ipAddress, 
                    userAgent: log.userAgent 
                },
                timestamp: log.timestamp.toISOString(),
                previousHash: log.previousHash
            });
            
            const recomputedHash = crypto.createHash("sha256").update(content).digest("hex");
            
            if (log.hash !== recomputedHash) {
                failures.push({ 
                    id: log._id, 
                    reason: "Content Tampered (Hash Mismatch)", 
                    expected: log.hash, 
                    actual: recomputedHash 
                });
            }

            currentPreviousHash = log.hash;
        }

        return {
            status: failures.length === 0 ? "VALID" : "CORRUPT",
            timestamp: new Date().toISOString(),
            totalCount: logs.length,
            failures: failures
        };
    }

    /**
     * Data Lifecycle Management: Cleanup old logs.
     * Retains logs for a specified number of days.
     */
    static async performRetentionCleanup(days = 90) {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - days);
        
        const result = await AdminAuditLog.deleteMany({ timestamp: { $lt: threshold } });
        console.log(`[COMPLIANCE] Retention cleanup: ${result.deletedCount} logs removed.`);
        return result.deletedCount;
    }
}

module.exports = { AuditService };
