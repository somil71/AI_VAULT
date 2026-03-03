"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { keccak256 } from "ethers";
import toast from "react-hot-toast";
import { logActivity, uploadDocument } from "@/lib/api";
import { loadContract } from "@/lib/web3";
import { useWallet } from "@/context/WalletContext";
import { isActionLocked, withActionLock } from "@/lib/actionLock";
import { clearPendingTx, getPendingTx, savePendingTx, TX_CONFIRMED_EVENT } from "@/lib/txRecovery";
import { listEncryptedFiles, saveEncryptedFile } from "@/lib/vaultIndexedDb";
import { appendAuditLog } from "@/lib/localData";

const IDENTITY_ABI = [
    "function mintIdentity(string calldata metadataURI) external returns (uint256)",
    "function hasIdentity(address) external view returns (bool)",
];

interface StoredDocument {
    docId: string;
    fileName: string;
    fileType: string;
    uploadedAt: number;
    encryptedSize: number;
    hash?: string;
    txHash: string;
}

interface EncryptedFileView {
    id?: number;
    fileName: string;
    size: number;
    hash: string;
    timestamp: number;
}

interface TxState {
    txPending: boolean;
    txConfirmed: boolean;
    txHash: string | null;
    error: string | null;
}

async function encryptFile(fileBuffer: ArrayBuffer) {
    const key = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, fileBuffer);
    return { encrypted, iv };
}

function normalizeWeb3Error(error: any) {
    const message = error?.reason || error?.shortMessage || error?.message || "Transaction failed";
    if (message.includes("ACTION_REJECTED") || message.toLowerCase().includes("user rejected")) {
        return "Action canceled - please try again.";
    }
    if (message.includes("NONCE_EXPIRED") || message.toLowerCase().includes("nonce")) {
        return "Nonce conflict detected. Wait for pending tx confirmation and retry.";
    }
    return message;
}

export default function DocumentVault({ walletAddress: walletProp }: { walletAddress: string | null }) {
    const { walletAddress: walletCtx, setLastTxHash } = useWallet();
    const walletAddress = walletProp || walletCtx;
    const [documents, setDocuments] = useState<StoredDocument[]>([]);
    const [mintState, setMintState] = useState<TxState>({ txPending: false, txConfirmed: false, txHash: null, error: null });
    const [uploadState, setUploadState] = useState<TxState>({ txPending: false, txConfirmed: false, txHash: null, error: null });
    const [hasMinted, setHasMinted] = useState(false);
    const [encryptionInfo, setEncryptionInfo] = useState<{ size: number; hash: string } | null>(null);
    const [encryptedFiles, setEncryptedFiles] = useState<EncryptedFileView[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const identityAddress = process.env.NEXT_PUBLIC_IDENTITY_CONTRACT || process.env.NEXT_PUBLIC_IDENTITY_NFT_ADDRESS;
    const explorerTxBase = null; // local chain has no explorer by default

    const txLink = (hash: string | null) => {
        if (!hash) return null;
        if (!explorerTxBase) return hash;
        return `${explorerTxBase}${hash}`;
    };

    const canUpload = useMemo(() => !!walletAddress && !uploadState.txPending, [walletAddress, uploadState.txPending]);

    const getIdentityContract = async () => {
        if (!walletAddress) throw new Error("Connect wallet first");
        return loadContract(identityAddress || "", IDENTITY_ABI);
    };

    const mintIdentity = async () => {
        if (!walletAddress) return toast.error("Connect wallet first");
        if (mintState.txPending || isActionLocked("document-vault:mint")) return;

        setMintState({ txPending: true, txConfirmed: false, txHash: null, error: null });
        try {
            await withActionLock("document-vault:mint", async () => {
                const identity = await getIdentityContract();
                const exists = await identity.hasIdentity(walletAddress);
                if (exists) {
                    setHasMinted(true);
                    setMintState({ txPending: false, txConfirmed: true, txHash: null, error: null });
                    toast.success("Identity already minted");
                    return;
                }

                const tx = await identity.mintIdentity(`lifevault://identity/${walletAddress}`);
                savePendingTx({
                    txHash: tx.hash,
                    scope: "document-vault",
                    action: "mintIdentity",
                    createdAt: Date.now(),
                });
                setMintState({ txPending: true, txConfirmed: false, txHash: tx.hash, error: null });
                await tx.wait();
                clearPendingTx(tx.hash);
                setMintState({ txPending: false, txConfirmed: true, txHash: tx.hash, error: null });
                setLastTxHash(tx.hash);
                setHasMinted(true);
                appendAuditLog({ type: "identity_mint", message: "Secure identity created", metadata: { txHash: tx.hash } });
                await logActivity({
                    type: "identity_minted",
                    walletAddress,
                    metadata: { txHash: tx.hash },
                });
                toast.success("Identity NFT minted");
            });
        } catch (error: any) {
            const msg = normalizeWeb3Error(error);
            setMintState({ txPending: false, txConfirmed: false, txHash: null, error: msg });
            toast.error(msg);
        }
    };

    const handleUpload = async (file: File) => {
        if (!canUpload || isActionLocked("document-vault:upload")) return;

        setUploadState({ txPending: true, txConfirmed: false, txHash: null, error: null });
        try {
            await withActionLock("document-vault:upload", async () => {
                const buffer = await file.arrayBuffer();
                const { encrypted, iv } = await encryptFile(buffer);
                const encryptedBytes = new Uint8Array(encrypted);
                const hash = keccak256(encryptedBytes);
                setEncryptionInfo({ size: encryptedBytes.byteLength, hash });

                await saveEncryptedFile({
                    fileName: file.name,
                    encryptedBytes: encrypted.slice(0),
                    iv: Array.from(iv),
                    hash,
                    size: encryptedBytes.byteLength,
                    timestamp: Date.now(),
                });

                const chainResult = await uploadDocument({ hash });
                setUploadState({ txPending: false, txConfirmed: true, txHash: chainResult.txHash, error: null });
                setLastTxHash(chainResult.txHash);
                appendAuditLog({
                    type: "document_store",
                    message: "Document fingerprint saved to secure ledger",
                    metadata: { txHash: chainResult.txHash, hash },
                });
                await logActivity({
                    type: "document_uploaded",
                    walletAddress,
                    metadata: { txHash: chainResult.txHash, hash, fileName: file.name },
                });

                const localDocs: StoredDocument[] = JSON.parse(localStorage.getItem("lifevault_docs") || "[]");
                const newDoc: StoredDocument = {
                    docId: Date.now().toString(),
                    fileName: file.name,
                    fileType: file.type || "application/octet-stream",
                    uploadedAt: Date.now(),
                    encryptedSize: encryptedBytes.byteLength,
                    hash,
                    txHash: chainResult.txHash,
                };
                localDocs.push(newDoc);
                localStorage.setItem("lifevault_docs", JSON.stringify(localDocs));
                setDocuments(localDocs);
                await restoreEncryptedFiles();

                toast.success("Encrypted hash stored on-chain");
            });
        } catch (error: any) {
            const msg = normalizeWeb3Error(error);
            setUploadState({ txPending: false, txConfirmed: false, txHash: null, error: msg });
            toast.error(msg);
        }
    };

    const loadDocuments = () => {
        const docs = JSON.parse(localStorage.getItem("lifevault_docs") || "[]");
        const normalized = (Array.isArray(docs) ? docs : []).map((doc: any, idx: number) => ({
            docId: String(doc?.docId || `${Date.now()}-${idx}`),
            fileName: String(doc?.fileName || "Unknown file"),
            fileType: String(doc?.fileType || "application/octet-stream"),
            uploadedAt: Number(doc?.uploadedAt || Date.now()),
            encryptedSize: Number(doc?.encryptedSize || 0),
            hash: typeof doc?.hash === "string" ? doc.hash : undefined,
            txHash: String(doc?.txHash || ""),
        }));
        setDocuments(normalized);
    };

    const restoreEncryptedFiles = async () => {
        const records = await listEncryptedFiles();
        setEncryptedFiles(
            records.map((item) => ({
                id: item.id,
                fileName: item.fileName,
                size: item.size,
                hash: item.hash,
                timestamp: item.timestamp,
            })),
        );
    };

    useEffect(() => {
        loadDocuments();
        restoreEncryptedFiles().catch(() => {});

        const mintPending = getPendingTx("document-vault", "mintIdentity");
        if (mintPending) {
            setMintState({ txPending: true, txConfirmed: false, txHash: mintPending.txHash, error: null });
        }

        const onConfirmed = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            if (!detail || detail.scope !== "document-vault") return;

            if (detail.action === "mintIdentity") {
                setMintState({ txPending: false, txConfirmed: true, txHash: detail.txHash, error: null });
                setHasMinted(true);
                setLastTxHash(detail.txHash);
                toast.success("Recovered pending mint transaction after reload");
            }
        };

        window.addEventListener(TX_CONFIRMED_EVENT, onConfirmed as EventListener);
        return () => window.removeEventListener(TX_CONFIRMED_EVENT, onConfirmed as EventListener);
    }, []);

    return (
        <div className="space-y-6 animate-fade-in">
            {!walletAddress && (
                <div className="glass-card p-6 text-center" style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}>
                    <p className="text-danger-400 font-medium">Connect your MetaMask wallet to use Document Vault</p>
                </div>
            )}

            <div className="glass-card p-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-semibold text-white">Secure Identity Pass</h3>
                        <p className="text-xs text-slate-500 mt-1">Create your personal identity pass with Secure Wallet Connector</p>
                    </div>
                    <button id="mint-identity-btn" onClick={mintIdentity} disabled={mintState.txPending || !walletAddress} className={hasMinted ? "btn-ghost" : "btn-primary"}>
                        {mintState.txPending ? "Pending..." : hasMinted ? "Identity Ready" : "Create Identity Pass"}
                    </button>
                </div>
                {mintState.txHash && <div className="mt-2 text-xs text-slate-400">Action confirmation: <span className="font-mono">{txLink(mintState.txHash)}</span></div>}
                {mintState.error && <div className="mt-2 text-xs text-red-400">{mintState.error}</div>}
            </div>

            <div className="glass-card p-6">
                <h3 className="text-sm font-semibold text-white mb-4">Upload & Encrypt Document</h3>
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all" style={{ borderColor: uploadState.txPending ? "#0ea5e9" : "#1e3a52" }}>
                    <input ref={fileInputRef} id="vault-file-input" type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                    {uploadState.txPending ? <p className="text-sm text-primary-400">Encrypting and storing hash...</p> : <p className="text-sm text-slate-300">Click to upload document</p>}
                </div>
                {encryptionInfo && (
                    <div className="mt-3 text-xs text-slate-400 space-y-1">
                        <div>Encrypted size: {encryptionInfo.size} bytes</div>
                        <div>Hash: <span className="font-mono">{encryptionInfo.hash.slice(0, 24)}...</span></div>
                    </div>
                )}
                {uploadState.txHash && <div className="mt-2 text-xs text-slate-400">Action confirmation: <span className="font-mono">{txLink(uploadState.txHash)}</span></div>}
                {uploadState.error && <div className="mt-2 text-xs text-red-400">{uploadState.error}</div>}
            </div>

            <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Stored Documents</h3>
                    <button onClick={loadDocuments} className="btn-ghost text-xs">Refresh</button>
                </div>
                {documents.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">No documents stored yet.</p>
                ) : (
                    <div className="space-y-3">
                        {documents.map((doc) => (
                            <div key={doc.docId} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.15)" }}>
                                <div>
                                    <div className="text-sm font-medium text-white">{doc.fileName}</div>
                                    <div className="text-[10px] text-slate-500 font-mono">
                                        {doc.encryptedSize} bytes · {doc.hash ? `${doc.hash.slice(0, 12)}...` : "hash unavailable"}
                                    </div>
                                </div>
                                <span className="risk-badge-low">Secured</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Encrypted Files (IndexedDB)</h3>
                    <button onClick={() => restoreEncryptedFiles()} className="btn-ghost text-xs">Reload</button>
                </div>
                {encryptedFiles.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No encrypted files persisted locally yet.</p>
                ) : (
                    <div className="space-y-2">
                        {encryptedFiles.map((file) => (
                            <div key={`${file.id}-${file.hash}`} className="p-3 rounded-xl" style={{ background: "rgba(15,23,42,0.45)", border: "1px solid rgba(56,189,248,0.2)" }}>
                                <div className="text-sm text-white">{file.fileName}</div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                    {file.size} bytes · {file.hash.slice(0, 16)}... · {new Date(file.timestamp).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

