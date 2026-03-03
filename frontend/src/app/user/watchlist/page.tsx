"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { addWatchlistEntry, listWatchlistAlerts, listWatchlistEntries, removeWatchlistEntry, WatchlistType } from "@/lib/watchlistDb";

export default function UserWatchlistPage() {
    const [type, setType] = useState<WatchlistType>("url");
    const [value, setValue] = useState("");
    const [entries, setEntries] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        const [nextEntries, nextAlerts] = await Promise.all([listWatchlistEntries(), listWatchlistAlerts()]);
        setEntries(nextEntries);
        setAlerts(nextAlerts);
    };

    useEffect(() => {
        load().catch(() => {
            setEntries([]);
            setAlerts([]);
        });
    }, []);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!value.trim()) {
            toast.error("Enter a value first.");
            return;
        }
        setSaving(true);
        try {
            await addWatchlistEntry({ type, value: value.trim() });
            setValue("");
            await load();
            toast.success("Added to watchlist.");
        } catch {
            toast.error("Failed to save watchlist entry.");
        } finally {
            setSaving(false);
        }
    };

    const alertSummary = useMemo(() => {
        const last24h = Date.now() - 24 * 60 * 60 * 1000;
        return alerts.filter((a) => a.createdAt >= last24h).length;
    }, [alerts]);

    return (
        <div className="space-y-6">
            <div className="glass-card p-5">
                <h2 className="text-lg font-semibold text-white">Suspicious Contact and Link Watchlist</h2>
                <p className="text-sm text-slate-400">Add phone numbers or URLs to get proactive warnings during checks.</p>
            </div>

            <form onSubmit={submit} className="glass-card p-5 space-y-3">
                <div className="grid sm:grid-cols-[140px_1fr_auto] gap-3">
                    <select className="input-dark" value={type} onChange={(e) => setType(e.target.value as WatchlistType)}>
                        <option value="url">URL</option>
                        <option value="phone">Phone</option>
                    </select>
                    <input className="input-dark" placeholder="Enter URL or phone number" value={value} onChange={(e) => setValue(e.target.value)} />
                    <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving..." : "Add"}</button>
                </div>
            </form>

            <div className="grid lg:grid-cols-2 gap-4">
                <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold text-white mb-3">Watch Entries ({entries.length})</h3>
                    {entries.length === 0 ? (
                        <p className="text-sm text-slate-500">No watch entries yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {entries.map((entry) => (
                                <div key={entry.id} className="p-3 rounded-lg border border-[#1e3a52] bg-[#0f172a] flex items-center justify-between gap-2">
                                    <div>
                                        <div className="text-xs uppercase text-slate-500">{entry.type}</div>
                                        <div className="text-sm text-white">{entry.value}</div>
                                    </div>
                                    <button
                                        className="btn-ghost text-xs"
                                        onClick={async () => {
                                            await removeWatchlistEntry(entry.id);
                                            await load();
                                        }}
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold text-white mb-3">Alert History</h3>
                    <p className="text-xs text-slate-500 mb-3">Alerts in last 24h: {alertSummary}</p>
                    {alerts.length === 0 ? (
                        <p className="text-sm text-slate-500">No alerts yet.</p>
                    ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                            {alerts.map((alert) => (
                                <div key={alert.id} className="p-3 rounded-lg border border-red-400/20 bg-red-500/5 text-red-300">
                                    <div className="text-xs">{new Date(alert.createdAt).toLocaleString()}</div>
                                    <div className="text-sm">{alert.entryValue} matched in {alert.matchedIn}</div>
                                    <div className="text-xs">Risk: {alert.riskLevel}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
