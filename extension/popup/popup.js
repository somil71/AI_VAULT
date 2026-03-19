/**
 * LifeVault AI Guardian — Popup Script
 */

const CACHE_NAME = "url_cache";

document.addEventListener("DOMContentLoaded", async () => {
    const { jwt } = await chrome.storage.local.get("jwt");
    if (!jwt) {
        document.getElementById("main-content").classList.add("hidden");
        document.getElementById("auth-needed").classList.remove("hidden");
        return;
    }

    // Initialize UI
    updateCurrentTabStatus();
    loadThreatHistory();

    // Event Listeners
    document.getElementById("manual-scan").onclick = runManualScan;
    document.getElementById("connect-btn").onclick = () => {
        chrome.tabs.create({ url: "http://localhost:5000/login?source=extension" });
    };
});

async function updateCurrentTabStatus() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !tab.url.startsWith("http")) {
        setGauge(0, "System Ready");
        return;
    }

    const urlHash = await hashUrl(tab.url);
    const cached = await getFromCache(urlHash);
    
    if (cached) {
        setGauge(cached.risk_score * 100, cached.risk_level);
        document.getElementById("site-status").textContent = cached.risk_level;
    } else {
        document.getElementById("site-status").textContent = "Analyzing...";
        // Trigger background scan if needed
    }
}

async function runManualScan() {
    const input = document.getElementById("scan-input").value;
    if (!input) return;

    const btn = document.getElementById("manual-scan");
    btn.disabled = true;
    btn.textContent = "Analyzing...";

    try {
        const { jwt } = await chrome.storage.local.get("jwt");
        const response = await fetch("http://localhost:5000/api/v1/analyze/url", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${jwt}`
            },
            body: JSON.stringify({ url: input, text: input })
        });

        const body = await response.json();
        if (body.status === "success") {
            const data = body.data;
            setGauge(data.risk_score * 100, data.risk_level);
            alert(`Analysis Result: ${data.risk_level}\nScore: ${Math.round(data.risk_score * 100)}/100`);
        }
    } catch (err) {
        console.error("Manual scan failed:", err);
    } finally {
        btn.disabled = false;
        btn.textContent = "Analyze Now";
    }
}

function setGauge(percent, level) {
    const fill = document.getElementById("gauge-fill");
    const valText = document.getElementById("gauge-val");
    
    const offset = 251.2 - (251.2 * percent) / 100;
    fill.style.strokeDashoffset = offset;
    
    // Color logic
    if (percent >= 65) fill.style.stroke = "#ef4444";
    else if (percent >= 40) fill.style.stroke = "#f97316";
    else fill.style.stroke = "#14b8a6";

    valText.textContent = Math.round(percent);
}

async function loadThreatHistory() {
    const db = await openDB();
    const transaction = db.transaction(CACHE_NAME, "readonly");
    const store = transaction.objectStore(CACHE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
        const results = request.result || [];
        const threats = results
            .filter(r => r.data.risk_score > 0.40)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 5);
            
        const container = document.getElementById("threat-history");
        container.innerHTML = threats.length ? "" : "<div class='threat-item'>No threats detected.</div>";
        
        threats.forEach(t => {
            const date = new Date(t.timestamp).toLocaleTimeString();
            const div = document.createElement("div");
            div.className = "threat-item";
            div.innerHTML = `
                <span>${new URL(t.data.url || "https://local").hostname}</span>
                <span style="color: ${t.data.risk_score > 0.65 ? '#ef4444' : '#f97316'}">${Math.round(t.data.risk_score * 100)}</span>
            `;
            container.appendChild(div);
        });
    };
}

// ── Utils ───────────────────────────────────────────────────────────────────
async function openDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open("LifeVaultDB", 1);
        request.onsuccess = () => resolve(request.result);
    });
}

async function hashUrl(url) {
    const msgUint8 = new TextEncoder().encode(new URL(url).href);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getFromCache(urlHash) {
    const db = await openDB();
    return new Promise((resolve) => {
        const transaction = db.transaction(CACHE_NAME, "readonly");
        const store = transaction.objectStore(CACHE_NAME);
        const request = store.get(urlHash);
        request.onsuccess = () => resolve(request.result?.data || null);
        request.onerror = () => resolve(null);
    });
}
