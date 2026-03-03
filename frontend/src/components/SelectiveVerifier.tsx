"use client";

import { useEffect, useState } from "react";
import { keccak256, toUtf8Bytes } from "ethers";
import toast from "react-hot-toast";
import { getSigner, loadContract } from "@/lib/web3";
import { generateProof, logActivity } from "@/lib/api";
import { useWallet } from "@/context/WalletContext";
import { isActionLocked, withActionLock } from "@/lib/actionLock";
import { clearPendingTx, getPendingTx, savePendingTx, TX_CONFIRMED_EVENT } from "@/lib/txRecovery";
import { appendAuditLog } from "@/lib/localData";

const SELECTIVE_VERIFIER_ABI = [
    "function submitProof(bytes32 dataHash, bytes calldata signature, uint8 claimType) external",
    "function verifyProof(uint8 claimType) external returns (bool success)",
    "function isVerified(address user, uint8 claimType) external view returns (bool)",
];

const CLAIM_TYPES = [
    { id: 0, label: "Age Above 18", color: "#0ea5e9" },
    { id: 1, label: "Income Above X", color: "#8b5cf6" },
    { id: 2, label: "Degree Verified", color: "#22c55e" },
];

interface ProofState {
    submitted: boolean;
    verified: boolean | null;
    loading: boolean;
    txHash: string | null;
    dataHash: string | null;
    error: string | null;
}

function parseTxError(error: any) {
    const msg = error?.reason || error?.shortMessage || error?.message || "Verification failed";
    if (msg.includes("ACTION_REJECTED") || msg.toLowerCase().includes("user rejected")) return "Action canceled - please try again.";
    if (msg.includes("NONCE_EXPIRED") || msg.toLowerCase().includes("nonce")) return "Nonce conflict. Wait for pending tx and retry.";
    return msg;
}

export default function SelectiveVerifier({ walletAddress }: { walletAddress: string | null }) {
    const { setLastTxHash } = useWallet();
    const [age, setAge] = useState("25");
    const [income, setIncome] = useState("50000");
    const [hasDegree, setHasDegree] = useState(true);
    const [salt] = useState(() => Math.random().toString(36).slice(2, 18));
    const [logs, setLogs] = useState<string[]>([]);
    const [proofStates, setProofStates] = useState<Record<number, ProofState>>({
        0: { submitted: false, verified: null, loading: false, txHash: null, dataHash: null, error: null },
        1: { submitted: false, verified: null, loading: false, txHash: null, dataHash: null, error: null },
        2: { submitted: false, verified: null, loading: false, txHash: null, dataHash: null, error: null },
    });

    const contractAddress = process.env.NEXT_PUBLIC_VERIFIER_CONTRACT || process.env.NEXT_PUBLIC_SELECTIVE_VERIFIER_ADDRESS;

    const addLog = (msg: string) => setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 14)]);
    const updateState = (id: number, updates: Partial<ProofState>) => setProofStates((prev) => ({ ...prev, [id]: { ...prev[id], ...updates } }));

    const buildClaimData = (claimId: number) => {
        if (claimId === 0) {
            const ageNum = parseInt(age, 10);
            if (ageNum < 18) throw new Error("Age claim requires age >= 18");
            return `age:${ageNum}:above18:${salt}`;
        }
        if (claimId === 1) {
            const incomeNum = parseInt(income, 10);
            return `income:${incomeNum}:threshold:50000:${salt}`;
        }
        return `degree:${hasDegree}:verified:${salt}`;
    };

    const generateAndSubmitProof = async (claimId: number) => {
        if (!walletAddress) return toast.error("Connect wallet first");
        if (!contractAddress) return toast.error("Deploy SelectiveVerifier contract first");
        const lockKey = `selective-verifier:submit:${claimId}`;
        if (proofStates[claimId].loading || isActionLocked(lockKey)) return;

        updateState(claimId, { loading: true, error: null });
        try {
            await withActionLock(lockKey, async () => {
                const signer = await getSigner();
                const contract = await loadContract(contractAddress, SELECTIVE_VERIFIER_ABI);

                const dataString = buildClaimData(claimId);
                const dataHash = keccak256(toUtf8Bytes(dataString));
                const signature = await signer.signMessage(toUtf8Bytes(dataHash));

                addLog(`Submitting proof for ${CLAIM_TYPES[claimId].label}`);
                const tx = await contract.submitProof(dataHash, signature, claimId);
                savePendingTx({
                    txHash: tx.hash,
                    scope: "selective-verifier",
                    action: `submit:${claimId}`,
                    createdAt: Date.now(),
                });
                updateState(claimId, { txHash: tx.hash, dataHash });
                await tx.wait();
                clearPendingTx(tx.hash);
                setLastTxHash(tx.hash);
                appendAuditLog({
                    type: "proof_submit",
                    message: "Privacy proof submitted",
                    metadata: { claimId, txHash: tx.hash },
                });
                await logActivity({
                    type: "proof_generated",
                    walletAddress,
                    metadata: { claimId, txHash: tx.hash },
                });

                // Keep backend verification endpoint active in parallel with browser-direct flow.
                try {
                    await generateProof({ hash: dataHash, signature });
                    addLog("Backend proof endpoint also confirmed");
                } catch (mirrorErr: any) {
                    addLog(`Backend mirror skipped: ${mirrorErr.message}`);
                }

                updateState(claimId, { submitted: true, loading: false });
                toast.success("Proof submitted on-chain");
            });
        } catch (error: any) {
            const msg = parseTxError(error);
            updateState(claimId, { loading: false, error: msg });
            toast.error(msg);
        }
    };

    const verifyProof = async (claimId: number) => {
        if (!walletAddress || !contractAddress) return;
        const lockKey = `selective-verifier:verify:${claimId}`;
        if (proofStates[claimId].loading || isActionLocked(lockKey)) return;

        updateState(claimId, { loading: true, error: null });
        try {
            await withActionLock(lockKey, async () => {
                const contract = await loadContract(contractAddress, SELECTIVE_VERIFIER_ABI);
                const tx = await contract.verifyProof(claimId);
                savePendingTx({
                    txHash: tx.hash,
                    scope: "selective-verifier",
                    action: `verify:${claimId}`,
                    createdAt: Date.now(),
                });
                await tx.wait();
                clearPendingTx(tx.hash);
                setLastTxHash(tx.hash);
                const ok = await contract.isVerified(walletAddress, claimId);
                updateState(claimId, { verified: ok, loading: false, txHash: tx.hash });
                appendAuditLog({
                    type: "proof_submit",
                    message: "Privacy proof verification requested",
                    metadata: { claimId, txHash: tx.hash, result: ok },
                });
                await logActivity({
                    type: "proof_generated",
                    walletAddress,
                    metadata: { claimId, txHash: tx.hash, result: ok },
                });
                toast.success(ok ? "Proof verified" : "Proof failed");
            });
        } catch (error: any) {
            const msg = parseTxError(error);
            updateState(claimId, { loading: false, error: msg });
            toast.error(msg);
        }
    };

    useEffect(() => {
        CLAIM_TYPES.forEach((claim) => {
            const submitPending = getPendingTx("selective-verifier", `submit:${claim.id}`);
            if (submitPending) {
                updateState(claim.id, { loading: true, submitted: false, txHash: submitPending.txHash, error: null });
            }
            const verifyPending = getPendingTx("selective-verifier", `verify:${claim.id}`);
            if (verifyPending) {
                updateState(claim.id, { loading: true, txHash: verifyPending.txHash, error: null });
            }
        });

        const onConfirmed = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            if (!detail || detail.scope !== "selective-verifier") return;

            for (const claim of CLAIM_TYPES) {
                if (detail.action === `submit:${claim.id}`) {
                    updateState(claim.id, { loading: false, submitted: true, txHash: detail.txHash });
                    toast.success(`${claim.label} proof recovered after reload`);
                }
                if (detail.action === `verify:${claim.id}`) {
                    updateState(claim.id, { loading: false, txHash: detail.txHash });
                    toast.success(`${claim.label} verification tx recovered after reload`);
                }
            }
        };

        window.addEventListener(TX_CONFIRMED_EVENT, onConfirmed as EventListener);
        return () => window.removeEventListener(TX_CONFIRMED_EVENT, onConfirmed as EventListener);
    }, []);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="glass-card p-6">
                <h3 className="text-sm font-semibold text-white mb-4">Your Private Data</h3>
                <div className="grid grid-cols-3 gap-4">
                    <input id="zk-age-input" type="number" value={age} onChange={(e) => setAge(e.target.value)} className="input-dark" />
                    <input id="zk-income-input" type="number" value={income} onChange={(e) => setIncome(e.target.value)} className="input-dark" />
                    <select value={hasDegree ? "yes" : "no"} onChange={(e) => setHasDegree(e.target.value === "yes")} className="input-dark"><option value="yes">Yes</option><option value="no">No</option></select>
                </div>
            </div>

            <div className="space-y-4">
                {CLAIM_TYPES.map((claim) => {
                    const st = proofStates[claim.id];
                    return (
                        <div key={claim.id} className="glass-card p-6" style={{ border: `1px solid ${claim.color}20` }}>
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-semibold text-white">{claim.label}</h4>
                                {st.verified === true && <span className="risk-badge-low">Verified</span>}
                                {st.verified === false && <span className="risk-badge-high">Failed</span>}
                            </div>
                            <div className="flex gap-3">
                                <button id={`generate-proof-${claim.id}`} onClick={() => generateAndSubmitProof(claim.id)} disabled={st.loading || !walletAddress} className="btn-primary text-xs">
                                    {st.loading && !st.submitted ? "Pending..." : st.submitted ? "Proof Submitted" : "Generate & Submit Proof"}
                                </button>
                                {st.submitted && st.verified === null && (
                                    <button id={`verify-proof-${claim.id}`} onClick={() => verifyProof(claim.id)} disabled={st.loading} className="btn-primary text-xs">
                                        {st.loading ? "Verifying..." : "Verify On-Chain"}
                                    </button>
                                )}
                            </div>
                            {st.dataHash && <div className="mt-2 text-[10px] font-mono text-slate-500">Hash: {st.dataHash}</div>}
                            {st.txHash && <div className="mt-1 text-[10px] font-mono text-slate-500">Tx: {st.txHash}</div>}
                            {st.error && <div className="mt-1 text-xs text-red-400">{st.error}</div>}
                        </div>
                    );
                })}
            </div>

            <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Proof Activity Log</h3>
                <div className="font-mono text-xs space-y-1 max-h-36 overflow-y-auto">
                    {logs.length === 0 ? <p className="text-slate-600">No activity yet...</p> : logs.map((log, i) => <div key={i} className="text-slate-400">{log}</div>)}
                </div>
            </div>
        </div>
    );
}

