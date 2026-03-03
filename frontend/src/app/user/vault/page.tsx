"use client";

import DocumentVault from "@/components/DocumentVault";
import { useWallet } from "@/context/WalletContext";

export default function UserVaultPage() {
    const { walletAddress } = useWallet();

    return (
        <div className="space-y-4">
            <div className="glass-card p-5">
                <h2 className="text-lg font-semibold text-white">Encrypted Document Storage</h2>
                <p className="text-sm text-slate-400">Encrypt files in your browser and save only secure fingerprints.</p>
            </div>
            <DocumentVault walletAddress={walletAddress} />
        </div>
    );
}
