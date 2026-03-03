export type AuditEventType =
    | "scam_scan"
    | "watchlist_alert"
    | "document_store"
    | "identity_mint"
    | "proof_submit"
    | "emergency_trigger"
    | "auth";

export type AuditEvent = {
    id: string;
    type: AuditEventType;
    message: string;
    createdAt: number;
    metadata?: Record<string, unknown>;
};

const AUDIT_KEY = "lifevault_audit_logs";
const USERS_KEY = "lifevault_known_users";
const SCAM_HISTORY_KEY = "lifevault_scam_history";
const TX_HISTORY_KEY = "lifevault_tx_history";

function readJson<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

function writeJson<T>(key: string, value: T) {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
}

export function appendAuditLog(event: Omit<AuditEvent, "id" | "createdAt">) {
    const logs = readJson<AuditEvent[]>(AUDIT_KEY, []);
    logs.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        ...event,
    });
    writeJson(AUDIT_KEY, logs.slice(0, 500));
}

export function getAuditLogs() {
    return readJson<AuditEvent[]>(AUDIT_KEY, []);
}

export function trackKnownUser(user: { email?: string | null; walletAddress?: string | null }) {
    if (!user.email && !user.walletAddress) return;
    const users = readJson<Array<{ email?: string | null; walletAddress?: string | null; lastSeenAt: number }>>(USERS_KEY, []);
    const index = users.findIndex((item) => item.email === user.email || item.walletAddress === user.walletAddress);
    if (index >= 0) {
        users[index] = { ...users[index], ...user, lastSeenAt: Date.now() };
    } else {
        users.push({ ...user, lastSeenAt: Date.now() });
    }
    writeJson(USERS_KEY, users);
}

export function getKnownUsers() {
    return readJson<Array<{ email?: string | null; walletAddress?: string | null; lastSeenAt: number }>>(USERS_KEY, []);
}

export function appendScamHistory(entry: {
    inputText?: string;
    inputUrl?: string;
    riskLevel: string;
    probability: number;
    watchlistHit: boolean;
}) {
    const history = readJson<any[]>(SCAM_HISTORY_KEY, []);
    history.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        ...entry,
    });
    writeJson(SCAM_HISTORY_KEY, history.slice(0, 300));
}

export function getScamHistory() {
    return readJson<any[]>(SCAM_HISTORY_KEY, []);
}

export function appendTxHistory(entry: { fileName: string; total: number; flagged: number; risk: number }) {
    const history = readJson<any[]>(TX_HISTORY_KEY, []);
    history.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        ...entry,
    });
    writeJson(TX_HISTORY_KEY, history.slice(0, 200));
}

export function getTxHistory() {
    return readJson<any[]>(TX_HISTORY_KEY, []);
}

