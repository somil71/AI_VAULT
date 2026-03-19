/**
 * LifeVault AI Guardian — Background Service Worker
 * 
 * Responsibilities:
 * - Listen for tab updates and scan URLs for phishing/scams.
 * - Manage URL result cache in IndexedDB.
 * - Trigger notifications for detected threats.
 * - Inject warning overlays via content scripts.
 */

const BACKEND_URL = "http://localhost:5000"; // Should match NEXT_PUBLIC_BACKEND_URL
const CACHE_NAME = "url_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── IndexedDB Cache Setup ────────────────────────────────────────────────────
const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open("LifeVaultDB", 1);
    request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(CACHE_NAME)) {
            db.createObjectStore(CACHE_NAME, { keyPath: "urlHash" });
        }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
});

async function hashUrl(url) {
    const msgUint8 = new TextEncoder().encode(new URL(url).href);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getFromCache(urlHash) {
    const db = await dbPromise;
    return new Promise((resolve) => {
        const transaction = db.transaction(CACHE_NAME, "readonly");
        const store = transaction.objectStore(CACHE_NAME);
        const request = store.get(urlHash);
        request.onsuccess = () => {
            const result = request.result;
            if (result && (Date.now() - result.timestamp < CACHE_TTL)) {
                resolve(result.data);
            } else {
                resolve(null);
            }
        };
        request.onerror = () => resolve(null);
    });
}

async function saveToCache(urlHash, data) {
    const db = await dbPromise;
    const transaction = db.transaction(CACHE_NAME, "readwrite");
    const store = transaction.objectStore(CACHE_NAME);
    store.put({ urlHash, data, timestamp: Date.now() });
}

// ── Tab Event Listener ───────────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url && tab.url.startsWith("http")) {
        try {
            const url = tab.url;
            const urlHash = await hashUrl(url);
            
            // Check Cache
            const cached = await getFromCache(urlHash);
            if (cached) {
                console.log("Cache hit for URL:", url);
                handleAnalysisResult(tabId, url, cached);
                return;
            }

            // Fetch JWT
            const { jwt } = await chrome.storage.local.get("jwt");
            if (!jwt) {
                console.warn("User not logged in, skipping scan.");
                return;
            }

            // API Analysis
            const response = await fetch(`${BACKEND_URL}/api/v1/analyze/url`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${jwt}`
                },
                body: JSON.stringify({ url })
            });

            const body = await response.json();
            if (body.status === "success") {
                const data = body.data;
                await saveToCache(urlHash, data);
                handleAnalysisResult(tabId, url, data);
            }
        } catch (error) {
            console.error("URL Analysis failed:", error.message);
        }
    }
});

function handleAnalysisResult(tabId, url, data) {
    const { risk_score, risk_level, reasoning } = data;
    
    // Critical Threat Overlay
    if (risk_score > 0.65) {
        chrome.tabs.sendMessage(tabId, {
            type: "BLOCK_PAGE",
            url: url,
            score: risk_score,
            level: risk_level,
            feature: reasoning?.[0] || "Suspicious domain patterns"
        });

        chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon128.png",
            title: "CRITICAL THREAT DETECTED",
            message: `LifeVault blocked a malicious page: ${new URL(url).hostname}`,
            priority: 2
        });
    } 
    // Warning Notification
    else if (risk_score > 0.40) {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon128.png",
            title: "Security Warning",
            message: `Suspicious activity detected on ${new URL(url).hostname} (Score: ${Math.round(risk_score * 100)})`,
            priority: 1
        });
    }
}

// ── On Install ─────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
    chrome.tabs.create({ url: `${BACKEND_URL}/login?ext_install=true` });
});
