export type PendingTxScope = "document-vault" | "selective-verifier" | "emergency-release";

export type PendingTx = {
    txHash: string;
    scope: PendingTxScope;
    action: string;
    createdAt: number;
};

const PENDING_TX_KEY = "lifevault_pending_txs";

export const TX_CONFIRMED_EVENT = "lifevault:tx-confirmed";
export const TX_PENDING_EVENT = "lifevault:tx-pending";

function readPendingTxs(): PendingTx[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(PENDING_TX_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writePendingTxs(entries: PendingTx[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(PENDING_TX_KEY, JSON.stringify(entries));
}

export function listPendingTxs() {
    return readPendingTxs();
}

export function getPendingTx(scope: PendingTxScope, action: string) {
    return readPendingTxs().find((entry) => entry.scope === scope && entry.action === action) || null;
}

export function savePendingTx(entry: PendingTx) {
    const current = readPendingTxs().filter((item) => item.txHash !== entry.txHash);
    current.push(entry);
    writePendingTxs(current);
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(TX_PENDING_EVENT, { detail: entry }));
    }
}

export function clearPendingTx(txHash: string) {
    const current = readPendingTxs();
    writePendingTxs(current.filter((item) => item.txHash !== txHash));
}

