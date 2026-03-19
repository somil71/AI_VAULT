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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

    // Close mobile menu on path change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

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
        <div className="app-shell cyber-grid bg-dark-900 text-white min-h-screen">
            <header className="app-topbar px-4 sm:px-6 py-4 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        {/* Mobile Menu Toggle */}
                        <button 
                            className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            aria-label="Toggle menu"
                        >
                            {isMobileMenuOpen ? (
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                                </svg>
                            )}
                        </button>

                        <div className="app-brand">
                            <span className="brand-chip">LV</span>
                            <div>
                                <h1 className="text-base sm:text-lg font-semibold">LifeVault AI</h1>
                                <p className="hidden xs:block text-[10px] text-slate-500">Personal Security Workspace</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            className="hidden sm:block btn-ghost text-[10px] px-2 py-1"
                            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                        >
                            {theme === "dark" ? "Light" : "Dark"}
                        </button>
                        <div className="text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-[#1e3a52] bg-[#0f172a] font-mono">
                            {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : (userEmail?.split('@')[0] || "Guest")}
                        </div>
                        {isAuthenticated && (
                            <button className="hidden sm:block btn-ghost text-[10px] px-2 py-1" onClick={logout}>Exit</button>
                        )}
                    </div>
                </div>
            </header>

            {/* Mobile Navigation Overlay */}
            {isMobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsMobileMenuOpen(false)}>
                    <aside 
                        className="fixed inset-y-0 left-0 w-64 side-nav bg-[#080d18] p-4 flex flex-col shadow-2xl animate-slide-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-8 px-2">
                            <span className="brand-chip scale-90">LV</span>
                            <span className="font-bold text-sm">Security Menu</span>
                        </div>
                        <nav className="flex-1 space-y-1">
                            {userNav.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`nav-link text-sm py-3 ${pathname === item.href ? "active" : ""}`}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                        <div className="mt-auto pt-6 border-t border-[#1e3a52]/50 space-y-3">
                            <button
                                className="w-full btn-ghost text-xs justify-start"
                                onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                            >
                                {theme === "dark" ? "🌙 Dark Mode" : "☀️ Light Mode"}
                            </button>
                            {isAuthenticated && (
                                <button className="w-full btn-ghost text-xs text-red-400 border-red-500/20" onClick={logout}>Sign Out</button>
                            )}
                        </div>
                    </aside>
                </div>
            )}

            <div className="max-w-7xl mx-auto grid lg:grid-cols-[240px_1fr] gap-6 p-4 sm:p-6">
                {/* Desktop Sidebar */}
                <aside className="hidden lg:block side-nav p-3 h-fit sticky top-24">
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
                        <Link href="/admin/dashboard" className="text-[10px] text-slate-500 hover:text-slate-300 uppercase tracking-wider font-semibold">
                            Admin Controller
                        </Link>
                    </div>
                </aside>

                <main className="min-w-0">
                    {children}
                </main>
            </div>
        </div>
    );
}

