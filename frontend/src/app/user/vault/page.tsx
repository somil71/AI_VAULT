"use client";

import DocumentVault from "@/components/DocumentVault";
import TeamVaultManager from "@/components/TeamVaultManager";
import { useWallet } from "@/context/WalletContext";

export default function UserVaultPage() {
    const { walletAddress } = useWallet();

    return (
        <div className="space-y-12">
            <div className="hero-panel p-8 bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20">
                <h1 className="text-4xl font-bold text-white mb-4">Security Vaults</h1>
                <p className="text-slate-300 text-lg">
                    blockchain-anchored, AES-256 encrypted storage for your most sensitive assets.
                </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <DocumentVault walletAddress={walletAddress} />
                </div>
                <div className="space-y-8">
                    <TeamVaultManager />
                </div>
            </div>
        </div>
    );
}
