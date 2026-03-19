"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, FileSearch, ShieldCheck, History } from "lucide-react";
import { apiClient } from "@/lib/api";

export default function ComplianceDashboard() {
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAudit = async () => {
            try {
                // In a real app, this would be a dedicated /compliance/audit endpoint
                const resp = await apiClient.get("/activity/recent?limit=50");
                if (resp.data.status === "success") {
                    setAuditLogs(resp.data.data.events);
                }
            } catch (err) {
                console.error("Audit fetch failed");
            } finally {
                setLoading(false);
            }
        };
        fetchAudit();
    }, []);

    return (
        <div className="space-y-8 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Compliance & SOC2</h1>
                    <p className="text-slate-400">Evidence collection and administrative audit trails.</p>
                </div>
                <div className="flex gap-3">
                    <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                        <ShieldCheck size={14} /> Readiness: 82%
                    </span>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <div className="glass-card p-6 border-blue-500/20">
                    <History className="text-blue-400 mb-4" size={32} />
                    <h3 className="text-lg font-bold text-white">Immutable Logs</h3>
                    <p className="text-xs text-slate-500 mt-2">Administrative actions are cryptographically hashed and immutable.</p>
                </div>
                <div className="glass-card p-6 border-purple-500/20">
                    <FileSearch className="text-purple-400 mb-4" size={32} />
                    <h3 className="text-lg font-bold text-white">Evidence Bundles</h3>
                    <p className="text-xs text-slate-500 mt-2">Automated collection for CC series control points.</p>
                </div>
                <div className="glass-card p-6 border-red-500/20">
                    <ShieldAlert className="text-red-400 mb-4" size={32} />
                    <h3 className="text-lg font-bold text-white">SLA Monitoring</h3>
                    <p className="text-xs text-slate-500 mt-2">Incident response time tracking and alerts.</p>
                </div>
            </div>

            <div className="glass-card p-8">
                <h2 className="text-xl font-bold text-white mb-6">Administrative Audit Trail</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase font-bold">
                                <th className="pb-4">Timestamp</th>
                                <th className="pb-4">Action</th>
                                <th className="pb-4">Actor</th>
                                <th className="pb-4">Context</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {auditLogs.map((log) => (
                                <tr key={log._id} className="border-b border-slate-800/50 hover:bg-slate-900/30 transition-colors">
                                    <td className="py-4 text-slate-400 font-mono text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                                    <td className="py-4">
                                        <span className="text-white font-semibold">{log.type}</span>
                                    </td>
                                    <td className="py-4 text-slate-400">{log.userEmail || "System"}</td>
                                    <td className="py-4">
                                        <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-500">
                                            {log.ipAddress || "Internal"}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
