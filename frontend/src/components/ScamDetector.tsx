"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { analyzeScam, logActivity } from "@/lib/api";
import { addWatchlistAlert, evaluateWatchlist } from "@/lib/watchlistDb";
import { appendAuditLog, appendScamHistory } from "@/lib/localData";

interface PhishingResult {
    risk_score: number; // 0-1
    risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    reasoning: string[];
    confidence: number; // 0-1
    explanation: string[];
    heuristic_score: number;
    model_confidence: number;
    scam_category?: string;
    url_analysis: {
        url: string;
        findings: string[];
        is_suspicious: boolean;
    } | null;
}

const RISK_COLORS = {
    LOW: { badge: "risk-badge-low" },
    MEDIUM: { badge: "risk-badge-medium" },
    HIGH: { badge: "risk-badge-high" },
    CRITICAL: { badge: "risk-badge-critical" },
};

const SAMPLE_PHISHING = "URGENT: Your account has an unusual login. Verify now at http://secure-bank-verify.xyz/login";

export default function ScamDetector() {
    const [text, setText] = useState("");
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<PhishingResult | null>(null);
    const [watchlistMessage, setWatchlistMessage] = useState<string | null>(null);

    const analyze = async () => {
        if (!text.trim() && !url.trim()) {
            toast.error("Enter a message or URL to check.");
            return;
        }

        setLoading(true);
        setResult(null);
        setWatchlistMessage(null);

        try {
            const watchCheck = await evaluateWatchlist({
                text: text.trim() || undefined,
                url: url.trim() || undefined,
            });

            const data = await analyzeScam({
                text: text.trim() || undefined,
                url: url.trim() || undefined,
            });

            setResult(data);

            if (watchCheck.hasHit) {
                const hitLabel = watchCheck.hits.map((h) => h.value).join(", ");
                setWatchlistMessage(`Watchlist match found: ${hitLabel}`);
                toast.error("Enhanced warning: this matches your watchlist.");

                for (const hit of watchCheck.hits) {
                    await addWatchlistAlert({
                        entryValue: hit.value,
                        matchedIn: url.toLowerCase().includes(hit.value) ? "url" : "text",
                        sample: (text || url).slice(0, 220),
                        riskLevel: data.risk_level,
                    });
                }

                appendAuditLog({
                    type: "watchlist_alert",
                    message: "Watchlist match detected during security check",
                    metadata: { count: watchCheck.hits.length, risk: data.risk_level },
                });
                await logActivity({
                    type: "watchlist_alert_triggered",
                    riskScore: data.risk_score * 100,
                    metadata: { count: watchCheck.hits.length, risk: data.risk_level },
                });
            } else {
                toast.success("Security check completed.");
            }

            appendScamHistory({
                inputText: text.trim() || undefined,
                inputUrl: url.trim() || undefined,
                riskLevel: data.risk_level,
                probability: data.risk_score * 100,
                watchlistHit: watchCheck.hasHit,
            });

            appendAuditLog({
                type: "scam_scan",
                message: "Scam detector executed",
                metadata: { riskLevel: data.risk_level, probability: data.risk_score * 100 },
            });
            await logActivity({
                type: "scam_analyzed",
                riskScore: data.risk_score * 100,
                metadata: {
                    riskLevel: data.risk_level,
                    probability: data.risk_score * 100,
                    scamCategory: data.scam_category || "general_phishing",
                },
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Security check failed";
            if (msg.includes("AI service")) {
                toast.error("Security AI service is offline. Start local AI service on port 8000.");
            } else {
                toast.error(msg.replace("User rejected", "Action canceled"));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="glass-card p-6">
                <h2 className="text-base font-semibold text-white mb-4">Message and Link Check</h2>

                <div className="space-y-4">
                    {watchlistMessage && (
                        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-300">
                            {watchlistMessage}
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-medium text-slate-400 mb-2 block">Message</label>
                        <textarea
                            id="phishing-text-input"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={4}
                            placeholder="Paste suspicious message here..."
                            className="input-dark resize-none"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-slate-400 mb-2 block">Link</label>
                        <input
                            id="phishing-url-input"
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com"
                            className="input-dark"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <button id="phishing-analyze-btn" onClick={analyze} disabled={loading} className="btn-primary">
                            {loading ? "Checking..." : "Run Security Check"}
                        </button>
                        <button onClick={() => { setText(SAMPLE_PHISHING); setUrl("http://secure-bank-verify.xyz/login"); }} className="btn-ghost text-xs">
                            Load Example
                        </button>
                        <button onClick={() => { setText(""); setUrl(""); setResult(null); setWatchlistMessage(null); }} className="btn-ghost text-xs">
                            Clear
                        </button>
                    </div>
                </div>
            </div>

            {result && (
                <div className="space-y-4 animate-fade-in">
                    <div className="glass-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-base font-semibold text-white">Security Result</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Risk score and explanation</p>
                            </div>
                            <span className={RISK_COLORS[result.risk_level].badge}>{result.risk_level} RISK</span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-sm">
                            <div className="glass-card p-3">
                                <div className="text-xs text-slate-500">Risk Intensity</div>
                                <div className="text-lg font-bold text-white">{(result.risk_score * 100).toFixed(0)}%</div>
                            </div>
                            <div className="glass-card p-3">
                                <div className="text-xs text-slate-500">Pattern Weight</div>
                                <div className="text-lg font-bold text-primary-400">{result.heuristic_score.toFixed(0)}%</div>
                            </div>
                            <div className="glass-card p-3">
                                <div className="text-xs text-slate-500">AI Confidence</div>
                                <div className="text-lg font-bold text-accent-400">{(result.confidence * 100).toFixed(0)}%</div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-6 border-l-4 border-primary-500">
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            AI Reasoning Panel
                        </h4>
                        <div className="space-y-3">
                            {result.reasoning.map((reason, i) => (
                                <div key={i} className="flex gap-2 items-start text-sm text-slate-300">
                                    <span className="text-primary-400 mt-1">●</span>
                                    <span>{reason}</span>
                                </div>
                            ))}
                        </div>
                        {result.scam_category && (
                            <div className="mt-4 pt-4 border-t border-slate-800">
                                <div className="text-[10px] uppercase font-bold text-slate-500">Classification</div>
                                <div className="text-xs text-primary-300">{result.scam_category.replace("_", " ").toUpperCase()}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
