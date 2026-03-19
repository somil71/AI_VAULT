import axios, { AxiosError } from "axios";
import { getSigner } from "@/lib/web3";

const backendBase = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");
const apiBase = backendBase.endsWith("/api") ? backendBase : `${backendBase}/api`;
const JWT_KEY = "lifevault_jwt";

export const apiClient = axios.create({
    baseURL: apiBase,
    timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
    const token = getJwt();
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401 && typeof window !== "undefined" && getJwt()) {
            clearJwt();
            window.dispatchEvent(new CustomEvent("lifevault:auth-expired"));
        }
        return Promise.reject(error);
    },
);

function normalizeErrorMessage(message: string) {
    if (!message) return "Request failed";
    if (message.includes("ACTION_REJECTED") || message.includes("User rejected")) {
        return "Action canceled - please try again.";
    }
    if (message.includes("NONCE_EXPIRED") || message.includes("nonce")) {
        return "Action conflict detected. Wait for confirmation and retry.";
    }
    return message;
}

function toApiError(error: unknown): Error {
    const axiosError = error as AxiosError<{ error?: string; message?: string; status?: string }>;
    const msg = axiosError.response?.data?.message || axiosError.response?.data?.error || axiosError.message || "Request failed";
    return new Error(normalizeErrorMessage(msg));
}

/**
 * Unwraps API responses supporting both legacy { success: true } and
 * hardened { status: "success" } contract formats.
 */
function unwrap<T>(response: { data: { success?: boolean; status?: string; data?: T; error?: string; message?: string } }): T {
    const d = response.data;
    const isOk = d?.success === true || d?.status === "success";
    if (!isOk) {
        throw new Error(d?.message || d?.error || "API request failed");
    }
    return d.data as T;
}

export function getJwt() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(JWT_KEY);
}

export function setJwt(token: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem(JWT_KEY, token);
}

export function clearJwt() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(JWT_KEY);
}

export async function acquireDemoJwt() {
    const email = "demo@lifevault.ai";
    const password = "demo123";

    // Auth routes still use legacy format (token at root level)
    const extractAuth = (resp: any) => {
        const body = resp.data;
        // Handle: { token, user } OR { data: { token, user } } OR { status, data: { accessToken, user } }
        const token = body?.data?.accessToken || body?.data?.token || body?.token;
        const user = body?.data?.user || body?.user;
        if (!token) throw new Error("No token in auth response");
        return { token, user: user || { email } };
    };

    try {
        const loginResp = await apiClient.post("/auth/login", { email, password });
        const data = extractAuth(loginResp);
        setJwt(data.token);
        return data;
    } catch {
        const registerResp = await apiClient.post("/auth/register", { email, password });
        const data = extractAuth(registerResp);
        setJwt(data.token);
        return data;
    }
}

async function tryEndpoint<T>(requests: Array<() => Promise<T>>) {
    for (const run of requests) {
        try {
            return await run();
        } catch (error: any) {
            const status = error?.response?.status;
            if (status && status !== 404 && status !== 405) {
                throw error;
            }
        }
    }
    return null;
}

export async function requestSignatureNonce(walletAddress: string) {
    const response = await tryEndpoint([
        () => apiClient.get(`/auth/wallet/nonce?walletAddress=${encodeURIComponent(walletAddress)}`),
        () => apiClient.post("/auth/nonce", { walletAddress }),
        () => apiClient.post("/auth/request-nonce", { walletAddress }),
        () => apiClient.get(`/auth/nonce?walletAddress=${encodeURIComponent(walletAddress)}`),
    ]);

    if (!response) return null;
    const payload = (response as any).data;
    if (!payload) return null;
    return {
        nonce: payload.data?.nonce || payload.nonce || null,
        message: payload.data?.message || payload.message || null,
    };
}

export async function verifySignatureLogin(payload: { walletAddress: string; signature: string; nonce?: string; message?: string; referralCode?: string }) {
    const response = await tryEndpoint([
        () => apiClient.post("/auth/wallet/verify", payload),
        () => apiClient.post("/auth/verify-signature", payload),
        () => apiClient.post("/auth/wallet-login", payload),
        () => apiClient.post("/auth/login-signature", payload),
    ]);

    if (!response) return null;
    const body = (response as any).data;
    if (!body) return null;
    const token = body.data?.accessToken || body.data?.token || body.token || null;
    const user = body.data?.user || body.user || null;
    if (!token) return null;
    setJwt(token);
    return { token, user };
}

export async function loginWithWalletSignature(walletAddress: string, referralCode?: string, appName = "LifeVault") {
    const noncePayload = await requestSignatureNonce(walletAddress);
    if (!noncePayload?.nonce) {
        throw new Error("Wallet signature login unavailable");
    }

    const signer = await getSigner();
    const message = noncePayload.message || `Sign to authenticate to ${appName}.\nNonce: ${noncePayload.nonce}`;
    const signature = await signer.signMessage(message);

    const verified = await verifySignatureLogin({
        walletAddress,
        signature,
        nonce: noncePayload.nonce || undefined,
        message,
        referralCode,
    });

    if (!verified?.token) {
        throw new Error("Wallet signature verification failed");
    }

    return verified;
}
export async function getCurrentUser() {
    const response = await apiClient.get("/auth/me");
    const data = unwrap<{ user: { email: string } }>(response);
    return data.user;
}

export async function getBackendHealth() {
    const response = await apiClient.get("/health");
    return unwrap<{ status: string; service: string; mongodb: string }>(response);
}

export async function analyzeScam(payload: { text?: string; url?: string }) {
    try {
        const response = await apiClient.post("/phishing/analyze", payload);
        return unwrap<{
            risk_score: number;
            risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
            reasoning: string[];
            confidence: number;
            explanation: string[];
            heuristic_score: number;
            model_confidence: number;
            url_analysis: { url: string; findings: string[]; is_suspicious: boolean } | null;
            scam_category?: string;
            similar_pattern?: string;
            recommended_action?: string;
        }>(response);
    } catch (error) {
        throw toApiError(error);
    }
}

export async function uploadTransactions(input: File | Array<Record<string, unknown>>) {
    try {
        if (input instanceof File) {
            const formData = new FormData();
            formData.append("file", input);
            const response = await apiClient.post("/transactions/upload-csv", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            return unwrap(response);
        }

        const response = await apiClient.post("/transactions/analyze", { transactions: input });
        return unwrap(response);
    } catch (error) {
        throw toApiError(error);
    }
}

export async function uploadDocument(payload: { hash: string }) {
    try {
        const response = await apiClient.post("/vault/upload-document", payload);
        return unwrap<{ txHash: string; storedHash: string; receipt: Record<string, unknown> }>(response);
    } catch (error) {
        throw toApiError(error);
    }
}

export async function generateProof(payload: { hash: string; signature: string }) {
    try {
        const response = await apiClient.post("/verifier/generate-proof", payload);
        return unwrap<{ txHash: string; submitTxHash: string; receipt: Record<string, unknown> }>(response);
    } catch (error) {
        throw toApiError(error);
    }
}

export async function triggerEmergency(payload: { userAddress: string }) {
    try {
        const response = await apiClient.post("/emergency/trigger", payload);
        return unwrap<{ txHash: string; receipt: Record<string, unknown> }>(response);
    } catch (error) {
        throw toApiError(error);
    }
}

export async function logActivity(payload: {
    type: string;
    walletAddress?: string | null;
    userEmail?: string | null;
    riskScore?: number | null;
    metadata?: Record<string, unknown>;
}) {
    const response = await apiClient.post("/activity/log", payload);
    const data = unwrap<{ id: string; createdAt: string }>(response);
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("lifevault:activity-updated"));
    }
    return data;
}

export async function getRecentActivity(params: { walletAddress?: string | null; userEmail?: string | null; limit?: number } = {}) {
    const response = await apiClient.get("/activity/recent", { params });
    return unwrap<{ events: Array<Record<string, unknown>> }>(response);
}

export async function getDashboardStats(params: { walletAddress?: string | null; userEmail?: string | null; days?: number } = {}) {
    const response = await apiClient.get("/stats/dashboard", {
        params: { ...params, _t: Date.now() },
        headers: { "Cache-Control": "no-cache" },
    });
    return unwrap<any>(response);
}

export async function getAdminStats() {
    const response = await apiClient.get("/stats/admin");
    return unwrap<any>(response);
}

export async function getScamContext(payload: { text?: string; url?: string }) {
    const response = await apiClient.post("/intelligence/scam-context", payload);
    return unwrap<any>(response);
}

export async function enrichIntelligence(payload: { email?: string; url?: string; ip?: string }) {
    const response = await apiClient.post("/intelligence/enrich", payload);
    return unwrap<any>(response);
}

export async function getCommunityStats() {
    const response = await apiClient.get("/phishing/community/stats");
    return unwrap<{ confirmedCount: number; totalEntries: number }>(response);
}

export async function getWalletReputation(address: string) {
    const response = await apiClient.get(`/wallet/reputation/${address}`);
    return unwrap<{ 
        address: string; 
        score: number; 
        level: string; 
        reasons: string[]; 
        generatedAt: string 
    }>(response);
}

export async function createCheckoutSession(priceId: string) {
    const response = await apiClient.post("/billing/checkout", { priceId });
    return unwrap<{ url: string }>(response);
}

export async function getMonthlyReport() {
    const response = await apiClient.get("/user/reports/monthly");
    return unwrap<{ content: string; stats: any }>(response);
}

export async function listVaults() {
    const response = await apiClient.get("/vault/list");
    return unwrap<any[]>(response);
}

export async function createVault(name: string, description: string) {
    const response = await apiClient.post("/vault/create", { name, description });
    return unwrap<any>(response);
}

export async function inviteToVault(vaultId: string, email: string, role: string) {
    const response = await apiClient.post("/vault/invite", { vaultId, email, role });
    return unwrap<any>(response);
}




