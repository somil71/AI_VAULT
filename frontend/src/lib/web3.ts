import { BrowserProvider, Contract, JsonRpcSigner } from "ethers";

export const LOCAL_CHAIN_ID = 31337;
export const LOCAL_CHAIN_HEX = "0x7a69";

function ensureEthereum() {
    if (!window.ethereum) {
        throw new Error("Secure Wallet Connector not found. Install MetaMask and retry.");
    }
    return window.ethereum;
}

export async function getProvider() {
    return new BrowserProvider(ensureEthereum());
}

export async function getCurrentChainId(): Promise<number | null> {
    try {
        const ethereum = ensureEthereum();
        const chainHex = await ethereum.request({ method: "eth_chainId" });
        return parseInt(chainHex as string, 16);
    } catch {
        return null;
    }
}

export async function isCorrectNetwork() {
    const chainId = await getCurrentChainId();
    return chainId === LOCAL_CHAIN_ID;
}

export async function switchToLocalNetwork() {
    const ethereum = ensureEthereum();

    try {
        await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: LOCAL_CHAIN_HEX }],
        });
        return;
    } catch (switchError: any) {
        if (switchError?.code !== 4902) {
            throw switchError;
        }
    }

    await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
            {
                chainId: LOCAL_CHAIN_HEX,
                chainName: "Hardhat 31337",
                rpcUrls: [process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545"],
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            },
        ],
    });

    await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: LOCAL_CHAIN_HEX }],
    });
}

export async function getAddress(): Promise<string | null> {
    const ethereum = ensureEthereum();
    const accounts = await ethereum.request({ method: "eth_accounts" });
    return Array.isArray(accounts) && accounts.length > 0 ? (accounts[0] as string) : null;
}

export async function connectWallet() {
    const ethereum = ensureEthereum();
    await switchToLocalNetwork();

    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    if (!Array.isArray(accounts) || accounts.length === 0) {
        throw new Error("No wallet accounts returned by MetaMask");
    }

    const chainId = await getCurrentChainId();
    if (chainId !== LOCAL_CHAIN_ID) {
        throw new Error(`Wrong network. Switch to local safe network (${LOCAL_CHAIN_ID}) and try again.`);
    }

    return accounts[0] as string;
}

export function disconnectWallet() {
    // MetaMask does not support programmatic disconnect. Caller clears local app state only.
    return;
}

export function onWalletChange(onChange: (accounts: string[], chainId: number | null) => void) {
    const ethereum = ensureEthereum();

    const handleAccounts = async (accounts: string[]) => {
        const nextChainId = await getCurrentChainId();
        onChange(accounts || [], nextChainId);
    };

    const handleChain = async () => {
        const accounts = (await ethereum.request({ method: "eth_accounts" })) as string[];
        const nextChainId = await getCurrentChainId();
        onChange(accounts || [], nextChainId);
    };

    ethereum.on("accountsChanged", handleAccounts);
    ethereum.on("chainChanged", handleChain);

    return () => {
        ethereum.removeListener("accountsChanged", handleAccounts);
        ethereum.removeListener("chainChanged", handleChain);
    };
}

export async function getSigner(): Promise<JsonRpcSigner> {
    const provider = await getProvider();
    const correct = await isCorrectNetwork();
    if (!correct) {
        await switchToLocalNetwork();
    }

    const network = await provider.getNetwork();
    if (Number(network.chainId) !== LOCAL_CHAIN_ID) {
        throw new Error(`Wrong network. Switch to local safe network (${LOCAL_CHAIN_ID}) and try again.`);
    }

    return provider.getSigner();
}

export async function loadContract(address: string, abi: any) {
    if (!address) {
        throw new Error("Contract address is missing");
    }

    const provider = await getProvider();
    const code = await provider.getCode(address);
    if (!code || code === "0x") {
        throw new Error(`No contract deployed at ${address} on chain ${LOCAL_CHAIN_ID}`);
    }

    const signer = await getSigner();
    return new Contract(address, abi, signer);
}

