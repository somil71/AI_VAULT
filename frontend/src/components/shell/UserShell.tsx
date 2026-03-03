"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";

const userNav = [
    { href: "/user/dashboard", label: "Dashboard" },
    { href: "/user/scam-detector", label: "Scam Protection" },
    { href: "/user/tx-monitor", label: "Activity Monitor" },
    { href: "/user/vault", label: "Secure Vault" },
    { href: "/user/proofs", label: "Proof Center" },
    { href: "/user/emergency", label: "Emergency Access" },
    { href: "/user/watchlist", label: "Watchlist" },
];

export default function UserShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { isAuthenticated, ensureAuth, logout, userEmail } = useAuth();
    const { walletAddress, connect, networkOk } = useWallet();
    const [theme, setTheme] = useState<"dark" | "light">("dark");

    const signedIn = useMemo(() => isAuthenticated || Boolean(walletAddress), [isAuthenticated, walletAddress]);

    useEffect(() => {
        const stored = localStorage.getItem("lifevault_theme");
        if (stored === "light" || stored === "dark") {
            setTheme(stored);
        }
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("lifevault_theme", theme);
    }, [theme]);

    if (!signedIn) {
        return (
            <div className="app-shell cyber-grid bg-dark-900 text-white flex items-center justify-center p-6">
                <div className="glass-card p-8 max-w-xl w-full text-center space-y-4">
                    <h1 className="text-2xl font-bold">Welcome to LifeVault AI</h1>
                    <p className="text-slate-400 text-sm">Sign in with JWT or connect your Secure Identity to continue.</p>
                    <div className="flex items-center justify-center gap-3">
                        <button className="btn-primary" onClick={() => ensureAuth()}>Get Started</button>
                        <button className="btn-ghost" onClick={async () => {
                            try {
                                await connect();
                                toast.success("Secure Identity connected.");
                            } catch (err: any) {
                                toast.error(err?.message || "Connection failed");
                            }
                        }}>Connect Secure Identity</button>
                    </div>
                    <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 block">Back to Landing Page</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="app-shell cyber-grid bg-dark-900 text-white">
            <header className="app-topbar px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div>
                        <div className="app-brand">
                            <span className="brand-chip">LV</span>
                            <div>
                                <h1 className="text-lg font-semibold">LifeVault AI</h1>
                                <p className="text-xs text-slate-500">Personal Security Workspace</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="btn-ghost text-xs"
                            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                        >
                            {theme === "dark" ? "Light Theme" : "Dark Theme"}
                        </button>
                        <div className="text-xs px-3 py-2 rounded-xl border border-[#1e3a52] bg-[#0f172a]">
                            {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : userEmail || "Guest"}
                        </div>
                        {!networkOk && walletAddress && (
                            <div className="text-xs px-3 py-2 rounded-xl border border-amber-500/40 text-amber-300">Switch to local safe network (31337)</div>
                        )}
                        {isAuthenticated ? <button className="btn-ghost text-xs" onClick={logout}>Logout</button> : null}
                    </div>
                </div>
            </header>
            <div className="max-w-7xl mx-auto grid lg:grid-cols-[248px_1fr] gap-6 p-6">
                <aside className="side-nav p-3 h-fit">
                    <nav className="space-y-1">
                        {userNav.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`nav-link ${pathname === item.href ? "active" : ""}`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="mt-4 pt-4 border-t border-[#1e3a52]/50">
                        <Link href="/admin/dashboard" className="text-xs text-slate-500 hover:text-slate-300">Open Admin Area</Link>
                    </div>
                </aside>
                <main>{children}</main>
            </div>
        </div>
    );
}
