const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { User } = require("../models/User");
const { ComplianceService } = require("./complianceService");

/**
 * Stripe Billing Service
 * Handles customer creation, subscription sessions, and tier updates.
 */
class StripeService {
    
    static async createCustomer(user) {
        if (user.stripeCustomerId) return user.stripeCustomerId;

        const customer = await stripe.customers.create({
            email: user.email,
            metadata: { userId: user._id.toString() }
        });

        await User.findByIdAndUpdate(user._id, { stripeCustomerId: customer.id });
        return customer.id;
    }

    static async createCheckoutSession(userId, priceId) {
        const user = await User.findById(userId);
        const customerId = await this.createCustomer(user);

        return await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ["card"],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: "subscription",
            success_url: `${process.env.FRONTEND_URL}/user/billing/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/user/billing/cancel`,
        });
    }

    static async handleWebhook(event) {
        const session = event.data.object;

        switch (event.type) {
            case "checkout.session.completed":
                await this.updateUserTier(session.customer, "pro");
                break;
            case "customer.subscription.deleted":
                await this.updateUserTier(session.customer, "free");
                break;
            // Add more as needed
        }
    }

    static async updateUserTier(stripeCustomerId, tier) {
        const user = await User.findOneAndUpdate({ stripeCustomerId }, { tier }, { new: false });
        if (user) {
            // Log for SOC2 compliance
            await ComplianceService.logAdminAction(
                { userId: "SYSTEM_STRIPE", ip: "127.0.0.1", headers: {} },
                "TIER_UPDATE_STRIPE",
                user._id,
                "User",
                { before: user.tier, after: tier }
            );
        }
        console.log(`[STRIPE] Updated customer ${stripeCustomerId} to tier: ${tier}`);
    }
}

module.exports = { StripeService };
