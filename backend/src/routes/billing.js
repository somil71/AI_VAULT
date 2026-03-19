const express = require("express");
const router = express.Router();
const { StripeService } = require("../services/stripeService");
const { auth } = require("../middleware/auth");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const success = (res, data) => res.json({ status: "success", data });

/**
 * Checkout Session Creation
 */
router.post("/checkout", auth, async (req, res) => {
    try {
        const { priceId } = req.body;
        if (!priceId) return res.status(400).json({ error: "PriceID required" });

        const session = await StripeService.createCheckoutSession(req.userId, priceId);
        return success(res, { url: session.url });
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
});

/**
 * Stripe Webhook Handler
 */
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        await StripeService.handleWebhook(event);
        res.json({ received: true });
    } catch (error) {
        res.status(500).json({ error: "Webhook consumption failed" });
    }
});

module.exports = router;
