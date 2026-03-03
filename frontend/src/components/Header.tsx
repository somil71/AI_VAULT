"use client";

import { useState } from "react";
import toast from "react-hot-toast";
type ActiveSection = "dashboard" | "scam-detector" | "transaction-monitor" | "document-vault" | "selective-verifier" | "emergency-release";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthContext";

const sectionTitles: Record<ActiveSection, { title: string; subtitle: string }> = {
    dashboard: { title: "Dashboard", subtitle: "Overview of your security posture" },
    "scam-detector": { title: "AI Scam Detector", subtitle: "Analyze messages and URLs for phishing" },
    "transaction-monitor": { title: "Transaction Monitor", subtitle: "ML-powered anomaly detection" },
    "document-vault": { title: "Document Vault", subtitle: "Blockchain-encrypted document storage" },
    "selective-verifier": { title: "ZK Selective Verifier", subtitle: "Prove claims without revealing data" },
    "emergency-release": { title: "Emergency Release", subtitle: "Smart contract dead man's switch" },
};

interface HeaderProps {
    activeSection: ActiveSection;
}

export default function Header({ activeSection }: HeaderProps) {
    const [connecting, setConnecting] = useState(false);
    const info = sectionTitles[activeSection];
    const { walletAddress, connect, disconnect, chainId, networkOk } = useWallet();
    const { isAuthenticated, ensureAuth, loginWithWalletSignature, logout, userEmail } = useAuth();

    const handleConnectWallet = async () => {
        setConnecting(true);
        try {
            await connect();
            toast.success("Wallet connected");
        } catch (err: any) {
            toast.error(err.message || "Wallet connection failed");
        } finally {
            setConnecting(false);
        }
    };

    const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    return (
        <header className="border-b border-[#1e3a52]/50 px-6 py-4" style={{ background: "rgba(8,13,24,0.9)", backdropFilter: "blur(12px)" }}>
            {!networkOk && walletAddress && (
                <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                    Wrong network detected. Please switch MetaMask to chainId 31337.
                </div>
            )}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-white">{info.title}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{info.subtitle}</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)" }}>
                        <div className={`w-2 h-2 rounded-full ${networkOk ? "bg-primary-400 animate-pulse" : "bg-amber-400"}`} />
                        <span className="text-xs text-primary-400 font-medium">{chainId ? `Chain ${chainId}` : "No Chain"}</span>
                    </div>

                    {isAuthenticated ? (
                        <button onClick={logout} className="btn-ghost text-xs">
                            JWT: {userEmail ? userEmail.split("@")[0] : "ready"} (Logout)
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button onClick={ensureAuth} className="btn-ghost text-xs">Get JWT</button>
                            <button
                                onClick={() => loginWithWalletSignature(walletAddress || "")}
                                disabled={!walletAddress}
                                className="btn-ghost text-xs"
                            >
                                Sign In With Wallet
                            </button>
                        </div>
                    )}

                    {walletAddress ? (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                                <span className="text-xs font-mono text-green-400">{formatAddress(walletAddress)}</span>
                            </div>
                            <button onClick={disconnect} className="btn-ghost text-xs">Disconnect</button>
                        </div>
                    ) : (
                        <button onClick={handleConnectWallet} disabled={connecting} className="btn-primary flex items-center gap-2">
                            {connecting ? "Connecting..." : "Connect Wallet"}
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}


