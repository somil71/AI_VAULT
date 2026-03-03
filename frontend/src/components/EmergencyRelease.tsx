"use client";

import { useEffect, useState } from "react";
import { Contract } from "ethers";
import toast from "react-hot-toast";
import { loadContract, getProvider } from "@/lib/web3";
import { logActivity, triggerEmergency } from "@/lib/api";
import { useWallet } from "@/context/WalletContext";
import { isActionLocked, withActionLock } from "@/lib/actionLock";
import { clearPendingTx, getPendingTx, savePendingTx, TX_CONFIRMED_EVENT } from "@/lib/txRecovery";
import { appendAuditLog } from "@/lib/localData";

const EMERGENCY_ABI = [
    "function setupEmergencyRelease(address trustedAddress, uint256 inactivityPeriod, string calldata encryptedVaultKey) external",
    "function recordActivity() external",
    "function triggerEmergencyRelease(address ownerAddress) external",
    "function timeUntilRelease(address ownerAddress) external view returns (uint256)",
    "function getConfig(address ownerAddress) external view returns (address trustedAddress, uint256 inactivityPeriod, uint256 lastActivity, bool isActive, bool hasBeenReleased)",
];

interface EmergencyConfig {
    trustedAddress: string;
    inactivityPeriod: number;
    lastActivity: number;
    isActive: boolean;
    hasBeenReleased: boolean;
}

interface TxState {
    txPending: boolean;
    txConfirmed: boolean;
    txHash: string | null;
    error: string | null;
}

function parseTxError(error: any) {
    const msg = error?.reason || error?.shortMessage || error?.message || "Transaction failed";
    if (msg.includes("ACTION_REJECTED") || msg.toLowerCase().includes("user rejected")) return "Action canceled - please try again.";
    if (msg.includes("NONCE_EXPIRED") || msg.toLowerCase().includes("nonce")) return "Nonce conflict. Wait for pending tx and retry.";
    return msg;
}

export default function EmergencyRelease({ walletAddress }: { walletAddress: string | null }) {
    const { setLastTxHash } = useWallet();
    const [trustedAddress, setTrustedAddress] = useState("");
    const [inactivitySeconds, setInactivitySeconds] = useState("300");
    const [vaultKeySecret, setVaultKeySecret] = useState("my-secret-vault-master-key-2024");
    const [config, setConfig] = useState<EmergencyConfig | null>(null);
    const [timeUntilRelease, setTimeUntilRelease] = useState<number | null>(null);
    const [triggerAddress, setTriggerAddress] = useState("");
    const [txState, setTxState] = useState<TxState>({ txPending: false, txConfirmed: false, txHash: null, error: null });

    const contractAddress = process.env.NEXT_PUBLIC_EMERGENCY_CONTRACT || process.env.NEXT_PUBLIC_EMERGENCY_RELEASE_ADDRESS;

    const getContract = async (readOnly = false) => {
        if (!contractAddress) throw new Error("Emergency contract missing");
        if (readOnly) {
            const provider = await getProvider();
            return new Contract(contractAddress, EMERGENCY_ABI, provider);
        }
        return loadContract(contractAddress, EMERGENCY_ABI);
    };

    const loadConfig = async () => {
        if (!walletAddress || !contractAddress) return;
        try {
            const contract = await getContract(true);
            const result = await contract.getConfig(walletAddress);
            if (!result.isActive) return;
            setConfig({
                trustedAddress: result.trustedAddress,
                inactivityPeriod: Number(result.inactivityPeriod),
                lastActivity: Number(result.lastActivity),
                isActive: result.isActive,
                hasBeenReleased: result.hasBeenReleased,
            });
            const timeLeft = await contract.timeUntilRelease(walletAddress);
            setTimeUntilRelease(Number(timeLeft));
        } catch {
            // no config yet
        }
    };

    useEffect(() => {
        loadConfig();
    }, [walletAddress]);

    useEffect(() => {
        if (timeUntilRelease === null || timeUntilRelease <= 0) return;
        const timer = setInterval(() => {
            setTimeUntilRelease((t) => (t !== null && t > 0 ? t - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [timeUntilRelease]);

    const setupEmergencyRelease = async () => {
        if (!walletAddress) return toast.error("Connect wallet first");
        if (!contractAddress) return toast.error("Deploy EmergencyRelease contract first");
        if (txState.txPending || isActionLocked("emergency-release:setup")) return;

        const period = parseInt(inactivitySeconds, 10);
        if (!trustedAddress || !trustedAddress.startsWith("0x")) return toast.error("Enter valid trusted address");
        if (period < 60) return toast.error("Minimum inactivity period is 60 seconds");

        setTxState({ txPending: true, txConfirmed: false, txHash: null, error: null });
        try {
            await withActionLock("emergency-release:setup", async () => {
                const contract = await getContract();
                const encryptedKey = btoa(vaultKeySecret);
                const tx = await contract.setupEmergencyRelease(trustedAddress, period, encryptedKey);
                savePendingTx({
                    txHash: tx.hash,
                    scope: "emergency-release",
                    action: "setup",
                    createdAt: Date.now(),
                });
                setTxState({ txPending: true, txConfirmed: false, txHash: tx.hash, error: null });
                await tx.wait();
                clearPendingTx(tx.hash);
                setTxState({ txPending: false, txConfirmed: true, txHash: tx.hash, error: null });
                setLastTxHash(tx.hash);
                appendAuditLog({
                    type: "emergency_trigger",
                    message: "Emergency release configured",
                    metadata: { txHash: tx.hash, trustedAddress },
                });
                await logActivity({
                    type: "emergency_triggered",
                    walletAddress,
                    metadata: { txHash: tx.hash, action: "configured", trustedAddress },
                });
                await loadConfig();
                toast.success("Emergency release configured");
            });
        } catch (error: any) {
            const msg = parseTxError(error);
            setTxState({ txPending: false, txConfirmed: false, txHash: null, error: msg });
            toast.error(msg);
        }
    };

    const recordActivity = async () => {
        if (!walletAddress || !contractAddress || txState.txPending || isActionLocked("emergency-release:record")) return;

        setTxState({ txPending: true, txConfirmed: false, txHash: null, error: null });
        try {
            await withActionLock("emergency-release:record", async () => {
                const contract = await getContract();
                const tx = await contract.recordActivity();
                savePendingTx({
                    txHash: tx.hash,
                    scope: "emergency-release",
                    action: "record",
                    createdAt: Date.now(),
                });
                setTxState({ txPending: true, txConfirmed: false, txHash: tx.hash, error: null });
                await tx.wait();
                clearPendingTx(tx.hash);
                setTxState({ txPending: false, txConfirmed: true, txHash: tx.hash, error: null });
                setLastTxHash(tx.hash);
                appendAuditLog({ type: "emergency_trigger", message: "Emergency activity heartbeat recorded", metadata: { txHash: tx.hash } });
                await logActivity({
                    type: "emergency_triggered",
                    walletAddress,
                    metadata: { txHash: tx.hash, action: "heartbeat" },
                });
                await loadConfig();
                toast.success("Activity recorded");
            });
        } catch (error: any) {
            const msg = parseTxError(error);
            setTxState({ txPending: false, txConfirmed: false, txHash: null, error: msg });
            toast.error(msg);
        }
    };

    const triggerRelease = async () => {
        if (!walletAddress || !contractAddress || txState.txPending || isActionLocked("emergency-release:trigger")) return;
        if (!triggerAddress) return toast.error("Enter owner address");

        setTxState({ txPending: true, txConfirmed: false, txHash: null, error: null });
        try {
            await withActionLock("emergency-release:trigger", async () => {
                const contract = await getContract();
                const tx = await contract.triggerEmergencyRelease(triggerAddress);
                savePendingTx({
                    txHash: tx.hash,
                    scope: "emergency-release",
                    action: "trigger",
                    createdAt: Date.now(),
                });
                setTxState({ txPending: true, txConfirmed: false, txHash: tx.hash, error: null });
                await tx.wait();
                clearPendingTx(tx.hash);
                setTxState({ txPending: false, txConfirmed: true, txHash: tx.hash, error: null });
                setLastTxHash(tx.hash);
                appendAuditLog({
                    type: "emergency_trigger",
                    message: "Emergency release trigger executed",
                    metadata: { txHash: tx.hash, triggerAddress },
                });
                await logActivity({
                    type: "emergency_triggered",
                    walletAddress,
                    metadata: { txHash: tx.hash, action: "trigger", triggerAddress },
                });

                // Keep backend endpoint active in parallel for compatibility.
                try {
                    await triggerEmergency({ userAddress: triggerAddress });
                } catch {
                    // ignore mirror failure, direct tx already confirmed
                }

                toast.success("Emergency release triggered");
            });
        } catch (error: any) {
            const msg = parseTxError(error);
            setTxState({ txPending: false, txConfirmed: false, txHash: null, error: msg });
            toast.error(msg);
        }
    };

    useEffect(() => {
        const setupPending = getPendingTx("emergency-release", "setup");
        const recordPending = getPendingTx("emergency-release", "record");
        const triggerPending = getPendingTx("emergency-release", "trigger");
        const pending = setupPending || recordPending || triggerPending;
        if (pending) {
            setTxState({ txPending: true, txConfirmed: false, txHash: pending.txHash, error: null });
        }

        const onConfirmed = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            if (!detail || detail.scope !== "emergency-release") return;
            setTxState({ txPending: false, txConfirmed: true, txHash: detail.txHash, error: null });
            setLastTxHash(detail.txHash);
            loadConfig().catch(() => {});
            toast.success(`Recovered emergency transaction: ${detail.action}`);
        };

        window.addEventListener(TX_CONFIRMED_EVENT, onConfirmed as EventListener);
        return () => window.removeEventListener(TX_CONFIRMED_EVENT, onConfirmed as EventListener);
    }, []);

    return (
        <div className="space-y-6 animate-fade-in">
            {!walletAddress && (
                <div className="glass-card p-4 text-center text-danger-400 text-sm" style={{ border: "1px solid rgba(239,68,68,0.3)" }}>
                    Connect MetaMask wallet to configure emergency release
                </div>
            )}

            <div className="glass-card p-6">
                <h3 className="text-sm font-semibold text-white mb-4">Configure Emergency Release</h3>
                <div className="space-y-4">
                    <input id="trusted-address-input" type="text" value={trustedAddress} onChange={(e) => setTrustedAddress(e.target.value)} placeholder="Trusted wallet address" className="input-dark" />
                    <input id="inactivity-period-input" type="number" value={inactivitySeconds} onChange={(e) => setInactivitySeconds(e.target.value)} className="input-dark" min="60" />
                    <input id="vault-key-input" type="text" value={vaultKeySecret} onChange={(e) => setVaultKeySecret(e.target.value)} className="input-dark" />
                    <button id="setup-emergency-btn" onClick={setupEmergencyRelease} disabled={txState.txPending || !walletAddress} className="btn-primary">
                        {txState.txPending ? "Pending..." : "Setup Emergency Release"}
                    </button>
                </div>
            </div>

            {config && (
                <div className="glass-card p-6">
                    <h3 className="text-sm font-semibold text-white mb-4">Live Status</h3>
                    <div className="text-xs text-slate-400">Trusted: {config.trustedAddress}</div>
                    <div className="text-xs text-slate-400">Inactivity: {config.inactivityPeriod}s</div>
                    <div className="text-xs text-slate-400 mb-4">Time until release: {timeUntilRelease ?? "-"}s</div>
                    <button id="record-activity-btn" onClick={recordActivity} disabled={txState.txPending} className="btn-primary text-xs">Record Activity</button>
                </div>
            )}

            <div className="glass-card p-6">
                <h3 className="text-sm font-semibold text-danger-400 mb-4">Trigger Emergency Release</h3>
                <div className="flex gap-3">
                    <input id="trigger-owner-input" type="text" value={triggerAddress} onChange={(e) => setTriggerAddress(e.target.value)} placeholder="Owner wallet address" className="input-dark flex-1" />
                    <button id="trigger-release-btn" onClick={triggerRelease} disabled={txState.txPending || !walletAddress} className="btn-danger whitespace-nowrap">
                        {txState.txPending ? "Pending..." : "Trigger Release"}
                    </button>
                </div>
                {txState.txHash && <div className="mt-2 text-xs font-mono text-slate-400">Tx: {txState.txHash}</div>}
                {txState.error && <div className="mt-2 text-xs text-red-400">{txState.error}</div>}
            </div>
        </div>
    );
}

