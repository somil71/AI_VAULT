export type EncryptedVaultRecord = {
    id?: number;
    fileName: string;
    encryptedBytes: ArrayBuffer;
    iv: number[];
    hash: string;
    size: number;
    timestamp: number;
};

const DB_NAME = "lifevault_vault_db";
const STORE_NAME = "encrypted_files";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveEncryptedFile(record: EncryptedVaultRecord): Promise<number> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.add(record);
        request.onsuccess = () => resolve(Number(request.result));
        request.onerror = () => reject(request.error);
    });
}

export async function listEncryptedFiles(): Promise<EncryptedVaultRecord[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
            const value = request.result as EncryptedVaultRecord[];
            resolve(value.sort((a, b) => b.timestamp - a.timestamp));
        };
        request.onerror = () => reject(request.error);
    });
}

