"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import toast from "react-hot-toast";

export default function ReferralsPage() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            const resp = await apiClient.get("/user/referral/stats");
            if (resp.status === 200 && resp.data.status === "success") {
                setStats(resp.data.data);
            }
        } catch (err) {
            console.error("Failed to fetch referral stats");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const copyToClipboard = () => {
        if (!stats?.link) return;
        navigator.clipboard.writeText(stats.link);
        toast.success("Referral link copied!");
    };

    if (loading) return <div className="p-12 text-center text-slate-400">Loading your referral circle...</div>;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="hero-panel p-10 bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20">
                <h1 className="text-4xl font-bold text-white mb-4">Grow the Guardian Circle</h1>
                <p className="text-slate-300 text-lg">
                    Invite your friends to LifeVault. For every 5 friends who secure their digital legacy, 
                    get <span className="text-indigo-400 font-bold">1 Month of Guardian Pro</span> for free.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="glass-card p-8 flex flex-col items-center justify-center text-center">
                    <div className="text-sm text-slate-400 uppercase tracking-widest mb-2">Your Referrals</div>
                    <div className="text-7xl font-extrabold text-indigo-400 mb-4">{stats?.totalReferrals || 0}</div>
                    <div className="text-sm text-slate-500">{stats?.rewardProgress}</div>
                </div>

                <div className="glass-card p-8 flex flex-col justify-center">
                    <h3 className="text-lg font-semibold text-white mb-4">Your Referral Link</h3>
                    <div className="bg-[#0a0f1e] p-4 rounded-lg border border-slate-800 mb-4 flex items-center justify-between">
                        <code className="text-sm text-indigo-300 truncate mr-4">
                            {stats?.link || "Generating..."}
                        </code>
                        <button 
                            onClick={copyToClipboard}
                            className="text-indigo-400 hover:text-indigo-300 font-bold text-xs"
                        >
                            COPY
                        </button>
                    </div>
                    <p className="text-xs text-slate-500">
                        Share this link on Twitter, Farcaster, or Discord to multiply your impact.
                    </p>
                </div>
            </div>

            <div className="glass-card p-8">
                <h2 className="text-xl font-bold text-white mb-6">Recent Growth Activity</h2>
                <div className="space-y-4">
                    {/* Mock data for visualization */}
                    {[1, 2].map((i) => (
                        <div key={i} className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-800" />
                                <div className="text-sm text-slate-300 flex items-center gap-2">
                                    <span className="text-white font-medium">New User Joined</span>
                                </div>
                            </div>
                            <span className="text-xs text-slate-500">2 days ago</span>
                        </div>
                    ))}
                    {(!stats || stats.totalReferrals === 0) && (
                        <p className="text-sm text-slate-500 italic">No referrals yet. Start sharing to earn rewards!</p>
                    )}
                </div>
            </div>
        </div>
    );
}
