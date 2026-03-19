"use client";
import LiveSecurityFeed from "./LiveSecurityFeed";

type ActiveSection = "dashboard" | "scam-detector" | "transaction-monitor" | "document-vault" | "selective-verifier" | "emergency-release";

const stats = [
    { label: "Scans Today", value: "12", change: "+3", icon: "ðŸ›¡ï¸", color: "#0ea5e9" },
    { label: "Threats Blocked", value: "4", change: "+2", icon: "âš ï¸", color: "#ef4444" },
    { label: "Docs Secured", value: "7", change: "+1", icon: "ðŸ”", color: "#8b5cf6" },
    { label: "Risk Score", value: "23%", change: "-5%", icon: "ðŸ“Š", color: "#22c55e" },
];

const quickActions = [
    { section: "scam-detector" as ActiveSection, label: "Scan Message/URL", desc: "AI phishing detection", color: "#0ea5e9", icon: "ðŸ”" },
    { section: "transaction-monitor" as ActiveSection, label: "Upload Statement", desc: "Anomaly detection", color: "#8b5cf6", icon: "ðŸ“ˆ" },
    { section: "document-vault" as ActiveSection, label: "Store Document", desc: "Blockchain encrypted", color: "#22c55e", icon: "ðŸ“„" },
    { section: "emergency-release" as ActiveSection, label: "Emergency Setup", desc: "Dead man's switch", color: "#f59e0b", icon: "ðŸš¨" },
];

const architectureNodes = [
    { label: "Next.js Frontend", color: "#0ea5e9", sublabel: "TypeScript + TailwindCSS" },
    { label: "Express Backend", color: "#8b5cf6", sublabel: "Node.js + MongoDB" },
    { label: "FastAPI AI Service", color: "#22c55e", sublabel: "PyTorch + Scikit-learn" },
    { label: "Hardhat Blockchain", color: "#f59e0b", sublabel: "Solidity + ethers.js" },
];

interface DashboardProps {
    walletAddress: string | null;
    setActiveSection: (section: ActiveSection) => void;
}

export default function Dashboard({ walletAddress, setActiveSection }: DashboardProps) {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Hero Banner */}
            <div className="glass-card p-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10"
                    style={{ background: "radial-gradient(ellipse at 80% 50%, #0ea5e9, transparent 60%)" }} />
                <div className="relative">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-2xl font-bold gradient-text mb-2">
                                LifeVault AI Guardian
                            </h1>
                            <p className="text-slate-400 text-sm max-w-lg">
                                Your complete AI + Blockchain security suite. Detect phishing, monitor transactions,
                                secure documents, and protect your digital legacy â€” all locally.
                            </p>
                        </div>
                        <div className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl"
                            style={{
                                background: walletAddress ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                                border: walletAddress ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)"
                            }}>
                            <div className={`w-2 h-2 rounded-full ${walletAddress ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
                            <span className={`text-xs font-medium ${walletAddress ? "text-green-400" : "text-red-400"}`}>
                                {walletAddress ? `${walletAddress.slice(0, 8)}...` : "Wallet Not Connected"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                    <div key={i} className="glass-card glass-card-hover p-5">
                        <div className="flex items-start justify-between mb-3">
                            <span className="text-2xl">{stat.icon}</span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80" }}>
                                {stat.change}
                            </span>
                        </div>
                        <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
                        <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Quick Actions</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {quickActions.map((action, i) => (
                        <button
                            key={i}
                            onClick={() => setActiveSection(action.section)}
                            className="glass-card glass-card-hover p-5 text-left group transition-all duration-300"
                        >
                            <div className="text-2xl mb-3">{action.icon}</div>
                            <div className="text-sm font-semibold text-white group-hover:text-primary-400 transition-colors">
                                {action.label}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">{action.desc}</div>
                            <div className="mt-3 w-8 h-0.5 rounded-full transition-all duration-300 group-hover:w-16"
                                style={{ background: action.color }} />
                        </button>
                    ))}
                </div>
            </div>

            {/* Architecture Overview */}
            <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">System Architecture</h3>
                <div className="glass-card p-6">
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        {architectureNodes.map((node, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="glass-card p-3 text-center min-w-[140px]"
                                    style={{ border: `1px solid ${node.color}30` }}>
                                    <div className="text-xs font-semibold mb-1" style={{ color: node.color }}>
                                        {node.label}
                                    </div>
                                    <div className="text-[10px] text-slate-500">{node.sublabel}</div>
                                </div>
                                {i < architectureNodes.length - 1 && (
                                    <div className="text-slate-600 text-lg">â†’</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Real-time Monitoring Section */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Live Feed */}
                <LiveSecurityFeed />

                {/* Risk Scoring Explanation */}
                <div className="glass-card p-6">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2 text-primary-400">
                        🛡️ Risk Scoring Engine
                    </h3>
                    <div className="space-y-6">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-widest">Phishing Score Formula</p>
                            <div className="font-mono text-[11px] bg-slate-950/50 rounded-lg p-3 text-slate-300 border border-slate-800">
                                <div className="text-cyan-400">final_score = 0.4 × heuristic + 0.6 × model</div>
                                <div className="text-slate-500 mt-1">heuristic = keyword_score + url_score</div>
                                <div className="text-slate-500">model = Transformer-based Ensemble</div>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-widest">Anomaly Detection (ML)</p>
                            <div className="font-mono text-[11px] bg-slate-950/50 rounded-lg p-3 text-slate-300 border border-slate-800">
                                <div className="text-accent-400">Isolation Forest (Unsupervised)</div>
                                <div className="text-slate-500 mt-1">Features: amount, log_amount, merchant_freq</div>
                                <div className="text-slate-500">Threshold: dynamic clustering baseline</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

