"use client";

import SelectiveVerifier from "@/components/SelectiveVerifier";
import { useWallet } from "@/context/WalletContext";

export default function UserProofsPage() {
    const { walletAddress } = useWallet();

    return (
        <div className="space-y-4">
            <div className="glass-card p-5">
                <h2 className="text-lg font-semibold text-white">Selective Proofs</h2>
                <p className="text-sm text-slate-400">Prove key facts while keeping private data hidden.</p>
            </div>
            <SelectiveVerifier walletAddress={walletAddress} />
        </div>
    );
}
