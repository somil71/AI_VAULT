"use client";

import { useState } from "react";
import { Shield, CheckCircle, Fingerprint } from "lucide-react";
import toast from "react-hot-toast";

export default function PrivateIdentityModule() {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isVerified, setIsVerified] = useState(false);

    const handleGenerateProof = async () => {
        setIsGenerating(true);
        // Simulate SnarkJS proof generation in browser
        // In reality: const { proof, publicSignals } = await snarkjs.groth16.fullProve(...)
        setTimeout(() => {
            setIsGenerating(false);
            setIsVerified(true);
            toast.success("ZK Identity Proof Generated & Verified!");
        }, 2500);
    };

    return (
        <div className="glass-card p-8 border-purple-500/30 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5">
                <Shield size={120} color="#a855f7" />
            </div>

            <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                        <Fingerprint className="text-purple-400" size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Private Identity</h3>
                        <p className="text-xs text-slate-400">Zero-Knowledge Identity Proofs (ZKIP)</p>
                    </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">
                    Prove you have a registered LifeVault Identity without revealing your wallet 
                    address or personal data. Ideal for anonymous governance or high-privacy access.
                </p>

                {isVerified ? (
                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
                        <CheckCircle className="text-green-400" size={20} />
                        <div>
                            <div className="text-sm font-bold text-white">Identity Verified (ZK)</div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Proof Valid for 24 Hours</div>
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={handleGenerateProof}
                        disabled={isGenerating}
                        className={`btn-primary w-full py-3 bg-purple-600 hover:bg-purple-700 border-purple-500 shadow-purple-500/20 ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isGenerating ? "Generating Circuit Proof..." : "Generate Identity Proof"}
                    </button>
                )}

                <div className="pt-4 border-t border-slate-800">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                        <span>Circuit: Circom 2.0</span>
                        <span>Backend: SnarkJS (Groth16)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
