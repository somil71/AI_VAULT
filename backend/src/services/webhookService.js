const axios = require("axios");
const crypto = require("crypto");
const Webhook = require("../models/Webhook");

/**
 * Webhook Service
 * Handles delivery of threat events to third-party endpoints.
 */
class WebhookService {
    /**
     * Dispatches a threat event to all active subscibers.
     */
    static async notify(eventType, payload) {
        const webhooks = await Webhook.find({ 
            events: eventType, 
            isActive: true 
        });

        const results = await Promise.allSettled(webhooks.map(webhook => this.send(webhook, eventType, payload)));
        return results;
    }

    /**
     * Sends a signed POST request to a single webhook.
     */
    static async send(webhook, eventType, data) {
        const payload = JSON.stringify({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            event: eventType,
            data
        });

        const signature = crypto
            .createHmac("sha256", webhook.secret)
            .update(payload)
            .digest("hex");

        try {
            await axios.post(webhook.url, payload, {
                headers: {
                    "Content-Type": "application/json",
                    "x-lifevault-signature": signature,
                    "x-lifevault-event": eventType,
                },
                timeout: 5000,
            });

            webhook.lastTriggeredAt = new Date();
            webhook.failCount = 0;
            await webhook.save();
        } catch (error) {
            webhook.failCount += 1;
            if (webhook.failCount >= 10) {
                webhook.isActive = false; // Auto-suspend
            }
            await webhook.save();
            throw error;
        }
    }
}

module.exports = WebhookService;
