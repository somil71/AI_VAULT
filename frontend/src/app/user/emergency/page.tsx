"use client";

import EmergencyRelease from "@/components/EmergencyRelease";
import { useWallet } from "@/context/WalletContext";

export default function UserEmergencyPage() {
    const { walletAddress } = useWallet();

    return (
        <div className="space-y-4">
            <div className="glass-card p-5">
                <h2 className="text-lg font-semibold text-white">Emergency Digital Release</h2>
                <p className="text-sm text-slate-400">Prepare trusted recovery access for emergencies.</p>
            </div>
            <EmergencyRelease walletAddress={walletAddress} />
        </div>
    );
}
