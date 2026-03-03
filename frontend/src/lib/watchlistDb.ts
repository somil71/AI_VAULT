export type WatchlistType = "url" | "phone";

export type WatchlistEntry = {
    id?: number;
    type: WatchlistType;
    value: string;
    createdAt: number;
};

export type WatchlistAlert = {
    id?: number;
    entryValue: string;
    matchedIn: "text" | "url";
    sample: string;
    riskLevel: string;
    createdAt: number;
};

const DB_NAME = "lifevault_watchlist_db";
const DB_VERSION = 1;
const ENTRY_STORE = "watch_entries";
const ALERT_STORE = "watch_alerts";

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(ENTRY_STORE)) {
                db.createObjectStore(ENTRY_STORE, { keyPath: "id", autoIncrement: true });
            }
            if (!db.objectStoreNames.contains(ALERT_STORE)) {
                db.createObjectStore(ALERT_STORE, { keyPath: "id", autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function addWatchlistEntry(entry: Omit<WatchlistEntry, "id" | "createdAt">) {
    const db = await openDb();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(ENTRY_STORE, "readwrite");
        const store = tx.objectStore(ENTRY_STORE);
        const request = store.add({ ...entry, value: entry.value.toLowerCase(), createdAt: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function listWatchlistEntries() {
    const db = await openDb();
    return new Promise<WatchlistEntry[]>((resolve, reject) => {
        const tx = db.transaction(ENTRY_STORE, "readonly");
        const store = tx.objectStore(ENTRY_STORE);
        const request = store.getAll();
        request.onsuccess = () => resolve((request.result as WatchlistEntry[]).sort((a, b) => b.createdAt - a.createdAt));
        request.onerror = () => reject(request.error);
    });
}

export async function removeWatchlistEntry(id: number) {
    const db = await openDb();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(ENTRY_STORE, "readwrite");
        const store = tx.objectStore(ENTRY_STORE);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function addWatchlistAlert(alert: Omit<WatchlistAlert, "id" | "createdAt">) {
    const db = await openDb();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(ALERT_STORE, "readwrite");
        const store = tx.objectStore(ALERT_STORE);
        const request = store.add({ ...alert, createdAt: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function listWatchlistAlerts() {
    const db = await openDb();
    return new Promise<WatchlistAlert[]>((resolve, reject) => {
        const tx = db.transaction(ALERT_STORE, "readonly");
        const store = tx.objectStore(ALERT_STORE);
        const request = store.getAll();
        request.onsuccess = () => resolve((request.result as WatchlistAlert[]).sort((a, b) => b.createdAt - a.createdAt));
        request.onerror = () => reject(request.error);
    });
}

export async function evaluateWatchlist(input: { text?: string; url?: string }) {
    const entries = await listWatchlistEntries();
    const checks = {
        text: (input.text || "").toLowerCase(),
        url: (input.url || "").toLowerCase(),
    };

    const hits = entries.filter((entry) => checks.text.includes(entry.value) || checks.url.includes(entry.value));
    return { hits, hasHit: hits.length > 0 };
}

