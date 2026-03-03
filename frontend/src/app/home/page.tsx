"use client";

import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { useWallet } from "@/context/WalletContext";

const pillars = [
    {
        title: "Scam Protection",
        summary: "Checks suspicious messages and links with AI risk scoring.",
        detail: "Input text or URL -> AI service classifies risk, category, and recommended action.",
    },
    {
        title: "Transaction Monitor",
        summary: "Finds unusual account activity from uploaded CSV statements.",
        detail: "CSV -> anomaly analysis -> risk trend + alerts for unusual behavior.",
    },
    {
        title: "Secure Document Vault",
        summary: "Encrypts files in browser and stores secure fingerprint on-chain.",
        detail: "File -> AES-256-GCM encryption -> hash -> secure ledger confirmation.",
    },
    {
        title: "Emergency Digital Release",
        summary: "Configures trusted emergency access if inactivity rules are met.",
        detail: "Set trusted address + inactivity window -> trigger recovery flow when needed.",
    },
];

const architecture = [
    { layer: "Frontend", tech: "Next.js + Tailwind", url: "http://localhost:3000", role: "User interface and wallet actions" },
    { layer: "Backend", tech: "Express + MongoDB", url: "http://localhost:5000", role: "Auth, orchestration, analytics APIs" },
    { layer: "AI Service", tech: "FastAPI + ML", url: "http://localhost:8000", role: "Scam and anomaly intelligence" },
    { layer: "Safe Chain", tech: "Hardhat + Solidity", url: "http://127.0.0.1:8545", role: "Document proof and emergency event state" },
];

const explainFlow = [
    {
        title: "1. Connect Identity",
        body: "User connects Secure Wallet Connector and signs in (JWT or wallet signature).",
    },
    {
        title: "2. Run Security Actions",
        body: "Scam checks, transaction analysis, vault uploads, proof generation, and emergency setup happen from one workspace.",
    },
    {
        title: "3. AI + Ledger Confirmation",
        body: "Backend routes requests to AI and secure ledger services, then returns validated results to UI in real-time.",
    },
    {
        title: "4. Live Risk Intelligence",
        body: "Dashboard updates KPIs, charts, and activity feed every few seconds for explainable decision support.",
    },
];

const demoScript = [
    "Open User Dashboard and connect wallet.",
    "Run Scam Protection on sample phishing text.",
    "Upload bank statement CSV to Transaction Monitor.",
    "Upload a document to Vault and show action confirmation.",
    "Open Admin Dashboard and review live risk analytics.",
];

export default function LandingPage() {
    const { connect } = useWallet();
    const [connecting, setConnecting] = useState(false);

    return (
        <div className="min-h-screen cyber-grid text-white">
            <header className="app-topbar px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div className="app-brand">
                        <span className="brand-chip">LV</span>
                        <div>
                            <h1 className="text-lg font-semibold">LifeVault AI</h1>
                            <p className="text-xs text-slate-500">Explainable Digital Security Platform</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/user/dashboard" className="btn-ghost text-xs">User App</Link>
                        <Link href="/admin/dashboard" className="btn-ghost text-xs">Admin App</Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
                <section className="hero-panel p-8">
                    <div className="relative z-10 grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
                        <div>
                            <h2 className="text-4xl font-semibold leading-tight">A single page to explain the full LifeVault workflow.</h2>
                            <p className="text-slate-300 mt-4 max-w-2xl">
                                This platform combines AI risk detection, secure document protection, and local blockchain verification into one connected flow.
                            </p>
                            <div className="mt-6 flex flex-wrap items-center gap-3">
                                <button
                                    className="btn-primary"
                                    disabled={connecting}
                                    onClick={async () => {
                                        setConnecting(true);
                                        try {
                                            await connect();
                                            toast.success("Wallet connected.");
                                        } catch (err: any) {
                                            toast.error(err?.message || "Connection failed");
                                        } finally {
                                            setConnecting(false);
                                        }
                                    }}
                                >
                                    {connecting ? "Connecting..." : "Connect Wallet"}
                                </button>
                                <Link href="/user/dashboard" className="btn-ghost">Start Demo</Link>
                            </div>
                        </div>
                        <div className="chart-card">
                            <h3 className="section-title mb-3">How to present this in 60 seconds</h3>
                            <div className="space-y-2 text-sm text-slate-300">
                                {demoScript.map((line, idx) => (
                                    <div key={line} className="flex gap-2">
                                        <span className="text-cyan-300">{idx + 1}.</span>
                                        <span>{line}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid lg:grid-cols-2 gap-4">
                    {pillars.map((item) => (
                        <article key={item.title} className="chart-card">
                            <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                            <p className="text-sm text-slate-300 mt-2">{item.summary}</p>
                            <p className="text-xs text-slate-500 mt-3">{item.detail}</p>
                        </article>
                    ))}
                </section>

                <section className="chart-card">
                    <h3 className="text-lg font-semibold text-white">System Architecture (Local)</h3>
                    <p className="text-sm text-slate-400 mt-1">Each service is isolated but connected through clear API flow.</p>
                    <div className="mt-4 grid md:grid-cols-2 gap-3">
                        {architecture.map((item) => (
                            <div key={item.layer} className="metric-card">
                                <div className="text-xs text-slate-500">{item.layer}</div>
                                <div className="text-base font-semibold text-white mt-1">{item.tech}</div>
                                <div className="text-xs text-cyan-300 mt-1">{item.url}</div>
                                <div className="text-xs text-slate-400 mt-2">{item.role}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="chart-card">
                    <h3 className="text-lg font-semibold text-white">End-to-End Working Flow</h3>
                    <div className="mt-4 grid md:grid-cols-2 gap-3">
                        {explainFlow.map((step) => (
                            <div key={step.title} className="metric-card">
                                <div className="text-sm font-semibold text-white">{step.title}</div>
                                <div className="text-sm text-slate-300 mt-2">{step.body}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="chart-card border border-amber-500/30 bg-amber-500/5">
                    <h3 className="text-lg font-semibold text-amber-100">Unique Differentiator: Proactive Watchlist</h3>
                    <p className="text-sm text-amber-50/90 mt-2">
                        Users can maintain suspicious numbers/links and receive proactive alert matches during future scam checks, not just one-time analysis.
                    </p>
                    <div className="mt-4 flex gap-3">
                        <Link href="/user/watchlist" className="btn-primary">Open Watchlist</Link>
                        <Link href="/user/scam-detector" className="btn-ghost">Try Scam Protection</Link>
                    </div>
                </section>
            </main>

            <footer className="border-t border-[#1e3a52]/50 mt-6">
                <div className="max-w-7xl mx-auto px-6 py-5 text-xs text-slate-500 flex flex-wrap justify-between gap-3">
                    <span>LifeVault AI · Local Demonstration Environment</span>
                    <span>Frontend 3000 · Backend 5000 · AI 8000 · Safe Chain 8545</span>
                </div>
            </footer>
        </div>
    );
}
