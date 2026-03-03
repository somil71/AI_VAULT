"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { acquireDemoJwt, clearJwt, getCurrentUser, getJwt, loginWithWalletSignature as loginWithWalletSignatureApi } from "@/lib/api";
import { appendAuditLog, trackKnownUser } from "@/lib/localData";

type AuthContextType = {
    token: string | null;
    userEmail: string | null;
    isAuthenticated: boolean;
    authLoading: boolean;
    ensureAuth: () => Promise<boolean>;
    loginWithWalletSignature: (walletAddress: string) => Promise<boolean>;
    logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            const existing = getJwt();
            if (!existing) {
                setAuthLoading(false);
                return;
            }
            setToken(existing);
            try {
                const me = await getCurrentUser();
                setUserEmail(me?.email || null);
                trackKnownUser({ email: me?.email || null });
            } catch {
                clearJwt();
                setToken(null);
                setUserEmail(null);
            } finally {
                setAuthLoading(false);
            }
        };
        init();
    }, []);

    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key !== "lifevault_jwt") return;
            const nextToken = getJwt();
            setToken(nextToken);
            if (!nextToken) {
                setUserEmail(null);
            }
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    useEffect(() => {
        const onExpired = () => {
            setToken(null);
            setUserEmail(null);
            toast("Session expired. Please sign in again.");
        };
        window.addEventListener("lifevault:auth-expired", onExpired);
        return () => window.removeEventListener("lifevault:auth-expired", onExpired);
    }, []);

    const ensureAuth = async () => {
        try {
            const result = await acquireDemoJwt();
            setToken(result.token);
            setUserEmail(result.user?.email || "demo@lifevault.ai");
            trackKnownUser({ email: result.user?.email || "demo@lifevault.ai" });
            appendAuditLog({ type: "auth", message: "Demo JWT session created" });
            toast.success("JWT ready for protected flows");
            return true;
        } catch (err: any) {
            toast.error(err.message || "Auth failed");
            return false;
        }
    };

    const loginWithWalletSignature = async (walletAddress: string) => {
        if (!walletAddress) {
            toast.error("Connect wallet first");
            return false;
        }

        try {
            const verified = await loginWithWalletSignatureApi(walletAddress);

            setToken(verified.token);
            setUserEmail(verified.user?.email || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`);
            trackKnownUser({ email: verified.user?.email || null, walletAddress });
            appendAuditLog({ type: "auth", message: "Wallet signature sign-in successful", metadata: { walletAddress } });
            toast.success("Signed in with wallet");
            return true;
        } catch (err: any) {
            toast((err?.message || "Wallet sign-in failed") + " Falling back to demo JWT.");
            return ensureAuth();
        }
    };

    const logout = () => {
        appendAuditLog({ type: "auth", message: "Session logged out" });
        clearJwt();
        setToken(null);
        setUserEmail(null);
        toast.success("Logged out");
    };

    const isAuthenticated = useMemo(() => Boolean(token), [token]);

    return (
        <AuthContext.Provider
            value={{ token, userEmail, isAuthenticated, authLoading, ensureAuth, loginWithWalletSignature, logout }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
}

