"use client";

import { useEffect, useState } from "react";

type HealthStatus = "healthy" | "down" | "unknown";

export default function AdminSystemHealthPage() {
    const [backend, setBackend] = useState<HealthStatus>("unknown");
    const [ai, setAi] = useState<HealthStatus>("unknown");
    const [rpc, setRpc] = useState<HealthStatus>("unknown");
    const [db, setDb] = useState<HealthStatus>("unknown");

    const runHealth = async () => {
        try {
            const backendResp = await fetch("http://localhost:5000/api/health");
            const backendJson = await backendResp.json();
            setBackend(backendResp.ok ? "healthy" : "down");
            setDb(backendJson?.data?.mongodb === "connected" ? "healthy" : "down");
        } catch {
            setBackend("down");
            setDb("down");
        }

        try {
            const aiResp = await fetch("http://localhost:8000/health");
            setAi(aiResp.ok ? "healthy" : "down");
        } catch {
            setAi("down");
        }

        try {
            const rpcResp = await fetch("http://127.0.0.1:8545", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
            });
            const rpcJson = await rpcResp.json();
            setRpc(rpcJson?.result === "0x7a69" ? "healthy" : "down");
        } catch {
            setRpc("down");
        }
    };

    useEffect(() => {
        runHealth();
        const id = setInterval(runHealth, 10000);
        return () => clearInterval(id);
    }, []);

    const statusClass = (status: HealthStatus) => status === "healthy" ? "risk-badge-low" : status === "down" ? "risk-badge-high" : "risk-badge-medium";

    return (
        <div className="space-y-6">
            <div className="glass-card p-6">
                <h2 className="text-xl font-semibold text-white">System Health</h2>
                <p className="text-sm text-slate-400">Backend, AI service, local safe chain, and database health checks.</p>
                <button className="btn-ghost text-xs mt-3" onClick={runHealth}>Refresh Health</button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
                <div className="glass-card p-4 flex items-center justify-between"><span>Backend API</span><span className={statusClass(backend)}>{backend}</span></div>
                <div className="glass-card p-4 flex items-center justify-between"><span>AI Service</span><span className={statusClass(ai)}>{ai}</span></div>
                <div className="glass-card p-4 flex items-center justify-between"><span>Safe Chain System</span><span className={statusClass(rpc)}>{rpc}</span></div>
                <div className="glass-card p-4 flex items-center justify-between"><span>MongoDB</span><span className={statusClass(db)}>{db}</span></div>
            </div>
        </div>
    );
}
