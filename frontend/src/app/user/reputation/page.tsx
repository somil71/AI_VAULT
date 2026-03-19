"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api";

export default function WalletReputationPage() {
    const [address, setAddress] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState("");

    const fetchReputation = async () => {
        if (!address || !address.startsWith("0x")) {
            setError("Please enter a valid wallet address.");
            return;
        }

        setLoading(true);
        setError("");
        setResult(null);

        try {
            const resp = await fetch(`http://localhost:5000/api/v1/wallet/reputation/${address}`);
            const body = await resp.json();
            if (body.status === "success") {
                setResult(body.data);
            } else {
                setError(body.message || "Failed to scan wallet");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-6">
            <div className="hero-panel p-8">
                <h1 className="text-4xl font-bold text-white mb-4">Web3 Identity Reputation</h1>
                <p className="text-slate-300 text-lg">
                    Check the trust score of any Ethereum or Polygon address before interacting.
                    Powered by LifeVault's algorithmic trust engine.
                </p>
            </div>

            <div className="glass-card p-6 flex flex-col sm:flex-row gap-4 items-center">
                <input
                    type="text"
                    placeholder="Enter wallet address (0x...)"
                    className="flex-1 bg-[#0a0f1e] border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                />
                <button
                    onClick={fetchReputation}
                    disabled={loading}
                    className="btn-primary px-8 py-3 w-full sm:w-auto"
                >
                    {loading ? "Scanning..." : "Scan Wallet"}
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-lg">
                    {error}
                </div>
            )}

            {result && (
                <div className="grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="glass-card p-8 flex flex-col items-center justify-center text-center">
                        <div className="text-sm text-slate-400 uppercase tracking-widest mb-2">Trust Score</div>
                        <div className={`text-7xl font-extrabold mb-4 ${
                            result.score >= 80 ? "text-teal-400" : 
                            result.score >= 50 ? "text-amber-400" : "text-rose-400"
                        }`}>
                            {result.score}
                        </div>
                        <div className="text-xl font-semibold text-white px-4 py-1 rounded-full bg-white/5 border border-white/10">
                            {result.level}
                        </div>
                    </div>

                    <div className="glass-card p-8">
                        <h3 className="text-lg font-semibold text-white mb-4">Scoring Analysis</h3>
                        <div className="space-y-3">
                            {(result.reasons || []).map((reason: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                                    <span className="text-teal-500">✓</span>
                                    {reason}
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 pt-6 border-t border-slate-800">
                            <div className="text-xs text-slate-500">
                                Scan performed at: {new Date(result.generatedAt).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="glass-card p-8">
                <h2 className="text-xl font-bold text-white mb-6">Developer API</h2>
                <p className="text-sm text-slate-400 mb-4">Integrate LifeVault reputation scores into your DApp:</p>
                <div className="bg-[#0a0f1e] p-4 rounded-lg border border-slate-800">
                    <code className="text-xs text-cyan-400">
                        GET https://api.lifevault.ai/v1/wallet/reputation/:address
                    </code>
                </div>
            </div>
        </div>
    );
}
