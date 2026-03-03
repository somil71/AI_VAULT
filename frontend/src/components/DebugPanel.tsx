"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthContext";
import { getBackendHealth } from "@/lib/api";
import { runStressChecklist, StressChecklistItem } from "@/lib/stress";
import { clearJwt } from "@/lib/api";

export default function DebugPanel() {
    const { walletAddress, chainId, lastTxHash, networkOk } = useWallet();
    const { token } = useAuth();
    const [backendStatus, setBackendStatus] = useState("unknown");
    const [stressRunning, setStressRunning] = useState(false);
    const [stressResults, setStressResults] = useState<StressChecklistItem[]>([]);

    useEffect(() => {
        let active = true;
        const poll = async () => {
            try {
                const health = await getBackendHealth();
                if (!active) return;
                setBackendStatus(health.status || "healthy");
            } catch {
                if (!active) return;
                setBackendStatus("down");
            }
        };
        poll();
        const id = setInterval(poll, 8000);
        return () => {
            active = false;
            clearInterval(id);
        };
    }, []);

    if (process.env.NODE_ENV !== "development") {
        return null;
    }

    return (
        <div className="fixed bottom-3 right-3 z-50 w-96 rounded-xl border border-slate-700/70 bg-slate-950/95 p-3 text-[11px] text-slate-300">
            <div className="mb-2 font-semibold text-slate-100">Debug Panel</div>
            <div>Wallet: {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-4)}` : "none"}</div>
            <div>Chain ID: {chainId ?? "-"} {networkOk ? "(ok)" : "(wrong)"}</div>
            <div>Last tx: {lastTxHash ? `${lastTxHash.slice(0, 10)}...` : "none"}</div>
            <div>JWT: {token ? "present" : "missing"}</div>
            <div>Backend: {backendStatus}</div>
            <div className="mt-3 flex items-center gap-2">
                <button
                    className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-200"
                    onClick={async () => {
                        setStressRunning(true);
                        try {
                            const result = await runStressChecklist();
                            setStressResults(result);
                        } finally {
                            setStressRunning(false);
                        }
                    }}
                >
                    {stressRunning ? "Running..." : "Run Stress Checks"}
                </button>
                <button
                    className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-200"
                    onClick={() => {
                        clearJwt();
                        window.dispatchEvent(new StorageEvent("storage", { key: "lifevault_jwt" }));
                    }}
                >
                    Clear JWT
                </button>
            </div>
            {stressResults.length > 0 && (
                <div className="mt-3 space-y-1 rounded border border-slate-700 p-2">
                    <div className="text-[10px] font-semibold text-slate-100">Stress Checklist</div>
                    {stressResults.map((item) => (
                        <div key={item.id} className="text-[10px]">
                            <span className={item.status === "pass" ? "text-green-400" : item.status === "fail" ? "text-red-400" : "text-amber-400"}>
                                [{item.status.toUpperCase()}]
                            </span>{" "}
                            {item.title}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

