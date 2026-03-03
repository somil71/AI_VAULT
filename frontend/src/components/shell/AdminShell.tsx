"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";

const ADMIN_UNLOCK_KEY = "lifevault_admin_unlocked";
const navItems = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/audit-logs", label: "Audit Logs" },
    { href: "/admin/system-health", label: "System Health" },
    { href: "/admin/settings", label: "Settings" },
];

function isJwtAdmin(token: string | null) {
    if (!token) return false;
    try {
        const payload = JSON.parse(atob(token.split(".")[1] || ""));
        return Boolean(payload?.admin === true || payload?.role === "admin");
    } catch {
        return false;
    }
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { token, ensureAuth } = useAuth();
    const [password, setPassword] = useState("");
    const [unlocked, setUnlocked] = useState(false);

    const adminByJwt = useMemo(() => isJwtAdmin(token), [token]);

    useEffect(() => {
        if (adminByJwt) {
            setUnlocked(true);
            return;
        }
        const saved = typeof window !== "undefined" ? localStorage.getItem(ADMIN_UNLOCK_KEY) : null;
        setUnlocked(saved === "true");
    }, [adminByJwt]);

    if (!unlocked) {
        return (
            <div className="app-shell cyber-grid bg-dark-900 text-white flex items-center justify-center p-6">
                <div className="glass-card p-8 max-w-lg w-full space-y-4">
                    <h1 className="text-xl font-semibold">Admin Access</h1>
                    <p className="text-sm text-slate-400">Use admin password for local demo mode. Default: <code>admin123</code></p>
                    <input
                        className="input-dark"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter admin password"
                    />
                    <div className="flex items-center gap-2">
                        <button
                            className="btn-primary"
                            onClick={async () => {
                                if (!token) {
                                    const ok = await ensureAuth();
                                    if (!ok) return;
                                }
                                const expected =
                                    process.env.NEXT_PUBLIC_ADMIN_DEMO_PASSWORD ||
                                    localStorage.getItem("lifevault_admin_demo_password") ||
                                    "admin123";
                                if (password === expected) {
                                    localStorage.setItem(ADMIN_UNLOCK_KEY, "true");
                                    setUnlocked(true);
                                    toast.success("Admin mode enabled.");
                                } else {
                                    toast.error("Invalid admin password.");
                                }
                            }}
                        >
                            Unlock Admin
                        </button>
                        <Link href="/" className="btn-ghost">Back</Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="app-shell cyber-grid bg-dark-900 text-white">
            <header className="app-topbar px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <div className="app-brand">
                            <span className="brand-chip">AD</span>
                            <div>
                                <h1 className="text-lg font-semibold">LifeVault Admin</h1>
                                <p className="text-xs text-slate-500">Operations and Intelligence Console</p>
                            </div>
                        </div>
                    </div>
                    <button className="btn-ghost text-xs" onClick={() => {
                        localStorage.removeItem(ADMIN_UNLOCK_KEY);
                        setUnlocked(false);
                    }}>Lock Admin</button>
                </div>
            </header>
            <div className="max-w-7xl mx-auto grid lg:grid-cols-[248px_1fr] gap-6 p-6">
                <aside className="side-nav p-3 h-fit">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`nav-link mb-1 ${pathname === item.href ? "active" : ""}`}
                        >
                            {item.label}
                        </Link>
                    ))}
                    <div className="pt-4 mt-3 border-t border-[#1e3a52]/50">
                        <Link href="/user/dashboard" className="text-xs text-slate-500 hover:text-slate-300">Open User Area</Link>
                    </div>
                </aside>
                <main>{children}</main>
            </div>
        </div>
    );
}
