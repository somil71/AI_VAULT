"use client";

import { useMemo, useState } from "react";
import { getAuditLogs } from "@/lib/localData";

export default function AdminAuditLogsPage() {
    const [typeFilter, setTypeFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState("");
    const logs = getAuditLogs();

    const filtered = useMemo(() => {
        return logs.filter((log) => {
            if (typeFilter !== "all" && log.type !== typeFilter) return false;
            if (!dateFilter) return true;
            const date = new Date(log.createdAt).toISOString().slice(0, 10);
            return date === dateFilter;
        });
    }, [logs, typeFilter, dateFilter]);

    return (
        <div className="space-y-6">
            <div className="glass-card p-6">
                <h2 className="text-xl font-semibold text-white">Audit Logs</h2>
                <p className="text-sm text-slate-400">JSON event timeline for important local actions.</p>
                <div className="mt-3 flex items-center gap-2">
                    <select className="input-dark max-w-[220px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                        <option value="all">All types</option>
                        <option value="auth">auth</option>
                        <option value="scam_scan">scam_scan</option>
                        <option value="watchlist_alert">watchlist_alert</option>
                        <option value="document_store">document_store</option>
                        <option value="identity_mint">identity_mint</option>
                        <option value="proof_submit">proof_submit</option>
                        <option value="emergency_trigger">emergency_trigger</option>
                    </select>
                    <input className="input-dark max-w-[220px]" type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
                </div>
            </div>

            <div className="glass-card p-5 max-h-[520px] overflow-y-auto">
                {filtered.length === 0 ? (
                    <p className="text-sm text-slate-500">No logs match current filters.</p>
                ) : (
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap">{JSON.stringify(filtered, null, 2)}</pre>
                )}
            </div>
        </div>
    );
}
