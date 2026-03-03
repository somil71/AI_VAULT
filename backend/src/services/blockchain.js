const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

// ── PRIVATE KEY VALIDATION ───────────────────────────────────────────────────
// No fallback keys. If PRIVATE_KEY is not set, blockchain features are disabled.
// This prevents accidental mainnet usage of Hardhat default keys.

const PRIVATE_KEY_REGEX = /^0x[a-fA-F0-9]{64}$/;

function validatePrivateKey(key) {
    if (!key) {
        throw new Error("FATAL: PRIVATE_KEY environment variable is not set. Blockchain features disabled.");
    }
    if (!PRIVATE_KEY_REGEX.test(key)) {
        throw new Error("FATAL: PRIVATE_KEY is malformed. Must be 0x-prefixed 64-char hex string.");
    }
    return key;
}

// Known testnet/devnet keys that MUST NOT be used in production
const KNOWN_INSECURE_KEYS = new Set([
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Hardhat #0
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Hardhat #1
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Hardhat #2
]);

// ── RPC & KEY INITIALIZATION ─────────────────────────────────────────────────

const rpcUrl = process.env.RPC_URL || process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
let _privateKey = null;
let _blockchainReady = false;

try {
    _privateKey = validatePrivateKey(process.env.PRIVATE_KEY);
    _blockchainReady = true;
} catch (err) {
    console.warn("[blockchain] " + err.message);
    console.warn("[blockchain] Blockchain relay features will be unavailable.");
}

// ── CHAIN ID SAFETY CHECK ────────────────────────────────────────────────────

const ALLOWED_CHAIN_IDS = process.env.ALLOWED_CHAIN_IDS
    ? process.env.ALLOWED_CHAIN_IDS.split(",").map(Number)
    : [31337, 80001, 137, 42161]; // Hardhat, Mumbai, Polygon, Arbitrum

// ── CONTRACT ADDRESSES ───────────────────────────────────────────────────────

const contractAddresses = {
    identity: process.env.IDENTITY_CONTRACT || process.env.IDENTITY_NFT_ADDRESS,
    vault: process.env.VAULT_CONTRACT || process.env.VAULT_REGISTRY_ADDRESS,
    emergency: process.env.EMERGENCY_CONTRACT || process.env.EMERGENCY_RELEASE_ADDRESS,
    verifier: process.env.VERIFIER_CONTRACT || process.env.SELECTIVE_VERIFIER_ADDRESS,
};

const artifactPaths = {
    identity: path.resolve(__dirname, "../../../blockchain/artifacts/contracts/IdentityNFT.sol/IdentityNFT.json"),
    vault: path.resolve(__dirname, "../../../blockchain/artifacts/contracts/VaultRegistry.sol/VaultRegistry.json"),
    emergency: path.resolve(__dirname, "../../../blockchain/artifacts/contracts/EmergencyRelease.sol/EmergencyRelease.json"),
    verifier: path.resolve(__dirname, "../../../blockchain/artifacts/contracts/SelectiveVerifier.sol/SelectiveVerifier.json"),
};

// ── ABI CACHE ────────────────────────────────────────────────────────────────

const abiCache = {};

function getAbi(key) {
    if (abiCache[key]) {
        return abiCache[key];
    }

    const artifactPath = artifactPaths[key];
    if (!fs.existsSync(artifactPath)) {
        throw new Error("Contract artifact not found for '" + key + "' at " + artifactPath);
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    abiCache[key] = artifact.abi;
    return abiCache[key];
}

// ── SINGLETON PROVIDER & SIGNER ──────────────────────────────────────────────
// Reuses a single provider and signer instance to avoid connection overhead.

let _provider = null;
let _signer = null;

function ensureBlockchainReady() {
    if (!_blockchainReady || !_privateKey) {
        throw new Error("Blockchain service unavailable. Set PRIVATE_KEY in environment.");
    }
}

function getProvider() {
    if (!_provider) {
        _provider = new ethers.JsonRpcProvider(rpcUrl);
    }
    return _provider;
}

function getSigner() {
    ensureBlockchainReady();
    if (!_signer) {
        const provider = getProvider();
        const wallet = new ethers.Wallet(_privateKey, provider);
        _signer = new ethers.NonceManager(wallet);
    }
    return _signer;
}

async function verifyChainId() {
    const provider = getProvider();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    if (!ALLOWED_CHAIN_IDS.includes(chainId)) {
        throw new Error("Chain ID " + chainId + " is not in allowed list: " + ALLOWED_CHAIN_IDS.join(","));
    }

    // Block insecure keys on production chains (mainnet-like chainIds)
    const PRODUCTION_CHAINS = [1, 137, 42161, 10]; // Ethereum, Polygon, Arbitrum, Optimism
    if (PRODUCTION_CHAINS.includes(chainId) && KNOWN_INSECURE_KEYS.has(_privateKey)) {
        throw new Error("SECURITY VIOLATION: Insecure development key detected on production chain " + chainId + ". Aborting.");
    }

    return chainId;
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function serializeReceipt(receipt) {
    if (!receipt) return null;
    return {
        blockHash: receipt.blockHash,
        blockNumber: receipt.blockNumber,
        contractAddress: receipt.contractAddress,
        cumulativeGasUsed: receipt.cumulativeGasUsed?.toString(),
        from: receipt.from,
        gasPrice: receipt.gasPrice?.toString(),
        gasUsed: receipt.gasUsed?.toString(),
        hash: receipt.hash,
        index: receipt.index,
        status: receipt.status,
        to: receipt.to,
    };
}

function normalizeHash(hash) {
    if (typeof hash === "string" && /^0x[a-fA-F0-9]{64}$/.test(hash)) {
        return hash;
    }

    if (typeof hash !== "string" || hash.trim().length === 0) {
        throw new Error("A valid hash string is required");
    }

    return ethers.keccak256(ethers.toUtf8Bytes(hash));
}

function loadContract(key) {
    const address = contractAddresses[key];
    if (!address) {
        throw new Error("Missing contract address for '" + key + "'. Set it in backend .env.");
    }
    const signer = getSigner();
    return new ethers.Contract(address, getAbi(key), signer);
}

// ── PUBLIC API ───────────────────────────────────────────────────────────────

async function mintIdentityNFT(address) {
    if (!ethers.isAddress(address)) {
        throw new Error("Invalid wallet address");
    }

    await verifyChainId();
    const contract = loadContract("identity");
    const tx = await contract.mintIdentity("lifevault://identity/" + address);
    const receipt = await tx.wait();

    return {
        txHash: tx.hash,
        receipt: serializeReceipt(receipt),
    };
}

async function storeDocumentHash(hash) {
    await verifyChainId();
    const contract = loadContract("vault");
    const normalizedHash = normalizeHash(hash);

    const tx = await contract.storeDocument(
        normalizedHash,
        "lifevault-document",
        "application/octet-stream",
        "backend-managed"
    );
    const receipt = await tx.wait();

    return {
        txHash: tx.hash,
        receipt: serializeReceipt(receipt),
        storedHash: normalizedHash,
    };
}

async function verifySelectiveProof(hash, signature) {
    if (typeof signature !== "string" || signature.trim().length === 0) {
        throw new Error("Signature is required");
    }

    await verifyChainId();
    const contract = loadContract("verifier");
    const normalizedHash = normalizeHash(hash);
    const claimType = Number(process.env.VERIFIER_CLAIM_TYPE || 0);

    const submitTx = await contract.submitProof(normalizedHash, signature, claimType);
    const submitReceipt = await submitTx.wait();

    const verifyTx = await contract.verifyProof(claimType);
    const verifyReceipt = await verifyTx.wait();

    return {
        txHash: verifyTx.hash,
        submitTxHash: submitTx.hash,
        receipt: serializeReceipt(verifyReceipt),
        submitReceipt: serializeReceipt(submitReceipt),
    };
}

async function triggerEmergencyRelease(userAddress) {
    if (!ethers.isAddress(userAddress)) {
        throw new Error("Invalid owner wallet address");
    }

    await verifyChainId();
    const contract = loadContract("emergency");

    const tx = await contract.triggerEmergencyRelease(userAddress);
    const receipt = await tx.wait();

    return {
        txHash: tx.hash,
        receipt: serializeReceipt(receipt),
    };
}

module.exports = {
    mintIdentityNFT,
    storeDocumentHash,
    verifySelectiveProof,
    triggerEmergencyRelease,
};
