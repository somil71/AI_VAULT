"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
    connectWallet,
    disconnectWallet,
    getAddress,
    getCurrentChainId,
    getProvider,
    isCorrectNetwork,
    onWalletChange,
} from "@/lib/web3";
import { clearPendingTx, listPendingTxs, TX_CONFIRMED_EVENT } from "@/lib/txRecovery";

type WalletContextType = {
    walletAddress: string | null;
    chainId: number | null;
    networkOk: boolean;
    networkLabel: string;
    lastTxHash: string | null;
    connect: () => Promise<void>;
    disconnect: () => void;
    setLastTxHash: (hash: string | null) => void;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);
    const [networkOk, setNetworkOk] = useState(false);
    const [lastTxHash, setLastTxHash] = useState<string | null>(null);

    const refreshState = async () => {
        try {
            const [addr, chain, ok] = await Promise.all([
                getAddress().catch(() => null),
                getCurrentChainId().catch(() => null),
                isCorrectNetwork().catch(() => false),
            ]);
            setWalletAddress(addr);
            setChainId(chain);
            setNetworkOk(ok);
        } catch {
            setWalletAddress(null);
            setChainId(null);
            setNetworkOk(false);
        }
    };

    useEffect(() => {
        refreshState();
        const unsubscribe = onWalletChange(async (accounts, nextChainId) => {
            setWalletAddress(accounts.length > 0 ? accounts[0] : null);
            setChainId(nextChainId);
            const ok = nextChainId === 31337;
            setNetworkOk(ok);
            if (!ok) {
                toast.error("Wrong network. Switch Secure Wallet Connector to local safe network (31337).");
            }
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        let mounted = true;
        const pollReceipts = async () => {
            try {
                const pending = listPendingTxs();
                if (pending.length === 0) return;
                const provider = await getProvider();

                for (const entry of pending) {
                    const receipt = await provider.getTransactionReceipt(entry.txHash);
                    if (!receipt || !receipt.blockNumber) continue;

                    clearPendingTx(entry.txHash);
                    if (mounted) {
                        setLastTxHash(entry.txHash);
                    }
                    window.dispatchEvent(
                        new CustomEvent(TX_CONFIRMED_EVENT, {
                            detail: { ...entry, receipt },
                        }),
                    );
                }
            } catch {
                // keep polling until local services are reachable again
            }
        };

        pollReceipts();
        const id = setInterval(pollReceipts, 3000);
        return () => {
            mounted = false;
            clearInterval(id);
        };
    }, []);

    const connect = async () => {
        const account = await connectWallet();
        setWalletAddress(account);
        const chain = await getCurrentChainId();
        setChainId(chain);
        setNetworkOk(chain === 31337);
    };

    const disconnect = () => {
        disconnectWallet();
        setWalletAddress(null);
        setChainId(null);
        setNetworkOk(false);
    };

    const networkLabel = useMemo(() => {
        if (!chainId) return "Not Connected";
        return `Chain ${chainId}`;
    }, [chainId]);

    return (
        <WalletContext.Provider
            value={{
                walletAddress,
                chainId,
                networkOk,
                networkLabel,
                lastTxHash,
                connect,
                disconnect,
                setLastTxHash,
            }}
        >
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const ctx = useContext(WalletContext);
    if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
    return ctx;
}

