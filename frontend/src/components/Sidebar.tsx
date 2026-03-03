"use client";

type ActiveSection = "dashboard" | "scam-detector" | "transaction-monitor" | "document-vault" | "selective-verifier" | "emergency-release";

const navItems = [
    {
        id: "dashboard" as ActiveSection,
        label: "Dashboard",
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
        ),
    },
    {
        id: "scam-detector" as ActiveSection,
        label: "Scam Detector",
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
        ),
        badge: "AI",
    },
    {
        id: "transaction-monitor" as ActiveSection,
        label: "Transaction Monitor",
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
        ),
        badge: "ML",
    },
    {
        id: "document-vault" as ActiveSection,
        label: "Document Vault",
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
        ),
        badge: "NFT",
    },
    {
        id: "selective-verifier" as ActiveSection,
        label: "ZK Verifier",
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
        ),
        badge: "ZK",
    },
    {
        id: "emergency-release" as ActiveSection,
        label: "Emergency Release",
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
        ),
    },
];

interface SidebarProps {
    activeSection: ActiveSection;
    setActiveSection: (section: ActiveSection) => void;
}

export default function Sidebar({ activeSection, setActiveSection }: SidebarProps) {
    return (
        <aside className="w-64 flex-shrink-0 border-r border-[#1e3a52]/50 flex flex-col"
            style={{ background: "rgba(8,13,24,0.95)" }}>
            {/* Logo */}
            <div className="p-6 border-b border-[#1e3a52]/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg, #0ea5e9, #8b5cf6)" }}>
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-white">LifeVault AI</h1>
                        <p className="text-xs text-slate-500">Personal AI Guardian</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-4 mb-3">
                    Navigation
                </p>
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`sidebar-item w-full text-left ${activeSection === item.id ? "active" : ""}`}
                    >
                        {item.icon}
                        <span className="flex-1 text-sm font-medium">{item.label}</span>
                        {item.badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                style={{
                                    background: "rgba(14,165,233,0.2)",
                                    color: "#38bdf8",
                                    border: "1px solid rgba(14,165,233,0.3)",
                                }}>
                                {item.badge}
                            </span>
                        )}
                    </button>
                ))}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-[#1e3a52]/50">
                <div className="glass-card p-3 text-center">
                    <p className="text-[10px] text-slate-500">Prototype v1.0</p>
                    <p className="text-[10px] text-slate-600">Local Network Only</p>
                    <div className="flex items-center justify-center gap-1.5 mt-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[10px] text-green-400">Systems Online</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}

