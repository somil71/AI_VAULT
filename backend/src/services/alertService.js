/**
 * Alert Service — Real-Time Notification Hub
 * Uses SSE (Server-Sent Events) to push live security alerts to clients.
 */

class AlertService {
    constructor() {
        this.clients = new Map(); // userId -> response array
        this.userThreatHistory = new Map(); // userId -> { count: number, lastAlert: timestamp }
    }

    /**
     * Registers a new SSE client for a user.
     */
    addClient(userId, res) {
        if (!this.clients.has(userId)) {
            this.clients.set(userId, []);
        }

        const userClients = this.clients.get(userId);

        if (userClients.length >= 3) {
            res.write('event: error\ndata: {"error": "ConnectionLimitReached"}\n\n');
            res.end();
            return;
        }

        userClients.push(res);
        
        const heartbeat = setInterval(() => {
            res.write(": heartbeat\n\n");
        }, 30000);

        res.on("close", () => {
            clearInterval(heartbeat);
            const filtered = this.clients.get(userId).filter(c => c !== res);
            if (filtered.length === 0) {
                this.clients.delete(userId);
            } else {
                this.clients.set(userId, filtered);
            }
        });
    }

    /**
     * Dispatches an alert with priority-based formatting.
     */
    sendAlert(userId, rawAlert) {
        const userClients = this.clients.get(userId);
        if (!userClients) return false;

        // Phase 6: Escalation Logic
        const escalatedAlert = this._applyEscalation(userId, rawAlert);
        
        const payload = `data: ${JSON.stringify(escalatedAlert)}\n\n`;
        userClients.forEach(res => res.write(payload));
        return true;
    }

    /**
     * Escalation Logic: If a user gets 3+ alerts in 5 minutes, escalate severity.
     */
    _applyEscalation(userId, alert) {
        let history = this.userThreatHistory.get(userId) || { count: 0, lastAlert: 0 };
        const now = Date.now();
        
        // Reset count if last alert was > 5 mins ago
        if (now - history.lastAlert > 5 * 60 * 1000) {
            history.count = 0;
        }

        history.count++;
        history.lastAlert = now;
        this.userThreatHistory.set(userId, history);

        if (history.count >= 3 && alert.severity !== 'CRITICAL') {
            return {
                ...alert,
                severity: 'CRITICAL',
                message: `[ESCALATED] Multiple threats detected: ${alert.message}`,
                escalated: true
            };
        }
        return alert;
    }

    /**
     * Formats a threat detection event with scientific weights.
     */
    createThreatAlert(type, data) {
        // priority score mapping
        const severityMap = {
            'info': 1,
            'warning': 2,
            'critical': 3
        };

        return {
            id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            severity: data.level || 'info', // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
            priority: severityMap[type] || 1,
            title: data.title || "Security Alert",
            message: data.message,
            confidence: data.confidence || 0.0,
            timestamp: new Date().toISOString(),
            metadata: data.metadata || {}
        };
    }
}

const alertService = new AlertService();
module.exports = { alertService };
