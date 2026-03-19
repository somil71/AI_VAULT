"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import toast from "react-hot-toast";

export default function DeveloperPortal() {
    const [activeTab, setActiveTab] = useState<"keys" | "webhooks">("keys");
    const [keys, setKeys] = useState<any[]>([]);
    const [webhooks, setWebhooks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newKeyName, setNewKeyName] = useState("");
    const [newWebhookUrl, setNewWebhookUrl] = useState("");

    const fetchData = async () => {
        setLoading(true);
        try {
            const [keysResp, webhooksResp] = await Promise.all([
                apiClient.get("/developer/keys"),
                apiClient.get("/webhooks")
            ]);
            if (keysResp.data.status === "success") setKeys(keysResp.data.data);
            if (webhooksResp.data.status === "success") setWebhooks(webhooksResp.data.data);
        } catch (err) {
            console.error("Failed to fetch developer data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateKey = async () => {
        if (!newKeyName) return;
        try {
            await apiClient.post("/developer/keys", { name: newKeyName });
            toast.success("API Key generated successfully!");
            setNewKeyName("");
            fetchData();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleRevokeKey = async (id: string) => {
        if (!confirm("Are you sure you want to revoke this key? This action is irreversible.")) return;
        try {
            await apiClient.delete(`/developer/keys/${id}`);
            toast.success("Key revoked");
            fetchData();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8">
            <div className="hero-panel p-10 bg-gradient-to-r from-blue-600/10 to-transparent border border-blue-500/20">
                <h1 className="text-4xl font-bold text-white mb-4">Developer Portal</h1>
                <p className="text-slate-300 text-lg max-w-2xl">
                    Integrate LifeVault AI's phishing detection engine into your own dApps, 
                    wallets, or browsers with our high-performance API.
                </p>
            </div>

            <div className="flex gap-4 border-b border-slate-800 pb-px">
                <button 
                    onClick={() => setActiveTab("keys")}
                    className={`pb-4 px-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'keys' ? 'border-blue-500 text-white' : 'border-transparent text-slate-500 hover:text-white'}`}
                >
                    API Keys
                </button>
                <button 
                    onClick={() => setActiveTab("webhooks")}
                    className={`pb-4 px-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'webhooks' ? 'border-blue-500 text-white' : 'border-transparent text-slate-500 hover:text-white'}`}
                >
                    Webhooks (B2B)
                </button>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                    {activeTab === "keys" ? (
                        <div className="glass-card p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold text-white">Your API Keys</h2>
                        </div>

                        {loading ? (
                            <div className="text-slate-500 py-4 italic">Loading keys...</div>
                        ) : keys.length === 0 ? (
                            <div className="text-slate-500 py-4 italic">No API keys found. Generate one to get started.</div>
                        ) : (
                            <div className="space-y-4">
                                {keys.map((k) => (
                                    <div key={k._id} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="text-sm font-semibold text-white">{k.name}</div>
                                            <code className="text-xs text-blue-400 block max-w-xs truncate">{k.key}</code>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded uppercase font-bold">
                                                {k.tier}
                                            </span>
                                            <button 
                                                onClick={() => handleRevokeKey(k._id)}
                                                className="text-xs text-slate-500 hover:text-red-400 transition-colors uppercase font-bold"
                                            >
                                                Revoke
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    ) : (
                        <div className="glass-card p-8">
                            <h2 className="text-xl font-bold text-white mb-6">Threat Streaming Webhooks</h2>
                            {webhooks.length === 0 ? (
                                <div className="text-slate-500 italic">No webhooks registered. Secure your infrastructure with real-time alerts.</div>
                            ) : (
                                <div className="space-y-4">
                                    {webhooks.map((h) => (
                                        <div key={h._id} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-white truncate max-w-xs">{h.url}</span>
                                                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${h.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                    {h.isActive ? 'Active' : 'Suspended'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-500">SECRET:</span>
                                                <code className="text-[10px] text-blue-400">••••••••••••••••</code>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="glass-card p-8 bg-slate-900/30">
                        <h2 className="text-xl font-bold text-white mb-6">Documentation Snippet</h2>
                        <div className="bg-[#050810] p-5 rounded-xl border border-slate-800">
                            <pre className="text-xs text-slate-300">
                                {`curl -X POST https://api.lifevault.ai/v1/analyze/url \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://malicious-site.com"}'`}
                            </pre>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {activeTab === "keys" ? (
                        <div className="glass-card p-8 border-blue-500/30">
                            <h3 className="text-lg font-bold text-white mb-4">Generate New Key</h3>
                            <div className="space-y-4">
                                <input 
                                    value={newKeyName}
                                    onChange={(e) => setNewKeyName(e.target.value)}
                                    placeholder="Key Name (e.g. My MetaMask Plugin)"
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white"
                                />
                                <button 
                                    onClick={handleCreateKey}
                                    className="btn-primary w-full py-2"
                                >
                                    Generate Key
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="glass-card p-8 border-blue-500/30">
                            <h3 className="text-lg font-bold text-white mb-4">Register Webhook</h3>
                            <div className="space-y-4">
                                <input 
                                    value={newWebhookUrl}
                                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                                    placeholder="https://your-api.com/webhooks/lifevault"
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white"
                                />
                                <button 
                                    onClick={async () => {
                                        try {
                                            await apiClient.post("/webhooks/register", { url: newWebhookUrl });
                                            toast.success("Webhook registered!");
                                            setNewWebhookUrl("");
                                            fetchData();
                                        } catch (err: any) { toast.error(err.message); }
                                    }}
                                    className="btn-primary w-full py-2"
                                >
                                    Add Endpoint
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="glass-card p-8">
                        <h3 className="text-lg font-bold text-white mb-4">Usage & Quotas</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Monthly Requests</span>
                                <span className="text-white">0 / 30,000</span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-blue-500 h-full w-[2%]" />
                            </div>
                            <p className="text-[10px] text-slate-500 italic">
                                Enterprise tier supports custom rate limits. Contact sales for more.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
