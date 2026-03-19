/**
 * LifeVault AI Guardian — Content Script
 * 
 * Responsibilities:
 * - Listen for BLOCK_PAGE messages from background.js.
 * - Inject a full-page modal/overlay to prevent interaction with malicious sites.
 * - Handle user override or safe exit.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "BLOCK_PAGE") {
        injectOverlay(message);
    }
});

function injectOverlay(data) {
    // Prevent multiple overlays
    if (document.getElementById("lifevault-block-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "lifevault-block-overlay";
    Object.assign(overlay.style, {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "#991b1b", // Red-800
        color: "#ffffff",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        textAlign: "center",
        padding: "20px"
    });

    overlay.innerHTML = `
        <div style="max-width: 600px;">
            <div style="font-size: 48px; margin-bottom: 20px;">🛡️</div>
            <h1 style="font-size: 32px; font-weight: 800; margin-bottom: 12px;">MALICIOUS PAGE BLOCKED</h1>
            <p style="font-size: 18px; margin-bottom: 24px; opacity: 0.9;">
                LifeVault AI detected a high-risk threat on <strong>${new URL(data.url).hostname}</strong>.
                Proceeding may compromise your wallet, documents, or identity.
            </p>
            
            <div style="background: rgba(0,0,0,0.2); padding: 16px; border-radius: 8px; margin-bottom: 32px; text-align: left;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 600;">Threat Score:</span>
                    <span style="color: #fca5a5;">${Math.round(data.score * 100)}/100</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-weight: 600;">Detection Trigger:</span>
                    <span style="font-style: italic;">${data.feature}</span>
                </div>
            </div>

            <div style="display: flex; gap: 16px; justify-content: center;">
                <button id="lv-go-back" style="background: #ffffff; color: #991b1b; border: none; padding: 12px 24px; border-radius: 6px; font-weight: 700; cursor: pointer;">
                    Go back to safety
                </button>
                <button id="lv-proceed" style="background: transparent; color: #ffffff; border: 1px solid rgba(255,255,255,0.4); padding: 12px 24px; border-radius: 6px; font-weight: 600; cursor: pointer;">
                    Proceed anyway (Risky)
                </button>
            </div>
            
            <p style="margin-top: 24px; font-size: 12px; opacity: 0.6;">
                Press ESC to dismiss and proceed. Override will be logged for security audit.
            </p>
        </div>
    `;

    document.body.appendChild(overlay);
    
    // Focus Trap & Accessibility
    overlay.focus();
    
    document.getElementById("lv-go-back").onclick = () => {
        window.history.back();
    };

    const proceed = () => {
        overlay.remove();
        logOverride(data.url);
    };

    document.getElementById("lv-proceed").onclick = proceed;

    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") proceed();
    }, { once: true });
}

async function logOverride(url) {
    try {
        const { jwt } = await chrome.storage.local.get("jwt");
        await fetch("http://localhost:5000/api/v1/threat-events/override", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${jwt}`
            },
            body: JSON.stringify({ url, timestamp: new Date().toISOString() })
        });
    } catch (err) {
        console.error("Failed to log override:", err);
    }
}
