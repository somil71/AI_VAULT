"use client";

import { useState } from "react";
import { createCheckoutSession } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const TIERS = [
    {
        id: "free",
        name: "Community",
        price: "0",
        description: "Core protection for individual users.",
        features: ["Manual Scan", "Basic Wallet Audit", "Community Threat Graph Access"],
        buttonText: "Current Plan",
        isCurrent: true,
    },
    {
        id: "pro",
        name: "Guardian Pro",
        price: "19",
        description: "Real-time AI guardianship for active Web3 users.",
        features: [
            "Real-time Browser Monitoring",
            "Unlimited ML Analysis",
            "Priority Support",
            "Advanced Threat Intelligence",
            "Cross-device Sync"
        ],
        buttonText: "Upgrade to Pro",
        priceId: "price_PRO_ID_HERE", // Replace with real Stripe Price ID
    },
    {
        id: "business",
        name: "Enterprise",
        price: "99",
        description: "Full-stack security for teams and VAs.",
        features: [
            "Team Vaults",
            "SOC2 Compliance Reports",
            "Custom Threat Lists",
            "Real-time API Access",
            "Dedicated Security Archtect"
        ],
        buttonText: "Contact Sales",
        priceId: "price_ENT_ID_HERE",
    }
];

export default function BillingPage() {
    const { user, isAuthenticated } = useAuth();
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const handleUpgrade = async (priceId: string, id: string) => {
        if (!isAuthenticated) return;
        setLoadingId(id);
        try {
            const { url } = await createCheckoutSession(priceId);
            window.location.href = url;
        } catch (err) {
            alert("Checkout failed. Please try again.");
            setLoadingId(null);
        }
    };

    const currentTier = user?.tier || "free";

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-12">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold text-white">Choose Your Protection Level</h1>
                <p className="text-slate-400 max-w-2xl mx-auto">
                    Secure your digital legacy with LifeVault's AI-driven security tiers. 
                    From individual safety to enterprise-grade compliance.
                </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {TIERS.map((tier) => (
                    <div key={tier.id} className={`glass-card p-8 flex flex-col ${
                        tier.id === "pro" ? "border-cyan-500/50 relative overflow-hidden" : ""
                    }`}>
                        {tier.id === "pro" && (
                            <div className="absolute top-0 right-0 bg-cyan-500 text-[#0a0f1e] text-[10px] font-bold px-3 py-1 uppercase tracking-tighter transform rotate-45 translate-x-4 translate-y-2">
                                Recommended
                            </div>
                        )}
                        
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-white mb-2">{tier.name}</h2>
                            <p className="text-sm text-slate-400 mb-6">{tier.description}</p>
                            
                            <div className="mb-8">
                                <span className="text-4xl font-extrabold text-white">${tier.price}</span>
                                <span className="text-slate-500">/month</span>
                            </div>

                            <ul className="space-y-4 mb-8">
                                {tier.features.map((f, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                                        <span className="text-cyan-400">✓</span>
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <button
                            disabled={tier.id === currentTier || loadingId === tier.id || !tier.priceId}
                            onClick={() => tier.priceId && handleUpgrade(tier.priceId, tier.id)}
                            className={`w-full py-3 rounded-lg font-bold transition-all ${
                                tier.id === currentTier
                                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                    : "btn-primary"
                            }`}
                        >
                            {loadingId === tier.id ? "Processing..." : 
                             tier.id === currentTier ? "Current Plan" : tier.buttonText}
                        </button>
                    </div>
                ))}
            </div>

            <div className="glass-card p-12 text-center bg-gradient-to-br from-cyan-500/5 to-transparent">
                <h3 className="text-2xl font-bold text-white mb-4">Need a Custom Solution?</h3>
                <p className="text-slate-400 mb-8 max-w-xl mx-auto">
                    For high-net-worth individuals and institutional vaults, we offer tailored 
                    protection protocols and hardware security integration.
                </p>
                <button className="btn-ghost">Speak to a Security Expert</button>
            </div>
        </div>
    );
}
