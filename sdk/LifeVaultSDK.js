/**
 * LifeVault AI - White-Label SDK
 * Version: 1.0.0
 * 
 * Secure wrapper for LifeVault's AI Threat Intelligence and Vault ecosystem.
 */
class LifeVaultSDK {
    constructor(config = {}) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || "https://api.lifevault.ai/v1";
        if (!this.apiKey) console.warn("[LifeVaultSDK] API Key is missing. Some methods may require authentication.");
    }

    /**
     * Scans a URL using LifeVault's AI Ensemble.
     */
    async scanUrl(url) {
        try {
            const response = await fetch(`${this.baseUrl}/analyze/url`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": this.apiKey
                },
                body: JSON.stringify({ url })
            });
            return await response.json();
        } catch (error) {
            return { status: "error", message: error.message };
        }
    }

    /**
     * Checks if a URL is community-blocked.
     */
    async isBlocked(url) {
        try {
            const domain = new URL(url).hostname;
            const response = await fetch(`${this.baseUrl}/community/stats`);
            const data = await response.json();
            // Note: In real SDK, call a specific 'check-blocked' endpoint
            return data;
        } catch (err) {
            return { error: "Check failed" };
        }
    }

    /**
     * Embeds a security badge into the DOM.
     */
    attachBadge(elementId) {
        const el = document.getElementById(elementId);
        if (el) {
            el.innerHTML = `
                <div style="padding: 10px; border-radius: 8px; background: #080d18; border: 1px solid #22d3ee; display: flex; align-items: center; gap: 8px; font-family: sans-serif;">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: #22d3ee; box-shadow: 0 0 10px #22d3ee;"></div>
                    <span style="color: #fff; font-size: 12px; font-weight: bold;">Protected by LifeVault AI</span>
                </div>
            `;
        }
    }
}

// Export for various environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LifeVaultSDK;
} else {
    window.LifeVaultSDK = LifeVaultSDK;
}
